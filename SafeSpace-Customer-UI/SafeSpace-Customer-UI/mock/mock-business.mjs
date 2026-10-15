// Phần /api/operations/* (Quản lý vận hành KD, role OPERATIONS) của máy chủ giả lập — bật bằng { business: true }.
// Theo hợp đồng docs/operations-api.md; số liệu tính đơn giản từ dữ liệu giả lập, không thay backend thật.

const pad = (n) => String(n).padStart(2, "0");
const dateOnly = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const todayIso = () => dateOnly(new Date(Date.now() + 7 * 3600000));
const dbTime = (d) => d.toISOString().replace("Z", "").replace(/\.\d+$/, "");
const IN_USE = ["OCCUPIED", "RETURN_PENDING"];
const UNAVAILABLE = ["MAINTENANCE", "OUT_OF_SERVICE", "INSPECTION"];

export function seedBusiness(S) {
  const now = new Date();
  const from = dateOnly(new Date(Date.now() - 30 * 86400000));
  const p = (policyId, policyName, policyType, calculationType, value, ruleDescription, extra = {}) => ({
    policyId, policyName, policyType, calculationType, value, minValue: null, maxValue: null, ruleDescription,
    facilityId: null, unitTypeId: null, effectiveFrom: from, effectiveTo: null, status: "ACTIVE", createdBy: 1, createdAt: now, updatedAt: now, ...extra,
  });
  S.policies = [
    p(1, "Mức đặt cọc mặc định", "DEPOSIT", "FIXED", 1, "Đặt cọc tương đương 1 tháng tiền thuê khi đặt chỗ"),
    p(2, "Thông báo trước khi hết hạn", "RENEWAL", "FIXED", 7, "Thông báo trước khi hết hạn: 7 ngày\nSố lần gia hạn tối đa: Không giới hạn"),
    p(3, "Phí huỷ trước ngày nhận kho", "CANCELLATION", "RULE", null, "Miễn phí nếu huỷ trước 48 giờ"),
    p(4, "Hoàn cọc sau khi trả kho", "RETURN", "RULE", null, "Hoàn cọc trong vòng: 5 ngày làm việc sau khi trả kho\nThời gian kiểm tra sau khi trả kho: 24 giờ"),
    p(5, "Phí phạt quá hạn / ngày", "OVERDUE", "FIXED", 20000, "Số ngày ân hạn trước khi khoá quyền truy cập: 3 ngày"),
    p(6, "Thuê từ 6 tháng trở lên", "DISCOUNT", "PERCENTAGE", 10, "Giảm 10% tổng phí thuê"),
    p(7, "Giới thiệu bạn bè đăng ký mới", "FEE_WAIVER", "RULE", null, "Miễn phí dịch vụ tháng đầu", { status: "DRAFT" }),
  ];
  // Preview fixtures only; opt-in startMockApi({ business:true }) never writes to SQL Server.
  for (const [i, type] of S.unitTypes.entries()) {
    const min = [700000, 1200000, 1800000, 2500000][i] || 700000;
    const max = [1400000, 2200000, 3500000, 5000000][i] || 1400000;
    S.policies.push(p(S.policies.length + 1, `Khung giá ${type.typeName}`, 'PRICE_RANGE', 'RANGE', null, 'Khoảng giá thuê theo tháng', {unitTypeId:type.unitTypeId,minValue:min,maxValue:max}));
    S.policies.push(p(S.policies.length + 1, `Phí dịch vụ ${type.typeName}`, 'EXTRA_FEE', 'FIXED', [50000,80000,100000,120000][i] || 50000, 'Phí dịch vụ theo tháng', {unitTypeId:type.unitTypeId}));
  }
}

