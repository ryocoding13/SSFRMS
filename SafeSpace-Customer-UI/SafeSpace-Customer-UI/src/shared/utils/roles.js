// Vai trò, trạng thái tài khoản và nhãn nhật ký của khu quản trị (theo StorageProject.Api).

export const ROLE_LABELS = {
  CUSTOMER: "Khách hàng",
  STAFF: "Nhân viên cơ sở",
  MANAGER: "Quản lý cơ sở",
  BUSINESS_OPERATOR: "Vận hành KD",
  BUSSINESS_OPERATOR: "Vận hành KD",
  OPERATIONS: "Vận hành KD",
  OPERATION_MANAGER: "Vận hành KD",
  ADMIN: "Quản trị",
};
export const ROLE_ORDER = ["CUSTOMER", "STAFF", "MANAGER", "BUSINESS_OPERATOR", "BUSSINESS_OPERATOR", "OPERATIONS", "OPERATION_MANAGER", "ADMIN"];
export const roleLabel = (name) => ROLE_LABELS[name] || name;
export const sortRoles = (list, key = (x) => x) =>
  [...list].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(key(a));
    const ib = ROLE_ORDER.indexOf(key(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

// DB có thể có nhiều mã cùng nghĩa "Vận hành KD" (OPERATIONS, BUSINESS_OPERATOR…). Danh sách chọn vai trò chỉ hiện
// một mục cho mỗi nhãn; ưu tiên OPERATIONS vì đây là mã được BE cho phép lưu chính sách (RentalPolicyEndpoints).
const PREFERRED_ROLE = { "Vận hành KD": "OPERATIONS" };
export const uniqueRoles = (list, key = (x) => x) => {
  const byLabel = new Map();
  for (const item of list) {
    const label = roleLabel(key(item));
    const kept = byLabel.get(label);
    if (!kept || (PREFERRED_ROLE[label] === key(item) && key(kept) !== key(item))) byLabel.set(label, item);
  }
  return list.filter((item) => byLabel.get(roleLabel(key(item))) === item);
};

// Vai trò gắn với một cơ sở cụ thể (BE: chỉ STAFF / MANAGER được phân công cơ sở)
export const FACILITY_ROLES = ["STAFF", "MANAGER"];
export const needsFacility = (roles = []) => roles.some((r) => FACILITY_ROLES.includes(r));

// Phạm vi dữ liệu theo vai trò (Figma A03)
export const ROLE_SCOPE = {
  CUSTOMER: "Chỉ dữ liệu của chính mình",
  STAFF: "Dữ liệu tại cơ sở được gán",
  MANAGER: "Dữ liệu tại cơ sở được gán",
  BUSINESS_OPERATOR: "Toàn bộ dữ liệu hệ thống (không gồm tài khoản)",
  BUSSINESS_OPERATOR: "Toàn bộ dữ liệu hệ thống (không gồm tài khoản)",
  OPERATIONS: "Toàn bộ dữ liệu hệ thống (không gồm tài khoản)",
  OPERATION_MANAGER: "Toàn bộ dữ liệu hệ thống (không gồm tài khoản)",
  ADMIN: "Toàn bộ dữ liệu hệ thống, gồm cả tài khoản",
};

export const USER_STATUS = {
  ACTIVE: ["Đang hoạt động", "green"],
  LOCKED: ["Đang khoá", "red"],
  SUSPENDED: ["Tạm ngưng", "amber"],
  INACTIVE: ["Ngưng hoạt động", "gray"],
};
export const ASSIGNMENT_STATUS = {
  ACTIVE: ["Đang phụ trách", "green"],
  SUSPENDED: ["Tạm ngưng", "amber"],
  ENDED: ["Đã kết thúc", "gray"],
};

// #40: ba nhóm nhật ký rõ nghĩa. Chuyển cơ sở phụ trách là "Phân công nhân sự", không phải đổi vai trò.
export const ACTION_GROUPS = {
  // Thay đổi dữ liệu: tài khoản, cơ sở, loại kho, giá, chính sách, chỉnh số liệu bằng Công cụ demo
  data: ["USER_CREATE", "USER_UPDATE", "USER_RESET_PASSWORD",
    "FACILITY_CREATE", "FACILITY_UPDATE", "FACILITY_STATUS_CHANGE",
    "RATE_SET", "RATE_SUPERSEDE",
    "POLICY_CREATE", "POLICY_UPDATE", "POLICY_ACTIVATE", "POLICY_DEACTIVATE", "POLICY_SUPERSEDE", "POLICY_DELETE_DRAFT", "RENTAL_POLICY_PUBLISHED",
    "DEMO_CONTRACT_EDITED", "DEMO_PAYMENT_EDITED"],
  // Phân công nhân sự: gán / đổi cơ sở phụ trách và trạng thái phân công
  staffing: ["FACILITY_SCOPE_ASSIGN", "FACILITY_SCOPE_STATUS_CHANGE"],
  // Phân quyền: cấp, đổi, thu hồi vai trò / quyền
  access: ["ROLE_ASSIGN", "ROLE_CHANGE", "ROLE_REVOKE", "PERMISSION_ASSIGN", "PERMISSION_REVOKE"],
};
export const ACTION_LABELS = {
  USER_CREATE: "Tạo tài khoản mới",
  USER_UPDATE: "Cập nhật tài khoản",
  USER_RESET_PASSWORD: "Đặt lại mật khẩu",
  ROLE_ASSIGN: "Gán vai trò",
  ROLE_REVOKE: "Thu hồi vai trò",
  PERMISSION_ASSIGN: "Gán quyền cho vai trò",
  PERMISSION_REVOKE: "Thu hồi quyền của vai trò",
  FACILITY_SCOPE_ASSIGN: "Phân công cơ sở",
  FACILITY_SCOPE_STATUS_CHANGE: "Đổi trạng thái phân công cơ sở",
  ROLE_CHANGE: "Đổi vai trò",
  FACILITY_CREATE: "Thêm cơ sở",
  FACILITY_UPDATE: "Sửa thông tin cơ sở",
  FACILITY_STATUS_CHANGE: "Đổi trạng thái cơ sở",
  RATE_SET: "Đặt giá thuê",
  RATE_SUPERSEDE: "Kết thúc giá thuê cũ",
  POLICY_CREATE: "Tạo chính sách",
  POLICY_UPDATE: "Sửa chính sách",
  POLICY_ACTIVATE: "Áp dụng chính sách",
  POLICY_DEACTIVATE: "Ngừng áp dụng chính sách",
  POLICY_SUPERSEDE: "Thay chính sách cũ",
  POLICY_DELETE_DRAFT: "Xoá bản nháp chính sách",
  RENTAL_POLICY_PUBLISHED: "Công bố chính sách thuê",
  DEMO_CONTRACT_EDITED: "Công cụ demo · chỉnh",
  DEMO_PAYMENT_EDITED: "Công cụ demo · chỉnh",
  ACCESS_SCANNED: "Quét mã mở cửa",
  DOOR_CLOSED: "Đóng cửa kho",
  DOOR_SUPPORT_REQUESTED: "Gọi hỗ trợ tại cửa",
  MOVE_OUT_REQUESTED: "Khách gửi trả kho",
  KEY_PICKUP_REQUESTED: "Khách yêu cầu nhận chìa khoá",
  PAYMENT_CONFIRMED: "Xác nhận thanh toán",
  RENEWAL_PAID: "Thanh toán gia hạn",
  RENEWAL_APPROVED: "Xác nhận gia hạn",
  RENEWAL_CANCELLED: "Huỷ gia hạn",
  RENEWAL_EXPIRED: "Gia hạn hết hạn thanh toán",
  CONTRACT_AUTO_ISSUED: "Hệ thống cấp hợp đồng",
  UNIT_PROPOSED: "Hệ thống bố trí ô",
  UNIT_REPROPOSED: "Hệ thống bố trí lại ô",
  UNIT_ALLOCATED: "Phân bổ ô",
  OVERDUE_CASE_OPENED: "Mở hồ sơ quá hạn",
  OVERDUE_CASE_ESCALATED: "Quá hạn tới mốc xử lý đồ",
  CONFIRM_DEPOSIT_REFUND: "Xác nhận hoàn cọc",
  CREDENTIAL_REISSUED: "Cấp lại mã ra vào",
  REPORT_EXPORT: "Xuất báo cáo",
  PASSWORD_RESET_COMPLETED: "Đặt lại mật khẩu (khách tự làm)",
};
// #39: hành động chưa có tên tiếng Việt thì không hiện mã kỹ thuật thô
export const actionLabel = (a) => ACTION_LABELS[a] || "Hoạt động hệ thống";

// Đọc vai trò từ JWT của backend (ClaimTypes.Role)
const ROLE_CLAIMS = ["http://schemas.microsoft.com/ws/2008/06/identity/claims/role", "role", "roles"];
export function rolesFromToken(token) {
  try {
    const part = String(token || "").split(".")[1];
    if (!part) return [];
    const json = decodeURIComponent(
      atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(part.length + ((4 - (part.length % 4)) % 4), "="))
        .split("")
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    const payload = JSON.parse(json);
    for (const k of ROLE_CLAIMS) {
      const v = payload[k];
      if (v) return (Array.isArray(v) ? v : [v]).map(String);
    }
  } catch {
    /* token không hợp lệ */
  }
  return [];
}
export const isAdminRoles = (roles = []) => roles.includes("ADMIN");
export const isCustomerRoles = (roles = []) => roles.length === 0 || roles.includes("CUSTOMER");

export const isStaffRoles = (roles = []) => roles.includes("STAFF");
export const isManagerRoles = (roles = []) => roles.includes("MANAGER");
export const isBusinessRoles = (roles = []) =>
  roles.includes("BUSINESS_OPERATOR") || roles.includes("BUSSINESS_OPERATOR") || roles.includes("OPERATIONS") || roles.includes("OPERATION_MANAGER");
// Vai trò làm việc tại cơ sở (không dùng giao diện khách hàng)
export const isOpsRoles = (roles = []) => isStaffRoles(roles) || isManagerRoles(roles);
// Trang chính sau đăng nhập theo vai trò (ưu tiên quyền cao hơn khi có nhiều vai trò)
export const homeFor = (roles = []) =>
  isAdminRoles(roles) ? "admin" : isBusinessRoles(roles) ? "business" : isManagerRoles(roles) ? "manager" : isStaffRoles(roles) ? "staff" : "overview";

