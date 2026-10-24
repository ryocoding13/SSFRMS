// Kiểm tra thao tác React thực tế bằng Chromium; API giả lập theo DTO của backend C13/S05/C12.
// Kiểm tra SQL Server thật nằm trong docs/frontend-auth-support.md.
import { test, expect } from "@playwright/test";

async function setup(page) {
  const users = {
    customer01: { userId: 3, username: "customer01", fullName: "Nguyễn Văn An", email: "an@example.com", phone: "0901234567", status: "ACTIVE", roles: ["CUSTOMER"] },
    customer02: { userId: 4, username: "customer02", fullName: "Trần Thị Bình", email: "binh@example.com", phone: null, status: "ACTIVE", roles: ["CUSTOMER"] },
    staff01: { userId: 8, username: "staff01", fullName: "Nhân viên Tân Bình", email: "staff@example.com", phone: null, status: "ACTIVE", roles: ["STAFF"] },
  };
  const passwords = { customer01: "Customer@123", customer02: "Customer@123", staff01: "Staff@123" };
  const tokens = Object.fromEntries(Object.values(users).map((u) => [u.username, `test.${Buffer.from(JSON.stringify({ roles: u.roles })).toString("base64url")}.${u.username}`]));
  const state = { users, passwords, calls: [], replies: [], detailStatus: 200, saveStatus: 200, delay: 0 };
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  state.errors = errors;
  const ticket = () => ({ ticketId: 5, contractId: 1, issueType: "ACCESS_CARD", title: "Lỗi thẻ ra vào", description: "Nhờ kiểm tra thẻ", status: state.replies.length ? "RESOLVED" : "OPEN", createdAt: "2026-10-21T07:00:00", priority: "NORMAL" });
  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const method = req.method();
    const body = req.postDataJSON();
    const username = Object.keys(tokens).find((key) => req.headers().authorization === `Bearer ${tokens[key]}`);
    const user = users[username];
    state.calls.push({ method, path, body, username });
    const send = (data, status = 200) => route.fulfill({ status, json: data });
    if (["/api/facilities", "/api/unit-types", "/api/rates"].includes(path)) return send([]);
    if (path === "/api/auth/login") {
      if (!users[body.username] || passwords[body.username] !== body.password) return send({}, 401);
      return send({ token: tokens[body.username], expiresAt: "2099-01-01T00:00:00Z", user: users[body.username] });
    }
    if (!user) return send({}, 401);
    if (path === "/api/auth/logout") return send({});
    if (path === "/api/auth/profile" && method === "GET") return send(user);
    if (path === "/api/auth/profile" && method === "PUT") {
      if (state.profileGate) await state.profileGate;
      if (state.delay) await new Promise((resolve) => setTimeout(resolve, state.delay));
      if (state.saveStatus !== 200) return send({ error: "Không lưu được hồ sơ." }, state.saveStatus);
      user.fullName = body.fullName;
      if (body.phone !== undefined) user.phone = body.phone;
      return send(user);
    }
    if (path === "/api/auth/change-password") {
      if (body.currentPassword !== passwords[username]) return send({ error: "Mật khẩu hiện tại không đúng." }, 400);
      if (!body.newPassword || body.newPassword.length < 8) return send({ error: "Mật khẩu mới cần ít nhất 8 ký tự." }, 400);
      passwords[username] = body.newPassword;
      return send({ message: "Đã đổi mật khẩu." });
    }
    if (path === "/api/reservations" || path === "/api/contracts") return send([]);
    if (path === "/api/tickets") return send(username === "customer01" ? [ticket()] : []);
    if (path === "/api/tickets/5") return send({ ...ticket(), responses: state.replies }, state.detailStatus);
    if (path === "/api/ops/board") return send({
      facility: { id: "TB", name: "SafeSpace Tân Bình" },
      me: { staffId: "NV-08", fullName: users.staff01.fullName },
      staff: [{ staffId: "NV-08", fullName: users.staff01.fullName }],
      tickets: [{ id: "HT-0005", unit: "TB-M-103", customer: users.customer01.fullName, title: ticket().title, createdAt: ticket().createdAt, schedule: ticket().createdAt, status: state.replies.length ? "WAITING_CUSTOMER" : "OPEN", assignee: "NV-08", notes: [{ staff: users.customer01.fullName, text: ticket().description, at: ticket().createdAt }] }],
      payments: null, allocations: null, verifications: null, handovers: null, returns: null,
      renewals: null, contracts: null, assignments: null, units: null, revenue: null,
    });
    if (path === "/api/ops/tickets/HT-0005/responses") {
      state.replies.push({ message: body.note, staffName: user.fullName, createdAt: "2026-10-21T08:00:00" });
      return send({});
    }
    return send({ error: `Unexpected ${method} ${path}` }, 404);
  });
  return state;
}

