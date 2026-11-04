import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { once } from 'node:events';

const repo = resolve('../..');
const host = spawn(process.env.DOTNET_EXECUTABLE || 'dotnet', [resolve(repo, 'tools/PasswordResetBrowserHost/bin/Debug/net10.0/PasswordResetBrowserHost.dll')], { cwd: repo, stdio: ['pipe', 'pipe', 'inherit'] });
const lines = createInterface({ input: host.stdout });
const output = [];
lines.on('line', line => output.push(line));
const waitLine = async prefix => {
  for (let i = 0; i < 200; i++) {
    const index = output.findIndex(line => line.startsWith(prefix));
    if (index >= 0) return output.splice(index, 1)[0].slice(prefix.length);
    if (host.exitCode !== null) throw new Error('Backend kiểm thử đã dừng. Build tools/PasswordResetBrowserHost trước.');
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Hết thời gian chờ backend kiểm thử.');
};
let browser, vite;
try {
  const api = await waitLine('PASSWORD_RESET_TEST_API=');
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5178', '--strictPort'], {
    env: { ...process.env, VITE_USE_API: 'true', VITE_API_URL: api }, stdio: 'ignore'
  });
  for (let i = 0; i < 100; i++) { try { await fetch('http://127.0.0.1:5178'); break; } catch { await new Promise(r => setTimeout(r, 100)); } }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  let requests = 0;
  page.on('request', r => { if (r.url().endsWith('/password-reset/request')) requests++; });
  await page.goto('http://127.0.0.1:5178/#/reset-password');
  await page.getByLabel('Email đã đăng ký').fill('customer@example.com');
  await page.getByRole('button', { name: 'Gửi mã xác nhận', exact: true }).evaluate(button => { button.click(); button.click(); });
  await page.getByLabel('Mã xác nhận').waitFor();
  assert.equal(requests, 1, 'Chặn gửi trùng trong một lần thao tác');
  assert.equal(await page.getByRole('button', { name: /Gửi lại mã sau/ }).isDisabled(), true);
  host.stdin.write('code\n'); const code = await waitLine('TEST_CODE=');
  assert.match(code, /^\d{6}$/);
  assert.equal(await page.getByText(/Mã thử nghiệm/).count(), 0, 'API thật không hiện OTP trên màn hình');
  await page.getByLabel('Mã xác nhận').fill(code === '000000' ? '111111' : '000000');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewCustomer@123');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('NewCustomer@123');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByText(/Mã xác nhận không hợp lệ hoặc đã hết hạn/).waitFor();
  assert.equal(await page.getByLabel('Mật khẩu mới', { exact: true }).inputValue(), 'NewCustomer@123');
  await page.getByLabel('Mã xác nhận').fill(code);
  await page.screenshot({ path: process.env.RESET_QA_DIR ? `${process.env.RESET_QA_DIR}/reset-desktop.png` : '/tmp/reset-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: process.env.RESET_QA_DIR ? `${process.env.RESET_QA_DIR}/reset-mobile.png` : '/tmp/reset-mobile.png', fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByRole('heading', { name: 'Đã đặt lại mật khẩu' }).waitFor();
  const reused = await fetch(`${api}/api/auth/password-reset/confirm`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'customer@example.com', code, newPassword: 'OtherPass@123' }) });
  assert.equal(reused.status, 400);
  const oldLogin = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'resetcustomer', password: 'Customer@123' }) });
  assert.equal(oldLogin.status, 401);
  const newLogin = await fetch(`${api}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'customer@example.com', password: 'NewCustomer@123' }) });
  assert.equal(newLogin.status, 200);
  await page.goto('http://127.0.0.1:5178/#/reset-password');
  await page.reload();
  await page.getByLabel('Email đã đăng ký').fill('customer@example.com');
  host.stdin.write('mail-fail\n');
  await page.getByRole('button', { name: 'Gửi mã xác nhận', exact: true }).click();
  await page.getByText(/Chưa gửi được mã xác nhận/).waitFor();
  assert.equal(await page.getByLabel('Email đã đăng ký').inputValue(), 'customer@example.com');
  assert.equal(await page.getByLabel('Mã xác nhận').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: FE + Kestrel/JWT/SQLite; gửi trùng, countdown, OTP sai/đúng/dùng lại, mật khẩu cũ/mới, lỗi gửi mail giữ form, desktop/mobile không tràn. Mailbox test; thư SMTP được kiểm riêng.');
} finally {
  await browser?.close(); vite?.kill('SIGTERM'); host.stdin.end('stop\n');
  await Promise.race([once(host, 'exit'), new Promise(r => setTimeout(r, 3000))]); host.kill('SIGTERM');
}
