import React from "react";
import { dayMonth, localDate, timeLabel } from "../lib/format";
import { go, qs } from "../lib/router";

// "Hôm nay · 14:00", "20/09 · 09:00"
export function slotLabel(isoDateTime, now = new Date()) {
  if (!isoDateTime) return "—";
  const d = localDate(new Date(isoDateTime));
  const day = d === localDate(now) ? "Hôm nay" : dayMonth(d);
  return `${day} · ${timeLabel(isoDateTime)}`;
}

export const millions = (n) => `${String(Number(n).toFixed(1)).replace(".", ",")} triệu đ`;

// Chọn một mục trong hàng đợi (nhiều đơn cần đối soát, nhiều khách cần xác minh…)
export function QueuePicker({ label, items, current, base, render }) {
  if (items.length <= 1) return null;
  return (
    <div className="queue" role="group" aria-label={label}>
      <span className="queue__label">{label}</span>
      {items.map((it) => (
        <button
          type="button"
          key={it.id}
          className={`chip${it.id === current ? " is-on" : ""}`}
          aria-pressed={it.id === current}
          onClick={() => go(`${base}${qs({ id: it.id })}`, { replace: true })}
        >
          {render(it)}
        </button>
      ))}
    </div>
  );
}

// Nhãn — giá trị theo hàng (Figma S03 / S09)
export function Facts({ rows }) {
  return (
    <dl className="facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
