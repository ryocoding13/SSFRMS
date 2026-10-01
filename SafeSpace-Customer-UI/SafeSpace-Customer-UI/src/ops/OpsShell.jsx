import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../components/UI";
import { go, href } from "../lib/router";
import { whenLabel } from "../state/selectors";
import { useApp } from "../state/store";
import { useOps } from "./store";

export const STAFF_TABS = [
  ["staff", "Công việc ngày"],
  ["staff/reconcile", "Đối soát"],
  ["staff/verify", "Xác minh"],
  ["staff/handover", "Bàn giao"],
  ["staff/return", "Kiểm tra trả kho"],
  ["staff/support", "Hỗ trợ"],
];
export const MANAGER_TABS = [
  ["manager", "Tổng quan"],
  ["manager/units", "Danh sách kho"],
  ["manager/allocate", "Phân bổ kho"],
  ["manager/assign", "Phân công"],
  ["manager/renewals", "Gia hạn"],
  ["manager/contracts", "Hợp đồng & quá hạn"],
  ["manager/report", "Báo cáo"],
];

function useOutside(open, setOpen, ref) {
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
  }, [open, setOpen, ref]);
}

function Bell({ role }) {
  const { ops, run } = useOps();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, setOpen, ref);
  const items = ops.log.filter((l) => l.role === "ALL" || l.role === role).slice(0, 12);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="bell-anchor" ref={ref}>
      <button type="button" className="bell" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}>
        <Icon name="bell" size={22} />
        {unread > 0 && <i aria-hidden="true" />}
      </button>
      {open && (
        <section className="popup" aria-label="Thông báo vận hành">
          <div className="popup__head">
            <h2>Thông báo vận hành</h2>
            <button type="button" className="popup__close" onClick={() => setOpen(false)} aria-label="Đóng thông báo">×</button>
          </div>
          <p className="popup__count">{unread ? `${unread} thông báo mới` : "Đã đọc tất cả"}</p>
          <ul className="popup__list">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" className={n.read ? "is-read" : ""} onClick={() => { run("MARK_READ", { ids: [n.id] }); setOpen(false); go(n.to); }}>
                  <strong>{n.text}</strong>
                  <small>{whenLabel(n.at)}</small>
                </button>
              </li>
            ))}
          </ul>
          {items.length === 0 && <p className="popup__empty">Chưa có cập nhật mới trong ca làm việc.</p>}
          {unread > 0 && (
            <button type="button" className="btn btn--outline popup__all" onClick={() => run("MARK_READ", { ids: items.map((n) => n.id) })}>
              Đánh dấu tất cả đã đọc
            </button>
          )}
        </section>
      )}
    </div>
  );
}

function UserMenu({ roleLabel, tone }) {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, setOpen, ref);
  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className={`usermenu__btn usermenu__btn--${tone}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <strong>{user?.full_name}</strong>
        <small>{roleLabel}</small>
      </button>
      {open && (
        <div className="usermenu__pop" role="menu">
          <p>
            {user?.username || user?.full_name}
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

// Khung chung khu vận hành (Figma S01 / M01): logo, tên + vai trò, chuông, thanh điều hướng theo vai trò
export default function OpsShell({ role, active, children }) {
  const { mode } = useApp();
  const { source } = useOps();
  const staff = role === "STAFF";
  const tabs = staff ? STAFF_TABS : MANAGER_TABS;
  const home = staff ? "staff" : "manager";
  return (
    <>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href(home)} aria-label="SafeSpace — Trang vận hành">
            <span className="brand__mark"><Icon name="box" size={22} /></span>
            SafeSpace
          </a>
          <nav className="header__nav" aria-label="Điều hướng chính" />
          <div className="header__user">
            <UserMenu roleLabel={staff ? "Nhân viên cơ sở" : "Quản lý cơ sở"} tone={staff ? "staff" : "manager"} />
            <Bell role={role} />
          </div>
        </div>
      </header>
      <nav className="subnav" aria-label={staff ? "Điều hướng nhân viên" : "Điều hướng quản lý"}>
        <div className="subnav__inner">
          {tabs.map(([to, label]) => (
            <a key={to} href={href(to)} className={active === to ? "is-active" : ""} aria-current={active === to ? "page" : undefined}>
              {label}
            </a>
          ))}
        </div>
      </nav>
      {mode === "api" && source === "local" && (
        <p className="ops-banner" role="status">
          Backend chưa có API cho khu vận hành (GET /api/ops/board trả 404) — đang hiển thị dữ liệu mẫu lưu trong trình duyệt.
        </p>
      )}
      {children}
    </>
  );
}
