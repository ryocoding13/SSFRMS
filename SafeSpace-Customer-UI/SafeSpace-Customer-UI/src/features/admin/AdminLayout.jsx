/*
 * ADMIN LAYOUT - KHUNG GIAO DIỆN CHUNG KHU VỰC QUẢN TRỊ (ADMIN)
 *
 * Chức năng chính:
 * - Cung cấp Header chung cho khu quản trị: Logo thương hiệu và menu tài khoản Admin.
 * - Thanh điều hướng phụ (Subnav tabs): Chuyển đổi giữa các phân hệ:
 *   1. Quản lý tài khoản (admin)
 *   2. Thêm tài khoản mới (admin/new)
 *   3. Cấu hình phân quyền (admin/permissions)
 *   4. Nhật ký hoạt động & đăng nhập (admin/logs)
 * - Menu quản trị (UserMenu): Xem thông tin tài khoản đăng nhập hiện tại và nút đăng xuất.
 */

import StickyHeader from "../../shared/components/StickyHeader.jsx";
import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../shared/components/UI.jsx";
import { go, href } from "../../app/router.js";
import { useApp } from "../../app/state/AppProvider.jsx";

// Danh sách các tab điều hướng trên thanh Subnav của khu vực Admin: [đường dẫn con, tên hiển thị]
const TABS = [
  ["", "Tài khoản"],
  ["new", "Thêm tài khoản"],
  ["permissions", "Quyền truy cập"],
  ["logs", "Nhật ký hoạt động"],
];

function UserMenu() {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false); // Trạng thái mở/đóng dropdown menu
  const ref = useRef(null);

  // Đóng menu khi bấm ra ngoài
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  return (
    <div className="usermenu" ref={ref}>
      {/* Nút hiển thị tên Admin */}
      <button type="button" className="usermenu__btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <strong>{user?.full_name}</strong>
        <small>Quản trị</small>
      </button>

      {/* Menu thả xuống */}
      {open && (
        <div className="usermenu__pop" role="menu">
          <p>
            {user?.username}
            <br />
            <span>{user?.email}</span>
          </p>
          {/* Nút Đăng xuất: gọi logout từ context và điều hướng về trang đăng nhập */}
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

/*
 * AdminLayout - Layout bao bọc chính cho các trang quản trị
 * 
 * Tham số:
 * - tab: tên tab con đang kích hoạt ("" | "new" | "permissions" | "logs")
 * - children: nội dung component của trang tương ứng được hiển thị bên dưới thanh điều hướng
 */
export default function AdminLayout({ tab, children }) {
  return (
    <>
      {/* Header cấp cao nhất: Logo SafeSpace, Menu người dùng và Chuông thông báo */}
      <StickyHeader>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href("admin")} aria-label="SafeSpace — Quản trị hệ thống">
            <span className="brand__mark"><Icon name="box" size={22} /></span>
            SafeSpace
          </a>
          <div className="header__nav" />
          <div className="header__user">
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Thanh điều hướng các tab phân hệ quản trị */}
      <nav className="subnav" aria-label="Điều hướng quản trị">
        <div className="subnav__inner">
          {TABS.map(([to, label]) => (
            <a
              key={label}
              href={href(to ? `admin/${to}` : "admin")}
              className={tab === to ? "is-active" : ""}
              aria-current={tab === to ? "page" : undefined}
            >
              {label}
            </a>
          ))}
        </div>
      </nav>
      </StickyHeader>

      {/* Nội dung chính của trang quản trị */}
      {children}
    </>
  );
}
