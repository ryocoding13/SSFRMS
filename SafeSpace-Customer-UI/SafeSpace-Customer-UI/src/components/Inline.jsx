import React from "react";
import { href } from "../lib/router";
import { Icon } from "./UI";

// Thông báo một dòng khi chưa có dữ liệu (Figma C01/C06/C14 · bản "trống")
export function EmptyInline({ text, cta, to }) {
  return (
    <div className="panel empty-line" role="status">
      <span className="empty-line__icon" aria-hidden="true"><Icon name="info" size={16} /></span>
      <p>{text}</p>
      {cta && to && <a className="btn btn--primary empty-line__cta" href={href(to)}>{cta}</a>}
    </div>
  );
}

// Nút chuyển chế độ xem Tìm & đặt kho (Figma C02 / C02m): Danh sách · Bản đồ
export function ViewToggle({ active, listTo, mapTo }) {
  return (
    <nav className="view-toggle" aria-label="Chế độ xem">
      <a href={href(listTo)} className={active === "list" ? "is-on" : ""} aria-current={active === "list" ? "page" : undefined}>☰ Danh sách</a>
      <a href={href(mapTo)} className={active === "map" ? "is-on" : ""} aria-current={active === "map" ? "page" : undefined}>⌖ Bản đồ</a>
    </nav>
  );
}
