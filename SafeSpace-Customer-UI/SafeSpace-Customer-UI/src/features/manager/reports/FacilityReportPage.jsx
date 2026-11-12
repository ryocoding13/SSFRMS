/**
 * FACILITY REPORT PAGE - BÁO CÁO TỔNG KẾT HOẠT ĐỘNG CƠ SỞ (M08)
 *
 * Báo cáo tài chính và công suất chi nhánh:
 * - Doanh thu theo tháng, doanh số tiền mặt và chuyển khoản.
 * - Biến động tỷ lệ lấp đầy ô kho theo thời gian.
 */
import { DailyStaffReportPage } from "./DailyStaffReportPage.jsx";
import React from "react";
import { go, qs } from "../../../app/router.js";
import { ColumnChart, Delta, ReportFilterBar, ReportState } from "../../../shared/components/ReportControls.jsx";
import { change, defaultRange, monthLabel, rangeMonths, rangeFromQuery, rangeText } from "../../../shared/utils/monthRange.js";
import { managerRevenueRows } from "./managerReportModel.js";
import { useOpsEndpoint } from "../../facility-operations/workflows/useOpsEndpoint.js";
import { Button, LinkButton } from "../../../shared/components/UI.jsx";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { RENTED } from "../dashboard/ManagerDashboardPage.jsx";
import { occupancy } from "../dashboard/ManagerDashboardPage.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

// Lượt 5 (#58): doanh thu theo khoảng tháng. Máy chủ: GET /api/ops/revenue?from&to (tiền đầy đủ theo đồng).
// Dữ liệu mô phỏng / máy chủ cũ chỉ có 6 tháng gần nhất trên bảng vận hành → lọc trong khoảng đó và ghi rõ.
/**
 * Màn hình báo cáo doanh thu và khai thác của cơ sở (quản lý).
 */
