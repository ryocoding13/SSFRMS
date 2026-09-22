import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { dateLabel, localDate, today } from "../lib/format";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

function monthGrid(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // tuần bắt đầu từ T2
  const days = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((offset + days) / 7);
  return Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(year, month, 1 - offset + i);
    return { iso: localDate(d), day: d.getDate(), inMonth: d.getMonth() === month };
  });
}

/** Ô chọn ngày với lịch popup: ngày quá khứ (trước `min`) bị khóa. */
export function DatePicker({ value, onChange, min = today(), label, error, id: idProp, className = "" }) {
  const autoId = useId();
  const id = idProp || autoId;
  const [open, setOpen] = useState(false);
  const base = value ? new Date(`${value}T12:00:00`) : new Date();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const wrap = useRef(null);
  const cells = useMemo(() => monthGrid(view.y, view.m), [view]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const shift = (delta) =>
    setView(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const toggle = () => {
    if (!open && value) {
      const d = new Date(`${value}T12:00:00`);
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
    setOpen(!open);
  };

  return (
    <div className={`field${error ? " field--invalid" : ""} ${className}`} ref={wrap}>
      {label && <label htmlFor={id}>{label}</label>}
      <div className="datepicker">
        <button
          id={id}
          type="button"
          className={`select-like${open ? " is-open" : ""}`}
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
        >
          <span>{value ? dateLabel(value) : "Chọn ngày"}</span>
          <i aria-hidden="true">{open ? "▴" : "▾"}</i>
        </button>
        {open && (
          <div className="datepicker__pop" role="dialog" aria-label="Chọn ngày">
            <div className="datepicker__head">
              <button type="button" onClick={() => shift(-1)} aria-label="Tháng trước">‹</button>
              <strong>Tháng {view.m + 1}, {view.y}</strong>
              <button type="button" onClick={() => shift(1)} aria-label="Tháng sau">›</button>
            </div>
            <div className="datepicker__grid" role="grid">
              {WEEKDAYS.map((w) => (
                <span key={w} className="datepicker__dow">{w}</span>
              ))}
              {cells.map((c) => {
                const disabled = c.iso < min;
                const selected = c.iso === value;
                return (
                  <button
                    type="button"
                    key={c.iso}
                    disabled={disabled}
                    className={`${c.inMonth ? "" : "is-out"}${selected ? " is-selected" : ""}${c.iso === today() ? " is-today" : ""}`}
                    aria-pressed={selected}
                    aria-label={dateLabel(c.iso)}
                    onClick={() => {
                      onChange(c.iso);
                      setOpen(false);
                    }}
                  >
                    {c.day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function Pagination({ page, pages, total, from, to, noun = "cơ sở", onPage }) {
  if (pages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Phân trang">
      <div className="pagination__row">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Trước</button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
          <button type="button" key={n} className={n === page ? "is-active" : ""} aria-current={n === page ? "page" : undefined} onClick={() => onPage(n)}>
            {n}
          </button>
        ))}
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)}>Sau ›</button>
      </div>
      <p>Hiển thị {from}–{to} trên {total} {noun}</p>
    </nav>
  );
}

// Bọc <select> có mũi tên ▾ theo Figma
export function Select({ children, ...props }) {
  return (
    <span className="select">
      <select {...props}>{children}</select>
      <i aria-hidden="true">▾</i>
    </span>
  );
}
Select.fieldControl = true; // để <Field> gắn id / aria vào <select> bên trong
