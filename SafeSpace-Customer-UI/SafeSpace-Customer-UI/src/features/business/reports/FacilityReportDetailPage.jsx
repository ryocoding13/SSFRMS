/**
 * FACILITY REPORT DETAIL PAGE - BÁO CÁO KINH DOANH CHI TIẾT TỪNG CƠ SỞ (B04a)
 *
 * Trực quan hóa dữ liệu kinh doanh của một chi nhánh cụ thể:
 * - Doanh thu thuê theo từng nhóm kho.
 * - Tỷ lệ lấp đầy thực tế qua các tháng.
 * - Cơ cấu hợp đồng mới, hợp đồng gia hạn và hợp đồng trả kho.
 */
import React, { useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { Button, Empty, LinkButton, Tag } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { go, qs } from "../../../app/router.js";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { ColumnChart, Delta, FilterSelect, ReportFilterBar, ReportState } from "../../../shared/components/ReportControls.jsx";
import { previousYear, rangeFromQuery, rangeMonths, rangePeriod, rangeText } from "../../../shared/utils/monthRange.js";
import { joinSheets, monthRows, systemKpis, trendColumns, trendTotal } from "./systemReportModel.js";
import { parseCsv, downloadWorkbook } from "./reportExport.js";
import { rateLabel } from "../utils/businessFormat.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { CONTRACT_STATUS_LABELS } from "../utils/businessFormat.js";
import { CONTRACT_TONES, contractCodeOf, facilityContractLine, summarizeFacilityContracts } from "./facilityReportModel.js";
import "../../../shared/styles/customer-detail.css";

// 3.5 · Figma B04a: chi tiết một cơ sở từ Báo cáo toàn hệ thống (#/business/facility-report?id=…).
// Dữ liệu: GET /api/operations/reports/facilities/{id}/contracts?status=&unitTypeId= (OPERATIONS/ADMIN).
const STATUS_OPTIONS = ["", "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING", "COMPLETED", "TERMINATED", "CANCELLED"];

/**
 * B04a · Lượt 5 (#36 #37 #58): mở là thấy ngay biểu đồ tăng trưởng (trên) và báo cáo chi tiết (dưới),
 * cùng cơ sở và cùng khoảng tháng. Trạng thái hợp đồng / loại kho lọc danh sách hợp đồng; loại kho áp dụng cho cả số liệu.
 * @param {{ query: URLSearchParams }} props
 */
export function FacilityReportDetailPage({ query }) {
  const { notify, onApiError } = useApp();
  const now = today();
  const id = Number(query?.get("id"));
  const status = query?.get("status") || "";
  const unitType = query?.get("unitType") || "";
  const range = rangeFromQuery(query, now);
  const valid = Number.isSafeInteger(id) && id > 0;
  const set = (patch) => go(`business/facility-report${qs({ id, from: range.from, to: range.to, status, unitType, ...patch })}`, { replace: true });
  const period = rangePeriod(range, now), prev = rangePeriod(previousYear(range), now);
  const scope = { facilityId: id, unitTypeId: unitType || undefined };
  const [exporting, setExporting] = useState(false);

  const meta = useLoad(async () => {
    const [facilities, unitTypes] = await Promise.all([businessApi.facilities({}).catch(() => []), businessApi.unitTypes().catch(() => [])]);
    return { facility: (Array.isArray(facilities) ? facilities : []).find((f) => f.facilityId === id) || null, unitTypes: Array.isArray(unitTypes) ? unitTypes : [] };
  }, [id], undefined);
  const report = useLoad(async () => {
    if (!valid) return null;
    const [current, previous, trend] = await Promise.all([
      businessApi.facilityReport({ ...period, ...scope }),
      businessApi.facilityReport({ ...prev, ...scope }).catch(() => null),
      businessApi.revenueTrend({ ...rangeMonths(range), ...scope }),
    ]);
    return { key: `${range.from}|${range.to}|${unitType}`, current, previous, trend };
  }, [id, range.from, range.to, unitType], onApiError);
  const contracts = useLoad(async () => {
    if (!valid) return null;
    const rows = await businessApi.facilityContracts(id, { status: status || undefined, unitTypeId: unitType || undefined });
    return Array.isArray(rows) ? rows : [];
  }, [id, status, unitType], onApiError);

  if (!valid) return <main className="container page"><Empty title="Không tìm thấy cơ sở" text="Mở báo cáo cơ sở từ bảng Báo cáo hệ thống."><LinkButton to="business/reports">Về báo cáo</LinkButton></Empty></main>;

  const name = meta.data?.facility?.name || `Cơ sở #${id}`;
  const data = report.data && report.data.key === `${range.from}|${range.to}|${unitType}` ? report.data : null;
  const kpi = data ? systemKpis(data.current, data.previous) : null;
  const trend = data ? trendColumns(data.trend.months, now) : [];
  const rows = data ? monthRows(data.trend.months) : [];
  const sum = summarizeFacilityContracts(contracts.data);
  const filtered = Boolean(status || unitType);
  const doExport = async () => {
    if (exporting || !data) return;
    setExporting(true);
    try {
      const filter = { ...period, ...scope };
      const [byFacility, byMonth] = await Promise.all([
        businessApi.exportReport({ view: "facilities", ...filter }, "bao-cao-co-so.csv"),
        businessApi.exportReport({ view: "revenue-trend", ...filter, ...rangeMonths(range) }, "bao-cao-co-so-theo-thang.csv"),
      ]);
      downloadWorkbook(joinSheets(parseCsv(await byFacility.blob.text()), parseCsv(await byMonth.blob.text())), `bao-cao-${name.replace(/\s+/g, "-").toLowerCase()}-${range.from}-den-${range.to}.xlsx`);
      notify("Đã xuất báo cáo theo bộ lọc đang áp dụng.");
    } catch (e) { onApiError(e); notify(e.message, "error"); }
    finally { setExporting(false); }
  };
  const typeOptions = [["", "Tất cả"], ...(meta.data?.unitTypes || []).map((t) => [String(t.unitTypeId), t.typeName])];
  return (
    <main className="container page business-reports facility-report-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Vận hành kinh doanh / Báo cáo / {name}</p>
      <header className="page-header page-header--tight">
        <div>
          <h1>{name}</h1>
          <p className="muted">Mở là thấy ngay biểu đồ tăng trưởng và báo cáo chi tiết, cùng cơ sở và cùng khoảng thời gian.</p>
        </div>
      </header>
      <ReportFilterBar range={range} today={now} busy={exporting} onApply={(r) => set(r)}
        actions={<Button variant="outline" onClick={doExport} disabled={exporting || !data}>{exporting ? "Đang xuất…" : "Xuất báo cáo"}</Button>}>
        <FilterSelect label="Trạng thái hợp đồng" value={status} options={STATUS_OPTIONS.map((s) => [s, s ? CONTRACT_STATUS_LABELS[s] || s : "Tất cả"])} onChange={(v) => set({ status: v })} />
        <FilterSelect label="Loại kho" value={unitType} options={typeOptions} onChange={(v) => set({ unitType: v })} />
      </ReportFilterBar>
      <ReportState loading={report.loading && !data} error={report.error && !data} onRetry={report.reload}>
        {data && <>
          <div className="report-kpis">
            <div className="stat"><span>Doanh thu thuê &amp; phí</span><strong>{money(kpi.revenue)}</strong><Delta value={kpi.revenueChange} /></div>
            <div className="stat"><span>Tỷ lệ lấp đầy</span><strong className="tone-blue">{rateLabel(kpi.occupancy)}</strong><small className="muted">{data.current.totals?.unitsInUse ?? 0}/{data.current.totals?.operableUnits ?? 0} ô đang thuê</small></div>
            <div className="stat"><span>Hợp đồng hiệu lực</span><strong>{sum.active}</strong><small className="muted">Khoản chờ thu {money(sum.pending)}</small></div>
            <div className="stat"><span>Hợp đồng quá hạn</span><strong className={kpi.overdue ? "danger" : ""}>{kpi.overdue}</strong>{kpi.overdueDiff == null ? <small className="muted">Chưa có số liệu cùng kỳ</small> : <small className={kpi.overdueDiff <= 0 ? "ok" : "danger"}>{kpi.overdueDiff === 0 ? "Không đổi" : `${kpi.overdueDiff < 0 ? "▼" : "▲"} ${Math.abs(kpi.overdueDiff)} so với cùng kỳ`}</small>}</div>
          </div>
          <ColumnChart title="Tăng trưởng doanh thu theo tháng" subtitle={`${name} · ${rangeText(range)}`} items={trend}
            footer={`Tổng ${trend.length} tháng: ${money(trendTotal(data.trend.months))} · khớp thẻ tổng quan và bảng chi tiết bên dưới.`} />
          <section className="panel report-chart-card">
            <header><h2>Báo cáo chi tiết</h2><p className="muted">Cùng phạm vi {rangeText(range).split(" · ")[0]} · tổng doanh thu {money(trendTotal(data.trend.months))}</p></header>
            <div className="table-wrap">
              <table className="table report-table">
                <thead><tr><th>Tháng</th><th className="num">Tiền thu</th><th className="num">Cọc thu</th><th className="num">Hoàn tiền</th><th className="num">Doanh thu thuê &amp; phí</th></tr></thead>
                <tbody>
                  {rows.map((r) => <tr key={r.key}><td className="cell-strong">{r.label}</td><td className="num">{money(r.collected)}</td><td className="num">{money(r.deposit)}</td><td className="num">{r.refunded ? `− ${money(r.refunded)}` : money(0)}</td><td className="num"><strong>{money(r.revenue)}</strong></td></tr>)}
                  <tr className="report-table__total"><td>Tổng cộng</td><td className="num">{money(rows.reduce((s, r) => s + r.collected, 0))}</td><td className="num">{money(rows.reduce((s, r) => s + r.deposit, 0))}</td><td className="num">{money(rows.reduce((s, r) => s + r.refunded, 0))}</td><td className="num"><strong>{money(trendTotal(data.trend.months))}</strong></td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </>}
      </ReportState>
      <h2 className="section-title">Hợp đồng của cơ sở</h2>
      {contracts.error ? <Empty title="Chưa tải được danh sách hợp đồng" text="Kiểm tra kết nối rồi thử lại. Bộ lọc vẫn được giữ."><Button onClick={contracts.reload}>Thử lại</Button></Empty>
        : contracts.loading && !contracts.data ? <p role="status" className="muted">Đang tải hợp đồng…</p>
        : !contracts.data?.length ? (
          <Empty title={filtered ? "Không có hợp đồng phù hợp bộ lọc" : "Cơ sở chưa có hợp đồng"} text={filtered ? "Đổi trạng thái hợp đồng hoặc loại kho để xem dữ liệu của cơ sở." : "Khi có hợp đồng thuê, danh sách sẽ hiện ở đây."}>
            {filtered && <Button variant="outline" onClick={() => set({ status: "", unitType: "" })}>Bỏ bộ lọc</Button>}
          </Empty>
        ) : (
          <div className="facility-report-detail__list">
            {contracts.data.map((r) => (
              <article key={r.contractId} className="panel facility-report-detail__item">
                <div>
                  <h3>{contractCodeOf(r)} · {r.customerName}</h3>
                  <p>{r.unitNumber}{r.unitTypeName ? ` · ${r.unitTypeName}` : ""} · {dateLabel(r.startDate)} – {dateLabel(r.endDate)}</p>
                  <p>{facilityContractLine(r, money)}</p>
                </div>
                <Tag tone={CONTRACT_TONES[r.status] || "gray"}>{CONTRACT_STATUS_LABELS[r.status] || r.status}</Tag>
              </article>
            ))}
          </div>
        )}
      <p className="hint">Khoản chờ thu là khoản chưa thanh toán còn hiệu lực (tiền thuê, gia hạn đã duyệt). Không có công nợ ngoài cọc (D32).</p>
      <div className="ops-actions"><LinkButton to={`business/reports${qs({ from: range.from, to: range.to })}`} variant="outline">Về báo cáo hệ thống</LinkButton></div>
    </main>
  );
}
