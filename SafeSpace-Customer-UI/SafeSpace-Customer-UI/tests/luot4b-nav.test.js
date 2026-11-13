// #7 bổ sung (12/11): bỏ hẳn hàng ô dưới navbar; navbar quản lý mới; chức năng con có lối vào trong trang.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { refundKindOf, refundPendingCounts } from "../src/features/manager/refunds/refundCenterModel.js";
import { hasMapCoords } from "../src/app/config/geo.js";

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

test("#7: navbar quản lý không còn Phân bổ kho, Phân công; có Hoàn tiền", () => {
  const layout = src("features/facility-operations/FacilityOperationsLayout.jsx");
  const labels = (name) => [...layout.split(`export const ${name} = [`)[1].split("];")[0].matchAll(/\["[^"]+", "([^"]+)"\]/g)].map((m) => m[1]);
  assert.deepEqual(labels("MANAGER_TABS"), ["Tổng quan", "Danh sách kho", "Hợp đồng & quá hạn", "Hoàn tiền", "Báo cáo"]);
  assert.deepEqual(labels("STAFF_TABS"), ["Công việc ngày", "Thu tiền", "Xác minh", "Kiểm tra trả kho", "Hỗ trợ"]);
});

test("#7: không còn hàng tab dưới navbar", () => {
  assert.ok(!existsSync(new URL("../src/features/facility-operations/utils/pageTabs.js", import.meta.url)));
  assert.doesNotMatch(src("features/facility-operations/FacilityOperationsLayout.jsx"), /page-tabs/);
});

test("#7: mọi chức năng con còn lối vào trong trang", () => {
  assert.match(src("features/facility-operations/FacilityOperationsRoutes.jsx"), /kind === "return" && <OldUnitInspectionPage embedded \/>/);
  assert.match(src("features/manager/contracts/ContractListPage.jsx"), /manager\/overdue\$\{qs\(\{contract:c\.id\}\)\}/);
  assert.match(src("features/manager/reports/FacilityReportPage.jsx"), /<DailyStaffReportPage embedded \/>/);
  assert.match(src("features/manager/dashboard/ManagerDashboardPage.jsx"), /manager\/unit-conflicts/);
  assert.match(src("features/manager/dashboard/ManagerDashboardPage.jsx"), /manager\/allocate/);
  assert.match(src("features/facility-operations/components/StaffTasks.jsx"), /kind === "all" \|\| kind === "return"\)\r?\n\s+\(ops\.overdue_cases/);
});

test("#7: Hoàn tiền gộp đơn huỷ, hoàn cọc và tiền mặt", () => {
  assert.equal(refundKindOf("cash"), "cash");
  assert.equal(refundKindOf("bừa"), "");
  assert.deepEqual(refundPendingCounts({ refunds: [{ status: "PENDING" }], deposit_refunds: [{ status: "PAID" }], cash_refunds: [{ status: "WAITING_APPROVAL" }, { status: "READY" }] }), { cancel: 1, deposit: 0, cash: 1 });
});

test("Thêm cơ sở: chưa có toạ độ thì không ghim lên bản đồ", () => {
  assert.equal(hasMapCoords({ name: "SafeSpace Hoàn Kiếm" }), false);
  assert.equal(hasMapCoords({ name: "SafeSpace Hoàn Kiếm", lat: 21.03, lng: 105.85 }), true);
  assert.equal(hasMapCoords({ name: "SafeSpace Tân Bình" }), true, "cơ sở mẫu có vị trí theo tên");
  assert.match(src("features/business/facilities/FacilityManagementPage.jsx"), /Vĩ độ \(không bắt buộc\)/);
});
