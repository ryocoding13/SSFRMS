import React from "react";
import { Button, LinkButton } from "../../../shared/components/UI.jsx";
import { dateLabel, today } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { millions } from "../../facility-operations/components/FacilityOperationsComponents.jsx";
import { RENTED } from "../dashboard/ManagerDashboardPage.jsx";
import { occupancy } from "../dashboard/ManagerDashboardPage.jsx";
import { growth } from "../dashboard/ManagerDashboardPage.jsx";
import { pct } from "../dashboard/ManagerDashboardPage.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

export function FacilityReportPage() {
  const { ops } = useOps();
  const months = ops.revenue.months;
  const now = new Date();
  const cur = months.at(-1) || { value: 0, month: now.getMonth() + 1, year: now.getFullYear(), label: `Tháng ${now.getMonth() + 1}` };
  const max = 100;
  const typeTotal = ops.revenue.by_type.reduce((s, x) => s + x.value, 0);
  const occ = occupancy(ops.units);
  const rented = ops.units.filter((u) => RENTED.includes(u.status)).length;
  const exportCsv = () => {
    const rows = [["Tháng", "Doanh thu (triệu đồng)"], ...months.map((m) => [`${m.month}/${m.year}`, m.value]), [], ["Loại kho", "Doanh thu (triệu đồng)"], ...ops.revenue.by_type.map((t) => [t.label, t.value]), [], ["Tỷ lệ lấp đầy", `${occ}%`]];
    const csv = "﻿" + rows.map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bao-cao-doanh-thu-${cur.month}-${cur.year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <main className="container page">
      <PageHeaderBlock title={`Báo cáo doanh thu — Tháng ${cur.month}/${cur.year}`} />
      <div className="stats">
        <div className="stat"><strong>{millions(cur.value)}</strong><span>Tổng doanh thu</span></div>
        <div className="stat"><strong className="ok">{pct(growth(months))}</strong><span>Tăng trưởng</span><small className="ok">so với tháng trước</small></div>
        <div className="stat"><strong className="tone-blue">{millions(cur.value / Math.max(1, rented))}</strong><span>Doanh thu TB / kho</span></div>
      </div>
      <div className="detail-grid">
        <section className="panel report-chart" aria-label="Doanh thu 6 tháng gần nhất">
          <h2>Doanh thu 6 tháng gần nhất (triệu đồng)</h2>
          <div className="bars">
            <div className="bars__axis" aria-hidden="true">{[100, 75, 50, 25, 0].map((n) => <span key={n}>{n}</span>)}</div>
            <div className="bars__plot">
              {months.map((m, i) => (
                <div className="bars__col" key={m.label}>
                  <b className={i === months.length - 1 ? "is-current" : ""}>{String(m.value.toFixed(1)).replace(".", ",")}</b>
                  <i className={i === months.length - 1 ? "is-current" : ""} style={{ height: `${(m.value / max) * 100}%` }} />
                  <span className={i === months.length - 1 ? "is-current" : ""}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <aside className="panel booking">
          <h2>Cơ cấu doanh thu theo loại kho</h2>
          {ops.revenue.by_type.map((t, i) => (
            <div className="meter" key={t.label}>
              <div className="meter__row"><span>{t.label}</span><strong>{millions(t.value)} · {Math.round((t.value / typeTotal) * 100)}%</strong></div>
              <div className="meter__track"><i className={`meter__fill meter__fill--${i}`} style={{ width: `${(t.value / typeTotal) * 100}%` }} /></div>
            </div>
          ))}
          <div className="meter">
            <div className="meter__row"><span>Tỷ lệ lấp đầy kho</span><strong>{occ}%</strong></div>
            <div className="meter__track"><i className="meter__fill meter__fill--2" style={{ width: `${occ}%` }} /></div>
          </div>
          <p className="hint">Số liệu tháng {cur.month}/{cur.year} · cập nhật đến {dateLabel(today())}</p>
        </aside>
      </div>
      <div className="ops-actions">
        <Button variant="outline" onClick={exportCsv}>Xuất báo cáo</Button>
        <LinkButton to="manager">Về tổng quan</LinkButton>
      </div>
    </main>
  );
}
