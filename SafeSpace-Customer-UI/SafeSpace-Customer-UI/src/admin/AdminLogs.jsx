import React, { useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { parseUtc } from "../api/mappers";
import { DatePicker, Pagination } from "../components/Pickers";
import { Notice } from "../components/UI";
import { ACTION_GROUPS, roleLabel, sortRoles } from "../lib/roles";
import { useApp } from "../state/store";
import { dateTime, describeActivity, useLoad } from "./util";

const TABS = [
  ["all", "Tất cả"],
  ["login", "Đăng nhập"],
  ["data", "Thay đổi dữ liệu"],
  ["access", "Phân quyền"],
];
const PAGE_SIZE = 10;
const FETCH = 100; // số bản ghi mới nhất lấy mỗi loại để gộp / lọc ở trình duyệt

// Ngày địa phương → mốc UTC để gửi backend
const startOf = (d) => (d ? new Date(`${d}T00:00:00`).toISOString() : undefined);
const endOf = (d) => (d ? new Date(`${d}T23:59:59`).toISOString() : undefined);

export default function AdminLogs() {
  const { onApiError } = useApp();
  const [tab, setTab] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const users = useLoad(async () => {
    const res = await adminApi.users({ page: 1, pageSize: 500 });
    return new Map(res.items.map((u) => [u.userId, u]));
  }, [], onApiError);

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
  const nameOf = (id) => userMap.get(id)?.fullName;
  const rolesOf = (id) => sortRoles(userMap.get(id)?.roles || []).map(roleLabel).join(", ") || "—";

  const rows = useMemo(() => {
    const d = logs.data;
    if (!d) return [];
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
    return [...loginRows, ...actRows].sort((x, y) => (parseUtc(y.at)?.getTime() || 0) - (parseUtc(x.at)?.getTime() || 0));
  }, [logs.data, tab, userMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const serverPaged = tab === "login";
  const total = serverPaged ? logs.data?.login?.totalItems || 0 : rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = serverPaged ? rows : rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const first = (current - 1) * PAGE_SIZE + 1;

  const pick = (fn) => (v) => {
    fn(v);
    setPage(1);
  };

  return (
    <main className="container page">
      <header className="page-header">
        <div>
          <h1>Lịch sử đăng nhập & nhật ký hoạt động</h1>
          <p>Theo dõi đăng nhập, thay đổi dữ liệu tài khoản và phân quyền trong hệ thống.</p>
        </div>
      </header>

      <div className="admin-toolbar">
        <div className="chips" role="tablist" aria-label="Loại nhật ký">
          {TABS.map(([k, label]) => (
            <button type="button" role="tab" key={k} aria-selected={tab === k} className={`chip chip--dark${tab === k ? " is-on" : ""}`} onClick={() => pick(setTab)(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="admin-toolbar__filters">
          <DatePicker label="Từ ngày" value={from} min="2000-01-01" onChange={pick(setFrom)} className="inline-date" />
          <DatePicker label="Đến ngày" value={to} min={from || "2000-01-01"} onChange={pick(setTo)} className="inline-date" />
          {(from || to) && (
            <button type="button" className="link-btn" onClick={() => { setFrom(""); setTo(""); setPage(1); }}>Bỏ lọc ngày</button>
          )}
        </div>
      </div>

      {logs.error && <Notice tone="error">{logs.error}</Notice>}
      <div className="table-wrap panel">
        <table className="table">
          <thead>
            <tr><th>Thời gian</th><th>Người dùng</th><th>Vai trò</th><th>Hành động</th><th>Địa chỉ IP</th></tr>
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
            {!logs.loading && shown.length === 0 && (
              <tr><td colSpan={5} className="table__empty">Chưa có hoạt động trong khoảng thời gian này.</td></tr>
            )}
            {logs.loading && !logs.data && (
              <tr><td colSpan={5} className="table__empty">Đang tải nhật ký…</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <Pagination page={current} pages={pages} total={total} from={first} to={first + shown.length - 1} noun="bản ghi" onPage={setPage} />
      {!serverPaged && total >= FETCH && <p className="hint">Hiển thị {FETCH} bản ghi mới nhất mỗi loại. Dùng bộ lọc ngày để xem các mốc cũ hơn.</p>}
    </main>
  );
}
