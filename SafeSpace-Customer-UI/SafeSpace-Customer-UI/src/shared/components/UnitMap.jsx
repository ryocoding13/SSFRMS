import React, { useEffect, useRef } from "react";
import { typeLabel } from "../utils/catalog.js";
import { dateLabel } from "../utils/format.js";
import { useNow } from "../hooks/useBrowserEvents.js";
import { LEGEND, UNIT_STATUS, bookableCount, countBy, floorLabel, freeCount, holdClock, holdSecondsLeft, zoneLabel } from "../utils/units.js";

// Sơ đồ ô kho của cơ sở: chú giải, các dãy theo tầng/khu vực động, ô đang chọn có viền sáng.
export default function UnitMap({
  units = [],
  selected,
  onSelect,
  loading = false,
  error = null,
  onRetry,
  onReload,
  onClear,
  viewDate,
}) {
  // D67: ô giữ chỗ đếm ngược từng giây; hết giờ thì tải lại sơ đồ một lần để ô trống lại.
  const now = useNow(1000);
  const reloadedFor = useRef(new Set());
  useEffect(() => {
    if (!onReload || loading) return;
    const due = (units || []).filter((u) => u.hold_expires_at && holdSecondsLeft(u, now) === 0 && !reloadedFor.current.has(`${u.code}@${u.hold_expires_at}`));
    if (!due.length) return;
    due.forEach((u) => reloadedFor.current.add(`${u.code}@${u.hold_expires_at}`));
    onReload();
  }, [now, units, loading, onReload]);

  if (loading) {
    return (
      <section className="panel unit-map" aria-label="Sơ đồ & tình trạng từng ô kho">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Sơ đồ & tình trạng từng ô kho</h2>
        </div>
        <p className="muted" style={{ margin: "20px 0" }}>Đang tải sơ đồ ô kho…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel unit-map" aria-label="Sơ đồ & tình trạng từng ô kho">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Sơ đồ & tình trạng từng ô kho</h2>
        </div>
        <p style={{ color: "var(--crimson, #b91c1c)", margin: "16px 0 12px" }}>{error}</p>
        {onRetry && (
          <button type="button" className="btn btn--outline btn--sm" onClick={onRetry}>
            Thử lại
          </button>
        )}
      </section>
    );
  }

  if (!units || units.length === 0) {
    return (
      <section className="panel unit-map" aria-label="Sơ đồ & tình trạng từng ô kho">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Sơ đồ & tình trạng từng ô kho</h2>

        </div>
        <p className="muted" style={{ margin: "20px 0" }}>Cơ sở này hiện chưa có dữ liệu sơ đồ ô kho.</p>
      </section>
    );
  }

  const counts = countBy(units);
  const floors = [...new Set(units.map((u) => u.floor || "Tầng trệt"))];
  const floorSub = floors.length === 1 ? floors[0] : `${floors.length} tầng`;

  // Gom nhóm theo Tầng -> Dãy (Zone)
  const floorGroups = [];
  for (const u of units) {
    const f = u.floor || "Tầng trệt";
    let fg = floorGroups.find((g) => g.floor === f);
    if (!fg) {
      fg = { floor: f, zones: [] };
      floorGroups.push(fg);
    }
    const z = u.zone || u.row || "Chưa phân khu";
    let zg = fg.zones.find((g) => g.zone === z);
    if (!zg) {
      zg = { zone: z, units: [] };
      fg.zones.push(zg);
    }
    zg.units.push(u);
  }

  const tile = (u) => {
    const on = u.code === selected;
    const st = UNIT_STATUS[u.status] || UNIT_STATUS.SERVICE;
    const isClimate = u.type === "climate";
    const futureBookable = u.status !== "FREE" && u.bookable_for_period;
    const left = u.status === "HELD" ? holdSecondsLeft(u, now) : null;
    // D67: đang thuê hiện "từ – đến" của hợp đồng tại ngày đang xem; giữ chỗ hiện đồng hồ đếm ngược, không hiện ngày hết hạn.
    const meta = [];
    if (u.status === "RENTED" && u.current_contract_start_date) {
      meta.push(`Từ ${dateLabel(u.current_contract_start_date)}`);
      if (u.current_contract_end_date) meta.push(`Đến ${dateLabel(u.current_contract_end_date)}`);
    } else if (u.status === "RENTED" && u.current_contract_end_date) {
      meta.push(`Đến ${dateLabel(u.current_contract_end_date)}`);
    } else if (u.status === "HELD") {
      meta.push(left != null ? `Còn ${holdClock(left)}` : "Đang thanh toán");
    } else if (u.status === "SERVICE") {
      meta.push("Không nhận đặt");
    } else if (u.status === "FREE" && u.next_booked_from) {
      meta.push("Đã có lịch thuê", `Từ ${dateLabel(u.next_booked_from)}`);
    }
    const spoken = u.status === "RENTED" && u.current_contract_end_date
      ? `, thuê${u.current_contract_start_date ? ` từ ${dateLabel(u.current_contract_start_date)}` : ""} đến ${dateLabel(u.current_contract_end_date)}`
      : u.status === "HELD" && left != null ? `, còn giữ ${holdClock(left)}` : "";
    return (
      <button
        type="button"
        key={u.unit_id || u.code}
        className={`unit-tile unit-tile--${st.tone}${futureBookable ? " unit-tile--bookable" : ""}${on ? " is-selected" : ""}`}
        onClick={() => onSelect(u.code)}
        aria-pressed={on}
        aria-label={`Ô ${u.code}, ${u.area_label}, ${typeLabel(u.type)}, ${st.label}${spoken}`}
      >
        <strong>{u.code}</strong>
        <span>{u.area_label} · {isClimate ? "Lạnh" : "Thường"}</span>
        <span>{st.label}</span>
        {meta.map((m) => (
          <span key={m} className={`unit-tile__meta${u.status === "HELD" ? " unit-tile__countdown" : ""}`} role={u.status === "HELD" ? "timer" : undefined}>{m}</span>
        ))}
        {futureBookable && <span className="unit-tile__bookable">Đặt được kỳ này</span>}
      </button>
    );
  };

  return (
    <section className="panel unit-map" aria-label="Sơ đồ & tình trạng từng ô kho">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2>Chọn một ô để xem thông tin</h2>
          <p className="muted unit-map__sub">{units.length} ô kho · {floorSub} · Tình trạng ngày {viewDate ? dateLabel(viewDate) : "hôm nay"} &amp; khả năng đặt theo kỳ đang tìm</p>
        </div>
        {/* D68: thay nút "Tải lại sơ đồ" bằng "Bỏ chọn ô" (sơ đồ tự tải lại khi hết giờ giữ chỗ) */}
        {onClear && (
          <button type="button" className="btn btn--outline btn--sm" onClick={onClear}>
            Bỏ chọn ô
          </button>
        )}
      </div>

      <ul className="unit-legend">
        {LEGEND.map((s) => (
          <li key={s}>
            <i className={`unit-dot unit-dot--${(UNIT_STATUS[s] || UNIT_STATUS.SERVICE).tone}`} aria-hidden="true" />
            {(UNIT_STATUS[s] || UNIT_STATUS.SERVICE).label} · {counts[s] || 0}
          </li>
        ))}
      </ul>

      {floorGroups.map((fg) => (
        <div key={fg.floor} style={{ display: "grid", gap: "12px", marginBottom: "16px" }}>
          {floorGroups.length > 1 && (
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "8px 0 0" }}>{floorLabel(fg.floor)}</h3>
          )}
          <div className="unit-plan">
            {fg.zones.map((zg, zIdx) => (
              <React.Fragment key={zg.zone}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, color: "var(--muted)", padding: "2px 4px" }}>
                  <span>{zoneLabel(zg.zone)}</span>
                  <span className="muted">{zg.units.length} ô</span>
                </div>
                <div className={`unit-row${zg.zone === "B" ? " unit-row--tall" : ""}`}>
                  {zg.units.map(tile)}
                </div>
                {/* Hành lang phân cách giữa dãy đầu tiên và các dãy sau nếu có nhiều hơn 1 dãy */}
                {zIdx === 0 && fg.zones.length > 1 && (
                  <div className="unit-corridor" aria-hidden="true">
                    <span>VÀO →</span>
                    <span>HÀNH LANG CHUNG</span>
                    <span>→ RA</span>
                  </div>
                )}
              </React.Fragment>
            ))}
            <div className="unit-plan__foot" aria-hidden="true">
              <span>Phòng kỹ thuật</span>
              <span>Sơ đồ minh họa · Không theo tỷ lệ</span>
            </div>
          </div>
        </div>
      ))}

      <p className="unit-map__note">{freeCount(units)} ô trống ngày {viewDate ? dateLabel(viewDate) : "hôm nay"} · {bookableCount(units)} ô khả dụng trong kỳ đang chọn · Bấm vào ô để xem thông tin.</p>
    </section>
  );
}
