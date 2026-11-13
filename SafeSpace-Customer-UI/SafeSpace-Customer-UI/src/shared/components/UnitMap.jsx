import React from "react";
import { typeLabel } from "../utils/catalog.js";
import { LEGEND, UNIT_STATUS, countBy, freeCount } from "../utils/units.js";

// Sơ đồ ô kho của cơ sở: chú giải, các dãy theo tầng/khu vực động, ô đang chọn có viền sáng.
export default function UnitMap({
  units = [],
  selected,
  onSelect,
  loading = false,
  error = null,
  onRetry,
  onReload,
}) {
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
          {onReload && (
            <button type="button" className="btn btn--outline btn--sm" onClick={onReload}>
              Tải lại sơ đồ
            </button>
          )}
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
    return (
      <button
        type="button"
        key={u.unit_id || u.code}
        className={`unit-tile unit-tile--${st.tone}${on ? " is-selected" : ""}`}
        onClick={() => onSelect(u.code)}
        aria-pressed={on}
        aria-label={`Ô ${u.code}, ${u.area_label}, ${typeLabel(u.type)}, ${st.label}`}
      >
        <strong>{u.code}</strong>
        <span>{u.area_label} · {isClimate ? "Lạnh" : "Thường"}</span>
        <span>{st.label}</span>
      </button>
    );
  };

  return (
    <section className="panel unit-map" aria-label="Sơ đồ & tình trạng từng ô kho">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h2>Chọn một ô để xem thông tin</h2>
          <p className="muted unit-map__sub">{units.length} ô kho · {floorSub} · Tình trạng hiện tại</p>
        </div>
        {onReload && (
          <button type="button" className="btn btn--outline btn--sm" onClick={onReload} title="Cập nhật sơ đồ kho">
            Tải lại sơ đồ
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
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: "8px 0 0" }}>{fg.floor}</h3>
          )}
          <div className="unit-plan">
            {fg.zones.map((zg, zIdx) => (
              <React.Fragment key={zg.zone}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: 600, color: "var(--muted)", padding: "2px 4px" }}>
                  <span>{zg.zone === "Chưa phân khu" ? zg.zone : `Dãy ${zg.zone}`}</span>
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

      <p className="unit-map__note">{freeCount(units)} ô còn trống · Bấm vào ô bất kỳ để xem thông tin.</p>
    </section>
  );
}