export function FacilityReportPage({ query = new URLSearchParams() } = {}) {
  const { ops, source } = useOps();
  const now = today();
  const range = rangeFromQuery(query, now);
  const def = defaultRange(now);
  const set = (r) => go(`manager/report${qs(r.from === def.from && r.to === def.to ? {} : r)}`, { replace: true });
  const live = useOpsEndpoint(source === "api" ? `/api/ops/revenue?from=${rangeMonths(range).from}&to=${rangeMonths(range).to}` : "");
  const fallback = source !== "api" || live.errorStatus === 404 || live.errorStatus === 405;
  const revenue = fallback ? { months: ops.revenue.months, by_type: ops.revenue.by_type, forfeited: ops.revenue.forfeited_refunds }
    : live.data ? { months: live.data.months || [], by_type: (live.data.byType || []).map((t) => ({ label: t.label, value: Number(t.value) || 0 })), forfeited: live.data.forfeitedRefunds } : null;
  const rows = revenue ? managerRevenueRows(revenue.months, range) : [];
  const missing = fallback && rows.some((r) => !r.known);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const cur = rows.at(-1) || { value: 0, label: monthLabel(range.to) };
  const prevRow = rows.at(-2);
  const typeTotal = (revenue?.by_type || []).reduce((s, x) => s + x.value, 0);
  const forfeited = Number(revenue?.forfeited) || 0;
  const occ = occupancy(ops.units);
  const rented = ops.units.filter((u) => RENTED.includes(u.status)).length;
  const exportCsv = () => {
    const out = [["Báo cáo doanh thu cơ sở", ops.facility.name], ["Khoảng tháng", rangeText(range)], [], ["Tháng", "Doanh thu (đồng)"], ...rows.map((r) => [r.label, r.value]), ["Tổng cộng", total], [], ["Loại kho", "Doanh thu (đồng)"], ...(revenue?.by_type || []).map((t) => [t.label, t.value]), [], ["Tiền mặt hoàn khách không nhận (đồng)", forfeited], ["Tỷ lệ lấp đầy hiện tại", `${occ}%`]];
    const csv = "\ufeff" + out.map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `bao-cao-doanh-thu-${range.from}-den-${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const loading = !fallback && live.loading && !live.data;
  const failed = !fallback && live.error && !live.data;
  return (
    <main className="container page manager-report">
      <PageHeaderBlock title="Báo cáo doanh thu" text={`${ops.facility.name} · ${rangeText(range)}`} />
      <ReportFilterBar range={range} today={now} onApply={set}
        actions={<Button variant="outline" onClick={exportCsv} disabled={!revenue}>Xuất báo cáo</Button>} />
      <ReportState loading={loading} error={failed} onRetry={live.reload}>
        {revenue && <>
          {total === 0 && <p className="hint">Chưa có doanh thu trong {rangeText(range).split(" · ")[0]}. Biểu đồ vẫn hiện đủ các tháng với 0 đ; có thể đổi khoảng thời gian ở bộ lọc.</p>}
          <div className="report-kpis">
            <div className="stat"><span>Tổng doanh thu trong khoảng</span><strong>{money(total)}</strong><small className="muted">{rows.length} tháng</small></div>
            <div className="stat"><span>Tháng {cur.label}</span><strong>{money(cur.value)}</strong>{prevRow ? <Delta value={change(cur.value, prevRow.value)} suffix={`so với ${prevRow.label}`} /> : <small className="muted">Chỉ có 1 tháng trong khoảng</small>}</div>
            <div className="stat"><span>Doanh thu TB / kho đang thuê</span><strong className="tone-blue">{money(cur.value / Math.max(1, rented))}</strong><small className="muted">Tháng {cur.label}</small></div>
            <div className="stat"><span>Tỷ lệ lấp đầy hiện tại</span><strong className="tone-blue">{occ}%</strong><small className="muted">{rented}/{ops.units.length} ô</small></div>
          </div>
          {missing && <p className="hint">Đang dùng số liệu 6 tháng gần nhất của bảng vận hành; tháng ngoài khoảng đó hiện 0 đ.</p>}
          <ColumnChart title="Tăng trưởng doanh thu theo tháng" subtitle="Trục tháng đổi theo khoảng đã chọn"
              items={rows.map((r) => ({ key: r.key, label: r.label, value: r.value, highlight: r.key === now.slice(0, 7) }))}
              footer={`Tổng ${rows.length} tháng: ${money(total)}.`} />
          <div className="manager-report__grid">
            <section className="panel report-chart-card">
              <header><h2>Chi tiết theo tháng</h2><p className="muted">Cùng phạm vi với biểu đồ</p></header>
              <div className="table-wrap"><table className="table report-table">
                <thead><tr><th>Tháng</th><th className="num">Doanh thu thuê &amp; phí</th></tr></thead>
                <tbody>{[...rows].reverse().map((r) => <tr key={r.key}><td className="cell-strong">{r.label}</td><td className="num">{money(r.value)}</td></tr>)}
                  <tr className="report-table__total"><td>Tổng cộng</td><td className="num"><strong>{money(total)}</strong></td></tr></tbody>
              </table></div>
            </section>
            <aside className="panel booking">
              <h2>Cơ cấu doanh thu theo loại kho</h2>
              <p className="hint">Cùng khoảng {rangeText(range).split(" · ")[0]}</p>
              {(revenue.by_type || []).map((t, i) => {
                const share = typeTotal > 0 ? (t.value / typeTotal) * 100 : 0;
                return (
                  <div className="meter" key={t.label}>
                    <div className="meter__row"><span>{t.label}</span><strong>{money(t.value)} · {Math.round(share)}%</strong></div>
                    <div className="meter__track"><i className={`meter__fill meter__fill--${i}`} style={{ width: `${share}%` }} /></div>
                  </div>
                );
              })}
              <div className="meter">
                <div className="meter__row"><span>Tỷ lệ lấp đầy kho</span><strong>{occ}%</strong></div>
                <div className="meter__track"><i className="meter__fill meter__fill--2" style={{ width: `${occ}%` }} /></div>
              </div>
              <div className="meter__row report-forfeited"><span>Tiền mặt hoàn khách không nhận</span><strong>{money(forfeited)}</strong></div>
              <p className="hint">Khoản hoàn tiền mặt quá 30 ngày khách không đến nhận được tính vào doanh thu, ghi riêng ngoài doanh thu thuê và phí.</p>
              <p className="hint">Cập nhật đến {dateLabel(now)}</p>
            </aside>
          </div>
        </>}
      </ReportState>
      <div className="ops-actions"><LinkButton to="manager">Về tổng quan</LinkButton></div>
      {/* #7: Báo cáo cuối ngày gộp vào trang Báo cáo (không còn tab riêng) */}
      <DailyStaffReportPage embedded />
    </main>
  );
}
