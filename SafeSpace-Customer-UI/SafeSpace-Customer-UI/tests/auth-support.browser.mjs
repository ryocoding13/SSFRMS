// Chạy riêng với tools/AuthSupportBrowserHost: endpoint/service .NET thật, JWT thật, SQLite riêng.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
const require = createRequire(import.meta.url);
const { chromium } = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright') : require('playwright');
const api = process.env.AUTH_SUPPORT_TEST_API;
assert.ok(api, 'Cần AUTH_SUPPORT_TEST_API từ AuthSupportBrowserHost, không dùng database thật.');
const marker = await fetch(api + '/__auth-support-test').then(r => r.json());
assert.equal(marker.testOnly, true, 'Chỉ chạy trên test host riêng.');
process.env.VITE_API_URL = api;
process.env.VITE_USE_API = 'true';
const vite = await createServer({ root: fileURLToPath(new URL('../', import.meta.url)), logLevel: 'error', server: { host: '127.0.0.1', port: 0 } });
await vite.listen();
const base = `http://127.0.0.1:${vite.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE ? { executablePath: process.env.CHROME_EXECUTABLE } : {}), args: ['--no-sandbox'] });
const errors = [];
const contexts = [];
async function pageFor() {
  const ctx = await browser.newContext(); contexts.push(ctx); const page = await ctx.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', e => errors.push(e.message)); return page;
}
async function login(page, username, password, next = 'profile') {
  await page.goto(base + '/#/login?next=' + next);
  await page.getByLabel('Tên đăng nhập hoặc Email').fill(username);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
}
async function closeDialog(page) { await page.getByRole('dialog').getByRole('button', { name: 'Đã hiểu', exact: true }).click(); }
async function fillPassword(page, current, next, confirm = next) {
  await page.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(current);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill(next);
  await page.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(confirm);
}
function pass(text) { console.log('PASS: ' + text); }
try {
  const customer = await pageFor();
  await login(customer, 'customer01', 'Customer@123');
  await customer.getByRole('heading', { name: 'Tài khoản của tôi' }).waitFor();
  assert.equal(await customer.getByLabel('Tên tài khoản (hiển thị)').inputValue(), 'customer01');
  pass('C13 tải hồ sơ từ API khi đăng nhập');

  await customer.getByLabel('Tên tài khoản (hiển thị)').fill(' ');
  await customer.getByRole('button', { name: 'Lưu tên tài khoản', exact: true }).click();
  await customer.getByText('Tên hiển thị cần từ 2 đến 100 ký tự.').waitFor();
  await customer.getByLabel('Tên tài khoản (hiển thị)').fill('  Nguyễn Gia Thắng  ');
  const nameResponse = customer.waitForResponse(r => r.url().endsWith('/api/auth/profile') && r.request().method() === 'PUT');
  await customer.getByRole('button', { name: 'Lưu tên tài khoản', exact: true }).click();
  assert.equal((await nameResponse).status(), 200);
  await customer.getByRole('heading', { name: 'Đã lưu tên', exact: true }).waitFor();
  await closeDialog(customer);
  await customer.reload();
  await customer.getByRole('heading', { name: 'Tài khoản của tôi' }).waitFor();
  assert.equal(await customer.getByLabel('Tên tài khoản (hiển thị)').inputValue(), 'Nguyễn Gia Thắng');
  pass('C13 kiểm tên rỗng, lưu tên qua PUT và giữ sau tải lại');

  await fillPassword(customer, 'Customer@123', 'NewPass@123', 'Different@123');
  await customer.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true }).click();
  await customer.getByText('Mật khẩu xác nhận chưa khớp', { exact: true }).waitFor();
  await fillPassword(customer, 'Wrong@123', 'NewPass@123');
  await customer.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true }).click();
  await customer.getByText('Mật khẩu hiện tại không chính xác.', { exact: true }).waitFor();
  assert.equal(await customer.getByLabel('Mật khẩu hiện tại', { exact: true }).getAttribute('aria-invalid'), 'true');
  pass('C13 mật khẩu xác nhận sai và mật khẩu hiện tại sai báo đúng trường, không mất phiên');

  await fillPassword(customer, 'Customer@123', 'NewPass@123');
  const passwordResponse = customer.waitForResponse(r => r.url().endsWith('/api/auth/change-password'));
  await customer.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true }).click();
  const pw = await passwordResponse;
  assert.deepEqual(pw.request().postDataJSON(), { currentPassword: 'Customer@123', newPassword: 'NewPass@123' });
  assert.equal(pw.status(), 200);
  await customer.getByRole('heading', { name: 'Đổi mật khẩu thành công', exact: true }).waitFor();
  await closeDialog(customer);
  assert.equal(await customer.getByLabel('Mật khẩu hiện tại', { exact: true }).inputValue(), '');
  await customer.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await login(customer, 'customer01', 'Customer@123');
  await customer.getByRole('alert').waitFor();
  assert.ok(customer.url().includes('/login'));
  await customer.getByLabel('Mật khẩu', { exact: true }).fill('NewPass@123');
  await customer.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await customer.getByRole('heading', { name: 'Tài khoản của tôi' }).waitFor();
  assert.equal(await customer.getByLabel('Tên tài khoản (hiển thị)').inputValue(), 'Nguyễn Gia Thắng');
  pass('C13 gửi đúng JSON, đổi mật khẩu thật; mật khẩu cũ bị từ chối, mật khẩu mới đăng nhập được');

  // Tên cũ trong local overlay không được che hồ sơ máy chủ.
  await customer.evaluate(() => localStorage.setItem('safespace.customer.overlay.1', JSON.stringify({ name: 'Tên cũ trong trình duyệt' })));
  await customer.reload();
  await customer.getByRole('heading', { name: 'Tài khoản của tôi' }).waitFor();
  assert.equal(await customer.getByLabel('Tên tài khoản (hiển thị)').inputValue(), 'Nguyễn Gia Thắng');
  pass('C13 loại bỏ tên overlay cũ và lấy lại hồ sơ máy chủ');

  // Lỗi mạng khi ghi tên: giữ nội dung để người dùng thử lại, không báo thành công.
  await customer.route('**/api/auth/profile', route => route.request().method() === 'PUT' ? route.abort() : route.continue());
  await customer.getByLabel('Tên tài khoản (hiển thị)').fill('Tên chưa lưu');
  await customer.getByRole('button', { name: 'Lưu tên tài khoản', exact: true }).click();
  await customer.locator('.field__error').waitFor();
  assert.equal(await customer.getByLabel('Tên tài khoản (hiển thị)').inputValue(), 'Tên chưa lưu');
  await customer.unroute('**/api/auth/profile');
  pass('C13 lỗi mạng giữ tên đang nhập, không báo lưu thành công');

  await customer.goto(base + '/#/support');
  await customer.getByRole('heading', { name: 'Bạn cần hỗ trợ điều gì?' }).waitFor();
  await customer.getByLabel('Chủ đề', { exact: true }).selectOption('OTHER');
  await customer.getByLabel('Mô tả vấn đề').fill('Khóa cửa K01 bị kẹt.');
  await customer.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  await customer.getByText('Vui lòng nhập chủ đề của bạn.', { exact: true }).waitFor();
  await customer.getByLabel('Chủ đề của bạn *', { exact: true }).fill('Kiểm tra khóa cửa K01');
  await customer.getByLabel('Mô tả vấn đề').fill('Khóa cửa K01 bị kẹt, nhờ nhân viên kiểm tra.');
  const createdResponse = customer.waitForResponse(r => r.url().endsWith('/api/tickets') && r.request().method() === 'POST');
  await customer.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();
  const created = await createdResponse; assert.equal(created.status(), 201);
  const dto = await created.json();
  const ticketId = dto.ticketId;
  assert.equal(dto.issueType, 'OTHER');
  assert.equal(dto.title, 'Kiểm tra khóa cửa K01');
  await customer.getByRole('heading', { name: 'Đã gửi yêu cầu hỗ trợ', exact: true }).waitFor();
  await closeDialog(customer);
  pass('C12 chủ đề Khác bắt buộc tiêu đề và gửi đúng title/issueType qua API thật');

  const staff = await pageFor();
  await login(staff, 'staff01', 'Staff@123', 'staff');
  await staff.waitForURL('**/#/staff');
  await staff.goto(base + `/#/staff/support?id=HT-${String(ticketId).padStart(4, '0')}`);
  await staff.getByRole('heading', { name: 'Cấp lại QR, PIN & chìa khóa', exact: true }).waitFor();
  await staff.getByLabel('Ghi nhận xử lý').fill('Nhân viên đã tiếp nhận và kiểm tra khóa.');
  await staff.getByLabel('Trạng thái tiếp theo').selectOption('IN_PROGRESS');
  await staff.getByRole('button', { name: 'Lưu phản hồi', exact: true }).click();
  await staff.getByRole('dialog').getByRole('button', { name: 'Quay lại', exact: true }).click();
  assert.equal(await staff.getByLabel('Ghi nhận xử lý').inputValue(), 'Nhân viên đã tiếp nhận và kiểm tra khóa.');
  await staff.getByRole('button', { name: 'Lưu phản hồi', exact: true }).click();
  await staff.getByRole('dialog').getByRole('button', { name: 'Lưu phản hồi', exact: true }).click();
  await staff.waitForURL('**/staff/done?kind=support');
  await customer.reload();
  await customer.locator('.ticket__preview').filter({ hasText: 'Nhân viên đã tiếp nhận và kiểm tra khóa.' }).waitFor();
  pass('S05 staff đúng cơ sở nhận ticket, xác nhận lưu và C12 thấy phản hồi sau tải lại');

  await staff.goto(base + `/#/staff/support?id=HT-${String(ticketId).padStart(4, '0')}`);
  await staff.getByLabel('Ghi nhận xử lý').fill('Đã sửa xong khóa, khách có thể sử dụng.');
  await staff.getByLabel('Trạng thái tiếp theo').selectOption('DONE');
  await staff.getByRole('button', { name: 'Lưu phản hồi', exact: true }).click();
  await staff.getByRole('dialog').getByRole('button', { name: 'Lưu phản hồi', exact: true }).click();
  await staff.waitForURL('**/staff/done?kind=support');
  await customer.reload();
  await customer.locator('.ticket__preview').filter({ hasText: 'Đã sửa xong khóa, khách có thể sử dụng.' }).waitFor();
  await customer.getByRole('link', { name: 'Xem chi tiết →' }).click();
  await customer.reload();
  await customer.getByText('Đã sửa xong khóa, khách có thể sử dụng.', { exact: true }).waitFor();
  await customer.getByText('Nhân viên đã tiếp nhận và kiểm tra khóa.', { exact: true }).waitFor();
  await customer.setViewportSize({ width: 390, height: 844 });
  assert.ok(await customer.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  const before = await customer.locator('.site-header').boundingBox().catch(() => null);
  await customer.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const after = await customer.locator('.site-header').boundingBox().catch(() => null);
  if (before && after) { assert.equal(after.y, before.y); assert.equal(after.height, before.height); }
  pass('C12/C12b hiển thị phản hồi mới nhất, timeline lịch sử sau reload và không tràn ngang ở mobile');

  const other = await pageFor();
  await login(other, 'customer02', 'Customer@123');
  await other.getByRole('heading', { name: 'Tài khoản của tôi' }).waitFor();
  assert.equal(await other.getByLabel('Tên tài khoản (hiển thị)').inputValue(), 'customer02');
  await other.goto(base + '/#/support');
  await other.getByText('Chưa có yêu cầu nào', { exact: true }).waitFor();
  assert.ok(!(await other.locator('main').innerText()).includes('Đã sửa xong khóa'));
  assert.deepEqual(errors, []);
  pass('Không lộ tên/phản hồi sang tài khoản khác; không có lỗi JavaScript');
} finally {
  await Promise.all(contexts.map(c => c.close()));
  await browser.close(); await vite.close();
}
