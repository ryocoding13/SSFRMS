import React, { useState } from "react";
import { businessApi } from "../api/business";
import { Button } from "../components/UI";
import { useLoad } from "../admin/util";
import { go, qs } from "../lib/router";
import { today } from "../lib/format";
import { useApp } from "../state/store";
import {
  CONTRACT_STATUS_LABELS,
  RESERVATION_STATUS_LABELS,
  UNIT_STATUS_LABELS,
  monthPeriod,
  rateLabel,
  shortFacility,
  shortMoney,
} from "./format";
import { parseCsv, downloadWorkbook } from "./export";
import { BarChart, LoadState } from "./parts";

const VIEWS = [
  ["facilities", "Theo cơ sở"],
  ["unit-types", "Theo loại kho"],
  ["revenue", "Theo doanh thu"],
  ["status", "Theo tình trạng thuê"],
];

function FacilityView({ data }) {
  const rows = data.facilities;
  return (
    <>
      <BarChart
        title={`Doanh thu theo cơ sở — tháng ${Number(data.filter.from.slice(5, 7))}/${data.filter.from.slice(0, 4)}`}
        items={rows.map((r) => ({ key: r.facilityId, label: shortFacility(r.facilityName), value: r.metrics.rentalAndFeeRevenue, text: shortMoney(r.metrics.rentalAndFeeRevenue) }))}
      />
      <h2 className="section-title">Chi tiết theo cơ sở</h2>
      <div className="panel table-wrap">
        <table className="table"><colgroup><col style={{width:"27%"}}/><col style={{width:"17.46%"}}/><col style={{width:"17.46%"}}/><col/></colgroup>
          <thead><tr><th>Cơ sở</th><th>Doanh thu</th><th>Tỷ lệ lấp đầy</th><th>Hợp đồng quá hạn</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="table__empty">Không có cơ sở phù hợp bộ lọc.</td></tr>}
            {rows.map((r) => (
              <tr key={r.facilityId}>
                <td className="cell-strong">{r.facilityName}</td>
                <td>{shortMoney(r.metrics.rentalAndFeeRevenue)}</td>
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

function UnitTypeView({ data }) {
  const rows = data.unitTypes;
  return (
    <>
      <BarChart
        title="Doanh thu thuê và phí theo loại kho"
        items={rows.map((r) => ({ key: r.unitTypeId, label: r.unitTypeName, value: r.metrics.rentalAndFeeRevenue, text: shortMoney(r.metrics.rentalAndFeeRevenue) }))}
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

function RevenueView({ data }) {
  const months = data.months;
  return (
    <>
      <BarChart
        title="Doanh thu thuê và phí 6 tháng gần nhất"
        items={months.map((m) => ({ key: `${m.year}-${m.month}`, label: `${m.month}/${m.year}`, value: m.rentalAndFeeRevenue, text: shortMoney(m.rentalAndFeeRevenue) }))}
      />
      <h2 className="section-title">Chi tiết theo tháng</h2>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Tháng</th><th>Doanh thu thuê và phí</th><th>Cọc thu</th><th>Tổng tiền thu</th><th>Hoàn tiền</th></tr></thead>
          <tbody>
            {[...months].reverse().map((m) => (
              <tr key={`${m.year}-${m.month}`}>
                <td className="cell-strong">Tháng {m.month}/{m.year}</td>
                <td>{shortMoney(m.rentalAndFeeRevenue)}</td>
                <td>{shortMoney(m.depositCollected)}</td>
                <td>{shortMoney(m.collected)}</td>
                <td>{shortMoney(m.refunded)}</td>
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

// B04 · Báo cáo toàn hệ thống (UC22, UC23): theo cơ sở / loại kho / doanh thu / tình trạng thuê, xuất XLSX (CSV từ API được chuyển thành workbook; trạng thái dùng snapshot đang xem)
export default function BusinessReports({ query }) {
  const { notify, onApiError } = useApp();
  const now = today();
  const view = VIEWS.some(([k]) => k === query.get("view")) ? query.get("view") : "facilities";
  const month = /^(?:19|20)\d{2}-(?:0[1-9]|1[0-2])$/.test(query.get("month") || "") ? query.get("month") : now.slice(0, 7);
  const facility = query.get("facility") || "";
  const set = (patch) => go(`business/reports${qs({ view, month: month === now.slice(0, 7) ? "" : month, facility, ...patch })}`, { replace: true });
  const period = monthPeriod(month, now);
  const filter = { ...period, facilityId: facility };
  const [exporting, setExporting] = useState(false);

  // Giữ kèm tên view để không vẽ số liệu cũ của view khác trong lúc đang tải view mới
  const load = useLoad(
    async () => {
      if (view === "unit-types") return { view, data: await businessApi.unitTypeReport(filter) };
      if (view === "revenue") return { view, data: await businessApi.revenueTrend({ months: 6 }) };
      if (view === "status") return { view, data: await businessApi.rentalStatus({}) };
      return { view, data: await businessApi.facilityReport(filter) };
    },
    [view, month, facility],
    onApiError,
  );

  const exportView = view === "unit-types" ? "unit-types" : view === "revenue" ? "revenue-trend" : view === "facilities" ? "facilities" : null;
  const doExport = async () => {
    setExporting(true);
    try {
      if (view === "status") {
        const data = load.data.data;
        const rows = [['SafeSpace — Báo cáo tình trạng thuê'], ['Cập nhật (UTC)', data.snapshotAt], ['Nhóm', 'Tình trạng', 'Số lượng']];
        for (const [key, title, labels] of [['contracts', 'Hợp đồng', CONTRACT_STATUS_LABELS], ['reservations', 'Đơn đặt chỗ', RESERVATION_STATUS_LABELS], ['units', 'Ô kho', UNIT_STATUS_LABELS]])
          for (const r of data[key]) rows.push([title, labels[r.status] || r.status, r.count]);
        downloadWorkbook(rows, `bao-cao-tinh-trang-thue-${now}.xlsx`);
        notify("Đã xuất báo cáo.");
        return;
      }
      const params = exportView === "revenue-trend" ? { view: exportView, from: new Date(Date.UTC(Number(now.slice(0, 4)), Number(now.slice(5, 7)) - 6, 1)).toISOString().slice(0, 10), to: now } : { view: exportView, ...filter };
      const { blob } = await businessApi.exportReport(params, `bao-cao-${exportView}-${month}.csv`);
      downloadWorkbook(parseCsv(await blob.text()), `bao-cao-${exportView}-${month}.xlsx`);
      notify("Đã xuất báo cáo.");
    } catch (e) {
      onApiError(e);
      notify(e.message, "error");
    } finally { setExporting(false); }
  };

  const [y, m] = month.split("-");
  return (
    <main className="container page business-reports">
      <header className="page-header page-header--tight">
        <div>
          <h1>Báo cáo toàn hệ thống{view === "revenue" || view === "status" ? "" : ` — Tháng ${Number(m)}/${y}`}</h1>

        </div>
      </header>
      <div className="admin-toolbar biz-toolbar">
        <div className="chips" role="group" aria-label="Xem báo cáo theo">
          {VIEWS.map(([k, label]) => (
            <button type="button" key={k} className={`chip chip--dark${view === k ? " is-on" : ""}`} aria-pressed={view === k} onClick={() => set({ view: k })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <LoadState load={load.data && load.data.view !== view ? { ...load, data: null } : load}>
        {({ data }) => (
          <>
            {view === "facilities" && <FacilityView data={data} />}
            {view === "unit-types" && <UnitTypeView data={data} />}
            {view === "revenue" && <RevenueView data={data} />}
            {view === "status" && <StatusView data={data} />}

          </>
        )}
      </LoadState>
      <div className="ops-actions">
          <Button variant="outline" onClick={doExport} disabled={exporting || load.loading || !!load.error || !load.data || load.data.view !== view}>Xuất báo cáo (.xlsx)</Button>
      </div>
    </main>
  );
}
