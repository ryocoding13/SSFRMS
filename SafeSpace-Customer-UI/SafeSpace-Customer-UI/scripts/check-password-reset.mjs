import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const server = spawn(process.execPath, ['scripts/dev-demo.mjs'], { stdio: 'ignore' });
process.on('exit', () => server.kill('SIGTERM'));
let browser;
try {
  for (let i = 0; i < 100; i++) { try { await fetch('http://127.0.0.1:5173'); break; } catch { await new Promise(r => setTimeout(r, 150)); } }
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:5173/#/reset-password');
  // Bước 1: lỗi trống và sai định dạng tách riêng
  await page.getByRole('button', { name: 'Gửi mã xác nhận', exact: true }).click();
  await page.getByText('Vui lòng nhập email.', { exact: true }).waitFor();
  await page.getByLabel('Email *').fill('an.nguyen@example');
  await page.getByRole('button', { name: 'Gửi mã xác nhận', exact: true }).click();
  await page.getByText('Email chưa đúng định dạng, ví dụ: ten@gmail.com.', { exact: true }).waitFor();
  await page.getByLabel('Email *').fill('an.nguyen@example.com');
  await page.getByRole('button', { name: 'Gửi mã xác nhận', exact: true }).click();
  // Bước 2: 6 ô mã
  await page.getByRole('heading', { name: 'Nhập mã xác nhận' }).waitFor();
  await page.getByLabel('Số thứ 1 của mã xác nhận').fill('000000');
  assert.equal(await page.getByLabel('Số thứ 6 của mã xác nhận').inputValue(), '0');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  // Bước 3: mật khẩu mới
  await page.getByLabel('Mật khẩu mới *', { exact: true }).fill('NewCustomer@123');
  await page.getByLabel('Nhập lại mật khẩu mới *').fill('NewCustomer@12');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByText('Mật khẩu nhập lại chưa khớp.', { exact: true }).waitFor();
  await page.getByLabel('Nhập lại mật khẩu mới *').fill('NewCustomer@123');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  // Mã sai → quay về bước 2, giữ mật khẩu
  await page.getByText(/Mã chưa đúng hoặc đã hết hạn/).waitFor();
  await page.getByLabel('Số thứ 1 của mã xác nhận').fill('123456');
  await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click();
  assert.equal(await page.getByLabel('Mật khẩu mới *', { exact: true }).inputValue(), 'NewCustomer@123');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByRole('heading', { name: 'Đã đặt lại mật khẩu' }).waitFor();
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).last().click();
  await page.locator('input').first().fill('customer01');
  await page.locator('input[type=password]').fill('NewCustomer@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForFunction(() => !location.hash.includes('/login'));
  assert.deepEqual(errors, []);
  console.log('PASS: 3 bước; lỗi trống/sai định dạng tách riêng; 6 ô mã; mật khẩu không khớp; mã sai quay lại bước 2 giữ mật khẩu; đăng nhập bằng mật khẩu mới.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
