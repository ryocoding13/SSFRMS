import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/admin";
import { Pagination, Select } from "../components/Pickers";
import { Empty, LinkButton, Notice, StatusTag } from "../components/UI";
import { USER_STATUS, needsFacility, roleLabel, sortRoles } from "../lib/roles";
import { go, href } from "../lib/router";
import { useApp } from "../state/store";
import { useLoad } from "./util";

const PAGE_SIZE = 10;

export default function AdminUsers() {
  const { onApiError } = useApp();
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [scopes, setScopes] = useState({});

  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const meta = useLoad(async () => {
    const [stats, roles] = await Promise.all([adminApi.stats(), adminApi.roles()]);
    return { stats, roles: sortRoles(roles, (r) => r.roleName) };
  }, [], onApiError);
  const list = useLoad(() => adminApi.users({ page, pageSize: PAGE_SIZE, searchTerm: term, status, roleId }), [page, term, status, roleId], onApiError);

  // Cơ sở phụ trách của nhân viên / quản lý trong trang hiện tại
  useEffect(() => {
    const items = list.data?.items || [];
    let alive = true;
    items
      .filter((u) => needsFacility(u.roles) && scopes[u.userId] === undefined)
      .forEach(async (u) => {
        try {
          const rows = await adminApi.userFacilities(u.userId);
          const active = rows.find((r) => r.status === "ACTIVE");
          if (alive) setScopes((s) => ({ ...s, [u.userId]: active ? active.facilityName : "Chưa phân công" }));
        } catch {
          if (alive) setScopes((s) => ({ ...s, [u.userId]: "—" }));
        }
      });
    return () => {
      alive = false;
    };
  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = meta.data?.stats;
  const byRole = stats?.usersByRole || {};
  const staffCount = Object.entries(byRole)
    .filter(([k]) => k !== "CUSTOMER" && k !== "ADMIN")
    .reduce((a, [, v]) => a + v, 0);
  const cards = [
    [stats?.totalUsers, "Tổng tài khoản", ""],
    [byRole.CUSTOMER || 0, "Khách hàng", "blue"],
    [staffCount, "Nhân viên & Quản lý", "green"],
    [stats?.inactiveUsersCount || 0, "Đang khoá / ngưng", "red"],
  ];

  const scopeOf = (u) => {
    if (u.roles.includes("ADMIN")) return "Toàn hệ thống";
    if (needsFacility(u.roles)) return scopes[u.userId] ?? "…";
    if (u.roles.some((r) => r !== "CUSTOMER")) return "Toàn hệ thống";
    return "—";
  };
  const data = list.data;
  const from = data ? (data.page - 1) * data.pageSize + 1 : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalItems / data.pageSize)) : 1;
  const roles = meta.data?.roles || [];
  const chips = useMemo(() => [{ roleId: "", roleName: "" }, ...roles], [roles]);

  return (
    <main className="container page">
      <header className="page-header">
        <div>
          <h1>Quản lý tài khoản người dùng</h1>
          <p>{stats ? `${stats.totalUsers} tài khoản trong hệ thống` : "Đang tải…"}</p>
        </div>
        <div className="page-header__actions">
          <LinkButton to="admin/new">+ Thêm tài khoản mới</LinkButton>
        </div>
      </header>

      {meta.error && <Notice tone="error">{meta.error}</Notice>}
      <div className="stats stats--4">
        {cards.map(([n, label, tone]) => (
          <div className="stat" key={label}>
            <strong className={tone ? `tone-${tone}` : ""}>{n ?? "—"}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <div className="admin-toolbar">
        <div className="chips" role="group" aria-label="Lọc theo vai trò">
          {chips.map((r) => (
            <button
              type="button"
              key={r.roleId || "all"}
              className={`chip chip--dark${String(roleId) === String(r.roleId) ? " is-on" : ""}`}
              aria-pressed={String(roleId) === String(r.roleId)}
              onClick={() => {
                setRoleId(r.roleId);
                setPage(1);
              }}
            >
              {r.roleName ? roleLabel(r.roleName) : "Tất cả"}
            </button>
          ))}
        </div>
        <div className="admin-toolbar__filters">
          <input className="search-input" type="search" placeholder="Tìm tên, email, SĐT…" aria-label="Tìm tài khoản" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select aria-label="Lọc trạng thái" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Mọi trạng thái</option>
            {Object.entries(USER_STATUS).map(([k, [label]]) => (
              <option key={k} value={k}>{label}</option>
            ))}
          </Select>
        </div>
      </div>

      {list.error && <Notice tone="error">{list.error}</Notice>}
      <div className="table-wrap panel">
        <table className="table table--hover">
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
              <th>Cơ sở phụ trách</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(data?.items || []).map((u) => (
              <tr key={u.userId} onClick={() => go(`admin/users/${u.userId}`)}>
                <td>
                  <a href={href(`admin/users/${u.userId}`)} onClick={(e) => e.stopPropagation()} className="cell-strong">{u.fullName}</a>
                  <small className="cell-sub">@{u.username}</small>
                </td>
                <td>{u.email}</td>
                <td>{sortRoles(u.roles).map(roleLabel).join(", ") || "—"}</td>
                <td>{scopeOf(u)}</td>
                <td>
                  <StatusTag map={USER_STATUS} status={u.status} />
                </td>
              </tr>
            ))}
            {!list.loading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={5} className="table__empty">Không có tài khoản phù hợp bộ lọc.</td>
              </tr>
            )}
            {list.loading && !data && (
              <tr>
                <td colSpan={5} className="table__empty">Đang tải danh sách…</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {data && <Pagination page={data.page} pages={totalPages} total={data.totalItems} from={from} to={from + data.items.length - 1} noun="tài khoản" onPage={setPage} />}

      <div className="stack">
        <LinkButton to="admin/permissions" variant="outline">Cấu hình quyền truy cập</LinkButton>
        <LinkButton to="admin/logs" variant="outline">Xem nhật ký hoạt động</LinkButton>
      </div>
      {meta.data && roles.length === 0 && <Empty title="Chưa có vai trò" text="Hệ thống chưa có vai trò nào." />}
    </main>
  );
}
