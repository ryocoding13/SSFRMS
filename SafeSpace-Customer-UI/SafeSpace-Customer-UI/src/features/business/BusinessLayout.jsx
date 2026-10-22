import StickyHeader from "../../shared/components/StickyHeader.jsx";
import "./business.css";
import React, { useEffect, useRef, useState } from "react";
import { go, href } from "../../app/router.js";
import { useApp } from "../../app/state/AppProvider.jsx";

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

export default function BusinessLayout({ active, children }) {
  return (
    <div className="business-app">
      <StickyHeader>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href("business")} aria-label="SafeSpace — Quản lý vận hành kinh doanh">
            <img src={`${import.meta.env.BASE_URL}images/business/brand.svg`} width="36" height="36" alt="" />
            SafeSpace
          </a>
          <nav className="header__nav" aria-label="Điều hướng chính" />
          <div className="header__user">
            <UserMenu roleLabel="Vận hành KD" tone="business" />
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
      </StickyHeader>
      {children}
    </div>
  );
}
