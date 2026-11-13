/**
 * Bộ lọc và biểu đồ dùng chung cho các báo cáo theo thời gian (Lượt 5 · #35 #36 #38 #58, Figma B-BC / B04a / B-BC-TT).
 * - ReportFilterBar: một hàng bộ lọc căn phải, cùng chiều cao 44px: Từ tháng · Đến tháng · (các bộ lọc khác) · Áp dụng · Xuất.
 *   Khoảng sai thì báo lỗi ngay dưới hàng và giữ bộ lọc cũ đang áp dụng.
 * - ColumnChart: cột xanh, không quá mập, nhãn bên dưới, trục có mốc giá trị; giá trị 0 vẫn hiện "0 đ".
 * - ReportState: đang tải / không có dữ liệu / lỗi tải dùng chung.
 */
import React, { useEffect, useState } from "react";
import { Button } from "./UI.jsx";
import { addMonth, monthLabel, niceTicks, rangeError, rangeText } from "../utils/monthRange.js";
import { money } from "../utils/format.js";
import "../styles/report-controls.css";

function MonthSelect({ label, value, options, onChange, invalid, disabled }) {
  return (
    <label className={`report-filter__field${invalid ? " is-invalid" : ""}`}>
      <span>{label}</span>
      <span className="select report-filter__select">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-invalid={invalid || undefined}>
          {options.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <i aria-hidden="true">▾</i>
      </span>
    </label>
  );
}

/** Chọn thêm (trạng thái hợp đồng, loại kho…) cùng kiểu với ô tháng. */
export function FilterSelect({ label, value, onChange, options, disabled }) {
  return (
    <label className="report-filter__field">
      <span>{label}</span>
      <span className="select report-filter__select">
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {options.map(([v, l]) => <option key={v || "all"} value={v}>{l}</option>)}
        </select>
        <i aria-hidden="true">▾</i>
      </span>
    </label>
  );
}

/**
 * @param {{ range:{from,to}, today:string, onApply:(r)=>void, children?:React.ReactNode, actions?:React.ReactNode, busy?:boolean }} props
 */
export function ReportFilterBar({ range, today, onApply, children, actions, busy }) {
  const [draft, setDraft] = useState(range);
  const [error, setError] = useState("");
  useEffect(() => { setDraft(range); setError(""); }, [range.from, range.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const latest = today.slice(0, 7);
  const options = Array.from({ length: 48 }, (_, i) => addMonth(latest, i - 35)); // 3 năm trước → 12 tháng tới
  const changed = draft.from !== range.from || draft.to !== range.to;
  const apply = () => {
    const e = rangeError(draft);
    setError(e);
    if (!e) onApply(draft);
  };
  return (
    <div className="report-filter">
      <div className="report-filter__current" aria-live="polite"><span>Đang xem</span><strong>{rangeText(range)}</strong></div>
      <div className="report-filter__row">
        <MonthSelect label="Từ tháng" value={draft.from} options={options} invalid={Boolean(error)} disabled={busy} onChange={(v) => { setDraft({ ...draft, from: v }); setError(""); }} />
        <MonthSelect label="Đến tháng" value={draft.to} options={options} invalid={Boolean(error)} disabled={busy} onChange={(v) => { setDraft({ ...draft, to: v }); setError(""); }} />
        <Button variant={changed ? "primary" : "outline"} className="report-filter__apply" disabled={busy || !changed} onClick={apply}>Áp dụng</Button>
        {children}
        {actions}
      </div>
      {error && <p className="report-filter__error" role="alert">{error} Bộ lọc cũ vẫn đang áp dụng.</p>}
    </div>
  );
}

/** Rút gọn nhãn quá dài nhưng vẫn nhận ra (giữ phần cuối tên cơ sở). */
const shortLabel = (s, max = 18) => (s.length <= max ? s : `${s.slice(0, max - 1)}…`);

/**
 * @param {{ title:string, subtitle?:string, items:{key:string,label:string,value:number,text?:string,highlight?:boolean}[], footer?:React.ReactNode, emptyText?:string }} props
 */
export function ColumnChart({ title, subtitle, items, footer, emptyText = "Chưa có số liệu trong khoảng đã chọn." }) {
  const max = Math.max(0, ...items.map((i) => Number(i.value) || 0));
  const ticks = niceTicks(max);
  const top = ticks[0] || 1;
  return (
    <section className="panel report-chart-card" aria-label={title}>
      <header><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</header>
      {items.length === 0 ? <p className="muted report-chart-card__empty">{emptyText}</p> : (
        <div className={`col-chart${items.length > 12 ? " is-dense" : ""}`} style={{ "--cols": items.length }}>
          <div className="col-chart__axis" aria-hidden="true">{ticks.map((t) => <span key={t}>{money(t)}</span>)}</div>
          <div className="col-chart__plot" role="list">
            <div className="col-chart__grid-layer" aria-hidden="true">{ticks.map((t) => <i key={t} className="col-chart__grid" style={{ bottom: `${(t / top) * 100}%` }} />)}</div>
            {items.map((it, idx) => {
              const v = Number(it.value) || 0, pct = (v / top) * 100;
              return (
                <div className={`col-chart__col${it.highlight ? " is-current" : ""}`} key={it.key} role="listitem" aria-label={`${it.label}: ${it.text || money(v)}`}>
                  <div className="col-chart__bar-wrap">
                    <b style={{ bottom: `calc(${pct}% + 4px)` }}>{it.text || money(v)}</b>
                    <i className="col-chart__bar" style={{ height: `${pct}%`, animationDelay: `${idx * 30}ms` }} />
                  </div>
                  <span title={it.label}>{shortLabel(it.label)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {footer && <p className="hint report-chart-card__footer">{footer}</p>}
    </section>
  );
}

/** Đang tải / lỗi / không có dữ liệu (Figma B-BC-TT). */
export function ReportState({ loading, error, empty, onRetry, onReset, emptyText, children }) {
  if (error) return <section className="panel report-state report-state--error" role="alert"><strong>Chưa tải được báo cáo</strong><p>Kiểm tra kết nối rồi thử lại.</p>{onRetry && <Button variant="outline" onClick={onRetry}>Thử lại</Button>}</section>;
  if (loading) return <section className="panel report-state" role="status" aria-busy="true"><span className="report-state__spinner" aria-hidden="true" /><strong>Đang tải báo cáo…</strong></section>;
  if (empty) return <section className="panel report-state"><strong>Không có dữ liệu</strong><p>{emptyText}</p>{onReset && <Button variant="outline" onClick={onReset}>Đổi khoảng thời gian</Button>}</section>;
  return children;
}

/** Mũi tên tăng/giảm so với cùng kỳ. */
export function Delta({ value, suffix = "so với cùng kỳ" }) {
  if (value == null) return <small className="muted">Chưa có số liệu cùng kỳ để so sánh</small>;
  const up = value >= 0;
  return <small className={up ? "ok" : "danger"}>{up ? "▲" : "▼"} {Math.abs(value).toFixed(1).replace(".", ",")}% {suffix}</small>;
}