async function login(page, username = "customer01", password = "Customer@123", spa = false) {
  if (spa) await page.evaluate(() => { location.hash = "/login?next=profile"; });
  else await page.goto("/#/login?next=profile");
  await page.getByLabel("Tên đăng nhập hoặc Email", { exact: true }).fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  const response = page.waitForResponse((res) => new URL(res.url()).pathname === "/api/auth/login" && res.request().method() === "POST");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  if ((await response).ok()) {
    if (username === "staff01") await expect(page.locator(".usermenu__btn")).toBeVisible();
    else await expect(page.getByRole("heading", { name: "Tài khoản của tôi" })).toBeVisible();
  } else await expect(page.getByText("Tên đăng nhập / email hoặc mật khẩu chưa đúng.")).toBeVisible();
}

async function fillPassword(page, current, next, confirm = next) {
  await page.getByLabel("Mật khẩu hiện tại", { exact: true }).fill(current);
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(next);
  await page.getByLabel("Xác nhận mật khẩu mới", { exact: true }).fill(confirm);
}

test("C13: lưu tên đã trim, giữ số điện thoại và đúng tài khoản sau F5", async ({ page }, testInfo) => {
  const state = await setup(page);
  await login(page);
  await page.getByLabel("Tên tài khoản (hiển thị)").fill("  An cập nhật  ");
  await page.getByRole("button", { name: "Lưu tên tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Đã lưu tên" })).toBeVisible();
  expect(state.users.customer01.fullName).toBe("An cập nhật");
  expect(state.users.customer01.phone).toBe("0901234567");
  await page.reload();
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("An cập nhật");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("safespace.customer.session")).user.userId)).toBe(3);
  expect(state.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("profile.png"), fullPage: true });
});

test("C13: tên từ API thay tên overlay cũ; khách khác không bị đổi tên", async ({ page }) => {
  const state = await setup(page);
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("safespace.customer.overlay.3", JSON.stringify({ name: "Tên nhân viên cũ" })));
  await login(page);
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("Nguyễn Văn An");
  await page.getByLabel("Tên tài khoản (hiển thị)").fill("An mới");
  await page.getByRole("button", { name: "Lưu tên tài khoản" }).click();
  await expect(page.getByRole("heading", { name: "Đã lưu tên" })).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await login(page, "customer02");
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("Trần Thị Bình");
  expect(state.users.customer02.fullName).toBe("Trần Thị Bình");
});

test("C13: tên trống bị chặn; lỗi lưu không đổi tên trong phiên", async ({ page }) => {
  const state = await setup(page);
  await login(page);
  await page.getByLabel("Tên tài khoản (hiển thị)").fill(" ");
  await page.getByRole("button", { name: "Lưu tên tài khoản" }).click();
  await expect(page.getByText("Tên hiển thị cần từ 2 đến 100 ký tự.")).toBeVisible();
  expect(state.calls.filter((x) => x.method === "PUT")).toHaveLength(0);
  state.saveStatus = 500;
  await page.getByLabel("Tên tài khoản (hiển thị)").fill("Chưa lưu");
  await page.getByRole("button", { name: "Lưu tên tài khoản" }).click();
  await expect(page.getByText("Không lưu được hồ sơ.")).toBeVisible();
  expect(state.users.customer01.fullName).toBe("Nguyễn Văn An");
  await page.reload();
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("Nguyễn Văn An");
});

