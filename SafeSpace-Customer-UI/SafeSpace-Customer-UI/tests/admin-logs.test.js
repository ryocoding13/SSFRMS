// #39 #40: nhật ký admin hiện tên thay cho ID thô, ba nhóm rõ nghĩa, có trước → sau.
import test from "node:test";
import assert from "node:assert/strict";
import { describeActivity } from "../src/features/admin/utils/adminUtils.js";
import { ACTION_GROUPS, actionLabel } from "../src/shared/utils/roles.js";

const nameOf = (id) => ({ 5: "Phạm Thu Hà" })[id];
const ctx = { facilityName: (id) => ({ 1: "SafeSpace Nguyễn Lương Bằng" })[id], unitTypeName: (id) => ({ 2: "Kho thường 15 m²" })[id] };
const L = (action, entityType, entityId, ov, nv) => ({ action, entityType, entityId, oldValue: ov && JSON.stringify(ov), newValue: nv && JSON.stringify(nv) });

test("#40: ba nhóm, phân công cơ sở không nằm trong Phân quyền hay Thay đổi dữ liệu", () => {
  assert.deepEqual(Object.keys(ACTION_GROUPS), ["data", "staffing", "access"]);
  assert.ok(ACTION_GROUPS.staffing.includes("FACILITY_SCOPE_ASSIGN"));
  assert.ok(!ACTION_GROUPS.access.includes("FACILITY_SCOPE_ASSIGN"));
  assert.ok(!ACTION_GROUPS.data.includes("FACILITY_SCOPE_ASSIGN"));
  for (const a of ["FACILITY_UPDATE", "RATE_SET", "POLICY_UPDATE", "DEMO_CONTRACT_EDITED"]) assert.ok(ACTION_GROUPS.data.includes(a), a);
  assert.ok(ACTION_GROUPS.access.includes("ROLE_CHANGE"));
});

test("#39: tên người, cơ sở, loại kho thay cho ID; không còn dạng 'CONTRACT #12'", () => {
  const rows = [
    describeActivity(L("FACILITY_SCOPE_ASSIGN", "user_facilities", 9, null, { UserId: 5, FacilityId: 1 }), nameOf, ctx),
    describeActivity(L("RATE_SET", "RENTAL_RATE", 3, null, { FacilityId: 1, UnitTypeId: 2, MonthlyRate: 1150000, EffectiveFrom: "2026-11-13" }), nameOf, ctx),
    describeActivity(L("ACCESS_SCANNED", "CONTRACT", 12, null, { result: "OPEN", unit: "K01" }), nameOf, ctx),
    describeActivity(L("UNKNOWN_ACTION", "CONTRACT", 7, null, {}), nameOf, ctx),
  ];
  assert.match(rows[0], /Phạm Thu Hà/); assert.match(rows[0], /Nguyễn Lương Bằng/);
  assert.match(rows[1], /Kho thường 15 m²: 1\.150\.000 đ\/tháng từ 13\/11\/2026/);
  assert.match(rows[2], /Quét mã mở cửa — hợp đồng số 12 · ô K01/);
  for (const r of rows) assert.doesNotMatch(r, /[A-Z_]{4,} ?#\d|\(CONTRACT|UNKNOWN_ACTION/, r);
  assert.equal(actionLabel("UNKNOWN_ACTION"), "Hoạt động hệ thống");
});

test("#40: thể hiện trước → sau khi cần", () => {
  assert.match(describeActivity(L("FACILITY_UPDATE", "FACILITY", 1, { Name: "A", OpeningTime: "07:00" }, { Name: "A", OpeningTime: "06:00" }), nameOf, ctx), /Giờ mở cửa 07:00 → 06:00/);
  assert.match(describeActivity(L("ROLE_CHANGE", "user_roles", 5, { UserId: 5, RoleName: "STAFF" }, { UserId: 5, RoleName: "MANAGER" }), nameOf, ctx), /→/);
  const demo = describeActivity(L("DEMO_CONTRACT_EDITED", "CONTRACT", 12, { StartDate: "2026-11-01", EndDate: "2027-02-01", Status: "ACTIVE" }, { after: { StartDate: "2026-11-01", EndDate: "2026-11-10", Status: "OVERDUE" }, reason: "demo" }), nameOf, ctx);
  assert.match(demo, /HĐ-2026-0012 · Ngày hết hạn 01\/02\/2027 → 10\/11\/2026 · Trạng thái Đang thuê → Quá hạn · Lý do: demo/);
});
