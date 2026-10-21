/*
 * ADMIN LAYOUT - KHUNG GIAO DIỆN CHUNG KHU VỰC QUẢN TRỊ (ADMIN)
 *
 * Chức năng chính:
 * - Cung cấp Header chung cho khu quản trị: Logo thương hiệu, menu tài khoản Admin, chuông thông báo.
 * - Thanh điều hướng phụ (Subnav tabs): Chuyển đổi giữa các phân hệ:
 *   1. Quản lý tài khoản (admin)
 *   2. Thêm tài khoản mới (admin/new)
 *   3. Cấu hình phân quyền (admin/permissions)
 *   4. Nhật ký hoạt động & đăng nhập (admin/logs)
 * - Tích hợp hệ thống thông báo nhanh (Bell): Cảnh báo tài khoản bị khóa, cập nhật quyền, lượt đăng nhập mới.
 * - Menu quản trị (UserMenu): Xem thông tin tài khoản đăng nhập hiện tại và nút đăng xuất.
 */

import React, { useEffect, useRef, useState } from "react";
import { Icon } from "../../shared/components/UI.jsx";
import { go, href } from "../../app/router.js";
import { useApp } from "../../app/state/AppProvider.jsx";
import { adminApi } from "./api/adminApi.js";
import { dateTime } from "./utils/adminUtils.js";

// Danh sách các tab điều hướng trên thanh Subnav của khu vực Admin: [đường dẫn con, tên hiển thị]
const TABS = [
  ["", "Tài khoản"],
  ["new", "Thêm tài khoản"],
  ["permissions", "Quyền truy cập"],
  ["logs", "Nhật ký hoạt động"],
];

// Khóa lưu danh sách ID thông báo đã đọc trong LocalStorage của trình duyệt
const READ_KEY = "safespace.admin.notices.read";

/*
 * useNotices - Custom Hook quản lý thông báo hệ thống cho Admin
 * 
 * Luồng hoạt động:
 * 1. Gọi song song API thống kê (adminApi.stats) và lịch sử đăng nhập mới nhất (adminApi.loginHistory).
 * 2. Tổng hợp thành danh sách các thông báo cảnh báo:
 *    - Cảnh báo có tài khoản đang bị khóa hoặc ngừng hoạt động.
 *    - Thông báo khi có thay đổi cấu hình quyền/vai trò gần đây.
 *    - Thông báo lượt đăng nhập mới nhất vào hệ thống.
 * 3. Quản lý trạng thái đọc thông báo thông qua LocalStorage.
 */
function useNotices(onApiError) {
  // Danh sách các mục thông báo được tạo tự động từ dữ liệu hệ thống
  const [items, setItems] = useState([]);

  // Danh sách ID các thông báo mà Admin đã đọc (khởi tạo từ LocalStorage)
  const [read, setRead] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_KEY)) || [];
    } catch {
      return [];
    }
  });

  // Tải dữ liệu để tạo thông báo khi component được gắn kết (mount)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Tải đồng thời thống kê và lần đăng nhập gần nhất
        const [stats, logins] = await Promise.all([adminApi.stats(), adminApi.loginHistory({ page: 1, pageSize: 1 })]);
        if (!alive) return;
        const list = [];

        // 1. Thông báo về tài khoản bị khóa / ngưng hoạt động
        const locked = stats.inactiveUsersCount || 0;
        list.push({
          id: `locked-${locked}`,
          title: "Tài khoản cần kiểm tra",
          detail: locked ? `${locked} tài khoản đang khoá hoặc ngưng hoạt động.` : "Rà soát vai trò và cơ sở phụ trách.",
          to: "admin",
        });

        // 2. Thông báo khi có hoạt động phân quyền mới nhất
        const access = (stats.recentActivities || []).find((a) => /^(ROLE|PERMISSION)_/.test(a.action));
        if (access) {
          list.push({
            id: `access-${access.logId}`,
            title: "Quyền truy cập được cập nhật",
            detail: `Lúc ${dateTime(access.loggedAt)}. Xem cấu hình quyền theo vai trò.`,
            to: "admin/permissions",
          });
        }

        // 3. Thông báo về lượt đăng nhập gần nhất
        const last = logins.items?.[0];
        if (last) {
          list.push({
            id: `login-${last.loginHistoryId}`,
            title: "Nhật ký hoạt động mới",
            detail: `${last.fullName} đăng nhập lúc ${dateTime(last.loginAt)}.`,
            to: "admin/logs",
          });
        }

        setItems(list);
      } catch (e) {
        onApiError?.(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onApiError]);

  // Đánh dấu các thông báo đã đọc và lưu vào LocalStorage (giữ tối đa 100 ID gần nhất)
  const mark = (ids) => {
    const next = [...new Set([...read, ...ids])].slice(-100);
    setRead(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(next));
    } catch {
      /* bỏ qua lỗi nếu không lưu được vào localStorage */
    }
  };

  return { items: items.map((n) => ({ ...n, read: read.includes(n.id) })), mark };
}

/*
 * Bell - Component Chuông Thông Báo
 * 
 * Hiển thị biểu tượng chuông và chấm đỏ khi có thông báo chưa đọc.
 * Nhấn chuông để mở popup danh sách thông báo, bấm vào thông báo sẽ dẫn đến trang tương ứng.
 */
function Bell() {
  const { onApiError } = useApp();
  const { items, mark } = useNotices(onApiError);
  const [open, setOpen] = useState(false); // Trạng thái mở/đóng popup thông báo
  const ref = useRef(null);

  // Đếm số lượng thông báo chưa đọc
  const unread = items.filter((n) => !n.read).length;

  // Lắng nghe sự kiện click bên ngoài hoặc phím Escape để tự động đóng popup
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
      {/* Nút bấm hình quả chuông */}
      <button
        type="button"
        className="bell"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Thông báo hệ thống${unread ? `, ${unread} chưa đọc` : ""}`}
      >
        <Icon name="bell" size={22} />
        {/* Chấm tròn đỏ hiển thị khi có thông báo chưa đọc */}
        {unread > 0 && <i aria-hidden="true" />}
      </button>

      {/* Hộp thoại Popup danh sách thông báo */}
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
                {/* Bấm vào thông báo: Đánh dấu đã đọc, đóng popup và chuyển hướng đến trang tương ứng */}
                <button
                  type="button"
                  className={n.read ? "is-read" : ""}
                  onClick={() => {
                    mark([n.id]);
                    setOpen(false);
                    go(n.to);
                  }}
                >
                  <strong>{n.title}</strong>
                  <span>{n.detail}</span>
                  <small>Hôm nay</small>
                </button>
              </li>
            ))}
          </ul>
          {/* Nút đánh dấu tất cả thông báo là đã đọc */}
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

/*
 * UserMenu - Component Menu Người Dùng Quản Trị
 * 
 * Hiển thị họ tên Admin hiện tại và nút mở menu tùy chọn (xem email, username, đăng xuất).
 */
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

      {/* Nội dung chính của trang quản trị */}
      {children}
    </>
  );
}