export function handleBusiness({ req, res, path, url, body, S, me, send }) {
  if (!path.startsWith("/api/operations")) return false;
  const roleNames = S.userRoles.filter((r) => r.userId === me).map((r) => S.roles.find((x) => x.roleId === r.roleId)?.roleName);
  if (!roleNames.includes("OPERATIONS")) return send(403), true;
  const bad = (error) => (send(400, { error }), true);
  const notFound = (error) => (send(404, { error }), true);
  const fac = (id) => S.facilities.find((f) => f.facilityId === id);
  const ut = (id) => S.unitTypes.find((t) => t.unitTypeId === id);
  const today = todayIso();
  const num = (k) => (url.searchParams.get(k) ? Number(url.searchParams.get(k)) : null);
  let m;

  const metrics = (units, contracts, payments) => {
    const inUse = units.filter((u) => IN_USE.includes(u.status)).length;
    const unavailable = units.filter((u) => UNAVAILABLE.includes(u.status)).length;
    const operable = units.length - unavailable;
    const paid = payments.filter((x) => x.status === "PAID");
    const sum = (list) => list.reduce((s, x) => s + Number(x.amount), 0);
    const overdue = contracts.filter((c) => c.status === "OVERDUE").length;
    return {
      collected: sum(paid.filter((x) => x.paymentType !== "REFUND")),
      refunded: sum(paid.filter((x) => x.paymentType === "REFUND")),
      netCollected: sum(paid.filter((x) => x.paymentType !== "REFUND")) - sum(paid.filter((x) => x.paymentType === "REFUND")),
      rentalAndFeeRevenue: sum(paid.filter((x) => !["DEPOSIT", "REFUND"].includes(x.paymentType))),
      depositCollected: sum(paid.filter((x) => x.paymentType === "DEPOSIT")),
      depositHeld: sum(paid.filter((x) => x.paymentType === "DEPOSIT")),
      outstanding: sum(payments.filter((x) => ["PENDING", "FAILED"].includes(x.status))),
      totalUnits: units.length,
      unitsInUse: inUse,
      unitsAvailable: units.filter((u) => u.status === "AVAILABLE").length,
      unitsReserved: units.filter((u) => ["RESERVED", "ASSIGNED"].includes(u.status)).length,
      unitsUnavailable: unavailable,
      operableUnits: operable,
      occupancyRate: operable ? Math.round((inUse / operable) * 1000) / 10 : null,
      activeContracts: contracts.filter((c) => ["ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING"].includes(c.status)).length,
      overdueCases: overdue,
      overdueContracts: overdue,
      overdueUnits: new Set(contracts.filter(c => c.status === "OVERDUE").map(c => c.unitId)).size,
    };
  };
  const scoped = (facilityId, unitTypeId) => {
    const units = S.units.filter((u) => (!facilityId || u.facilityId === facilityId) && (!unitTypeId || u.unitTypeId === unitTypeId));
    const ids = new Set(units.map((u) => u.unitId));
    const contracts = S.contracts.filter((c) => ids.has(c.unitId));
    const cids = new Set(contracts.map((c) => c.contractId));
    return { units, contracts, payments: S.payments.filter((x) => cids.has(x.contractId)) };
  };
  const filter = () => ({ from: url.searchParams.get("from") || `${today.slice(0, 7)}-01`, to: url.searchParams.get("to") || today, facilityId: num("facilityId"), unitTypeId: num("unitTypeId") });

  // ---- Cơ sở
  const facilityDto = (f) => {
    const { units } = scoped(f.facilityId);
    const mm = metrics(units, [], []);
    return {
      facilityId: f.facilityId, name: f.name, address: f.address, contactPhone: f.contactPhone, openingTime: f.openingTime, closingTime: f.closingTime,
      status: f.status, totalUnits: units.length, unitsInUse: mm.unitsInUse, operableUnits: mm.operableUnits, occupancyRate: mm.occupancyRate,
      pricedUnitTypes: new Set(S.rates.filter((r) => r.facilityId === f.facilityId && (r.status ?? "ACTIVE") === "ACTIVE").map((r) => r.unitTypeId)).size,
      assignedStaff: f.facilityId === 1 ? 2 : 0, managerName: f.facilityId === 1 ? "Phạm Thu Hà" : null,
      createdAt: "2026-09-15T12:40:41", updatedAt: "2026-09-15T12:40:41",
    };
  };
  if (req.method === "GET" && path === "/api/operations/facilities") return send(200, S.facilities.map(facilityDto)), true;
  if (req.method === "POST" && path === "/api/operations/facilities") {
    if (!body?.name?.trim() || !body?.address?.trim()) return bad("Tên và địa chỉ cơ sở là bắt buộc.");
    const f = { facilityId: S.facilities.length + 1, name: body.name.trim(), address: body.address.trim(), contactPhone: body.contactPhone, openingTime: body.openingTime, closingTime: body.closingTime, status: "ACTIVE" };
    S.facilities.push(f);
    return send(201, { facility: facilityDto(f), warnings: ["Cơ sở đang hoạt động nhưng chưa có bảng giá, ô kho hoặc nhân sự."] }), true;
  }
  if ((m = path.match(/^\/api\/operations\/facilities\/(\d+)(\/status)?$/))) {
    const f = fac(+m[1]);
    if (!f) return notFound("Không tìm thấy cơ sở.");
    if (req.method === "PUT" && m[2]) {
      if (body?.status === "INACTIVE" && S.contracts.some((c) => S.units.find((u) => u.unitId === c.unitId)?.facilityId === f.facilityId && c.status === "ACTIVE"))
        return send(409, { error: "Cơ sở còn hợp đồng đang xử lý.", details: { openContracts: 1, openReservations: 0 } }), true;
      f.status = body.status;
      return send(200, { facility: facilityDto(f), warnings: [] }), true;
    }
    if (req.method === "PUT") {
      Object.assign(f, { name: body.name, address: body.address, contactPhone: body.contactPhone, openingTime: body.openingTime, closingTime: body.closingTime });
      return send(200, { facility: facilityDto(f), warnings: [] }), true;
    }
    if (req.method === "GET") return send(200, facilityDto(f)), true;
  }

  // ---- Chính sách
  const policyDto = (x) => ({
    ...x, scope: x.facilityId && x.unitTypeId ? "FACILITY_UNIT_TYPE" : x.facilityId ? "FACILITY" : x.unitTypeId ? "UNIT_TYPE" : "GLOBAL",
    facilityName: x.facilityId ? fac(x.facilityId)?.name : null, unitTypeName: x.unitTypeId ? ut(x.unitTypeId)?.typeName : null,
    createdByName: "Lê Vận Hành", createdAt: dbTime(x.createdAt), updatedAt: dbTime(x.updatedAt),
  });
  const validate = (b) => {
    if (!b?.policyName?.trim() || !b?.ruleDescription?.trim()) return "Tên và mô tả chính sách là bắt buộc.";
    if (b.calculationType === "RANGE" && !(b.minValue <= b.maxValue)) return "Khoảng giá không hợp lệ.";
    if (b.calculationType === "PERCENTAGE" && !(b.value >= 0 && b.value <= 100)) return "Phần trăm từ 0 đến 100.";
    if (b.value < 0) return "Giá trị không được âm.";
    return null;
  };
  if (req.method === "GET" && path === "/api/operations/policies") {
    const type = url.searchParams.get("type");
    const status = url.searchParams.get("status");
    return send(200, S.policies.filter((x) => (!type || x.policyType === type) && (!status || x.status === status)).map(policyDto)), true;
  }
  if (req.method === "POST" && path === "/api/operations/policies") {
    const err = validate(body);
    if (err) return bad(err);
    const x = { ...body, policyId: S.policies.length + 1, status: "DRAFT", createdBy: me, createdAt: new Date(), updatedAt: new Date() };
    S.policies.push(x);
    return send(201, policyDto(x)), true;
  }
  if ((m = path.match(/^\/api\/operations\/policies\/(\d+)(\/activate|\/deactivate)?$/))) {
    const x = S.policies.find((y) => y.policyId === +m[1]);
    if (!x) return notFound("Không tìm thấy chính sách.");
    if (m[2] === "/activate" && req.method === "POST") {
      if (x.status === "ACTIVE") return bad("Chính sách đang được áp dụng.");
      const conflicts = S.policies.filter(y => y !== x && y.status === 'ACTIVE' && y.policyType === x.policyType
        && (y.facilityId ?? null) === (x.facilityId ?? null) && (y.unitTypeId ?? null) === (x.unitTypeId ?? null)
        && (!y.effectiveTo || y.effectiveTo >= x.effectiveFrom) && (!x.effectiveTo || x.effectiveTo >= y.effectiveFrom));
      if (conflicts.length && url.searchParams.get("replaceExisting") !== "true")
        return send(409, { error: "Đã có chính sách cùng loại và cùng phạm vi đang áp dụng.", details: { conflictingPolicyIds: conflicts.map((c) => c.policyId) } }), true;
      for (const c of conflicts) c.status = "INACTIVE";
      x.status = "ACTIVE";
      return send(200, { policy: policyDto(x), superseded: conflicts.map(policyDto) }), true;
    }
    if (m[2] === "/deactivate" && req.method === "POST") {
      x.status = "INACTIVE";
      return send(200, policyDto(x)), true;
    }
    if (req.method === "PUT") {
      if (x.status !== "DRAFT") return bad("Chỉ sửa được chính sách ở trạng thái nháp.");
      const err = validate(body);
      if (err) return bad(err);
      Object.assign(x, body, { updatedAt: new Date() });
      return send(200, policyDto(x)), true;
    }
    if (req.method === "DELETE") {
      if (x.status !== "DRAFT") return bad("Chỉ xoá được chính sách nháp.");
      S.policies.splice(S.policies.indexOf(x), 1);
      return send(204), true;
    }
  }

  // ---- Bảng giá
  if (req.method === "GET" && path === "/api/operations/rates") {
    const fid = num("facilityId");
    return send(200, S.rates.filter((r) => (!fid || r.facilityId === fid) && (r.status ?? "ACTIVE") === "ACTIVE").map((r) => ({ ...r, isCurrent: r.effectiveFrom <= today && (!r.effectiveTo || r.effectiveTo >= today) }))), true;
  }
  if (req.method === "POST" && path === "/api/operations/rates") {
    if (!(body?.monthlyRate > 0) || body.monthlyRate % 1000) return bad("Giá thuê phải lớn hơn 0 và là bội số của 1.000 đ.");
    const from = body.effectiveFrom || today;
    if (from < today) return bad("Ngày áp dụng không được ở quá khứ.");
    for (const r of S.rates.filter((x) => x.facilityId === body.facilityId && x.unitTypeId === body.unitTypeId && (x.status ?? "ACTIVE") === "ACTIVE")) {
      if (r.effectiveFrom >= from) r.status = "INACTIVE";
      else r.effectiveTo = dateOnly(new Date(new Date(`${from}T00:00:00Z`).getTime() - 86400000));
    }
    const r = { rateId: S.rates.length + 1, facilityId: body.facilityId, facilityName: fac(body.facilityId)?.name, unitTypeId: body.unitTypeId, unitTypeName: ut(body.unitTypeId)?.typeName, monthlyRate: body.monthlyRate, effectiveFrom: from, effectiveTo: null, status: "ACTIVE" };
    S.rates.push(r);
    return send(200, { ...r, isCurrent: from <= today }), true;
  }

  // ---- Báo cáo
  const snapshotAt = dbTime(new Date());
  if (req.method === "GET" && path === "/api/operations/reports/facilities") {
    const fl = filter();
    const rows = S.facilities.filter((f) => !fl.facilityId || f.facilityId === fl.facilityId).map((f) => {
      const s = scoped(f.facilityId, fl.unitTypeId);
      return { facilityId: f.facilityId, facilityName: f.name, facilityStatus: f.status, metrics: metrics(s.units, s.contracts, s.payments) };
    });
    const all = scoped(fl.facilityId, fl.unitTypeId);
    return send(200, { filter: fl, snapshotAt, totals: metrics(all.units, all.contracts, all.payments), facilities: rows }), true;
  }
  if (req.method === "GET" && path === "/api/operations/reports/unit-types") {
    const fl = filter();
    const rows = S.unitTypes.map((t) => {
      const s = scoped(fl.facilityId, t.unitTypeId);
      return { unitTypeId: t.unitTypeId, unitTypeName: t.typeName, metrics: metrics(s.units, s.contracts, s.payments) };
    });
    const all = scoped(fl.facilityId, fl.unitTypeId);
    return send(200, { filter: fl, snapshotAt, totals: metrics(all.units, all.contracts, all.payments), unitTypes: rows }), true;
  }
  if (req.method === "GET" && path === "/api/operations/reports/revenue-trend") {
    const n = num("months") || 6;
    const [y, mo] = today.split("-").map(Number);
    const months = Array.from({ length: n }, (_, i) => {
      const d = new Date(Date.UTC(y, mo - n + i, 1));
      const base = i === n - 1 ? 3000000 : 0;
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, label: `${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, collected: base * 1.5, refunded: 0, rentalAndFeeRevenue: base, depositCollected: base / 2 };
    });
    return send(200, { facilityId: num("facilityId"), unitTypeId: null, snapshotAt, months }), true;
  }
  if (req.method === "GET" && path === "/api/operations/reports/rental-status") {
    const s = scoped(num("facilityId"));
    const count = (list) => Object.entries(list.reduce((a, x) => ({ ...a, [x.status]: (a[x.status] || 0) + 1 }), {})).map(([status, n]) => ({ status, count: n }));
    const rids = new Set(s.units.map((u) => u.facilityId));
    return send(200, { facilityId: num("facilityId"), unitTypeId: null, snapshotAt, contracts: count(s.contracts), reservations: count(S.reservations.filter((r) => rids.has(r.facilityId))), units: count(s.units) }), true;
  }
  if (req.method === "GET" && path === "/api/operations/reports/export") {
    const view = url.searchParams.get("view") || "facilities";
    const fl = filter();
    const rows = [[`Báo cáo ${view}`], ['Từ', fl.from, 'Đến', fl.to]];
    if (view === 'facilities') {
      rows.push(['Cơ sở', 'Doanh thu', 'Tỷ lệ lấp đầy', 'Kho quá hạn']);
      for (const f of S.facilities.filter(f => !fl.facilityId || f.facilityId === fl.facilityId)) {
        const s = scoped(f.facilityId, fl.unitTypeId), m = metrics(s.units, s.contracts, s.payments);
        rows.push([f.name, m.rentalAndFeeRevenue, m.occupancyRate, m.overdueUnits]);
      }
    } else if (view === 'unit-types') {
      rows.push(['Loại kho', 'Doanh thu', 'Tỷ lệ lấp đầy', 'Kho quá hạn']);
      for (const t of S.unitTypes.filter(t => !fl.unitTypeId || t.unitTypeId === fl.unitTypeId)) {
        const s = scoped(fl.facilityId, t.unitTypeId), m = metrics(s.units, s.contracts, s.payments);
        rows.push([t.typeName, m.rentalAndFeeRevenue, m.occupancyRate, m.overdueUnits]);
      }
    } else if (view === 'revenue-trend') {
      rows.push(['Tháng', 'Đã thu', 'Hoàn', 'Thuê và phí', 'Tiền cọc']);
      for (let d = new Date(fl.from.slice(0, 7) + '-01T00:00:00Z'); d.toISOString().slice(0, 10) <= fl.to; d.setUTCMonth(d.getUTCMonth() + 1)) {
        const current = d.toISOString().slice(0, 7) === today.slice(0, 7), revenue = current ? 3000000 : 0;
        rows.push([`${d.getUTCMonth() + 1}/${d.getUTCFullYear()}`, revenue * 1.5, 0, revenue, revenue / 2]);
      }
    } else return bad('view không hợp lệ.');
    const csv = '\ufeff' + rows.map(row => row.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\r\n');
    res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bao-cao-${view}.csv"` });
    res.end(csv);
    return true;
  }
  return send(404, { error: "Not found" }), true;
}
