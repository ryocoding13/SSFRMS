import React from "react";
import { typeLabel } from "../utils/catalog.js";
import { dateLabel } from "../utils/format.js";
import { LEGEND, UNIT_STATUS, bookableCount, countBy, freeCount } from "../utils/units.js";

// Sơ đồ 12 ô kho (Figma C03b-sđ, 14/10): chú giải, dãy A cỡ M – hành lang – dãy B cỡ L, ô đang chọn có viền sáng.
export default function UnitMap({ units, selected, onSelect }) {
  const counts = countBy(units);
  const rowA = units.filter((u) => u.row === "A");
  const rowB = units.filter((u) => u.row === "B");
  const tile = (u) => {
    const on = u.code === selected;
    const st = UNIT_STATUS[u.status];
    const futureBookable = u.status !== "FREE" && u.bookable_for_period;
    return (
      <button
        type="button"
        key={u.code}
        className={`unit-tile unit-tile--${st.tone}${futureBookable ? " unit-tile--bookable" : ""}${on ? " is-selected" : ""}`}
        onClick={() => onSelect(u.code)}
        aria-pressed={on}
        aria-label={`Ô ${u.code}, ${u.area_label}, ${typeLabel(u.type)}, ${st.label}${u.current_contract_end_date ? `, hết hạn ${dateLabel(u.current_contract_end_date)}` : ""}`}
      >
        <strong>{u.code}</strong>
        <span>{u.area_label} · {u.type === "climate" ? "Lạnh" : "Thường"}</span>
        <span>{st.label}</span>
        {u.current_contract_end_date && (
          <span className="unit-tile__meta">Hết hạn {dateLabel(u.current_contract_end_date)}</span>
        )}
        {futureBookable && <span className="unit-tile__bookable">Đặt được kỳ này</span>}
      </button>
    );
  };
  return (
    <section className="panel unit-map" aria-label="Sơ đồ & tình trạng từng ô kho">
      <h2>Chọn một ô để xem thông tin</h2>
      <p className="muted unit-map__sub">{units.length} ô kho · Tầng trệt · Trạng thái hiện tại &amp; khả năng đặt theo kỳ đang tìm</p>
      <ul className="unit-legend">
        {LEGEND.map((s) => (
          <li key={s}><i className={`unit-dot unit-dot--${UNIT_STATUS[s].tone}`} aria-hidden="true" />{UNIT_STATUS[s].label} · {counts[s]}</li>
        ))}
      </ul>
      <div className="unit-plan">
        <div className="unit-row">{rowA.map(tile)}</div>
        <div className="unit-corridor" aria-hidden="true"><span>VÀO →</span><span>HÀNH LANG CHUNG</span><span>→ RA</span></div>
        <div className="unit-row unit-row--tall">{rowB.map(tile)}</div>
        <div className="unit-plan__foot" aria-hidden="true"><span>Phòng kỹ thuật</span><span>Sơ đồ minh họa · Không theo tỷ lệ</span></div>
      </div>
      <p className="unit-map__note">{freeCount(units)} ô trống hôm nay · {bookableCount(units)} ô khả dụng trong kỳ đang chọn · Bấm vào ô để xem thông tin.</p>
    </section>
  );
}
