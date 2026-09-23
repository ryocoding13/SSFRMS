// Khu quản trị: đọc vai trò từ JWT của backend và mô tả nhật ký hoạt động (theo AdminService).
import test from "node:test";
import assert from "node:assert/strict";
import { isAdminRoles, isCustomerRoles, rolesFromToken, roleLabel, needsFacility } from "../src/lib/roles.js";
import { describeActivity, tempPassword, usernameFrom } from "../src/admin/util.js";

const jwt = (payload) => `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const ROLE = "http://schemas.microsoft.com/ws/2008/06/identity/claims/role";

test("rolesFromToken: một vai trò, nhiều vai trò, token hỏng", () => {
  assert.deepEqual(rolesFromToken(jwt({ [ROLE]: "ADMIN", fullName: "Hệ Thống Admin" })), ["ADMIN"]);
  assert.deepEqual(rolesFromToken(jwt({ [ROLE]: ["STAFF", "MANAGER"] })), ["STAFF", "MANAGER"]);
  assert.deepEqual(rolesFromToken("abc"), []);
  assert.equal(isAdminRoles(["ADMIN"]), true);
  assert.equal(isCustomerRoles([]), true);
  assert.equal(isCustomerRoles(["STAFF"]), false);
  assert.equal(needsFacility(["MANAGER"]), true);
  assert.equal(roleLabel("STAFF"), "Nhân viên cơ sở");
});

test("describeActivity: đọc JSON PascalCase do AdminService ghi", () => {
  const names = { 5: "Phạm Thu Hà" };
  const nameOf = (id) => names[id];
  const d = (action, oldValue, newValue, entityId = 5) => describeActivity({ action, entityId, oldValue: oldValue && JSON.stringify(oldValue), newValue: typeof newValue === "string" ? newValue : newValue && JSON.stringify(newValue) }, nameOf);
  assert.equal(d("USER_CREATE", null, { Username: "ha", FullName: "Phạm Thu Hà", Status: "ACTIVE" }), "Tạo tài khoản mới — Phạm Thu Hà");
  assert.equal(d("USER_UPDATE", { Status: "ACTIVE" }, { FullName: "Hà", Status: "LOCKED" }), "Cập nhật tài khoản — Hà · Đang hoạt động → Đang khoá");
  assert.equal(d("USER_RESET_PASSWORD", null, "Mật khẩu đã được đặt lại bởi quản trị viên"), "Đặt lại mật khẩu — Phạm Thu Hà");
  assert.equal(d("ROLE_ASSIGN", null, { UserId: 5, RoleId: 3, RoleName: "STAFF" }), "Gán vai trò Nhân viên cơ sở — Phạm Thu Hà");
  assert.equal(d("PERMISSION_REVOKE", { RoleName: "ADMIN", PermissionCode: "REPORT_VIEW" }, null, 1), "Thu hồi quyền REPORT_VIEW của Quản trị");
  assert.equal(d("FACILITY_SCOPE_ASSIGN", null, { UserId: 5, FacilityName: "SSFRMS Chi nhánh Quận 7" }), "Phân công SSFRMS Chi nhánh Quận 7 — Phạm Thu Hà");
  assert.equal(d("FACILITY_SCOPE_STATUS_CHANGE", { Status: "ACTIVE" }, { Status: "ENDED" }, 9), "Đổi trạng thái phân công cơ sở · Đang phụ trách → Đã kết thúc");
});

test("mật khẩu tạm thời đủ mạnh; tên đăng nhập gợi ý từ email", () => {
  for (let i = 0; i < 20; i++) {
    const p = tempPassword();
    assert.equal(p.length, 12);
    assert.ok(/[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p) && /[@#$%&*]/.test(p));
  }
  assert.equal(usernameFrom("Hà.Phạm@SafeSpace.vn"), "ha.pham");
});
