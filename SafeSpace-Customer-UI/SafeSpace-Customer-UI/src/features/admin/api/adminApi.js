/*
 * ADMIN API - CÁC HÀM GỌI API BACKEND CHO KHU VỰC QUẢN TRỊ
 *
 * Định nghĩa các endpoint quản trị tương ứng trên backend (StorageProject.Api/Endpoints/AdminEndpoints.cs).
 * Tất cả các endpoint đều yêu cầu xác thực JWT với vai trò ADMIN (trừ facilities() là danh mục cơ sở công khai).
 *
 * Các nhóm chức năng API:
 * 1. Thống kê Dashboard (dashboard stats)
 * 2. Quản lý người dùng (danh sách, chi tiết, tạo mới, sửa thông tin, đặt lại mật khẩu)
 * 3. Phân quyền và vai trò (danh sách vai trò/quyền, gán/thu hồi vai trò của user, gán/thu hồi quyền của vai trò)
 * 4. Phân công cơ sở (lịch sử phân công của user, phân công cơ sở mới, cập nhật trạng thái phân công)
 * 5. Nhật ký kiểm toán (lịch sử đăng nhập, nhật ký hoạt động thay đổi dữ liệu)
 * 6. Danh mục cơ sở (lấy danh sách các cơ sở SafeSpace để phục vụ gán cơ sở)
 */

import { request } from "../../../shared/api/httpClient.js";

/*
 * q - Chuyển đổi đối tượng tham số (params) thành chuỗi Query String cho URL
 *
 * Tự động lọc bỏ các giá trị undefined, null, hoặc chuỗi rỗng "".
 * Ví dụ: { page: 1, search: "admin", status: "" } -> "?page=1&search=admin"
 */
const q = (params = {}) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") s.set(k, v);
  }
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const adminApi = {
  /*
   * 1. THỐNG KÊ DASHBOARD QUẢN TRỊ
   * GET /api/admin/dashboard/stats
   * Trả về: tổng số tài khoản, số lượng theo vai trò, số tài khoản bị khóa/ngưng hoạt động, hoạt động gần đây.
   */
  stats: () => request("/api/admin/dashboard/stats"),

  /*
   * 2. QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG
   */
  // Lấy danh sách người dùng có phân trang và bộ lọc: page, pageSize, searchTerm, status, roleId
  users: (filter) => request(`/api/admin/users${q(filter)}`),

  // Lấy thông tin chi tiết một tài khoản theo userId (kèm danh sách roles, số hợp đồng, tickets)
  user: (id) => request(`/api/admin/users/${id}`),

  // Tạo tài khoản mới (POST /api/admin/users)
  // Body gồm: username, password, fullName, email, phone, initialRoleId, status
  createUser: (body) => request("/api/admin/users", { method: "POST", body }),

  // Cập nhật thông tin tài khoản (PUT /api/admin/users/{id})
  // Body gồm: fullName, email, phone, status
  updateUser: (id, body) => request(`/api/admin/users/${id}`, { method: "PUT", body }),

  // Đặt lại mật khẩu cho tài khoản (POST /api/admin/users/{id}/reset-password)
  // Body gồm: { newPassword }
  resetPassword: (id, newPassword) => request(`/api/admin/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),

  /*
   * 3. QUẢN LÝ VAI TRÒ VÀ PHÂN QUYỀN TRUY CẬP
   */
  // Lấy danh sách tất cả vai trò trong hệ thống kèm quyền được gán
  roles: () => request("/api/admin/roles"),

  // Lấy danh sách tất cả các quyền hạn (permissions) được định nghĩa trong hệ thống
  permissions: () => request("/api/admin/permissions"),

  // Gán một vai trò cho người dùng (POST /api/admin/users/{userId}/roles)
  assignRole: (userId, roleId) => request(`/api/admin/users/${userId}/roles`, { method: "POST", body: { roleId } }),

  // Thu hồi một vai trò khỏi người dùng (DELETE /api/admin/users/{userId}/roles/{roleId})
  revokeRole: (userId, roleId) => request(`/api/admin/users/${userId}/roles/${roleId}`, { method: "DELETE" }),

  // Gán một quyền cho vai trò (POST /api/admin/roles/{roleId}/permissions)
  assignPermission: (roleId, permissionId) => request(`/api/admin/roles/${roleId}/permissions`, { method: "POST", body: { permissionId } }),

  // Thu hồi một quyền khỏi vai trò (DELETE /api/admin/roles/{roleId}/permissions/{permissionId})
  revokePermission: (roleId, permissionId) => request(`/api/admin/roles/${roleId}/permissions/${permissionId}`, { method: "DELETE" }),

  /*
   * 4. PHÂN CÔNG CƠ SỞ (FACILITY ASSIGNMENT)
   */
  // Lấy lịch sử phân công cơ sở của người dùng (nhân viên hoặc quản lý cơ sở)
  userFacilities: (userId) => request(`/api/admin/users/${userId}/facilities`),

  // Tạo mới phân công cơ sở cho người dùng (POST /api/admin/user-facilities)
  // Body gồm: userId, facilityId, assignedFrom, assignedTo
  assignFacility: (body) => request("/api/admin/user-facilities", { method: "POST", body }),

  // Đổi trạng thái phân công cơ sở (PUT /api/admin/user-facilities/{id}/status)
  // Trạng thái: ACTIVE, SUSPENDED, ENDED
  setAssignmentStatus: (id, status) => request(`/api/admin/user-facilities/${id}/status`, { method: "PUT", body: { status } }),

  /*
   * 5. NHẬT KÝ KIỂM TOÁN (AUDIT LOGS)
   */
  // Lấy lịch sử đăng nhập hệ thống: có phân trang, lọc theo khoảng ngày (fromDate, toDate)
  loginHistory: (filter) => request(`/api/admin/logs/login-history${q(filter)}`),

  // Lấy nhật ký thay đổi dữ liệu và phân quyền: có phân trang, lọc theo khoảng ngày (fromDate, toDate)
  activityLogs: (filter) => request(`/api/admin/logs/activity-logs${q(filter)}`),

  /*
   * 6. DANH MỤC CƠ SỞ CHUNG
   * Lấy danh sách tất cả cơ sở để Admin chọn khi phân công người dùng phụ trách (không yêu cầu quyền Admin)
   */
  facilities: () => request("/api/facilities", { auth: false }),
};
