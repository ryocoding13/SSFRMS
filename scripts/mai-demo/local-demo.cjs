'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');
const { Writable } = require('node:stream');
const readline = require('node:readline/promises');

const EMAIL = 'safespace.swp391@gmail.com';
const API = 'StorageProject.Api';
const UI = 'SafeSpace-Customer-UI/SafeSpace-Customer-UI';
const ROOT = path.resolve(__dirname, '../..');

function cleanEnvironment(source = process.env) {
  const env = { ...source };
  for (const name of Object.keys(env)) {
    if (/^Smtp__/i.test(name) || /^PasswordReset__HashKey$/i.test(name) ||
        /^ConnectionStrings__DefaultConnection$/i.test(name)) delete env[name];
  }
  return { ...env, ASPNETCORE_ENVIRONMENT: 'Development' };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT, env: cleanEnvironment(), encoding: 'utf8', ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Lệnh ${command} thất bại. ${result.error?.message || result.stderr || 'Xem kết quả phía trên.'}`);
  }
  return result.stdout || '';
}

function npmCommand(command, cwd) {
  // Các lệnh ở đây là hằng số, không ghép mật khẩu hay dữ liệu nhập từ bàn phím.
  return process.platform === 'win32'
    ? ['cmd.exe', ['/d', '/s', '/c', `npm.cmd ${command}`]]
    : ['npm', command.split(' ')];
}

function parseSecrets(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const separator = line.indexOf(' = ');
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 3);
  }
  return values;
}

function getSecrets() {
  return parseSecrets(run('dotnet', ['user-secrets', 'list', '--project', API]));
}

function saveSecrets(values) {
  // Truyền qua stdin để giá trị không nằm trong lịch sử lệnh hoặc danh sách tiến trình.
  run('dotnet', ['user-secrets', 'set', '--project', API], { input: JSON.stringify(values) });
}

function quoteConnection(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function connectionString(server, database, username, password) {
  const common = `Server=${quoteConnection(server)};Database=${quoteConnection(database)};TrustServerCertificate=True;`;
  return username
    ? `${common}User ID=${quoteConnection(username)};Password=${quoteConnection(password)};`
    : `${common}Integrated Security=True;`;
}

function checkTools() {
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major < 22 || (major === 22 && minor < 12)) throw new Error('Cần Node.js từ 22.12 trở lên.');
  if (!fs.existsSync(path.join(ROOT, API, 'Endpoints/PasswordResetEndpoints.cs'))) {
    throw new Error('Repo này chưa có code quên mật khẩu email. Lấy đúng nhánh/PR của Ngọc Mai trước.');
  }
  const sdks = run('dotnet', ['--list-sdks']);
  if (!/^10\./m.test(sdks)) throw new Error('Chưa có .NET SDK 10. Cài SDK rồi mở lại terminal.');
}

function makePrompt() {
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!output.muted) process.stdout.write(chunk);
      callback();
    },
  });
  const input = readline.createInterface({ input: process.stdin, output, terminal: !!process.stdin.isTTY });
  input.on('SIGINT', () => { input.close(); process.exit(130); });
  return {
    async ask(question, secret = false) {
      if (secret && !process.stdin.isTTY) throw new Error('Nhập mật khẩu trong terminal tương tác của VS Code.');
      const answer = input.question(question);
      output.muted = secret;
      try { return await answer; }
      finally { output.muted = false; if (secret) process.stdout.write('\n'); }
    },
    close() { input.close(); },
  };
}

function tcpAvailable(host, port, timeout = 10000) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port });
    let finished = false;
    const done = success => { if (!finished) { finished = true; socket.destroy(); resolve(success); } };
    socket.setTimeout(timeout, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

async function setup(flags) {
  checkTools();
  run('dotnet', ['user-secrets', 'init', '--project', API]);
  const existing = getSecrets();
  const settings = {
    'Smtp:Host': 'smtp.gmail.com', 'Smtp:Port': '587', 'Smtp:Security': 'StartTls',
    'Smtp:Username': EMAIL, 'Smtp:FromEmail': EMAIL,
  };
  const prompt = makePrompt();
  try {
    if (!existing['ConnectionStrings:DefaultConnection'] || flags.includes('--sql')) {
      console.log('Nhập Server giống ô Server name trong SSMS. MSSQLSERVER thường dùng localhost; SQLEXPRESS dùng .\\SQLEXPRESS.');
      const server = (await prompt.ask('SQL Server [localhost]: ')).trim() || 'localhost';
      const database = (await prompt.ask('Database [SSFRMS]: ')).trim() || 'SSFRMS';
      const username = (await prompt.ask('SQL username [Enter = Windows Authentication]: ')).trim();
      const password = username ? await prompt.ask('Mật khẩu SQL (ẩn): ', true) : '';
      settings['ConnectionStrings:DefaultConnection'] = connectionString(server, database, username, password);
    }
    if (!existing['Smtp:Password'] || flags.includes('--mail')) {
      console.log(`Dùng mật khẩu ứng dụng của ${EMAIL}; không dùng mật khẩu đăng nhập Gmail.`);
      let password;
      do {
        password = (await prompt.ask('Mật khẩu ứng dụng Gmail 16 ký tự (ẩn): ', true)).replace(/\s/g, '');
        if (password.length !== 16) console.log('Chưa đủ đúng 16 ký tự. Hãy nhập lại.');
      } while (password.length !== 16);
      settings['Smtp:Password'] = password;
    }
    if (!existing['PasswordReset:HashKey']) {
      settings['PasswordReset:HashKey'] = crypto.randomBytes(32).toString('base64');
    } else if (existing['PasswordReset:HashKey'].length < 32) {
      throw new Error('HashKey hiện có quá ngắn; giữ nguyên dữ liệu và dừng để kiểm tra cấu hình.');
    }
    saveSecrets(settings);
  } finally { prompt.close(); }

  console.log('Đã lưu cấu hình riêng trên máy. Các giá trị đã có được giữ lại.');
  if (!await tcpAvailable('smtp.gmail.com', 587)) {
    throw new Error('Không kết nối được smtp.gmail.com:587. Cấu hình đã lưu; kiểm tra Internet/firewall rồi chạy setup lại.');
  }
  run('dotnet', ['restore', 'StorageProject.slnx'], { stdio: 'inherit' });
  run('dotnet', ['build', API, '--no-restore'], { stdio: 'inherit' });
  run(...npmCommand('ci', path.join(ROOT, UI)), { stdio: 'inherit', cwd: path.join(ROOT, UI) });
  run(...npmCommand('run check:structure', path.join(ROOT, UI)), { stdio: 'inherit', cwd: path.join(ROOT, UI) });
  run(...npmCommand('run build', path.join(ROOT, UI)), { stdio: 'inherit', cwd: path.join(ROOT, UI) });
  console.log('Cài đặt xong. Chạy: node scripts/mai-demo/local-demo.cjs start');
  console.log('SMTP TCP đã thông; cần nhận mã thật và đổi mật khẩu để xác nhận Gmail/SQL thực tế.');
}

function portFree(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`Cổng ${port} đang dùng. Dừng phiên demo cũ bằng Ctrl+C.`)));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve()));
  });
}

async function waitReady(url, alive, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!alive()) throw new Error('Backend đã dừng. Xem lỗi SQL/cấu hình ở terminal phía trên.');
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.status === 200) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Backend chưa ready sau 90 giây. Kiểm tra SQL Server, quyền DB và migration; không xóa/reset database.');
}

async function start() {
  checkTools();
  const secrets = getSecrets();
  for (const key of ['ConnectionStrings:DefaultConnection', 'Smtp:Password', 'PasswordReset:HashKey']) {
    if (!secrets[key]) throw new Error(`Thiếu cấu hình ${key}. Chạy setup một lần trước.`);
  }
  if (!fs.existsSync(path.join(ROOT, UI, 'node_modules/.bin/vite' + (process.platform === 'win32' ? '.cmd' : '')))) {
    throw new Error('Chưa cài frontend. Chạy setup trước.');
  }
  await portFree(5151);
  await portFree(5173);
  const env = {
    ...cleanEnvironment(), VITE_USE_API: 'true', VITE_API_URL: 'http://localhost:5151', VITE_WORKFLOW_DEMO: 'false',
  };
  const owned = [];
  let stopping = false;
  function cleanup() {
    if (stopping) return;
    stopping = true;
    for (const child of [...owned].reverse()) {
      if (!child.pid || child.exitCode !== null || child.signalCode !== null) continue;
      if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      else child.kill('SIGTERM');
    }
  }
  process.once('SIGINT', () => { cleanup(); process.exit(130); });
  process.once('SIGTERM', () => { cleanup(); process.exit(143); });
  try {
    console.log('Đang chạy backend và kiểm tra SQL/migration...');
    const backend = spawn('dotnet', ['run', '--project', API, '--launch-profile', 'http'], { cwd: ROOT, env, stdio: 'inherit' });
    owned.push(backend);
    let spawnError;
    backend.once('error', error => { spawnError = error; });
    await waitReady('http://localhost:5151/health/ready', () => !spawnError && backend.exitCode === null && backend.signalCode === null);
    console.log('Backend đã ready. Mở trang Quên mật khẩu; Ctrl+C để dừng cả hai.');
    const [command, args] = npmCommand('run dev -- --host 127.0.0.1 --port 5173 --strictPort --open /#/reset-password', path.join(ROOT, UI));
    const frontend = spawn(command, args, { cwd: path.join(ROOT, UI), env, stdio: 'inherit' });
    owned.push(frontend);
    await new Promise((resolve, reject) => {
      frontend.once('error', reject);
      frontend.once('exit', code => code === 0 ? resolve() : reject(new Error(`Frontend đã dừng (mã ${code}).`)));
      backend.once('exit', () => { if (!stopping) reject(new Error('Backend đã dừng trong lúc demo.')); });
    });
  } finally { cleanup(); }
}

if (require.main === module) {
  const [command, ...flags] = process.argv.slice(2);
  Promise.resolve().then(() => {
    if (command === 'setup') return setup(flags);
    if (command === 'start') return start();
    throw new Error('Dùng: node scripts/mai-demo/local-demo.cjs setup | start. Thêm --sql hoặc --mail sau setup để đổi riêng phần đó.');
  }).catch(error => { console.error(`\n${error.message}`); process.exitCode = 1; });
}

module.exports = { cleanEnvironment, parseSecrets, connectionString, tcpAvailable, waitReady, portFree };
