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
  await page.getByLabel('Email đã đăng ký').fill('an.nguyen@example.com');
  await page.getByRole('button', { name: 'Gửi mã xác nhận', exact: true }).click();
  await page.getByLabel('Mã xác nhận').fill('000000');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewCustomer@123');
  await page.getByLabel('Nhập lại mật khẩu mới').fill('NewCustomer@123');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByText('Mã xác nhận không hợp lệ hoặc đã hết hạn.', { exact: true }).waitFor();
  await page.getByLabel('Mã xác nhận').fill('123456');
  await page.getByRole('button', { name: 'Đặt lại mật khẩu', exact: true }).click();
  await page.getByRole('heading', { name: 'Đã đặt lại mật khẩu' }).waitFor();
  await page.getByRole('link', { name: 'Về đăng nhập', exact: true }).click();
  await page.locator('input').first().fill('customer01');
  await page.locator('input[type=password]').fill('NewCustomer@123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForFunction(() => !location.hash.includes('/login'));
  assert.deepEqual(errors, []);
  console.log('PASS: sai OTP giữ form; đúng OTP đổi mật khẩu; đăng nhập bằng mật khẩu mới; không lỗi runtime.');
} finally { await browser?.close(); server.kill('SIGTERM'); }
