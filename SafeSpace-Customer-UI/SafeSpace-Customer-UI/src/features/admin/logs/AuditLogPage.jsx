/*
 * AUDIT LOG PAGE - NHẬT KÝ HOẠT ĐỘNG & LỊCH SỬ ĐĂNG NHẬP
 *
 * Chức năng chính:
 * 1. Cho phép Quản trị viên (Admin) theo dõi toàn bộ hoạt động kiểm toán trong hệ thống:
 *    - Lịch sử đăng nhập: Thời gian, người dùng, IP, thiết bị, trạng thái (thành công / thất bại), giờ đăng xuất.
 *    - Thay đổi dữ liệu: Tạo, sửa, khóa, mở khóa tài khoản, phân công cơ sở.
 *    - Phân quyền: Gán hoặc thu hồi vai trò của người dùng, cấp hoặc gỡ quyền hạn của vai trò.
 * 2. Phân loại theo Tab:
 *    - "Tất cả" (all): Gộp cả lịch sử đăng nhập và nhật ký hành động, sắp xếp mới nhất lên đầu.
 *    - "Đăng nhập" (login): Chỉ xem lịch sử đăng nhập (phân trang phía server).
 *    - "Thay đổi dữ liệu" (data): Nhật ký thay đổi người dùng, cơ sở.
 *    - "Phân quyền" (access): Nhật ký thay đổi vai trò và quyền hạn.
 * 3. Bộ lọc thời gian: Lọc nhật ký từ ngày đến ngày (DatePicker).
 * 4. Phân trang: Hiển thị 10 bản ghi mỗi trang.
 */

