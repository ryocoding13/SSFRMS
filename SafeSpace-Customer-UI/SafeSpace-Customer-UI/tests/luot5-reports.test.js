// Lượt 5 (#35 #36 #37 #38 #58): bộ lọc từ tháng đến tháng, biểu đồ theo cơ sở / theo tháng, báo cáo cơ sở một trang.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { addMonth, defaultRange, monthCount, monthsIn, niceTicks, previousYear, rangeError, rangeFromQuery, rangePeriod, rangeText, change } from "../src/shared/utils/monthRange.js";
import { facilityColumns, joinSheets, monthRows, systemKpis, trendColumns, trendTotal } from "../src/features/business/reports/systemReportModel.js";
import { managerRevenueRows } from "../src/features/manager/reports/managerReportModel.js";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8");

test("#58: khoảng tháng qua năm, không cho tháng bắt đầu sau tháng kết thúc, tối đa 24 tháng", () => {
  assert.deepEqual(defaultRange("2026-11-12"), { from: "2026-01", to: "2026-11" });
  assert.equal(monthCount("2026-11", "2027-02"), 4);
  assert.deepEqual(monthsIn({ from: "2026-11", to: "2027-02" }), ["2026-11", "2026-12", "2027-01", "2027-02"]);
  assert.equal(rangeError({ from: "2026-11", to: "2027-02" }), "");
  assert.match(rangeError({ from: "2026-12", to: "2026-02" }), /trước hoặc bằng/);
  assert.match(rangeError({ from: "2024-01", to: "2026-02" }), /24 tháng/);
  assert.equal(rangeText({ from: "2026-01", to: "2026-11" }), "01/2026 – 11/2026 · 11 tháng");
  assert.deepEqual(rangePeriod({ from: "2026-01", to: "2026-11" }, "2026-11-12"), { from: "2026-01-01", to: "2026-11-12" }, "tháng hiện tại tính đến hôm nay");
  assert.deepEqual(rangePeriod({ from: "2026-11", to: "2027-02" }, "2027-05-01"), { from: "2026-11-01", to: "2027-02-28" });
  assert.deepEqual(previousYear({ from: "2026-01", to: "2026-11" }), { from: "2025-01", to: "2025-11" });
  assert.equal(addMonth("2026-12", 1), "2027-01");
  assert.deepEqual(rangeFromQuery(new URLSearchParams("from=2026-12&to=2026-02"), "2026-11-12"), { from: "2026-01", to: "2026-11" }, "URL sai → mặc định");
});

test("#35/#36: trục có mốc giá trị gồm 0, cơ sở 0 đ vẫn có cột, tháng theo thứ tự thời gian", () => {
  const t = niceTicks(4_600_000);
  assert.equal(t.at(-1), 0);
  assert.ok(t[0] >= 4_600_000);
  assert.ok(t.length >= 3 && t.length <= 7);
  const cols = facilityColumns([
    { facilityId: 2, facilityName: "SafeSpace Tân Thuận", metrics: { rentalAndFeeRevenue: 3_900_000 } },
    { facilityId: 9, facilityName: "SafeSpace Bình Chánh", metrics: { rentalAndFeeRevenue: 0 } },
    { facilityId: 1, facilityName: "SafeSpace Nguyễn Lương Bằng", metrics: { rentalAndFeeRevenue: 4_600_000 } },
  ]);
  assert.deepEqual(cols.map((c) => c.label), ["Nguyễn Lương Bằng", "Tân Thuận", "Bình Chánh"]);
  assert.equal(cols.at(-1).value, 0);
  const months = [{ year: 2026, month: 10, rentalAndFeeRevenue: 3_400_000 }, { year: 2026, month: 11, rentalAndFeeRevenue: 2_800_000 }];
  const tc = trendColumns(months, "2026-11-12");
  assert.deepEqual(tc.map((c) => [c.label, c.highlight]), [["10/2026", false], ["11/2026", true]]);
  assert.equal(trendTotal(months), 6_200_000);
});

test("#36/#37: thẻ tổng quan so cùng kỳ, bảng chi tiết khớp tổng biểu đồ", () => {
  const k = systemKpis({ totals: { rentalAndFeeRevenue: 28_300_000, occupancyRate: 68, overdueContracts: 3, forfeitedRefunds: 350_000 } },
    { totals: { rentalAndFeeRevenue: 25_177_936, occupancyRate: 63, overdueContracts: 5 } });
  assert.equal(Math.round(k.revenueChange * 10) / 10, 12.4);
  assert.equal(k.occupancyPoints, 5);
  assert.equal(k.overdueDiff, -2);
  assert.equal(systemKpis({ totals: { rentalAndFeeRevenue: 1 } }, null).revenueChange, null, "không có cùng kỳ thì không bịa % tăng");
  assert.equal(change(100, 0), null, "không chia cho 0");
  const rows = monthRows([{ year: 2026, month: 10, collected: 10, rentalAndFeeRevenue: 8 }, { year: 2026, month: 11, collected: 5, rentalAndFeeRevenue: 4 }]);
  assert.deepEqual(rows.map((r) => r.label), ["11/2026", "10/2026"], "mới nhất trước");
  assert.equal(rows.reduce((s, r) => s + r.revenue, 0), 12);
  assert.deepEqual(joinSheets([["a"]], [], [["b"]]), [["a"], [], ["b"]]);
});

test("#58: báo cáo quản lý lấp đủ các tháng trong khoảng, tháng thiếu số liệu = 0 đ", () => {
  const rows = managerRevenueRows([{ year: 2026, month: 11, value: 15_800_000 }], { from: "2026-09", to: "2026-11" });
  assert.deepEqual(rows.map((r) => [r.label, r.value, r.known]), [["09/2026", 0, false], ["10/2026", 0, false], ["11/2026", 15_800_000, true]]);
});

test("#37/#38: báo cáo cơ sở một trang, hàng bộ lọc chung căn phải, xuất theo bộ lọc", () => {
  const detail = src("features/business/reports/FacilityReportDetailPage.jsx");
  const system = src("features/business/reports/BusinessReportPage.jsx");
  const css = src("shared/styles/report-controls.css");
  assert.match(detail, /ReportFilterBar/);
  assert.match(detail, /Tăng trưởng doanh thu theo tháng/);
  assert.match(detail, /Báo cáo chi tiết/);
  assert.match(system, /view: "revenue-trend", \.\.\.filter/);
  assert.match(css, /\.report-filter__row \{[^}]*justify-content: flex-end/);
  assert.match(css, /height: 44px/);
  assert.doesNotMatch(system, /BarChart/, "không dùng biểu đồ thanh cũ");
});
