// Máy chủ API giả lập theo đúng StorageProject.Api (endpoint, JSON camelCase, luật kiểm tra, dữ liệu DbSeeder).
// Dùng để chạy / kiểm thử giao diện khi máy chưa có .NET và SQL Server:  npm run dev:mock
// Dữ liệu nằm trong bộ nhớ, tắt là mất. Không thay thế backend thật.
import http from "node:http";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => d.toISOString(); // DateTime.UtcNow trả về khi vừa tạo: có "Z"
const dbTime = (d) => d.toISOString().replace("Z", "").replace(/\.\d+$/, ""); // đọc lại từ DB: không có "Z"
const dateOnly = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addMonths = (s, m) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + m);
  return dateOnly(d);
};
const days = (n) => new Date(Date.now() + n * 86400000);

export function createState() {
  const users = [
    { userId: 1, username: "admin", email: "admin@storage.vn", password: "Admin@123", fullName: "Hệ Thống Admin", status: "ACTIVE" },
    { userId: 2, username: "staff01", email: "staff01@storage.vn", password: "Staff@123", fullName: "Trần Nhân Viên", status: "ACTIVE" },
    { userId: 3, username: "customer01", email: "an.nguyen@example.com", password: "Customer@123", fullName: "Nguyễn Văn An", status: "ACTIVE" },
    { userId: 4, username: "customer02", email: "mai.tran@example.com", password: "Customer@123", fullName: "Trần Thị Mai", status: "ACTIVE" },
  ];
  // Theo DbSeeder: 2 cơ sở ban đầu (đã đổi tên SafeSpace) + 10 cơ sở mạng lưới SafeSpace (bước 7b)
  const NETWORK = [
    ["NLB", "SafeSpace Nguyễn Lương Bằng", "12 Nguyễn Lương Bằng, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh", "02837001012", 1150000, true],
    ["HL", "SafeSpace Him Lam", "Khu dân cư Him Lam, Phường Tân Hưng, Quận 7, TP. Hồ Chí Minh", "02837001013", 1050000, false],
    ["PX", "SafeSpace Phú Xuân", "Đường Nguyễn Hữu Thọ, Xã Phú Xuân, Huyện Nhà Bè, TP. Hồ Chí Minh", "02837001014", 890000, false],
    ["TT", "SafeSpace Tân Thuận", "Đường Huỳnh Tấn Phát, Phường Tân Thuận Đông, Quận 7, TP. Hồ Chí Minh", "02837001015", 1100000, true],
    ["PMH", "SafeSpace Phú Mỹ Hưng", "Đường Nguyễn Văn Linh, Phường Tân Phong, Quận 7, TP. Hồ Chí Minh", "02837001016", 1250000, true],
    ["BT", "SafeSpace Bình Thạnh", "Đường Nguyễn Xí, Phường 26, Quận Bình Thạnh, TP. Hồ Chí Minh", "02837001017", 980000, false],
    ["NB", "SafeSpace Nhà Bè", "Đường Huỳnh Tấn Phát, Thị trấn Nhà Bè, Huyện Nhà Bè, TP. Hồ Chí Minh", "02837001018", 850000, false],
    ["BC", "SafeSpace Bình Chánh", "Quốc lộ 50, Xã Bình Hưng, Huyện Bình Chánh, TP. Hồ Chí Minh", "02837001019", 790000, true],
    ["TD", "SafeSpace Thủ Đức", "Đường Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh", "02837001020", 920000, false],
    ["GV", "SafeSpace Gò Vấp", "Đường Quang Trung, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh", "02837001021", 930000, false],
  ];
  const facilities = [
    { facilityId: 1, name: "SafeSpace Tân Bình", address: "123 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh", contactPhone: "02838112233", openingTime: "07:00", closingTime: "22:00", status: "ACTIVE" },
    { facilityId: 2, name: "SafeSpace Quận 7", address: "456 Nguyễn Thị Thập, Phường Tân Quy, Quận 7, TP. Hồ Chí Minh", contactPhone: "02837778899", openingTime: "06:00", closingTime: "23:00", status: "ACTIVE" },
    ...NETWORK.map(([, name, address, contactPhone], i) => ({ facilityId: i + 3, name, address, contactPhone, openingTime: "06:00", closingTime: "22:00", status: "ACTIVE" })),
  ];
  const unitTypes = [
    { unitTypeId: 1, typeName: "Kho Mini S (1m x 1m)", length: 1, width: 1, height: 2.5, area: 1, climateControlled: false, description: "Kho nhỏ tiết kiệm, phù hợp cất giữ vali, tài liệu, phụ kiện gia đình", status: "ACTIVE" },
    { unitTypeId: 2, typeName: "Kho Tiêu Chuẩn M (2m x 2m)", length: 2, width: 2, height: 2.8, area: 4, climateControlled: true, description: "Kho điều hòa mát mẻ, phù hợp đồ nội thất, thiết bị điện tử, hàng shop online", status: "ACTIVE" },
    { unitTypeId: 3, typeName: "Kho Lớn L (3m x 3m)", length: 3, width: 3, height: 3, area: 9, climateControlled: true, description: "Kho điều hòa sức chứa lớn, phù hợp lưu trữ đồ chuyển nhà 2-3 phòng ngủ", status: "ACTIVE" },
    { unitTypeId: 4, typeName: "Kho Doanh Nghiệp XL (4m x 4m)", length: 4, width: 4, height: 3.2, area: 16, climateControlled: true, description: "Kho chuyên biệt cho doanh nghiệp", status: "ACTIVE" },
  ];
  const eff = dateOnly(days(-30));
  const round10k = (v) => Math.round(v / 10000) * 10000;
  const rateRows = [
    [1, 1, 500000], [1, 2, 1500000], [1, 3, 3000000],
    [2, 1, 550000], [2, 2, 1600000], [2, 3, 3200000], [2, 4, 5500000],
  ];
  NETWORK.forEach(([, , , , rateM, xl], i) => {
    const fid = i + 3;
    rateRows.push([fid, 1, round10k(rateM * 0.4)], [fid, 2, rateM], [fid, 3, round10k(rateM * 2)]);
    if (xl) rateRows.push([fid, 4, round10k(rateM * 3.5)]);
  });
  const rates = rateRows.map(([facilityId, unitTypeId, monthlyRate], i) => ({ rateId: i + 1, facilityId, facilityName: facilities[facilityId - 1].name, unitTypeId, unitTypeName: unitTypes[unitTypeId - 1].typeName, monthlyRate, effectiveFrom: eff, effectiveTo: null }));
  const units = [
    [1, 1, 1, "TB-S-101", "AVAILABLE"], [2, 1, 1, "TB-S-102", "AVAILABLE"], [3, 1, 2, "TB-M-103", "OCCUPIED"], [4, 1, 2, "TB-M-104", "AVAILABLE"],
    [5, 1, 3, "TB-L-201", "AVAILABLE"], [6, 1, 3, "TB-L-202", "AVAILABLE"], [7, 2, 1, "Q7-S-101", "AVAILABLE"], [8, 2, 1, "Q7-S-102", "AVAILABLE"],
    [9, 2, 2, "Q7-M-103", "AVAILABLE"], [10, 2, 2, "Q7-M-104", "AVAILABLE"], [11, 2, 3, "Q7-L-201", "AVAILABLE"], [12, 2, 4, "Q7-XL-301", "AVAILABLE"],
  ].map(([unitId, facilityId, unitTypeId, unitNumber, status]) => ({ unitId, facilityId, unitTypeId, unitNumber, status }));
  NETWORK.forEach(([code, , , , , xl], i) => {
    const fid = i + 3;
    const plan = [[1, "S", 101, 2], [2, "M", 111, 2], [3, "L", 201, 1], ...(xl ? [[4, "XL", 301, 1]] : [])];
    for (const [unitTypeId, size, first, count] of plan)
      for (let k = 0; k < count; k++) units.push({ unitId: units.length + 1, facilityId: fid, unitTypeId, unitNumber: `${code}-${size}-${first + k}`, status: "AVAILABLE" });
  });
  const start1 = dateOnly(days(-15));
  const start2 = dateOnly(days(5));
  const reservations = [
    { reservationId: 1, customerId: 3, facilityId: 1, unitTypeId: 2, startDate: start1, expectedEndDate: addMonths(start1, 3), rentalPeriodMonths: 3, quotedMonthlyRate: 1500000, estimatedAmount: 4500000, requiredDeposit: 1500000, status: "CHECKED_IN", createdAt: days(-16), expiresAt: days(-15), cancelledAt: null, cancellationReason: null },
    { reservationId: 2, customerId: 3, facilityId: 1, unitTypeId: 1, startDate: start2, expectedEndDate: addMonths(start2, 1), rentalPeriodMonths: 1, quotedMonthlyRate: 500000, estimatedAmount: 500000, requiredDeposit: 500000, status: "PENDING_PAYMENT", createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600000), cancelledAt: null, cancellationReason: null },
  ];
  const contracts = [
    { contractId: 1, reservationId: 1, customerId: 3, unitId: 3, startDate: start1, endDate: addMonths(start1, 3), agreedMonthlyRate: 1500000, depositAmount: 1500000, status: "ACTIVE", createdAt: days(-15), activatedAt: days(-15) },
  ];
  const handovers = [{ handoverId: 1, contractId: 1, status: "HANDED_OVER", scheduledAt: days(-15), handoverAt: days(-15), customerConfirmed: true, staffConfirmed: true }];
  const payments = [
    { paymentId: 1, contractId: 1, renewalId: null, paymentType: "DEPOSIT", amount: 1500000, currency: "VND", paymentMethod: "BANK_TRANSFER", transactionReference: "VNPAY-DEP-10001", dueDate: start1, paidAt: days(-15), status: "PAID", createdAt: days(-15) },
    { paymentId: 2, contractId: 1, renewalId: null, paymentType: "RENT", amount: 1500000, currency: "VND", paymentMethod: "BANK_TRANSFER", transactionReference: "VNPAY-RENT-10002", dueDate: start1, paidAt: days(-15), status: "PAID", createdAt: days(-15) },
  ];
  const tickets = [
    { ticketId: 1, customerId: 3, contractId: 1, unitId: 3, issueType: "UNIT", title: "Kiểm tra nhiệt độ phòng kho", description: "Nhờ nhân viên kiểm tra lại nhiệt độ kho TB-M-103 vào buổi trưa", priority: "NORMAL", status: "OPEN", createdAt: days(-2), assignedAt: null, resolvedAt: null, closedAt: null },
  ];
  const roles = [
    { roleId: 1, roleName: "ADMIN", description: "Quản trị viên toàn quyền hệ thống" },
    { roleId: 2, roleName: "MANAGER", description: "Quản lý cơ sở kho" },
    { roleId: 3, roleName: "STAFF", description: "Nhân viên vận hành, bàn giao và kiểm tra kho" },
    { roleId: 4, roleName: "CUSTOMER", description: "Khách hàng thuê kho tự quản" },
  ];
  const permissions = [
    ["USER_MANAGE", "Quản lý tài khoản"], ["ROLE_MANAGE", "Quản lý vai trò"], ["FACILITY_SCOPE_MANAGE", "Quản lý phạm vi cơ sở"], ["AUDIT_LOG_VIEW", "Xem nhật ký kiểm toán"],
    ["FACILITY_MANAGE", "Quản lý cơ sở"], ["UNIT_MANAGE", "Quản lý kho"], ["ASSIGNMENT_MANAGE", "Phân bổ kho"], ["HANDOVER_MANAGE", "Bàn giao kho"], ["RETURN_MANAGE", "Kiểm tra trả kho"],
    ["RENEWAL_MANAGE", "Duyệt gia hạn"], ["TICKET_MANAGE", "Xử lý hỗ trợ"], ["PAYMENT_CONFIRM", "Xác nhận thanh toán"], ["REPORT_VIEW", "Xem báo cáo"],
  ].map(([permissionCode, permissionName], i) => ({ permissionId: i + 1, permissionCode, permissionName, description: `Mô tả ${permissionName.toLowerCase()}` }));
  const rolePermissions = permissions.map((p) => ({ roleId: 1, permissionId: p.permissionId }));
  const userRoles = [{ userId: 1, roleId: 1 }, { userId: 2, roleId: 3 }, { userId: 3, roleId: 4 }, { userId: 4, roleId: 4 }];
  for (const u of users) Object.assign(u, { phone: null, createdAt: days(-30 + u.userId), updatedAt: days(-30 + u.userId) });
  return { users, facilities, unitTypes, rates, units, reservations, contracts, handovers, payments, renewals: [], tickets, tokens: new Map(), down: false, roles, permissions, rolePermissions, userRoles, userFacilities: [], loginHistory: [], activityLogs: [] };
}

