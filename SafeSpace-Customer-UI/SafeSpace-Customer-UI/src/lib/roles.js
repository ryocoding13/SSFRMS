// Vai trò, trạng thái tài khoản và nhãn nhật ký của khu quản trị (theo StorageProject.Api).

export const ROLE_LABELS = {
  CUSTOMER: "Khách hàng",
  STAFF: "Nhân viên cơ sở",
  MANAGER: "Quản lý cơ sở",
  OPERATIONS: "Vận hành KD",
  OPERATION_MANAGER: "Vận hành KD",
  ADMIN: "Quản trị",
};
export const ROLE_ORDER = ["CUSTOMER", "STAFF", "MANAGER", "OPERATIONS", "OPERATION_MANAGER", "ADMIN"];
export const roleLabel = (name) => ROLE_LABELS[name] || name;
export const sortRoles = (list, key = (x) => x) =>
  [...list].sort((a, b) => {
    const ia = ROLE_ORDER.indexOf(key(a));
    const ib = ROLE_ORDER.indexOf(key(b));
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

// Vai trò gắn với một cơ sở cụ thể (BE: chỉ STAFF / MANAGER được phân công cơ sở)
export const FACILITY_ROLES = ["STAFF", "MANAGER"];
export const needsFacility = (roles = []) => roles.some((r) => FACILITY_ROLES.includes(r));

// Phạm vi dữ liệu theo vai trò (Figma A03)
export const ROLE_SCOPE = {
  CUSTOMER: "Chỉ dữ liệu của chính mình",
  STAFF: "Dữ liệu tại cơ sở được gán",
  MANAGER: "Dữ liệu tại cơ sở được gán",
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

export const ACTION_GROUPS = {
  data: ["USER_CREATE", "USER_UPDATE", "USER_RESET_PASSWORD", "FACILITY_SCOPE_ASSIGN", "FACILITY_SCOPE_STATUS_CHANGE"],
  access: ["ROLE_ASSIGN", "ROLE_REVOKE", "PERMISSION_ASSIGN", "PERMISSION_REVOKE"],
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
};
export const actionLabel = (a) => ACTION_LABELS[a] || a;

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
