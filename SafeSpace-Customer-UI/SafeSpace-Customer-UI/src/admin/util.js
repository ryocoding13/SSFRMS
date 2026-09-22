import { useCallback, useEffect, useRef, useState } from "react";
import { parseUtc } from "../api/mappers.js";
import { ASSIGNMENT_STATUS, USER_STATUS, actionLabel, roleLabel } from "../lib/roles.js";

const pad = (n) => String(n).padStart(2, "0");
export function dateTime(v) {
  const d = parseUtc(v);
  if (!d) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function dateOnlyLabel(v) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// Tải dữ liệu bất đồng bộ; lỗi 401 được chuyển cho store để kết thúc phiên
export function useLoad(fn, deps, onApiError) {
  const [state, setState] = useState({ loading: true, error: null, data: null });
  const seq = useRef(0);
  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      if (id === seq.current) setState({ loading: false, error: null, data });
    } catch (e) {
      onApiError?.(e);
      if (id === seq.current) setState((s) => ({ loading: false, error: e?.message || "Không tải được dữ liệu.", data: s.data }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    run();
  }, [run]);
  return { ...state, reload: run };
}

const parse = (v) => {
  if (!v) return {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
};
const get = (o, key) => o[key] ?? o[key[0].toLowerCase() + key.slice(1)];

// Mô tả một dòng nhật ký hoạt động bằng tiếng Việt (old/new value do AdminService ghi dạng JSON PascalCase)
export function describeActivity(log, nameOf) {
  const nv = parse(log.newValue);
  const ov = parse(log.oldValue);
  const who = (id) => nameOf(id) || (id ? `#${id}` : "");
  const status = (s) => USER_STATUS[s]?.[0] || s;
  const scope = (s) => ASSIGNMENT_STATUS[s]?.[0] || s;
  switch (log.action) {
    case "USER_CREATE":
      return `Tạo tài khoản mới — ${get(nv, "FullName") || who(log.entityId)}`;
    case "USER_UPDATE": {
      const from = get(ov, "Status");
      const to = get(nv, "Status");
      const change = from && to && from !== to ? ` · ${status(from)} → ${status(to)}` : "";
      return `Cập nhật tài khoản — ${get(nv, "FullName") || who(log.entityId)}${change}`;
    }
    case "USER_RESET_PASSWORD":
      return `Đặt lại mật khẩu — ${who(log.entityId)}`;
    case "ROLE_ASSIGN":
      return `Gán vai trò ${roleLabel(get(nv, "RoleName") || "")} — ${who(get(nv, "UserId") || log.entityId)}`;
    case "ROLE_REVOKE":
      return `Thu hồi vai trò ${roleLabel(get(ov, "RoleName") || "")} — ${who(get(ov, "UserId") || log.entityId)}`;
    case "PERMISSION_ASSIGN":
      return `Gán quyền ${get(nv, "PermissionCode") || ""} cho ${roleLabel(get(nv, "RoleName") || "")}`;
    case "PERMISSION_REVOKE":
      return `Thu hồi quyền ${get(ov, "PermissionCode") || ""} của ${roleLabel(get(ov, "RoleName") || "")}`;
    case "FACILITY_SCOPE_ASSIGN":
      return `Phân công ${get(nv, "FacilityName") || "cơ sở"} — ${who(get(nv, "UserId") || log.entityId)}`;
    case "FACILITY_SCOPE_STATUS_CHANGE":
      return `Đổi trạng thái phân công cơ sở · ${scope(get(ov, "Status"))} → ${scope(get(nv, "Status"))}`;
    default:
      return `${actionLabel(log.action)}${log.entityType ? ` (${log.entityType}${log.entityId ? ` #${log.entityId}` : ""})` : ""}`;
  }
}

// Mật khẩu tạm thời: 12 ký tự, đủ chữ hoa / thường / số / ký tự đặc biệt
export function tempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#$%&*"];
  const rand = (n) => {
    const a = new Uint32Array(1);
    (globalThis.crypto || window.crypto).getRandomValues(a);
    return a[0] % n;
  };
  const chars = sets.map((s) => s[rand(s.length)]);
  const all = sets.join("");
  while (chars.length < 12) chars.push(all[rand(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export const usernameFrom = (email) =>
  String(email || "")
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 50);
