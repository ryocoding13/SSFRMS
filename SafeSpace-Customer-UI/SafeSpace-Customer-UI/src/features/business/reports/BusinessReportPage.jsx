/**
 * BUSINESS REPORT PAGE - BÁO CÁO PHÂN TÍCH DOANH THU VÀ CÔNG SUẤT VẬN HÀNH (B04)
 *
 * Các chỉ số báo cáo nghiệp vụ (D16 / D45):
 * - Doanh thu thuê và các loại phí phát sinh.
 * - Khoản cọc đang giữ và hoàn tiền cọc (REFUND).
 * - Khoản hoàn tiền mặt quá hạn 30 ngày khách không nhận (forfeitedRefunds - D45).
 * - Phân tích chi tiết theo từng cơ sở và theo từng loại kho lưu trữ.
 */
import React, { useEffect,useRef,useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { Button, LinkButton } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { go, qs } from "../../../app/router.js";
import { money, today } from "../../../shared/utils/format.js";
import { ColumnChart, Delta, FilterSelect, ReportFilterBar, ReportState } from "../../../shared/components/ReportControls.jsx";
import { defaultRange, monthLabel, previousYear, rangeFromQuery, rangeMonths, rangePeriod, rangeText } from "../../../shared/utils/monthRange.js";
import { facilityColumns, joinSheets, systemKpis, trendColumns, trendTotal } from "./systemReportModel.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import {
  CONTRACT_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  UNIT_STATUS_LABELS,
  rateLabel,
  shortFacility,
  shortMoney,
} from "../utils/businessFormat.js";
import { parseCsv, downloadWorkbook } from "./reportExport.js";
import { LoadState } from "../components/BusinessComponents.jsx";

// D45: tiền mặt hoàn quá 30 ngày khách không nhận — tính vào doanh thu, ghi dòng riêng (không gộp doanh thu thuê và phí).
function ForfeitedNote({ value }) {
  const amount = Number(value) || 0;
  return <p className="hint report-forfeited">Tiền mặt hoàn khách không nhận trong kỳ (tính vào doanh thu, ghi riêng): <strong>{shortMoney(amount)}</strong></p>;
}

