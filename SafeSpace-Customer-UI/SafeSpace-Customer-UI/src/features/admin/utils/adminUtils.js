/*
 * ADMIN UTILS - CÁC HÀM TIỆN ÍCH DÀNH RIÊNG CHO KHU VỰC QUẢN TRỊ
 *
 * Chức năng chính:
 * 1. dateTime(v): Định dạng ngày giờ UTC từ backend thành chuỗi tiếng Việt dễ đọc (DD/MM/YYYY HH:mm).
 * 2. dateOnlyLabel(v): Định dạng chuỗi ngày YYYY-MM-DD thành DD/MM/YYYY.
 * 3. useLoad(fn, deps, onApiError): Custom React Hook tải dữ liệu bất đồng bộ với cơ chế chống race-condition (seq ref).
 * 4. describeActivity(log, nameOf): Diễn giải mã hành động kỹ thuật (JSON PascalCase) thành mô tả tiếng Việt chi tiết cho nhật ký.
 * 5. tempPassword(): Tạo mật khẩu tạm thời ngẫu nhiên 12 ký tự mạnh (chữ hoa, chữ thường, số, ký tự đặc biệt).
 * 6. usernameFrom(email): Tạo gợi ý tên đăng nhập chuẩn hóa từ địa chỉ email (loại bỏ dấu tiếng Việt và ký tự đặc biệt).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { parseUtc } from "../../../shared/api/apiMappers.js";
import { ASSIGNMENT_STATUS, USER_STATUS, actionLabel, roleLabel } from "../../../shared/utils/roles.js";

// Hàm đệm số có 2 chữ số (ví dụ: 5 -> "05")
const pad = (n) => String(n).padStart(2, "0");

/*
 * dateTime - Định dạng ngày giờ
 * Nhận giá trị ngày giờ (chuỗi ISO UTC hoặc Date) và chuyển thành định dạng "DD/MM/YYYY HH:mm" theo giờ địa phương.
 * Trả về "—" nếu giá trị không hợp lệ hoặc rỗng.
 */