import React, { useMemo, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import { parseUtc } from "../../../shared/api/apiMappers.js";
import { DatePicker, Pagination } from "../../../shared/components/Pickers.jsx";
import { Notice } from "../../../shared/components/UI.jsx";
import { ACTION_GROUPS, roleLabel, sortRoles } from "../../../shared/utils/roles.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateTime, describeActivity, useLoad } from "../utils/adminUtils.js";

// Danh sách các tab phân loại nhật ký: [mã tab, tên hiển thị]
const TABS = [
  ["all", "Tất cả"],
  ["login", "Đăng nhập"],
  ["data", "Thay đổi dữ liệu"],
  ["access", "Phân quyền"],
];

// Số bản ghi hiển thị trên mỗi trang bảng
const PAGE_SIZE = 10;

// Số lượng bản ghi mới nhất tải về để gộp và lọc ở phía giao diện cho các tab tổng hợp
const FETCH = 100;

/*
 * Các hàm tiện ích chuyển ngày địa phương thành mốc giờ UTC:
 * - startOf(d): chuyển ngày d thành đầu ngày UTC (00:00:00)
 * - endOf(d): chuyển ngày d thành cuối ngày UTC (23:59:59)
 */
const startOf = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const endOf = (d) => (d ? new Date(`${d}T23:59:59`).toISOString() : undefined);

export default function AuditLogPage() {
  const { onApiError } = useApp();

  /*
   * STATE BỘ LỌC VÀ PHÂN TRANG
   */
  const [tab, setTab] = useState("all"); // Tab đang chọn (all, login, data, access)
  const [from, setFrom] = useState("");  // Lọc từ ngày (chuỗi YYYY-MM-DD)
  const [to, setTo] = useState("");      // Lọc đến ngày (chuỗi YYYY-MM-DD)
  const [page, setPage] = useState(1);   // Số trang hiện tại

  /*
   * TẢI DANH SÁCH NGƯỜI DÙNG ĐỂ MAP TÊN VÀ VAI TRÒ
   * Tải map người dùng (tối đa 500) để tra cứu họ tên và vai trò theo userId nhanh chóng khi hiển thị log.
   */
  const users = useLoad(async () => {
    const res = await adminApi.users({ page: 1, pageSize: 500 });
    return new Map(res.items.map((u) => [u.userId, u]));
  }, [], onApiError);

  /*
   * TẢI NHẬT KÝ TỪ BACKEND
   * - Nếu tab là "login": Chỉ gọi API loginHistory với phân trang từ server.
   * - Nếu tab khác: Gọi đồng thời cả loginHistory (nếu tab all) và activityLogs theo khoảng ngày lọc.
   */
  const logs = useLoad(async () => {
    const range = { fromDate: startOf(from), toDate: endOf(to) };
    if (tab === "login") return { login: await adminApi.loginHistory({ page, pageSize: PAGE_SIZE, ...range }) };
    const [login, activity] = await Promise.all([
      tab === "all" ? adminApi.loginHistory({ page: 1, pageSize: FETCH, ...range }) : null,
      adminApi.activityLogs({ page: 1, pageSize: FETCH, ...range }),
    ]);
    return { login, activity };
  }, [tab, from, to, tab === "login" ? page : 0], onApiError);

  const userMap = users.data || new Map();
  // Hàm lấy tên người dùng từ map
  const nameOf = (id) => userMap.get(id)?.fullName;
  // Hàm lấy chuỗi các vai trò của người dùng từ map
  const rolesOf = (id) => sortRoles(userMap.get(id)?.roles || []).map(roleLabel).join(", ") || "—";

  /*
   * rows - Chuẩn hóa và gộp danh sách bản ghi hiển thị
   * - Chuyển login logs và activity logs thành định dạng bảng thống nhất.
   * - Tab "login": chỉ hiển thị danh sách đăng nhập.
   * - Tab khác: lọc theo nhóm hành động (ACTION_GROUPS) và sắp xếp theo mốc thời gian giảm dần (mới nhất lên trước).
   */
  const rows = useMemo(() => {
    const d = logs.data;
    if (!d) return [];

    // Chuẩn hóa danh sách lịch sử đăng nhập
    const loginRows = (d.login?.items || []).map((h) => ({
      id: `L${h.loginHistoryId}`,
      at: h.loginAt,
      userId: h.userId,
      user: h.fullName || h.username,
      action: `${h.loginStatus === "SUCCESS" ? "Đăng nhập thành công" : `Đăng nhập ${h.loginStatus === "FAILED" ? "thất bại" : h.loginStatus.toLowerCase()}`}${h.logoutAt ? ` · đăng xuất ${dateTime(h.logoutAt).slice(11)}` : ""}`,
      ip: h.ipAddress || "—",
      device: h.deviceInfo,
    }));

    if (tab === "login") return loginRows;

    // Chuẩn hóa danh sách nhật ký hành động (activity logs)
    const group = ACTION_GROUPS[tab];
    const actRows = (d.activity?.items || [])
      .filter((a) => !group || group.includes(a.action))
      .map((a) => ({
        id: `A${a.logId}`,
        at: a.loggedAt,
        userId: a.userId,
        user: a.userId ? nameOf(a.userId) || a.username || `#${a.userId}` : "Hệ thống",
        action: describeActivity(a, nameOf),
        ip: a.ipAddress || "—",
      }));

    // Gộp và sắp xếp theo thời gian mới nhất
    return [...loginRows, ...actRows].sort((x, y) => (parseUtc(y.at)?.getTime() || 0) - (parseUtc(x.at)?.getTime() || 0));
  }, [logs.data, tab, userMap]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * TÍNH TOÁN PHÂN TRANG
   * - tab === "login": Phân trang phía server (serverPaged = true).
   * - các tab khác: Phân trang phía client trên mảng `rows`.
   */
  const serverPaged = tab === "login";
  const total = serverPaged ? logs.data?.login?.totalItems || 0 : rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = serverPaged ? rows : rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const first = (current - 1) * PAGE_SIZE + 1;

  // Hàm chọn giá trị bộ lọc: cập nhật state tương ứng và tự động quay về trang 1
  const pick = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  return (
    <main className="container page">
      {/* Tiêu đề trang và phần mô tả */}
      <header className="page-header">
        <div>
          <h1>Lịch sử đăng nhập & nhật ký hoạt động</h1>
          <p>Theo dõi đăng nhập, thay đổi dữ liệu tài khoản và phân quyền trong hệ thống.</p>
        </div>
      </header>

      {/* Thanh công cụ: Chọn tab loại nhật ký và bộ lọc ngày */}
      <div className="admin-toolbar">
        {/* Nhóm các nút chuyển đổi Tab */}
        <div className="chips" role="tablist" aria-label="Loại nhật ký">
          {TABS.map(([k, label]) => (
            <button
              type="button"
              role="tab"
              key={k}
              aria-selected={tab === k}
              className={`chip chip--dark${tab === k ? " is-on" : ""}`}
              onClick={() => pick(setTab)(k)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Bộ lọc chọn khoảng ngày (Từ ngày - Đến ngày) */}
        <div className="admin-toolbar__filters">
          <DatePicker label="Từ ngày" value={from} min="2000-01-01" onChange={pick(setFrom)} className="inline-date" />
          <DatePicker label="Đến ngày" value={to} min={from || "2000-01-01"} onChange={pick(setTo)} className="inline-date" />
          {/* Nút xóa bộ lọc ngày nếu đang lọc */}
          {(from || to) && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setFrom("");
                setTo("");
                setPage(1);
              }}
            >
              Bỏ lọc ngày
            </button>
          )}
        </div>
      </div>

      {/* Thông báo nếu có lỗi tải log */}
      {logs.error && <Notice tone="error">{logs.error}</Notice>}

      {/* Bảng danh sách nhật ký */}
      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Người dùng</th>
              <th>Vai trò</th>
              <th>Hành động</th>
              <th>Địa chỉ IP</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{dateTime(r.at)}</td>
                <td>{r.user}</td>
                <td>{r.userId ? rolesOf(r.userId) : "—"}</td>
                <td>{r.action}</td>
                <td className="nowrap" title={r.device || undefined}>{r.ip}</td>
              </tr>
            ))}
            {/* Trường hợp không có dữ liệu */}
            {!logs.loading && shown.length === 0 && (
              <tr>
                <td colSpan={5} className="table__empty">Chưa có hoạt động trong khoảng thời gian này.</td>
              </tr>
            )}
            {/* Trường hợp đang tải lần đầu */}
            {logs.loading && !logs.data && (
              <tr>
                <td colSpan={5} className="table__empty">Đang tải nhật ký…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Thanh điều hướng phân trang */}
      <Pagination page={current} pages={pages} total={total} from={first} to={first + shown.length - 1} noun="bản ghi" onPage={setPage} />

      {/* Gợi ý khi số bản ghi đạt mốc FETCH ở phía client */}
      {!serverPaged && total >= FETCH && (
        <p className="hint">Hiển thị {FETCH} bản ghi mới nhất mỗi loại. Dùng bộ lọc ngày để xem các mốc cũ hơn.</p>
      )}
    </main>
  );
}