function UnitTypeView({ data }) {
  const rows = data.unitTypes;
  return (
    <>
      <ColumnChart
        title="Doanh thu thuê và phí theo loại kho"
        items={rows.map((r) => ({ key: String(r.unitTypeId), label: r.unitTypeName, value: r.metrics.rentalAndFeeRevenue }))}
      />
      <h2 className="section-title">Chi tiết theo loại kho</h2>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Loại kho</th><th>Doanh thu</th><th>Kho đang thuê / khai thác được</th><th>Tỷ lệ lấp đầy</th><th>Hợp đồng quá hạn</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="table__empty">Không có loại kho phù hợp bộ lọc.</td></tr>}
            {rows.map((r) => (
              <tr key={r.unitTypeId}>
                <td className="cell-strong">{r.unitTypeName}</td>
                <td>{shortMoney(r.metrics.rentalAndFeeRevenue)}</td>
                <td>{r.metrics.unitsInUse} / {r.metrics.operableUnits}</td>
                <td>{rateLabel(r.metrics.occupancyRate)}</td>
                <td>{r.metrics.overdueContracts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function StatusGroup({ title, rows, labels }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <section className="panel biz-status" aria-label={title}>
      <h2>{title} <small className="muted">· {total}</small></h2>
      {rows.length === 0 ? (
        <p className="muted">Chưa có dữ liệu.</p>
      ) : (
        rows.map((r) => (
          <div className="meter" key={r.status}>
            <div className="meter__row"><span>{labels[r.status] || r.status}</span><strong>{r.count}</strong></div>
            <div className="meter__track"><i className="meter__fill meter__fill--0" style={{ width: `${total ? (r.count / total) * 100 : 0}%` }} /></div>
          </div>
        ))
      )}
    </section>
  );
}

function StatusView({ data }) {
  return (
    <div className="biz-status-grid">
      <StatusGroup title="Hợp đồng" rows={data.contracts} labels={CONTRACT_STATUS_LABELS} />
      <StatusGroup title="Đơn đặt chỗ" rows={data.reservations} labels={RESERVATION_STATUS_LABELS} />
      <StatusGroup title="Ô kho" rows={data.units} labels={UNIT_STATUS_LABELS} />
    </div>
  );
}

const ANALYSIS = [["", "Theo cơ sở"], ["unit-types", "Theo loại kho"], ["status", "Theo tình trạng thuê"]];

// B04 · Lượt 5 (Figma B-BC · #35 #36 #38 #58): bộ lọc Từ tháng – Đến tháng + loại kho áp dụng cho thẻ tổng quan,
// hai biểu đồ, bảng chi tiết và file xuất. Mở là thấy ngay cả biểu đồ lẫn chi tiết, không cần bấm thêm.
/**
 * Màn hình báo cáo phân tích tài chính và hoạt động kinh doanh toàn hệ thống.
 * @param {{ query: URLSearchParams }} props
 */
export default function BusinessReportPage({ query }) {
  const { notify, onApiError } = useApp();
  const now = today();
  const range = rangeFromQuery(query, now);
  const unitType = query.get("unitType") || "";
  const analysis = ANALYSIS.some(([k]) => k === query.get("view")) ? query.get("view") : "";
  const def = defaultRange(now);
  const set = (patch) => {
    const next = { from: range.from, to: range.to, unitType, view: analysis, ...patch };
    go(`business/reports${qs({ from: next.from === def.from && next.to === def.to ? "" : next.from, to: next.from === def.from && next.to === def.to ? "" : next.to, unitType: next.unitType, view: next.view })}`, { replace: true });
  };
  const period = rangePeriod(range, now);
  const prev = rangePeriod(previousYear(range), now);
  const filter = { ...period, unitTypeId: unitType || undefined };
  const [exporting, setExporting] = useState(false), exportGuard = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const types = useLoad(async () => { const t = await businessApi.unitTypes(); return Array.isArray(t) ? t : []; }, [], undefined);
  const load = useLoad(async () => {
    const [current, previous, trend] = await Promise.all([
      businessApi.facilityReport(filter),
      businessApi.facilityReport({ ...prev, unitTypeId: unitType || undefined }).catch(() => null),
      businessApi.revenueTrend({ ...rangeMonths(range), unitTypeId: unitType || undefined }),
    ]);
    return { key: `${range.from}|${range.to}|${unitType}`, current, previous, trend };
  }, [range.from, range.to, unitType], onApiError);
  const extra = useLoad(async () => {
    if (analysis === "unit-types") return { analysis, data: await businessApi.unitTypeReport(filter) };
    if (analysis === "status") return { analysis, data: await businessApi.rentalStatus({ unitTypeId: unitType || undefined }) };
    return { analysis, data: null };
  }, [analysis, range.from, range.to, unitType], onApiError);

  const data = load.data && load.data.key === `${range.from}|${range.to}|${unitType}` ? load.data : null;
  const kpi = data ? systemKpis(data.current, data.previous) : null;
  const facilities = data ? facilityColumns(data.current.facilities) : [];
  const trend = data ? trendColumns(data.trend.months, now) : [];
  const empty = Boolean(data) && kpi.revenue === 0 && trendTotal(data.trend.months) === 0 && !(data.current.facilities || []).length;

  const doExport = async () => {
    if (exportGuard.current || !data) return; exportGuard.current = true;
    setExporting(true);
    try {
      // #58: file xuất theo đúng bộ lọc đang áp dụng (khoảng tháng + loại kho), gồm theo cơ sở và theo tháng
      const [byFacility, byMonth] = await Promise.all([
        businessApi.exportReport({ view: "facilities", ...filter }, "bao-cao-theo-co-so.csv"),
        businessApi.exportReport({ view: "revenue-trend", ...filter, ...rangeMonths(range) }, "bao-cao-theo-thang.csv"),
      ]);
      const sheets = [parseCsv(await byFacility.blob.text()), parseCsv(await byMonth.blob.text())];
      if (!alive.current) return;
      downloadWorkbook(joinSheets(...sheets), `bao-cao-he-thong-${range.from}-den-${range.to}.xlsx`);
      notify("Đã xuất báo cáo theo bộ lọc đang áp dụng.");
    } catch (e) {
      if (!alive.current) return; onApiError(e);
      notify(e.message, "error");
    } finally { exportGuard.current = false; if (alive.current) setExporting(false); }
  };

  const typeOptions = [["", "Tất cả"], ...(types.data || []).map((t) => [String(t.unitTypeId), t.typeName])];
  return (
    <main className="container page business-reports system-report">
      <p className="customer-records__breadcrumb">SafeSpace / Vận hành kinh doanh / Báo cáo</p>
      <header className="page-header page-header--tight system-report__head">
        <div>
          <h1>Báo cáo hệ thống</h1>
          <p className="muted">Bộ lọc áp dụng cho thẻ tổng quan, cả hai biểu đồ, bảng chi tiết và file xuất. Số tiền hiển thị đầy đủ, không rút gọn.</p>
        </div>
        {data && <span className="tag tag--blue">{(data.current.facilities || []).length} cơ sở</span>}
      </header>
      <ReportFilterBar range={range} today={now} busy={exporting} onApply={(r) => set(r)}
        actions={<Button variant="outline" onClick={doExport} disabled={exporting || !data || empty}>{exporting ? "Đang xuất…" : "Xuất báo cáo"}</Button>}>
        <FilterSelect label="Loại kho" value={unitType} options={typeOptions} disabled={exporting} onChange={(v) => set({ unitType: v })} />
      </ReportFilterBar>
      <ReportState loading={load.loading && !data} error={load.error && !data} onRetry={load.reload} empty={empty}
        emptyText={`Chưa có doanh thu trong ${rangeText(range).split(" · ")[0]}.`} onReset={() => set(def)}>
        {data && <>
          <div className="report-kpis">
            <div className="stat"><span>Doanh thu thuê &amp; phí</span><strong>{money(kpi.revenue)}</strong><Delta value={kpi.revenueChange} suffix={`so với ${monthLabel(previousYear(range).from)} – ${monthLabel(previousYear(range).to)}`} /></div>
            <div className="stat"><span>Tiền mặt khách không nhận</span><strong>{money(kpi.forfeited)}</strong><small className="muted">Dòng riêng, không gộp doanh thu thuê</small></div>
            <div className="stat"><span>Tỷ lệ lấp đầy</span><strong className="tone-blue">{rateLabel(kpi.occupancy)}</strong>{kpi.occupancyPoints == null ? <small className="muted">Chưa có số liệu cùng kỳ</small> : <small className={kpi.occupancyPoints >= 0 ? "ok" : "danger"}>{kpi.occupancyPoints >= 0 ? "▲" : "▼"} {Math.abs(kpi.occupancyPoints)} điểm so với cùng kỳ</small>}</div>
            <div className="stat"><span>Hợp đồng quá hạn</span><strong className={kpi.overdue ? "danger" : ""}>{kpi.overdue}</strong>{kpi.overdueDiff == null ? <small className="muted">Chưa có số liệu cùng kỳ</small> : <small className={kpi.overdueDiff <= 0 ? "ok" : "danger"}>{kpi.overdueDiff === 0 ? "Không đổi so với cùng kỳ" : `${kpi.overdueDiff < 0 ? "▼" : "▲"} ${Math.abs(kpi.overdueDiff)} so với cùng kỳ`}</small>}</div>
          </div>
          <ColumnChart title="Doanh thu theo cơ sở" subtitle={`${rangeText(range).split(" · ")[0]} · so sánh ${facilities.length} cơ sở trong cùng kỳ`} items={facilities} emptyText="Chưa có cơ sở phù hợp bộ lọc." />
          <ColumnChart title="Tăng trưởng doanh thu theo tháng" subtitle="Toàn hệ thống · trục tháng đổi theo khoảng đã chọn" items={trend}
            footer={`Tổng ${trend.length} tháng: ${money(trendTotal(data.trend.months))} · khớp thẻ tổng quan và bảng chi tiết.${range.to === now.slice(0, 7) ? ` ${monthLabel(range.to)} tính đến ${now.split("-").reverse().join("/")}.` : ""}`} />
          <div className="chips system-report__analysis" role="group" aria-label="Phân tích chi tiết theo">
            {ANALYSIS.map(([k, label]) => <button type="button" key={k || "fac"} className={`chip chip--dark${analysis === k ? " is-on" : ""}`} aria-pressed={analysis === k} onClick={() => set({ view: k })}>{label}</button>)}
          </div>
          {!analysis && <FacilityTable rows={data.current.facilities || []} range={range} unitType={unitType} />}
          {analysis && <LoadState load={extra.data && extra.data.analysis !== analysis ? { ...extra, data: null } : extra}>
            {({ data: d }) => analysis === "unit-types" ? <UnitTypeView data={d} /> : <StatusView data={d} />}
          </LoadState>}
          <ForfeitedNote value={data.current.totals?.forfeitedRefunds} />
        </>}
      </ReportState>
      <div className="ops-actions"><LinkButton to="business/export" variant="outline">Xuất CSV theo phạm vi</LinkButton></div>
    </main>
  );
}

function FacilityTable({ rows, range, unitType }) {
  const sorted = [...rows].sort((a, b) => (b.metrics?.rentalAndFeeRevenue || 0) - (a.metrics?.rentalAndFeeRevenue || 0));
  return (
    <>
      <h2 className="section-title">Chi tiết theo cơ sở</h2>
      <div className="panel table-wrap">
        <table className="table report-table">
          <thead><tr><th>Cơ sở</th><th className="num">Hợp đồng quá hạn</th><th className="num">Lấp đầy</th><th className="num">Doanh thu</th><th>Báo cáo</th></tr></thead>
          <tbody>
            {sorted.length === 0 && <tr><td colSpan={5} className="table__empty">Không có cơ sở phù hợp bộ lọc.</td></tr>}
            {sorted.map((r) => (
              <tr key={r.facilityId}>
                <td className="cell-strong">{r.facilityName}</td>
                <td className="num">{r.metrics.overdueContracts}</td>
                <td className="num">{rateLabel(r.metrics.occupancyRate)}</td>
                <td className="num">{shortMoney(r.metrics.rentalAndFeeRevenue)}</td>
                <td><a className="table-link" href={`#/business/facility-report${qs({ id: r.facilityId, from: range.from, to: range.to, unitType })}`}>Xem báo cáo cơ sở →</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
