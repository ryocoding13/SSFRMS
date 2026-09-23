import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/UI";
import { go, href } from "../lib/router";
import { useApp } from "../state/store";
import { adminApi } from "../api/admin";
import { dateTime } from "./util";

const TABS = [
  ["", "Tài khoản"],
  ["new", "Thêm tài khoản"],
  ["permissions", "Quyền truy cập"],
  ["logs", "Nhật ký hoạt động"],
];
const READ_KEY = "safespace.admin.notices.read";

function useNotices(onApiError) {
  const [items, setItems] = useState([]);
  const [read, setRead] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_KEY)) || [];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [stats, logins] = await Promise.all([adminApi.stats(), adminApi.loginHistory({ page: 1, pageSize: 1 })]);
        if (!alive) return;
        const list = [];
        const locked = stats.inactiveUsersCount || 0;
        list.push({
          id: `locked-${locked}`,
          title: "Tài khoản cần kiểm tra",
          detail: locked ? `${locked} tài khoản đang khoá hoặc ngưng hoạt động.` : "Rà soát vai trò và cơ sở phụ trách.",
          to: "admin",
        });
        const access = (stats.recentActivities || []).find((a) => /^(ROLE|PERMISSION)_/.test(a.action));
        if (access) list.push({ id: `access-${access.logId}`, title: "Quyền truy cập được cập nhật", detail: `Lúc ${dateTime(access.loggedAt)}. Xem cấu hình quyền theo vai trò.`, to: "admin/permissions" });
        const last = logins.items?.[0];
        if (last) list.push({ id: `login-${last.loginHistoryId}`, title: "Nhật ký hoạt động mới", detail: `${last.fullName} đăng nhập lúc ${dateTime(last.loginAt)}.`, to: "admin/logs" });
        setItems(list);
      } catch (e) {
        onApiError?.(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onApiError]);
  const mark = (ids) => {
    const next = [...new Set([...read, ...ids])].slice(-100);
    setRead(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      /* bỏ qua */
    }
  };
  return { items: items.map((n) => ({ ...n, read: read.includes(n.id) })), mark };
}

function Bell() {
  const { onApiError } = useApp();
  const { items, mark } = useNotices(onApiError);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const unread = items.filter((n) => !n.read).length;
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="bell-anchor" ref={ref}>
      <button type="button" className="bell" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Thông báo hệ thống${unread ? `, ${unread} chưa đọc` : ""}`}>
        <Icon name="bell" size={22} />
        {unread > 0 && <i aria-hidden="true" />}
      </button>
      {open && (
        <section className="popup" aria-label="Thông báo hệ thống">
          <div className="popup__head">
            <h2>Thông báo hệ thống</h2>
            <button type="button" className="popup__close" onClick={() => setOpen(false)} aria-label="Đóng thông báo">×</button>
          </div>
          <p className="popup__count">{unread ? `${unread} thông báo mới` : "Đã đọc tất cả"}</p>
          <ul className="popup__list">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" className={n.read ? "is-read" : ""} onClick={() => { mark([n.id]); setOpen(false); go(n.to); }}>
                  <strong>{n.title}</strong>
                  <span>{n.detail}</span>
                  <small>Hôm nay</small>
                </button>
              </li>
            ))}
          </ul>
          {unread > 0 && (
            <button type="button" className="btn btn--outline popup__all" onClick={() => mark(items.map((n) => n.id))}>
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);
  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="usermenu__btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <strong>{user?.full_name}</strong>
        <small>Quản trị</small>
      </button>
      {open && (
        <div className="usermenu__pop" role="menu">
          <p>
            {user?.username}
            <br />
            <span>{user?.email}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await logout();
              go("login");
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminShell({ tab, children }) {
  return (
    <>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href("admin")} aria-label="SafeSpace — Quản trị hệ thống">
            <span className="brand__mark"><Icon name="box" size={22} /></span>
            SafeSpace
          </a>
          <div className="header__nav" />
          <div className="header__user">
            <UserMenu />
            <Bell />
          </div>
        </div>
      </header>
      <nav className="subnav" aria-label="Điều hướng quản trị">
        <div className="subnav__inner">
          {TABS.map(([to, label]) => (
            <a key={label} href={href(to ? `admin/${to}` : "admin")} className={tab === to ? "is-active" : ""} aria-current={tab === to ? "page" : undefined}>
              {label}
            </a>
          ))}
        </div>
      </nav>
      {children}
    </>
  );
}
