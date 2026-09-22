import React, { useEffect, useRef, useState } from "react";
import { go, href } from "../lib/router";
import { unreadCount, whenLabel } from "../state/selectors";
import { useApp } from "../state/store";
import { Icon } from "./UI";

const PUBLIC_LINKS = [
  ["home", "Trang chủ"],
  ["find", "Cơ sở"],
  ["pricing", "Bảng giá"],
  ["guide", "Hỗ trợ"],
];

const CUSTOMER_LINKS = [
  ["overview", "Tổng quan"],
  ["find", "Tìm & đặt kho"],
  ["units", "Kho của tôi"],
  ["reservations", "Đặt chỗ"],
  ["payments", "Thanh toán & lịch hẹn"],
  ["support", "Hỗ trợ"],
];

// Trang nào thì tab nào sáng (Figma: C04/C05 sáng "Đặt chỗ", C03b sáng "Tìm & đặt kho")
export const CUSTOMER_PAGES = ["overview", "find", "checkout", "confirmation", "units", "sent", "reservations", "payments", "support", "profile"];
const navActive = (page) => (["checkout", "confirmation"].includes(page) ? "reservations" : page === "sent" ? "units" : page);

const PUBLIC_NOTICES = [
  { id: "p1", title: "Tìm không gian phù hợp", detail: "Chọn diện tích và kỳ thuê để xem cơ sở.", to: "find" },
  { id: "p2", title: "Chi phí trước khi đặt", detail: "Xem tiền thuê, cọc và phí áp dụng.", to: "pricing" },
  { id: "p3", title: "Bạn mới sử dụng?", detail: "Xem hướng dẫn thuê và nhận kho.", to: "guide" },
];

function NotificationPopup({ onClose, anchorRef }) {
  const { authed, data, dispatch } = useApp();
  const [publicRead, setPublicRead] = useState([]);
  const ref = useRef(null);
  const items = authed
    ? [...data.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((n) => ({ ...n, when: whenLabel(n.created_at) }))
    : PUBLIC_NOTICES.map((n) => ({ ...n, when: "Hôm nay", read: publicRead.includes(n.id) }));
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    const onDown = (e) => {
      if (!ref.current?.contains(e.target) && !anchorRef.current?.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        anchorRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, anchorRef]);

  const markAll = () => (authed ? dispatch("MARK_READ", {}) : setPublicRead(PUBLIC_NOTICES.map((n) => n.id)));
  const open = (n) => {
    if (authed) dispatch("MARK_READ", { ids: [n.id] });
    else setPublicRead((r) => [...r, n.id]);
    onClose();
    go(n.to);
  };

  return (
    <section className="popup" ref={ref} aria-label={authed ? "Thông báo của bạn" : "Thông tin SafeSpace"}>
      <div className="popup__head">
        <h2>{authed ? "Thông báo của bạn" : "Thông tin SafeSpace"}</h2>
        <button type="button" className="popup__close" onClick={onClose} aria-label="Đóng thông báo">×</button>
      </div>
      <p className="popup__count">{unread ? `${unread} thông báo mới` : "Đã đọc tất cả"}</p>
      <ul className="popup__list">
        {items.map((n) => (
          <li key={n.id}>
            <button type="button" className={n.read ? "is-read" : ""} onClick={() => open(n)}>
              <strong>{n.title}</strong>
              <span>{n.detail}</span>
              <small>{n.when}</small>
            </button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="popup__empty">Chưa có thông báo nào.</p>}
      {items.length > 0 && !unread && <p className="popup__empty">Bạn đã xem hết thông báo hiện tại.</p>}
      {unread > 0 && (
        <button type="button" className="btn btn--outline popup__all" onClick={markAll}>
          Đánh dấu tất cả đã đọc
        </button>
      )}
    </section>
  );
}

export default function Header({ page }) {
  const { authed, user, data } = useApp();
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  const unread = authed ? unreadCount(data) : 3;

  useEffect(() => setOpen(false), [page]);

  return (
    <>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href("home")} aria-label="SafeSpace — Trang chủ">
            <span className="brand__mark"><Icon name="box" size={22} /></span>
            SafeSpace
          </a>
          <nav className="header__nav" aria-label="Điều hướng chính">
            {PUBLIC_LINKS.map(([to, label]) => (
              <a key={to} href={href(to)} aria-current={page === to && !(authed && to === "find") ? "page" : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="header__user">
            {authed ? (
              <a className="header__name" href={href("profile")} title="Tài khoản của tôi">{user.full_name}</a>
            ) : (
              <a className="header__name" href={href("login")}>Đăng nhập</a>
            )}
            <div className="bell-anchor" ref={anchor}>
              <button
                type="button"
                className="bell"
                onClick={() => setOpen(!open)}
                aria-label={`Thông báo${unread ? `, ${unread} chưa đọc` : ""}`}
                aria-expanded={open}
              >
                <Icon name="bell" size={22} />
                {unread > 0 && <i aria-hidden="true" />}
              </button>
              {open && <NotificationPopup onClose={() => setOpen(false)} anchorRef={anchor} />}
            </div>
          </div>
        </div>
      </header>
      {authed && CUSTOMER_PAGES.includes(page) && (
        <nav className="subnav" aria-label="Điều hướng khách hàng">
          <div className="subnav__inner">
            {CUSTOMER_LINKS.map(([to, label]) => (
              <a key={to} href={href(to)} className={navActive(page) === to ? "is-active" : ""} aria-current={navActive(page) === to ? "page" : undefined}>
                {label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </>
  );
}