export function startMockApi(port = 5199, { verbose = false } = {}) {
  const S = createState();
  const log = [];
  const fac = (id) => S.facilities.find((f) => f.facilityId === id);
  const ut = (id) => S.unitTypes.find((t) => t.unitTypeId === id);
  const unit = (id) => S.units.find((u) => u.unitId === id);

  const resDto = (r) => ({
    reservationId: r.reservationId, facilityId: r.facilityId, facilityName: fac(r.facilityId).name, unitTypeId: r.unitTypeId, unitTypeName: ut(r.unitTypeId).typeName,
    startDate: r.startDate, expectedEndDate: r.expectedEndDate, rentalPeriodMonths: r.rentalPeriodMonths, quotedMonthlyRate: r.quotedMonthlyRate,
    estimatedAmount: r.estimatedAmount, requiredDeposit: r.requiredDeposit, status: r.status, expiresAt: r.expiresAt ? dbTime(r.expiresAt) : null,
    cancelledAt: r.cancelledAt ? dbTime(r.cancelledAt) : null, cancellationReason: r.cancellationReason, createdAt: dbTime(r.createdAt),
  });
  const payDto = (p) => ({ ...p, paidAt: p.paidAt ? dbTime(p.paidAt) : null, createdAt: dbTime(p.createdAt) });
  const renDto = (r) => ({ ...r, requestedAt: dbTime(r.requestedAt), approvedAt: null });
  const contractSummary = (c) => {
    const u = unit(c.unitId);
    return { contractId: c.contractId, reservationId: c.reservationId, unitId: c.unitId, unitNumber: u.unitNumber, facilityName: fac(u.facilityId).name, unitTypeName: ut(u.unitTypeId).typeName, startDate: c.startDate, endDate: c.endDate, agreedMonthlyRate: c.agreedMonthlyRate, depositAmount: c.depositAmount, status: c.status, activatedAt: c.activatedAt ? dbTime(c.activatedAt) : null };
  };
  const ticketDto = (t) => ({ ticketId: t.ticketId, contractId: t.contractId, unitId: t.unitId, issueType: t.issueType, title: t.title, priority: t.priority, status: t.status, createdAt: dbTime(t.createdAt), resolvedAt: null, closedAt: null });

  const availability = (facilityId, unitTypeId, startDate, months) => {
    const end = addMonths(startDate, months);
    const free = S.units.filter((u) => u.facilityId === facilityId && u.unitTypeId === unitTypeId && u.status === "AVAILABLE").length;
    const held = S.reservations.filter((r) => r.facilityId === facilityId && r.unitTypeId === unitTypeId && ["PENDING_PAYMENT", "CONFIRMED"].includes(r.status) && r.startDate < end && r.expectedEndDate > startDate).length;
    return Math.max(0, free - held);
  };

  const server = http.createServer(async (req, res) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS" };
    const send = (status, body) => {
      res.writeHead(status, { ...cors, ...(body !== undefined ? { "Content-Type": "application/json; charset=utf-8" } : {}) });
      res.end(body !== undefined ? JSON.stringify(body) : "");
      if (verbose && req.method !== "OPTIONS" && !req.url.startsWith("/__")) {
        const color = status >= 400 ? "\x1b[31m" : "\x1b[32m";
        console.log(`${color}${status}\x1b[0m ${req.method.padEnd(6)} ${req.url}${status >= 400 && body ? `  → ${body.error || body.message || ""}` : ""}`);
      }
    };
    if (req.method === "OPTIONS") return send(204);
    const url = new URL(req.url, "http://x");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/__state") return send(200, { reservations: S.reservations, renewals: S.renewals, tickets: S.tickets, users: S.users.map(({ password, ...u }) => u) });
    if (path === "/__down") { S.down = true; return send(200, {}); }
    if (path === "/__up") { S.down = false; return send(200, {}); }
    if (path === "/__revoke") { S.tokens.clear(); return send(200, {}); }
    if (S.down) { req.socket.destroy(); return; }
    let body = null;
    if (req.method === "POST" || req.method === "PUT") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      try { body = raw ? JSON.parse(raw) : null; } catch { return send(400, { title: "Bad JSON" }); }
    }
    log.push(`${req.method} ${path}`);
    const auth = () => {
      const t = (req.headers.authorization || "").replace(/^Bearer /, "");
      return S.tokens.get(t) || null;
    };
    const bad = (m) => send(400, { error: m });
    let m;

    // ---- Auth
    if (req.method === "POST" && path === "/api/auth/register") {
      if (S.users.some((u) => u.username === body.username || u.email === body.email)) return bad("Tên đăng nhập hoặc email đã tồn tại trong hệ thống.");
      const user = { userId: S.users.length + 1, username: body.username, email: body.email, password: body.password, fullName: body.fullName, phone: body.phone, status: "ACTIVE", createdAt: new Date(), updatedAt: new Date() };
      S.users.push(user);
      S.userRoles.push({ userId: user.userId, roleId: 4 });
      return send(201, { userId: user.userId, username: user.username, fullName: user.fullName, email: user.email, status: user.status });
    }
    if (req.method === "POST" && path === "/api/auth/login") {
      const u = S.users.find((x) => x.username === body.username);
      if (!u || u.password !== body.password) return send(401);
      if (u.status !== "ACTIVE") return bad("Tài khoản đang bị khóa hoặc ngưng hoạt động.");
      const h = { loginHistoryId: S.loginHistory.length + 1, userId: u.userId, loginAt: new Date(), logoutAt: null, ipAddress: "::1", deviceInfo: req.headers["user-agent"] || "", loginStatus: "SUCCESS" };
      S.loginHistory.push(h);
      const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
      const roleNames = S.userRoles.filter((r) => r.userId === u.userId).map((r) => S.roles.find((x) => x.roleId === r.roleId).roleName);
      const claim = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";
      const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier": String(u.userId), fullName: u.fullName, loginHistoryId: String(h.loginHistoryId), ...(roleNames.length ? { [claim]: roleNames.length === 1 ? roleNames[0] : roleNames } : {}) })}.c2ln`;
      S.tokens.set(token, u);
      return send(200, { token, expiresAt: iso(new Date(Date.now() + 86400000)), user: { userId: u.userId, username: u.username, fullName: u.fullName, email: u.email, status: u.status } });
    }
    if (req.method === "POST" && path === "/api/auth/logout") {
      const u = auth();
      if (!u) return send(401);
      const h = [...S.loginHistory].reverse().find((x) => x.userId === u.userId && !x.logoutAt);
      if (h) h.logoutAt = new Date();
      return send(200, { message: "Đăng xuất thành công." });
    }

    // ---- Công khai
    if (req.method === "GET" && path === "/api/facilities") return send(200, S.facilities);
    if (req.method === "GET" && path === "/api/unit-types") return send(200, S.unitTypes);
    if (req.method === "GET" && path === "/api/rates") return send(200, S.rates);
    if (req.method === "POST" && path === "/api/availability/check") {
      const rate = S.rates.find((r) => r.facilityId === body.facilityId && r.unitTypeId === body.unitTypeId);
      const t = ut(body.unitTypeId);
      const count = availability(body.facilityId, body.unitTypeId, body.startDate, body.rentalPeriodMonths);
      return send(200, { facilityId: body.facilityId, facilityName: fac(body.facilityId)?.name, unitTypeId: body.unitTypeId, unitTypeName: t?.typeName, area: t?.area, climateControlled: t?.climateControlled, monthlyRate: rate?.monthlyRate || 0, estimatedTotalRent: (rate?.monthlyRate || 0) * body.rentalPeriodMonths, requiredDeposit: rate?.monthlyRate || 0, startDate: body.startDate, expectedEndDate: addMonths(body.startDate, body.rentalPeriodMonths), availableUnitCount: count, isAvailable: count > 0 });
    }

    const user = auth();
    if (path.startsWith("/api/") && !user) return send(401);
    const me = user?.userId;


    // ---- Quản trị (RequireRole ADMIN)
    if (path.startsWith("/api/admin")) {
      const isAdmin = S.userRoles.some((r) => r.userId === me && r.roleId === 1);
      if (!isAdmin) return send(403);
      const msg = (status, m) => send(status, { message: m });
      const roleNamesOf = (uid) => S.userRoles.filter((r) => r.userId === uid).map((r) => S.roles.find((x) => x.roleId === r.roleId).roleName);
      const log = (action, entityType, entityId, oldValue, newValue) =>
        S.activityLogs.push({ logId: S.activityLogs.length + 1, userId: me, action, entityType, entityId, oldValue: oldValue == null ? null : typeof oldValue === "string" ? oldValue : JSON.stringify(oldValue), newValue: newValue == null ? null : typeof newValue === "string" ? newValue : JSON.stringify(newValue), ipAddress: null, loggedAt: new Date() });
      const activeAdmins = (except) => S.users.filter((u) => u.userId !== except && u.status === "ACTIVE" && roleNamesOf(u.userId).includes("ADMIN")).length;
      const ufDto = (x) => {
        const u = S.users.find((y) => y.userId === x.userId);
        const a = S.users.find((y) => y.userId === x.assignedBy);
        return { userFacilityId: x.userFacilityId, userId: x.userId, username: u.username, userFullName: u.fullName, facilityId: x.facilityId, facilityName: fac(x.facilityId).name, assignedFrom: x.assignedFrom, assignedTo: x.assignedTo, status: x.status, assignedBy: x.assignedBy, assignerName: a?.fullName || null, createdAt: dbTime(x.createdAt) };
      };
      const logDto = (l) => ({ ...l, username: S.users.find((u) => u.userId === l.userId)?.username || null, loggedAt: dbTime(l.loggedAt) });
      const page = (list) => {
        const p = Math.max(1, +url.searchParams.get("page") || 1);
        const size = +url.searchParams.get("pageSize") || 20;
        return { items: list.slice((p - 1) * size, p * size), totalItems: list.length, page: p, pageSize: size, totalPages: Math.ceil(list.length / size), hasPreviousPage: p > 1, hasNextPage: p * size < list.length };
      };
      const inRange = (d) => {
        const f = url.searchParams.get("fromDate");
        const t = url.searchParams.get("toDate");
        return (!f || d >= new Date(f)) && (!t || d <= new Date(t));
      };

      if (req.method === "GET" && path === "/api/admin/dashboard/stats") {
        const active = S.users.filter((u) => u.status === "ACTIVE").length;
        const usersByRole = Object.fromEntries(S.roles.map((r) => [r.roleName, S.userRoles.filter((x) => x.roleId === r.roleId).length]).filter(([, n]) => n));
        return send(200, { totalUsers: S.users.length, usersByRole, activeUsersCount: active, inactiveUsersCount: S.users.length - active, totalFacilities: S.facilities.length, totalUnits: S.units.length, occupiedUnits: 1, availableUnits: S.units.length - 1, maintenanceUnits: 0, occupancyRate: 8.33, activeContractsCount: S.contracts.length, pendingReservationsCount: S.reservations.filter((r) => r.status === "PENDING_PAYMENT").length, openTicketsCount: S.tickets.filter((t) => t.status === "OPEN").length, recentActivities: [...S.activityLogs].reverse().slice(0, 5).map(logDto) });
      }
      if (req.method === "GET" && path === "/api/admin/users") {
        const term = (url.searchParams.get("searchTerm") || "").toLowerCase();
        const st = url.searchParams.get("status");
        const rid = url.searchParams.get("roleId");
        const list = S.users
          .filter((u) => !term || [u.username, u.fullName, u.email].some((v) => v.toLowerCase().includes(term)) || (u.phone || "").includes(term))
          .filter((u) => !st || u.status === st.toUpperCase())
          .filter((u) => !rid || S.userRoles.some((r) => r.userId === u.userId && r.roleId === +rid))
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((u) => ({ userId: u.userId, username: u.username, fullName: u.fullName, email: u.email, phone: u.phone, status: u.status, createdAt: dbTime(u.createdAt), roles: roleNamesOf(u.userId) }));
        return send(200, page(list));
      }
      if ((m = path.match(/^\/api\/admin\/users\/(\d+)$/))) {
        const u = S.users.find((x) => x.userId === +m[1]);
        if (req.method === "GET") {
          if (!u) return send(404, { message: `Không tìm thấy người dùng với ID: ${m[1]}` });
          const last = [...S.loginHistory].reverse().find((h) => h.userId === u.userId);
          return send(200, { userId: u.userId, username: u.username, fullName: u.fullName, email: u.email, phone: u.phone, status: u.status, createdAt: dbTime(u.createdAt), updatedAt: dbTime(u.updatedAt), roles: S.userRoles.filter((r) => r.userId === u.userId).map((r) => S.roles.find((x) => x.roleId === r.roleId)), facilityAssignments: S.userFacilities.filter((x) => x.userId === u.userId).map(ufDto), activeContractsCount: S.contracts.filter((c) => c.customerId === u.userId && c.status === "ACTIVE").length, openTicketsCount: S.tickets.filter((t) => t.customerId === u.userId && t.status === "OPEN").length, lastLoginAt: last ? dbTime(last.loginAt) : null });
        }
        if (req.method === "PUT") {
          if (!u) return msg(404, `Không tìm thấy người dùng với ID: ${m[1]}`);
          const newStatus = (body.status || "ACTIVE").toUpperCase();
          if (u.status === "ACTIVE" && newStatus !== "ACTIVE" && roleNamesOf(u.userId).includes("ADMIN") && activeAdmins(u.userId) === 0) return msg(400, "Không thể khóa hoặc ngưng hoạt động tài khoản Quản trị viên (ADMIN) đang hoạt động duy nhất của hệ thống.");
          if (S.users.some((x) => x.userId !== u.userId && x.email === body.email)) return msg(400, `Email '${body.email}' đã được tài khoản khác sử dụng.`);
          const old = { FullName: u.fullName, Email: u.email, Phone: u.phone, Status: u.status };
          Object.assign(u, { fullName: body.fullName, email: body.email, phone: body.phone, status: newStatus, updatedAt: new Date() });
          log("USER_UPDATE", "users", u.userId, old, { FullName: u.fullName, Email: u.email, Phone: u.phone, Status: u.status });
          return send(200, { userId: u.userId, username: u.username, fullName: u.fullName, email: u.email, phone: u.phone, status: u.status, createdAt: dbTime(u.createdAt), roles: roleNamesOf(u.userId) });
        }
      }
      if (req.method === "POST" && path === "/api/admin/users") {
        if (S.users.some((u) => u.username === body.username)) return msg(400, `Tên đăng nhập '${body.username}' đã tồn tại trong hệ thống.`);
        if (S.users.some((u) => u.email === body.email)) return msg(400, `Email '${body.email}' đã được sử dụng.`);
        const u = { userId: S.users.length + 1, username: body.username, password: body.password, fullName: body.fullName, email: body.email, phone: body.phone, status: body.status || "ACTIVE", createdAt: new Date(), updatedAt: new Date() };
        S.users.push(u);
        if (body.initialRoleId) S.userRoles.push({ userId: u.userId, roleId: body.initialRoleId });
        log("USER_CREATE", "users", u.userId, null, { Username: u.username, FullName: u.fullName, Email: u.email, Status: u.status });
        return send(201, { userId: u.userId, username: u.username, fullName: u.fullName, email: u.email, phone: u.phone, status: u.status, createdAt: iso(u.createdAt), roles: roleNamesOf(u.userId) });
      }
      if (req.method === "POST" && (m = path.match(/^\/api\/admin\/users\/(\d+)\/reset-password$/))) {
        const u = S.users.find((x) => x.userId === +m[1]);
        if (!u) return msg(404, `Không tìm thấy người dùng với ID: ${m[1]}`);
        if (!body.newPassword || body.newPassword.length < 6) return msg(400, "Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.");
        u.password = body.newPassword;
        log("USER_RESET_PASSWORD", "users", u.userId, null, "Mật khẩu đã được đặt lại bởi quản trị viên");
        return send(200, { message: "Đặt lại mật khẩu người dùng thành công." });
      }
      if (req.method === "GET" && path === "/api/admin/roles")
        return send(200, S.roles.map((r) => ({ ...r, permissions: S.rolePermissions.filter((x) => x.roleId === r.roleId).map((x) => S.permissions.find((p) => p.permissionId === x.permissionId)) })));
      if (req.method === "GET" && path === "/api/admin/permissions") return send(200, S.permissions);
      if (req.method === "POST" && (m = path.match(/^\/api\/admin\/users\/(\d+)\/roles$/))) {
        const u = S.users.find((x) => x.userId === +m[1]);
        if (!u) return msg(404, `Không tìm thấy user với ID: ${m[1]}`);
        const role = S.roles.find((r) => r.roleId === body.roleId);
        if (!role) return msg(404, `Không tìm thấy vai trò với ID: ${body.roleId}`);
        if (S.userRoles.some((r) => r.userId === u.userId && r.roleId === role.roleId)) return msg(400, `Người dùng đã có vai trò '${role.roleName}'.`);
        S.userRoles.push({ userId: u.userId, roleId: role.roleId });
        log("ROLE_ASSIGN", "user_roles", u.userId, null, { UserId: u.userId, RoleId: role.roleId, RoleName: role.roleName });
        return send(200, { message: "Gán vai trò cho người dùng thành công." });
      }
      if (req.method === "DELETE" && (m = path.match(/^\/api\/admin\/users\/(\d+)\/roles\/(\d+)$/))) {
        const idx = S.userRoles.findIndex((r) => r.userId === +m[1] && r.roleId === +m[2]);
        if (idx < 0) return msg(404, "Liên kết vai trò của người dùng không tồn tại.");
        const role = S.roles.find((r) => r.roleId === +m[2]);
        const u = S.users.find((x) => x.userId === +m[1]);
        if (role.roleName === "ADMIN" && u.status === "ACTIVE" && activeAdmins(u.userId) === 0) return msg(400, "Không thể thu hồi vai trò Quản trị viên (ADMIN) từ tài khoản Admin hoạt động duy nhất của hệ thống.");
        S.userRoles.splice(idx, 1);
        log("ROLE_REVOKE", "user_roles", u.userId, { UserId: u.userId, RoleId: role.roleId, RoleName: role.roleName }, null);
        return send(200, { message: "Thu hồi vai trò của người dùng thành công." });
      }
      if (req.method === "POST" && (m = path.match(/^\/api\/admin\/roles\/(\d+)\/permissions$/))) {
        const role = S.roles.find((r) => r.roleId === +m[1]);
        const perm = S.permissions.find((p) => p.permissionId === body.permissionId);
        if (!role) return msg(404, `Không tìm thấy role: ${m[1]}`);
        if (!perm) return msg(404, `Không tìm thấy permission: ${body.permissionId}`);
        if (S.rolePermissions.some((x) => x.roleId === role.roleId && x.permissionId === perm.permissionId)) return msg(400, "Quyền này đã được gán cho vai trò.");
        S.rolePermissions.push({ roleId: role.roleId, permissionId: perm.permissionId });
        log("PERMISSION_ASSIGN", "role_permissions", role.roleId, null, { RoleId: role.roleId, RoleName: role.roleName, PermissionId: perm.permissionId, PermissionCode: perm.permissionCode });
        return send(200, { message: "Gán quyền hạn cho vai trò thành công." });
      }
      if (req.method === "DELETE" && (m = path.match(/^\/api\/admin\/roles\/(\d+)\/permissions\/(\d+)$/))) {
        const idx = S.rolePermissions.findIndex((x) => x.roleId === +m[1] && x.permissionId === +m[2]);
        if (idx < 0) return msg(404, "Liên kết quyền của vai trò không tồn tại.");
        const role = S.roles.find((r) => r.roleId === +m[1]);
        const perm = S.permissions.find((p) => p.permissionId === +m[2]);
        S.rolePermissions.splice(idx, 1);
        log("PERMISSION_REVOKE", "role_permissions", role.roleId, { RoleId: role.roleId, RoleName: role.roleName, PermissionId: perm.permissionId, PermissionCode: perm.permissionCode }, null);
        return send(200, { message: "Thu hồi quyền hạn khỏi vai trò thành công." });
      }
      if (req.method === "GET" && (m = path.match(/^\/api\/admin\/users\/(\d+)\/facilities$/)))
        return send(200, S.userFacilities.filter((x) => x.userId === +m[1]).sort((a, b) => b.createdAt - a.createdAt).map(ufDto));
      if (req.method === "POST" && path === "/api/admin/user-facilities") {
        const u = S.users.find((x) => x.userId === body.userId);
        if (!u) return msg(404, `Không tìm thấy người dùng với ID: ${body.userId}`);
        if (!roleNamesOf(u.userId).some((r) => r === "STAFF" || r === "MANAGER")) return msg(400, "Chỉ có thể phân công cơ sở cho tài khoản có vai trò STAFF hoặc MANAGER.");
        const f = fac(body.facilityId);
        if (!f) return msg(404, `Không tìm thấy cơ sở với ID: ${body.facilityId}`);
        if (body.assignedTo && body.assignedTo < body.assignedFrom) return msg(400, "Ngày kết thúc phân công không thể trước ngày bắt đầu.");
        for (const old of S.userFacilities.filter((x) => x.userId === u.userId && x.status === "ACTIVE")) {
          old.status = "ENDED";
          if (!old.assignedTo || old.assignedTo > body.assignedFrom) old.assignedTo = body.assignedFrom;
        }
        const x = { userFacilityId: S.userFacilities.length + 1, userId: u.userId, facilityId: f.facilityId, assignedBy: me, assignedFrom: body.assignedFrom, assignedTo: body.assignedTo || null, status: "ACTIVE", createdAt: new Date() };
        S.userFacilities.push(x);
        log("FACILITY_SCOPE_ASSIGN", "user_facilities", u.userId, null, { UserId: u.userId, FacilityId: f.facilityId, FacilityName: f.name, AssignedFrom: body.assignedFrom, AssignedTo: body.assignedTo });
        return send(201, ufDto(x));
      }
      if (req.method === "PUT" && (m = path.match(/^\/api\/admin\/user-facilities\/(\d+)\/status$/))) {
        const x = S.userFacilities.find((y) => y.userFacilityId === +m[1]);
        if (!x) return msg(404, `Không tìm thấy bản ghi phân công cơ sở với ID: ${m[1]}`);
        const st = (body.status || "").toUpperCase();
        if (!["ACTIVE", "ENDED", "SUSPENDED"].includes(st)) return msg(400, "Trạng thái phân công không hợp lệ (chỉ chấp nhận ACTIVE, ENDED, SUSPENDED).");
        if (st === "ACTIVE" && S.userFacilities.some((y) => y.userId === x.userId && y.userFacilityId !== x.userFacilityId && y.status === "ACTIVE")) return msg(400, "Người dùng đang có phân công ACTIVE khác. Hãy kết thúc phân công hiện tại trước khi kích hoạt phân công này.");
        const old = x.status;
        x.status = st;
        if (st === "ENDED" && !x.assignedTo) x.assignedTo = dateOnly(new Date());
        log("FACILITY_SCOPE_STATUS_CHANGE", "user_facilities", x.userFacilityId, { Status: old }, { Status: st });
        return send(200, { message: "Cập nhật trạng thái phân công cơ sở thành công." });
      }
      if (req.method === "GET" && path === "/api/admin/logs/login-history") {
        const list = [...S.loginHistory].filter((h) => inRange(h.loginAt)).sort((a, b) => b.loginAt - a.loginAt).map((h) => {
          const u = S.users.find((x) => x.userId === h.userId);
          return { ...h, username: u.username, fullName: u.fullName, loginAt: dbTime(h.loginAt), logoutAt: h.logoutAt ? dbTime(h.logoutAt) : null };
        });
        return send(200, page(list));
      }
      if (req.method === "GET" && path === "/api/admin/logs/activity-logs") {
        const action = url.searchParams.get("action");
        const list = [...S.activityLogs].filter((l) => inRange(l.loggedAt) && (!action || l.action === action)).sort((a, b) => b.loggedAt - a.loggedAt).map(logDto);
        return send(200, page(list));
      }
      return send(404, { message: "Not found" });
    }

    // ---- Đặt chỗ
    if (req.method === "GET" && path === "/api/reservations") return send(200, S.reservations.filter((r) => r.customerId === me).sort((a, b) => b.createdAt - a.createdAt).map(resDto));
    if (req.method === "GET" && (m = path.match(/^\/api\/reservations\/(\d+)$/))) {
      const r = S.reservations.find((x) => x.reservationId === +m[1] && x.customerId === me);
      if (!r) return send(404, { error: "Không tìm thấy đơn đặt chỗ." });
      const c = S.contracts.find((x) => x.reservationId === r.reservationId);
      return send(200, { ...resDto(r), checkInAppointmentAt: null, assignedUnitNumber: c ? unit(c.unitId).unitNumber : null, contractId: c?.contractId ?? null, contractStatus: c?.status ?? null });
    }
    if (req.method === "POST" && path === "/api/reservations") {
      if (body.rentalPeriodMonths <= 0) return bad("Thời hạn thuê phải lớn hơn 0 tháng.");
      if (!fac(body.facilityId)) return bad("Không tìm thấy cơ sở kho.");
      if (!ut(body.unitTypeId)) return bad("Không tìm thấy loại phòng kho.");
      if (body.startDate < dateOnly(new Date())) return bad("Ngày bắt đầu thuê không thể ở quá khứ.");
      const rate = S.rates.find((r) => r.facilityId === body.facilityId && r.unitTypeId === body.unitTypeId);
      if (!rate) return bad("Chưa có bảng giá áp dụng cho cơ sở và loại kho này.");
      if (availability(body.facilityId, body.unitTypeId, body.startDate, body.rentalPeriodMonths) <= 0) return bad("Hiện tại đã hết kho trống cho loại kho và khoảng thời gian yêu cầu.");
      const r = { reservationId: S.reservations.length + 1, customerId: me, facilityId: body.facilityId, unitTypeId: body.unitTypeId, startDate: body.startDate, expectedEndDate: addMonths(body.startDate, body.rentalPeriodMonths), rentalPeriodMonths: body.rentalPeriodMonths, quotedMonthlyRate: rate.monthlyRate, estimatedAmount: rate.monthlyRate * body.rentalPeriodMonths, requiredDeposit: rate.monthlyRate, status: "PENDING_PAYMENT", createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 3600000), cancelledAt: null, cancellationReason: null };
      S.reservations.push(r);
      return send(201, { ...resDto(r), createdAt: iso(r.createdAt), expiresAt: iso(r.expiresAt) });
    }
    if (req.method === "POST" && (m = path.match(/^\/api\/reservations\/(\d+)\/cancel$/))) {
      const r = S.reservations.find((x) => x.reservationId === +m[1] && x.customerId === me);
      if (!r) return bad("Không tìm thấy đơn đặt chỗ hợp lệ.");
      if (!["PENDING_PAYMENT", "CONFIRMED"].includes(r.status)) return bad(`Không thể hủy đơn đặt chỗ ở trạng thái '${r.status}'.`);
      Object.assign(r, { status: "CANCELLED", cancelledAt: new Date(), cancellationReason: body?.reason });
      return send(200, { message: "Đã hủy đơn đặt chỗ thành công." });
    }

    // ---- Hợp đồng
    if (req.method === "GET" && path === "/api/contracts") return send(200, S.contracts.filter((c) => c.customerId === me).map(contractSummary));
    if (req.method === "GET" && (m = path.match(/^\/api\/contracts\/(\d+)$/))) {
      const c = S.contracts.find((x) => x.contractId === +m[1] && x.customerId === me);
      if (!c) return send(404, { error: "Không tìm thấy hợp đồng." });
      const h = S.handovers.find((x) => x.contractId === c.contractId);
      return send(200, { ...contractSummary(c), terminationReason: null, createdAt: dbTime(c.createdAt), completedAt: null, handover: h ? { handoverId: h.handoverId, status: h.status, scheduledAt: dbTime(h.scheduledAt), handoverAt: dbTime(h.handoverAt), customerConfirmed: h.customerConfirmed, staffConfirmed: h.staffConfirmed } : null, payments: S.payments.filter((p) => p.contractId === c.contractId).map(payDto), renewals: S.renewals.filter((r) => r.contractId === c.contractId).map(renDto) });
    }
    if (req.method === "POST" && (m = path.match(/^\/api\/contracts\/(\d+)\/renewals$/))) {
      if (!(body.renewalPeriodMonths > 0)) return bad("Thời gian gia hạn phải lớn hơn 0 tháng.");
      const c = S.contracts.find((x) => x.contractId === +m[1] && x.customerId === me);
      if (!c) return bad("Không tìm thấy hợp đồng hợp lệ.");
      if (c.status !== "ACTIVE") return bad(`Chỉ hợp đồng ở trạng thái 'ACTIVE' mới có thể gia hạn. Trạng thái hiện tại: ${c.status}`);
      if (S.renewals.some((r) => r.contractId === c.contractId && ["PENDING_PAYMENT", "PENDING_APPROVAL"].includes(r.status))) return bad("Hợp đồng đã có yêu cầu gia hạn đang chờ xử lý.");
      const r = { renewalId: S.renewals.length + 1, contractId: c.contractId, oldEndDate: c.endDate, newEndDate: addMonths(c.endDate, body.renewalPeriodMonths), renewalPeriodMonths: body.renewalPeriodMonths, oldMonthlyRate: c.agreedMonthlyRate, newMonthlyRate: c.agreedMonthlyRate, renewalAmount: c.agreedMonthlyRate * body.renewalPeriodMonths, status: "PENDING_PAYMENT", requestedAt: new Date() };
      S.renewals.push(r);
      return send(201, { ...r, requestedAt: iso(r.requestedAt), approvedAt: null });
    }
    if (req.method === "GET" && (m = path.match(/^\/api\/contracts\/(\d+)\/payments$/))) return send(200, S.payments.filter((p) => p.contractId === +m[1]).map(payDto));
    if (req.method === "POST" && (m = path.match(/^\/api\/handovers\/(\d+)\/confirm$/))) {
      const h = S.handovers.find((x) => x.handoverId === +m[1]);
      if (!h) return bad("Không tìm thấy biên bản bàn giao phù hợp.");
      h.customerConfirmed = true;
      return send(200, { message: "Đã xác nhận bàn giao." });
    }

    // ---- Hỗ trợ
    if (req.method === "GET" && path === "/api/tickets") return send(200, S.tickets.filter((t) => t.customerId === me).map(ticketDto));
    if (req.method === "GET" && (m = path.match(/^\/api\/tickets\/(\d+)$/))) {
      const t = S.tickets.find((x) => x.ticketId === +m[1] && x.customerId === me);
      if (!t) return send(404, { error: "Không tìm thấy yêu cầu hỗ trợ." });
      return send(200, { ...ticketDto(t), contractUnitNumber: unit(S.contracts.find((c) => c.contractId === t.contractId).unitId).unitNumber, description: t.description, assignedAt: null });
    }
    if (req.method === "POST" && path === "/api/tickets") {
      const c = S.contracts.find((x) => x.contractId === body.contractId && x.customerId === me);
      if (!c) return bad("Hợp đồng liên quan không tồn tại hoặc không thuộc về khách hàng.");
      const t = { ticketId: S.tickets.length + 1, customerId: me, contractId: c.contractId, unitId: body.unitId ?? c.unitId, issueType: body.issueType, title: body.title, description: body.description, priority: body.priority || "MEDIUM", status: "OPEN", createdAt: new Date() };
      S.tickets.push(t);
      return send(201, { ...ticketDto(t), createdAt: iso(t.createdAt) });
    }
    if (req.method === "POST" && (m = path.match(/^\/api\/tickets\/(\d+)\/cancel$/))) {
      const t = S.tickets.find((x) => x.ticketId === +m[1] && x.customerId === me);
      if (!t) return bad("Yêu cầu hỗ trợ không tồn tại.");
      if (t.status !== "OPEN") return bad("Chỉ có thể hủy yêu cầu đang ở trạng thái mở.");
      t.status = "CANCELLED";
      return send(200, { message: "Đã hủy yêu cầu hỗ trợ." });
    }
    return send(404, { error: "Not found" });
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, state: S, log })));
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("mock/mock-api.mjs")) {
  const port = Number(process.argv[2]) || 5151;
  startMockApi(port, { verbose: true }).then(() => console.log(`API giả lập đang chạy: http://localhost:${port}`));
}
