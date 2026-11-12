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
      if (id === seq.current) onApiError?.(e);
      if (id === seq.current) setState((s) => ({ loading: false, error: e?.message || "Không tải được dữ liệu.", data: s.data }));
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  // Tự động gọi run khi các giá trị trong deps thay đổi
  useEffect(() => {
    run();
    return () => {seq.current++;};
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

/** #39: tên đối tượng thay cho "CONTRACT #12". Mã hiển thị theo quy ước của giao diện (HĐ-…, TT-…, GH-…). */
const pad4 = (id) => String(id ?? "").padStart(4, "0");
const ENTITY = {
  // Mã hợp đồng đầy đủ cần năm bắt đầu (HĐ-2026-0012); không có năm thì ghi số hợp đồng
  CONTRACT: (id, year) => (year ? `hợp đồng HĐ-${year}-${pad4(id)}` : `hợp đồng số ${Number(id)}`),
  RESERVATION: (id) => `đơn đặt kho số ${Number(id)}`,
  PAYMENT: (id) => `giao dịch TT-${pad4(id)}`,
  RENEWAL: (id) => `yêu cầu gia hạn GH-${pad4(id)}`,
  RENTAL_RATE: () => "bảng giá thuê",
  POLICY: () => "chính sách",
  RENTAL_POLICY: () => "chính sách thuê",
  SUPPORT_TICKET: (id) => `yêu cầu hỗ trợ HT-${pad4(id)}`,
};
const money = (v) => (v == null || v === "" ? "" : `${Number(v).toLocaleString("vi-VN")} đ`);
const ymd = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10).split("-").reverse().join("/") : v);
const CONTRACT_STATE = { DRAFT: "Chưa kích hoạt", ACTIVE: "Đang thuê", EXPIRING: "Sắp hết hạn", OVERDUE: "Quá hạn", RETURN_PENDING: "Chờ trả kho", COMPLETED: "Đã kết thúc", TERMINATED: "Đã chấm dứt", CANCELLED: "Đã huỷ" };
const FACILITY_STATUS = { ACTIVE: "Đang hoạt động", INACTIVE: "Tạm ngừng", MAINTENANCE: "Bảo trì", CLOSED: "Đóng cửa" };

/** Trước → sau của các trường đã đổi (bỏ trường không đổi), ví dụ "Giờ mở cửa 07:00 → 06:00". */
function changes(ov, nv, fields) {
  return fields
    .map(([key, label, fmt = (x) => x]) => {
      const a = get(ov, key), b = get(nv, key);
      // Bản ghi cũ không lưu trường này ở một phía → không đoán giá trị
      if (a === undefined || b === undefined) return null;
      if (String(a ?? "") === String(b ?? "")) return null;
      return `${label ? `${label} ` : ""}${a == null || a === "" ? "trống" : fmt(a)} → ${b == null || b === "" ? "trống" : fmt(b)}`;
    })
    .filter(Boolean)
    .join(" · ");
}

/**
 * describeActivity - Diễn giải nhật ký hoạt động sang câu tiếng Việt, ưu tiên tên người / tên đối tượng (#39)
 * và giá trị trước → sau (#40).
 * ctx (không bắt buộc): facilityName(id), unitTypeName(id) để đổi mã cơ sở / loại kho thành tên.
 */