test("C13: chặn bấm lưu lặp trong khi chờ máy chủ", async ({ page }) => {
  const state = await setup(page);
  state.delay = 600;
  await login(page);
  await page.getByLabel("Tên tài khoản (hiển thị)").fill("An đang lưu");
  await page.getByRole("button", { name: "Lưu tên tài khoản" }).click();
  await expect(page.getByRole("button", { name: "Đang lưu…" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Đã lưu tên" })).toBeVisible();
  expect(state.calls.filter((x) => x.method === "PUT")).toHaveLength(1);
});

test("C13: sai mật khẩu hiện tại hiện dưới ô đúng, giữ phiên đăng nhập", async ({ page }) => {
  const state = await setup(page);
  await login(page);
  await fillPassword(page, "Wrong@123", "NewPass@123");
  await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page.getByLabel("Mật khẩu hiện tại", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();
  expect(state.passwords.customer01).toBe("Customer@123");
  expect(await page.evaluate(() => !!localStorage.getItem("safespace.customer.session"))).toBe(true);
});

test("C13: xác nhận không khớp bị chặn trước API", async ({ page }, testInfo) => {
  const state = await setup(page);
  await login(page);
  await fillPassword(page, "Customer@123", "NewPass@123", "Other@123");
  await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page.getByText("Mật khẩu xác nhận chưa khớp", { exact: true })).toBeVisible();
  expect(state.calls.filter((x) => x.path.endsWith("change-password"))).toHaveLength(0);
  await page.screenshot({ path: testInfo.outputPath("profile-mismatch.png"), fullPage: true });
});

test("C13: đổi mật khẩu, đăng nhập mới đạt và mật khẩu cũ bị từ chối", async ({ page }) => {
  const state = await setup(page);
  await login(page);
  await fillPassword(page, "Customer@123", "NewPass@123");
  await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page.getByRole("heading", { name: "Đổi mật khẩu thành công" })).toBeVisible();
  expect(state.calls.find((x) => x.path.endsWith("change-password")).body).toEqual({ currentPassword: "Customer@123", newPassword: "NewPass@123" });
  await page.getByRole("button", { name: "Đã hiểu", exact: true }).click();
  await expect(page.getByLabel("Mật khẩu hiện tại", { exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await login(page);
  await expect(page.getByText("Tên đăng nhập / email hoặc mật khẩu chưa đúng.")).toBeVisible();
  await login(page, "customer01", "NewPass@123");
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("Nguyễn Văn An");
  expect(state.errors).toEqual([]);
});

test("C12: nhiều phản hồi có nội dung, nhân viên, lịch sử và giữ sau F5", async ({ page }, testInfo) => {
  const state = await setup(page);
  state.replies = [
    { message: "Đang kiểm tra thẻ", staffName: "Nhân viên Tân Bình", createdAt: "2026-10-21T08:00:00" },
    { message: "Đã cấp lại thẻ", staffName: "Nhân viên Tân Bình", createdAt: "2026-10-21T09:00:00" },
  ];
  await login(page);
  await page.goto("/#/support");
  await expect(page.locator(".ticket__preview")).toContainText("Đã cấp lại thẻ");
  await page.screenshot({ path: testInfo.outputPath("support-list.png"), fullPage: true });
  await page.getByRole("link", { name: "Xem chi tiết →" }).click();
  await expect(page.getByRole("heading", { name: "HT-0005 · Lỗi thẻ ra vào" })).toBeVisible();
  await expect(page.getByText("Đã cấp lại thẻ", { exact: true })).toBeVisible();
  await expect(page.getByText("Đang kiểm tra thẻ", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Đã cấp lại thẻ", { exact: true })).toBeVisible();
  expect(state.calls.some((x) => x.path === "/api/tickets/5")).toBe(true);
  expect(state.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("support.png"), fullPage: true });
});

test("C12: lỗi tải chi tiết báo rõ, cập nhật lại lấy được phản hồi", async ({ page }) => {
  const state = await setup(page);
  state.detailStatus = 500;
  await login(page);
  await page.goto("/#/support");
  await expect(page.getByText("Chưa tải được phản hồi. Vui lòng cập nhật lại yêu cầu.")).toBeVisible();
  state.detailStatus = 200;
  state.replies.push({ message: "Phản hồi sau khi tải lại", staffName: "Nhân viên Tân Bình", createdAt: "2026-10-21T09:00:00" });
  await page.getByRole("button", { name: "Cập nhật yêu cầu" }).click();
  await expect(page.locator(".ticket__preview")).toContainText("Phản hồi sau khi tải lại");
  await expect(page.getByText("Chưa tải được phản hồi. Vui lòng cập nhật lại yêu cầu.")).toHaveCount(0);
});

test("S05 → C12: nhân viên gửi phản hồi, khách đọc lại trên cùng API", async ({ page }) => {
  const state = await setup(page);
  await login(page, "staff01", "Staff@123");
  await page.goto("/#/staff/support?id=HT-0005");
  await page.getByLabel("Ghi nhận xử lý").fill("Đã thay thẻ mới cho khách");
  await page.getByRole("button", { name: "Lưu phản hồi" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lưu phản hồi", exact: true }).click();
  await expect(page).toHaveURL(/staff\/done/);
  expect(state.replies[0].message).toBe("Đã thay thẻ mới cho khách");
  // Đăng xuất qua giao diện nhân viên rồi đăng nhập khách, không thay phiên bằng mã thử nghiệm.
  await page.locator(".usermenu__btn").click();
  await page.getByRole("menuitem", { name: "Đăng xuất" }).click();
  await login(page);
  await page.goto("/#/support");
  await expect(page.locator(".ticket__preview")).toContainText("Đã thay thẻ mới cho khách");
  await page.getByRole("link", { name: "Xem chi tiết →" }).click();
  await page.reload();
  await expect(page.getByText("Đã thay thẻ mới cho khách", { exact: true })).toBeVisible();
  await page.goto("/#/profile");
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("Nguyễn Văn An");
  expect(state.errors).toEqual([]);
});

test("C12/C13: màn hình hẹp không tràn ngang", async ({ page }, testInfo) => {
  const state = await setup(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("profile-mobile.png"), fullPage: true });
  await page.goto("/#/support");
  await expect(page.getByRole("heading", { name: "Bạn cần hỗ trợ điều gì?" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(state.errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("support-mobile.png"), fullPage: true });
});

test("C12: chi tiết trả 401 kết thúc phiên thay vì che lỗi bằng danh sách rỗng", async ({ page }) => {
  const state = await setup(page);
  await login(page);
  await page.goto("/#/support");
  await expect(page.getByRole("heading", { name: "Bạn cần hỗ trợ điều gì?" })).toBeVisible();
  state.detailStatus = 401;
  await page.getByRole("button", { name: "Cập nhật yêu cầu" }).click();
  await expect(page.getByRole("heading", { name: "Đăng nhập", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("safespace.customer.session"))).toBe(null);
});

test("C13: phản hồi lưu trễ không thay phiên của khách đăng nhập sau", async ({ page }) => {
  const state = await setup(page);
  let release;
  state.profileGate = new Promise((resolve) => { release = resolve; });
  await login(page);
  await page.getByLabel("Tên tài khoản (hiển thị)").fill("An lưu trễ");
  const saved = page.waitForResponse((res) => res.request().method() === "PUT" && new URL(res.url()).pathname === "/api/auth/profile");
  const requested = page.waitForRequest((req) => req.method() === "PUT" && new URL(req.url()).pathname === "/api/auth/profile");
  await page.getByRole("button", { name: "Lưu tên tài khoản" }).click();
  await requested;
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await login(page, "customer02", "Customer@123", true);
  release();
  await saved;
  await expect(page.getByLabel("Tên tài khoản (hiển thị)")).toHaveValue("Trần Thị Bình");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("safespace.customer.session")).user.userId)).toBe(4);
});

test("Figma C13d/C12b: trạng thái thiếu thông tin và các icon nguyên bản tải được", async ({ page }, testInfo) => {
  const state = await setup(page);
  await login(page);
  await page.getByRole("button", { name: "Cập nhật mật khẩu" }).click();
  await expect(page.getByText("Bạn chưa nhập đủ thông tin", { exact: true })).toBeVisible();
  for (const label of ["Mật khẩu hiện tại", "Mật khẩu mới", "Xác nhận mật khẩu mới"]) await expect(page.getByLabel(label, { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.screenshot({ path: testInfo.outputPath("profile-missing.png"), fullPage: true });
  expect(await page.locator(".brand img").evaluate((img) => [img.naturalWidth, img.naturalHeight])).toEqual([36, 36]);
  expect(await page.locator(".bell img").evaluate((img) => [img.naturalWidth, img.naturalHeight])).toEqual([44, 44]);
  await expect(page.locator(".brand img")).toHaveCSS("width", "36px");
  await expect(page.locator(".bell img")).toHaveCSS("width", "44px");
  state.replies.push({ message: "Đã xử lý thẻ ra vào", staffName: "Nhân viên Tân Bình", createdAt: "2026-10-21T09:00:00" });
  await page.goto("/#/support/HT-0005");
  await page.reload();
  await expect(page.getByText("Đã xử lý thẻ ra vào", { exact: true })).toBeVisible();
  await expect.poll(() => page.locator(".support-step__marker img").evaluateAll((imgs) => imgs.every((img) => img.complete && img.naturalWidth === 14 && img.naturalHeight === 17))).toBe(true);
  await expect(page.locator(".support-step__marker img").first()).toHaveCSS("width", "14px");
  await expect(page.locator(".support-step__marker img").first()).toHaveCSS("height", "17px");
  expect(state.errors).toEqual([]);
});
