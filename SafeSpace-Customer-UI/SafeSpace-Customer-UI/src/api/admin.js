// Endpoint khu quản trị (StorageProject.Api/Endpoints/AdminEndpoints.cs), yêu cầu vai trò ADMIN.
import { request } from "./http.js";

const q = (params = {}) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, v);
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const adminApi = {
  stats: () => request("/api/admin/dashboard/stats"),

  users: (filter) => request(`/api/admin/users${q(filter)}`),
  user: (id) => request(`/api/admin/users/${id}`),
  createUser: (body) => request("/api/admin/users", { method: "POST", body }),
  updateUser: (id, body) => request(`/api/admin/users/${id}`, { method: "PUT", body }),
  resetPassword: (id, newPassword) => request(`/api/admin/users/${id}/reset-password`, { method: "POST", body: { newPassword } }),

  roles: () => request("/api/admin/roles"),
  permissions: () => request("/api/admin/permissions"),
  assignRole: (userId, roleId) => request(`/api/admin/users/${userId}/roles`, { method: "POST", body: { roleId } }),
  revokeRole: (userId, roleId) => request(`/api/admin/users/${userId}/roles/${roleId}`, { method: "DELETE" }),
  assignPermission: (roleId, permissionId) => request(`/api/admin/roles/${roleId}/permissions`, { method: "POST", body: { permissionId } }),
  revokePermission: (roleId, permissionId) => request(`/api/admin/roles/${roleId}/permissions/${permissionId}`, { method: "DELETE" }),

  userFacilities: (userId) => request(`/api/admin/users/${userId}/facilities`),
  assignFacility: (body) => request("/api/admin/user-facilities", { method: "POST", body }),
  setAssignmentStatus: (id, status) => request(`/api/admin/user-facilities/${id}/status`, { method: "PUT", body: { status } }),

  loginHistory: (filter) => request(`/api/admin/logs/login-history${q(filter)}`),
  activityLogs: (filter) => request(`/api/admin/logs/activity-logs${q(filter)}`),

  facilities: () => request("/api/facilities", { auth: false }),
};