export function dateTime(v) {
  const d = parseUtc(v);
  if (!d) return "—";
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/*
 * dateOnlyLabel - Định dạng chỉ ngày
 * Nhận chuỗi ngày có dạng "YYYY-MM-DD..." và chuyển thành "DD/MM/YYYY".
 * Trả về "—" nếu không có dữ liệu.
 */
export function dateOnlyLabel(v) {
  if (!v) return "—";
  const [y, m, d] = String(v).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/*
 * useLoad - Custom Hook tải dữ liệu bất đồng bộ từ API
 *
 * Tham số:
 * - fn: hàm async gọi API và trả về kết quả
 * - deps: mảng dependencies kích hoạt tải lại dữ liệu khi giá trị thay đổi
 * - onApiError: callback xử lý lỗi API (đặc biệt khi gặp lỗi 401 Unauthorized để đăng xuất)
 *
 * Trả về:
 * - loading: boolean cho biết request đang chạy
 * - error: thông điệp lỗi (hoặc null)
 * - data: dữ liệu trả về từ API
 * - reload: hàm thủ công kích hoạt tải lại dữ liệu
 */
export function useLoad(fn, deps, onApiError) {
  const [state, setState] = useState({ loading: true, error: null, data: null });

  // seq ref dùng để đếm số thứ tự request, tránh race-condition khi response cũ đến sau response mới
  const seq = useRef(0);

  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fn();
      // Chỉ cập nhật state nếu đây là request mới nhất
      if (id === seq.current) setState({ loading: false, error: null, data });
    } catch (e) {
      onApiError?.(e);
      if (id === seq.current) setState((s) => ({ loading: false, error: e?.message || "Không tải được dữ liệu.", data: s.data }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Tự động gọi run khi các giá trị trong deps thay đổi
  useEffect(() => {
    run();
  }, [run]);

  return { ...state, reload: run };
}

/*
 * parse - Chuyển chuỗi JSON sang object an toàn
 * Nếu parse lỗi hoặc giá trị rỗng thì trả về object rỗng {} thay vì làm văng lỗi ứng dụng.
 */
const parse = (v) => {
  if (!v) return {};
  try {
    const o = JSON.parse(v);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
};

/*
 * get - Lấy thuộc tính của object bất kể backend dùng PascalCase hay camelCase
 * Ví dụ: get(obj, "FullName") sẽ thử lấy obj["FullName"], nếu không có thì lấy obj["fullName"].
 */
const get = (o, key) => o[key] ?? o[key[0].toLowerCase() + key.slice(1)];

/*
 * describeActivity - Diễn giải nhật ký hoạt động sang tiếng Việt
 *
 * Backend AdminService ghi log oldValue và newValue dạng JSON PascalCase.
 * Hàm này đọc log.action và các giá trị trước/sau để tạo câu mô tả tự nhiên bằng tiếng Việt cho Admin đọc.
 *
 * Tham số:
 * - log: bản ghi log chứa action, entityId, oldValue, newValue
 * - nameOf: hàm tra cứu tên người dùng theo userId
 */
export function describeActivity(log, nameOf) {
  const nv = parse(log.newValue);
  const ov = parse(log.oldValue);
  const who = (id) => nameOf(id) || (id ? `#${id}` : "");
  const status = (s) => USER_STATUS[s]?.[0] || s;
  const scope = (s) => ASSIGNMENT_STATUS[s]?.[0] || s;

  switch (log.action) {
    // 1. Tạo tài khoản người dùng mới
    case "USER_CREATE":
      return `Tạo tài khoản mới — ${get(nv, "FullName") || who(log.entityId)}`;

    // 2. Cập nhật thông tin hoặc trạng thái tài khoản
    case "USER_UPDATE": {
      const from = get(ov, "Status");
      const to = get(nv, "Status");
      const change = from && to && from !== to ? ` · ${status(from)} → ${status(to)}` : "";
      return `Cập nhật tài khoản — ${get(nv, "FullName") || who(log.entityId)}${change}`;
    }

    // 3. Đặt lại mật khẩu
    case "USER_RESET_PASSWORD":
      return `Đặt lại mật khẩu — ${who(log.entityId)}`;

    // 4. Gán vai trò cho người dùng
    case "ROLE_ASSIGN":
      return `Gán vai trò ${roleLabel(get(nv, "RoleName") || "")} — ${who(get(nv, "UserId") || log.entityId)}`;

    // 5. Thu hồi vai trò khỏi người dùng
    case "ROLE_REVOKE":
      return `Thu hồi vai trò ${roleLabel(get(ov, "RoleName") || "")} — ${who(get(ov, "UserId") || log.entityId)}`;

    // 6. Gán quyền cho vai trò
    case "PERMISSION_ASSIGN":
      return `Gán quyền ${get(nv, "PermissionCode") || ""} cho ${roleLabel(get(nv, "RoleName") || "")}`;

    // 7. Thu hồi quyền khỏi vai trò
    case "PERMISSION_REVOKE":
      return `Thu hồi quyền ${get(ov, "PermissionCode") || ""} của ${roleLabel(get(ov, "RoleName") || "")}`;

    // 8. Phân công cơ sở cho nhân viên/quản lý
    case "FACILITY_SCOPE_ASSIGN":
      return `Phân công ${get(nv, "FacilityName") || "cơ sở"} — ${who(get(nv, "UserId") || log.entityId)}`;

    // 9. Thay đổi trạng thái phân công cơ sở (ví dụ: đang phụ trách -> kết thúc)
    case "FACILITY_SCOPE_STATUS_CHANGE":
      return `Đổi trạng thái phân công cơ sở · ${scope(get(ov, "Status"))} → ${scope(get(nv, "Status"))}`;

    // Mặc định: hiển thị nhãn hành động và mã đối tượng
    default:
      return `${actionLabel(log.action)}${log.entityType ? ` (${log.entityType}${log.entityId ? ` #${log.entityId}` : ""})` : ""}`;
  }
}

/*
 * tempPassword - Sinh mật khẩu tạm thời ngẫu nhiên
 *
 * Tiêu chuẩn mật khẩu:
 * - Độ dài: 12 ký tự.
 * - Đảm bảo có ít nhất: 1 chữ cái in hoa, 1 chữ cái in thường, 1 chữ số, 1 ký tự đặc biệt.
 * - Sử dụng crypto.getRandomValues để sinh số ngẫu nhiên an toàn mật mã (cryptographically secure).
 * - Xáo trộn ngẫu nhiên (Fisher-Yates shuffle) trước khi trả về.
 */
export function tempPassword() {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#$%&*"];
  const rand = (n) => {
    const a = new Uint32Array(1);
    (globalThis.crypto || window.crypto).getRandomValues(a);
    return a[0] % n;
  };
  // Chọn ít nhất một ký tự từ mỗi tập hợp ký tự
  const chars = sets.map((s) => s[rand(s.length)]);
  const all = sets.join("");
  // Bổ sung các ký tự còn lại cho đủ độ dài 12
  while (chars.length < 12) chars.push(all[rand(all.length)]);
  // Xáo trộn ngẫu nhiên mảng ký tự
  for (let i = chars.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

/*
 * usernameFrom - Tạo gợi ý tên đăng nhập từ địa chỉ email
 *
 * Quy trình xử lý:
 * 1. Lấy phần trước dấu '@' của email.
 * 2. Chuyển sang chữ thường.
 * 3. Chuẩn hóa NFD và loại bỏ toàn bộ dấu tiếng Việt (ví dụ: "đặng" -> "dang").
 * 4. Loại bỏ các ký tự không phải chữ cái thường, số, dấu chấm, gạch dưới, gạch ngang.
 * 5. Cắt ngắn tối đa 50 ký tự theo giới hạn của cơ sở dữ liệu.
 */
export const usernameFrom = (email) =>
  String(email || "")
    .split("@")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 50);
