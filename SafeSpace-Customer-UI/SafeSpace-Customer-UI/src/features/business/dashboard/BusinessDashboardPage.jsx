import React from "react";
import { businessApi } from "../api/businessApi.js";
import { LinkButton } from "../../../shared/components/UI.jsx";
import { useLoad, dateTime } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { areaOf, growthLabel, rateLabel, shortMoney } from "../utils/businessFormat.js";
import { LoadState } from "../components/BusinessComponents.jsx";

// B01 · Tổng quan toàn hệ thống — số liệu tháng này từ /reports/facilities + /reports/revenue-trend
export default function BusinessDashboardPage() {
  const { onApiError } = useApp();
  const load = useLoad(
    async () => {
      const [facilities, report, trend] = await Promise.all([
        businessApi.facilities(),
        businessApi.facilityReport({}),
        businessApi.revenueTrend({ months: 2 }),
      ]);
      return { facilities, report, trend };
    },
    [],
    onApiError,
  );

  return (
    <main className="container page">
      <LoadState load={load}>
        {({ facilities, report, trend }) => {
          const t = report.totals;
          const active = facilities.filter((f) => f.status === "ACTIVE").length;
          const [prev, cur] = trend.months.length >= 2 ? trend.months.slice(-2) : [null, trend.months.at(-1)];
          const growth = prev && cur ? growthLabel(prev.rentalAndFeeRevenue, cur.rentalAndFeeRevenue) : null;
          const byId = new Map(facilities.map((f) => [f.facilityId, f]));
          return (
            <>
              <header className="page-header page-header--tight">
                <div>
                  <h1>Tổng quan toàn hệ thống</h1>
                  <p>{active} cơ sở đang hoạt động · Cập nhật đến {dateTime(report.snapshotAt)}</p>
                </div>
              </header>
              <div className="stats stats--4">
                <div className="stat"><strong>{facilities.length}</strong><span>Tổng số cơ sở</span></div>
                <div className="stat">
                  <strong className="ok">{shortMoney(t.rentalAndFeeRevenue)}</strong>
                  <span>Tổng doanh thu tháng</span>
                  {growth && <small className={growth.startsWith("+") ? "ok" : "warn"}>{growth} so với tháng trước</small>}
                </div>
                <div className="stat"><strong className="tone-blue">{rateLabel(t.occupancyRate)}</strong><span>Tỷ lệ lấp đầy trung bình</span></div>
                <div className="stat"><strong className="danger">{t.overdueContracts}</strong><span>Hợp đồng quá hạn toàn hệ thống</span></div>
              </div>

              <h2 className="section-title">Danh sách cơ sở</h2>
              <div className="panel table-wrap">
                <table className="table"><colgroup><col style={{width:"27%"}}/><col style={{width:"17.46%"}}/><col style={{width:"11.9%"}}/><col style={{width:"15.87%"}}/><col/></colgroup>
                  <thead>
                    <tr><th>Cơ sở</th><th>Khu vực</th><th>Số kho</th><th>Tỷ lệ lấp đầy</th><th>Doanh thu tháng</th></tr>
                  </thead>
                  <tbody>
                    {report.facilities.length === 0 && <tr><td colSpan={5} className="table__empty">Chưa có cơ sở nào.</td></tr>}
                    {report.facilities.map((row) => {
                      const f = byId.get(row.facilityId);
                      const { district, city } = areaOf(f?.address);
                      return (
                        <tr key={row.facilityId}>
                          <td className="cell-strong">{row.facilityName}</td>
                          <td>{city || "—"}</td>
                          <td>{row.metrics.totalUnits}</td>
                          <td>{rateLabel(row.metrics.occupancyRate)}</td>
                          <td>{shortMoney(row.metrics.rentalAndFeeRevenue)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="ops-actions">
                <LinkButton to="business/policies">Quản lý chính sách</LinkButton>
                <LinkButton to="business/pricing" variant="outline">Quản lý giá &amp; phí</LinkButton>
                <LinkButton to="business/reports" variant="outline">Xem báo cáo hệ thống</LinkButton>
              </div>
            </>
          );
        }}
      </LoadState>
    </main>
  );
}
