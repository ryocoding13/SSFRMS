import "./design.css";
import React, { useEffect, useRef, useState } from "react";
import { businessApi } from "../api/business";
import { go, href } from "../lib/router";
import { useApp } from "../state/store";

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


// Khung khu Quản lý vận hành KD (Figma B01–B05): logo, tên + "Vận hành KD", chuông, 5 tab.
export const BUSINESS_TABS = [
  ["business", "Tổng quan hệ thống"],
  ["business/facilities", "Các cơ sở"],
  ["business/policies", "Chính sách"],
  ["business/pricing", "Giá & phí"],
  ["business/reports", "Báo cáo"],
];

const READ_KEY = "safespace.business.notices.read";
const readSaved = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(READ_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

// Việc cần để ý trên toàn hệ thống, lấy từ API (không có bảng thông báo riêng)
function useNotices() {
  const { onApiError } = useApp();
  const [items, setItems] = useState([]);
  const [read, setRead] = useState(readSaved);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [facilities, report, drafts] = await Promise.all([
          businessApi.facilities(),
          businessApi.facilityReport({}),
          businessApi.policies({ status: "DRAFT" }),
        ]);
        if (!alive) return;
        const list = [];
        const overdue = report?.totals?.overdueContracts || 0;
        if (overdue) list.push({ id: `overdue-${overdue}`, title: `${overdue} hợp đồng quá hạn toàn hệ thống`, to: "business/reports" });
        const missing = facilities.filter((f) => f.status === "ACTIVE" && (f.pricedUnitTypes === 0 || f.totalUnits === 0 || f.assignedStaff === 0));
        if (missing.length) list.push({ id: `setup-${missing.map((f) => f.facilityId).join("-")}`, title: `${missing.length} cơ sở đang hoạt động còn thiếu giá, ô kho hoặc nhân sự`, to: "business/facilities" });
        const closed = facilities.filter((f) => f.status === "TEMPORARILY_CLOSED");
        if (closed.length) list.push({ id: `closed-${closed.map((f) => f.facilityId).join("-")}`, title: `${closed.length} cơ sở đang tạm đóng`, to: "business/facilities" });
        if (drafts.length) list.push({ id: `drafts-${drafts.map((p) => p.policyId).join("-")}`, title: `${drafts.length} chính sách ở bản nháp, chưa áp dụng`, to: "business/policies" });
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
      /* trình duyệt chặn lưu: chỉ giữ trong phiên */
    }
  };
  return { items: items.map((n) => ({ ...n, read: read.includes(n.id) })), mark };
}

function Bell() {
  const { items, mark } = useNotices();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, setOpen, ref);
  const unread = items.filter((n) => !n.read).length;
  return (
    <div className="bell-anchor" ref={ref}>
      <button type="button" className="bell" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={`Thông báo vận hành${unread ? `, ${unread} chưa đọc` : ""}`}>
        <img src={`${import.meta.env.BASE_URL}images/business/bell.svg`} width="44" height="44" alt="" />
      </button>
      {open && (
        <section className="popup" aria-label="Thông báo vận hành">
          <div className="popup__head">
            <h2>Cần để ý</h2>
            <button type="button" className="popup__close" onClick={() => setOpen(false)} aria-label="Đóng thông báo">×</button>
          </div>
          <p className="popup__count">{unread ? `${unread} thông báo mới` : "Đã đọc tất cả"}</p>
          <ul className="popup__list">
            {items.map((n) => (
              <li key={n.id}>
                <button type="button" className={n.read ? "is-read" : ""} onClick={() => { mark([n.id]); setOpen(false); go(n.to); }}>
                  <strong>{n.title}</strong>
                </button>
              </li>
            ))}
          </ul>
          {items.length === 0 && <p className="popup__empty">Hệ thống chưa có việc cần để ý.</p>}
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

export default function BusinessShell({ active, children }) {
  return (
    <div className="business-app">
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href("business")} aria-label="SafeSpace — Quản lý vận hành kinh doanh">
            <img src={`${import.meta.env.BASE_URL}images/business/brand.svg`} width="36" height="36" alt="" />
            SafeSpace
          </a>
          <nav className="header__nav" aria-label="Điều hướng chính" />
          <div className="header__user">
            <UserMenu roleLabel="Vận hành KD" tone="business" />
            <Bell />
          </div>
        </div>
      </header>
      <nav className="subnav" aria-label="Điều hướng vận hành kinh doanh">
        <div className="subnav__inner">
          {BUSINESS_TABS.map(([to, label]) => (
            <a key={to} href={href(to)} className={active === to ? "is-active" : ""} aria-current={active === to ? "page" : undefined}>
              {label}
            </a>
          ))}
        </div>
      </nav>
      {children}
    </div>
  );
}