export function describeActivity(log, nameOf, ctx = {}) {
  const nv = parse(log.newValue);
  const ov = parse(log.oldValue);
  const who = (id) => nameOf(id) || (id ? "tài khoản không còn trong danh sách" : "");
  const status = (s) => USER_STATUS[s]?.[0] || s;
  const scope = (s) => ASSIGNMENT_STATUS[s]?.[0] || s;
  const fac = (id, name) => name || ctx.facilityName?.(id) || (id ? "cơ sở không còn trong danh sách" : "");
  const type = (id) => ctx.unitTypeName?.(id) || "loại kho";
  const tail = (text) => (text ? ` · ${text}` : "");

  switch (log.action) {
    case "USER_CREATE":
      return `Tạo tài khoản mới — ${get(nv, "FullName") || who(log.entityId)}`;
    case "USER_UPDATE":
      return `Cập nhật tài khoản — ${get(nv, "FullName") || who(log.entityId)}${tail(changes(ov, nv, [["FullName", "Họ tên"], ["Email", "Email"], ["Phone", "Số điện thoại"], ["Status", "", status]]))}`;
    case "USER_RESET_PASSWORD":
      return `Đặt lại mật khẩu — ${who(log.entityId)}`;

    // Phân quyền
    case "ROLE_ASSIGN":
      return `Gán vai trò ${roleLabel(get(nv, "RoleName") || "")} — ${who(get(nv, "UserId") || log.entityId)}`;
    case "ROLE_REVOKE":
      return `Thu hồi vai trò ${roleLabel(get(ov, "RoleName") || "")} — ${who(get(ov, "UserId") || log.entityId)}`;
    case "ROLE_CHANGE":
      return `Đổi vai trò ${roleLabel(get(ov, "RoleName") || "")} → ${roleLabel(get(nv, "RoleName") || "")} — ${who(get(nv, "UserId") || log.entityId)}`;
    case "PERMISSION_ASSIGN":
      return `Gán quyền ${get(nv, "PermissionCode") || ""} cho ${roleLabel(get(nv, "RoleName") || "")}`;
    case "PERMISSION_REVOKE":
      return `Thu hồi quyền ${get(ov, "PermissionCode") || ""} của ${roleLabel(get(ov, "RoleName") || "")}`;

    // Phân công nhân sự
    case "FACILITY_SCOPE_ASSIGN":
      return `Phân công ${fac(get(nv, "FacilityId"), get(nv, "FacilityName"))} — ${who(get(nv, "UserId") || log.entityId)}`;
    case "FACILITY_SCOPE_STATUS_CHANGE": {
      const user = get(nv, "UserId") || get(ov, "UserId");
      const facility = fac(get(nv, "FacilityId") || get(ov, "FacilityId"), get(nv, "FacilityName") || get(ov, "FacilityName"));
      return `Đổi trạng thái phân công cơ sở${facility ? ` tại ${facility}` : ""}${user ? ` — ${who(user)}` : ""} · ${scope(get(ov, "Status"))} → ${scope(get(nv, "Status"))}`;
    }

    // Thay đổi dữ liệu: cơ sở, giá, chính sách
    case "FACILITY_CREATE":
      return `Thêm cơ sở ${get(nv, "Name") || fac(log.entityId)}`;
    case "FACILITY_UPDATE":
      return `Sửa cơ sở ${get(nv, "Name") || fac(log.entityId)}${tail(changes(ov, nv, [["Name", "Tên"], ["Address", "Địa chỉ"], ["ContactPhone", "Hotline"], ["OpeningTime", "Giờ mở cửa"], ["ClosingTime", "Giờ đóng cửa"], ["Latitude", "Vĩ độ"], ["Longitude", "Kinh độ"]]))}`;
    case "FACILITY_STATUS_CHANGE":
      return `Đổi trạng thái cơ sở ${get(nv, "Name") || get(ov, "Name") || fac(log.entityId)} · ${FACILITY_STATUS[get(ov, "Status")] || get(ov, "Status") || "—"} → ${FACILITY_STATUS[get(nv, "Status")] || get(nv, "Status") || "—"}`;
    case "RATE_SET":
      return `Đặt giá thuê ${fac(get(nv, "FacilityId"))} · ${type(get(nv, "UnitTypeId"))}: ${money(get(nv, "MonthlyRate"))}/tháng từ ${ymd(get(nv, "EffectiveFrom"))}`;
    case "RATE_SUPERSEDE":
      return `Kết thúc giá thuê cũ ${fac(get(nv, "FacilityId") || get(ov, "FacilityId"))} · ${type(get(nv, "UnitTypeId") || get(ov, "UnitTypeId"))}: ${money(get(ov, "MonthlyRate") || get(nv, "MonthlyRate"))}/tháng${get(nv, "EffectiveTo") ? `, áp dụng đến ${ymd(get(nv, "EffectiveTo"))}` : ""}`;
    case "POLICY_CREATE":
    case "POLICY_UPDATE":
    case "POLICY_ACTIVATE":
    case "POLICY_DEACTIVATE":
    case "POLICY_SUPERSEDE":
    case "POLICY_DELETE_DRAFT": {
      const name = get(nv, "PolicyName") || get(ov, "PolicyName") || "chính sách";
      const where = get(nv, "FacilityName") || get(ov, "FacilityName");
      return `${actionLabel(log.action)} — ${name}${where ? ` (${where})` : ""}${tail(changes(ov, nv, [["Value", "Giá trị"], ["MinValue", "Tối thiểu"], ["MaxValue", "Tối đa"], ["Status", "Trạng thái"]]))}`;
    }

    // Công cụ demo: giá trị trước/sau và lý do
    case "DEMO_CONTRACT_EDITED": {
      const after = get(nv, "After") || nv; // BE ghi { after, reason }; bản ghi phẳng thì đọc thẳng
      const diff = changes(ov, after, [["StartDate", "Ngày bắt đầu", ymd], ["EndDate", "Ngày hết hạn", ymd], ["AgreedMonthlyRate", "Giá thuê/tháng", money], ["Status", "Trạng thái", (x) => CONTRACT_STATE[x] || x]]);
      return `${actionLabel(log.action)} ${ENTITY.CONTRACT(log.entityId, String(get(ov, "StartDate") || "").slice(0, 4))}${tail(diff)}${get(nv, "Reason") ? ` · Lý do: ${get(nv, "Reason")}` : ""}`;
    }
    case "DEMO_PAYMENT_EDITED": {
      const after = get(nv, "After") || nv; // BE ghi { after, reason }; bản ghi phẳng thì đọc thẳng
      const diff = changes(ov, after, [["PaidAt", "Ngày thanh toán", ymd], ["Amount", "Số tiền", money]]);
      return `${actionLabel(log.action)} ${ENTITY.PAYMENT(log.entityId)}${tail(diff)}${get(nv, "Reason") ? ` · Lý do: ${get(nv, "Reason")}` : ""}`;
    }

    // Mặc định: tên hành động + tên đối tượng, không hiện mã kỹ thuật kiểu "CONTRACT #12"
    default: {
      const kind = String(log.entityType || "").toUpperCase();
      let target = "";
      if (kind === "USER" || kind === "USERS") target = who(log.entityId);
      else if (kind === "FACILITY") target = fac(log.entityId);
      else if (ENTITY[kind] && log.entityId) target = ENTITY[kind](log.entityId);
      const unit = get(nv, "unit") || get(nv, "Unit");
      return `${actionLabel(log.action)}${target ? ` — ${target}` : ""}${unit ? ` · ô ${unit}` : ""}`;
    }
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
