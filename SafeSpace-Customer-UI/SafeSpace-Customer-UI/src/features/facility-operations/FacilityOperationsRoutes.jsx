/**
 * FACILITY OPERATIONS ROUTES - ĐỊNH TUYẾN PHÂN HỆ TÁC NGHIỆP CƠ SỞ (STAFF / MANAGER)
 *
 * Điều hướng theo URL:
 * - /staff: Bảng việc hôm nay, xác minh khách (S02), kiểm kê trả kho (S03), hỗ trợ (S04),
 *   thu phí tại quầy (S09), chi tiền mặt (S10), nghiệm thu ô cũ (D46).
 * - /manager: Bảng điều khiển, phân bổ kho (M05), phân công việc (M06), duyệt gia hạn (M01),
 *   hoàn cọc (M07/M08), xử lý nợ quá hạn (M04), quản lý ô kho (M02).
 */
import React from "react";
import { RenewalCollectionPage } from "../staff/payments/RenewalCollectionPage.jsx";
import { CashRefundCounterPage } from "../staff/payments/CashRefundCounterPage.jsx";
import { ReturnRecheckPage } from "../staff/returns/ReturnRecheckPage.jsx";
import { OldUnitInspectionPage } from "../staff/returns/OldUnitInspectionPage.jsx";
import { CashRefundApprovalPage } from "../manager/cash/CashRefundApprovalPage.jsx";
import { DailyStaffReportPage } from "../manager/reports/DailyStaffReportPage.jsx";
import { UnitConflictListPage } from "../manager/conflicts/UnitConflictListPage.jsx";
import { OverdueRemovalPage } from "../staff/overdue/OverdueRemovalPage.jsx";
import { StaffInquiryPage } from "../staff/support/StaffInquiryPage.jsx";
import { OverdueCasePage } from "../manager/overdue/OverdueCasePage.jsx";
import { IncidentManagementPage } from "../manager/incidents/IncidentManagementPage.jsx";
import { DepositRefundPage } from "../manager/refunds/DepositRefundPage.jsx";
import { RefundCenterPage } from "../manager/refunds/RefundCenterPage.jsx";

import { Empty, LinkButton } from "../../shared/components/UI.jsx";
import { UnitAllocationPage } from "../manager/allocations/UnitAllocationPage.jsx";
import { StaffAssignmentPage } from "../manager/assignments/StaffAssignmentPage.jsx";
import { ContractListPage } from "../manager/contracts/ContractListPage.jsx";
import { CancellationRefundPage } from "../manager/refunds/CancellationRefundPage.jsx";
import { ManagerResultPage } from "../manager/results/ManagerResultPage.jsx";
import { ManagerDashboardPage } from "../manager/dashboard/ManagerDashboardPage.jsx";
import { RenewalApprovalPage } from "../manager/renewals/RenewalApprovalPage.jsx";
import { FacilityReportPage } from "../manager/reports/FacilityReportPage.jsx";
import { UnitManagementPage } from "../manager/units/UnitManagementPage.jsx";
import FacilityOperationsLayout from "./FacilityOperationsLayout.jsx";
import { StaffResultPage } from "../staff/results/StaffResultPage.jsx";
import { KeyReceiptPage } from "../staff/keys/KeyReceiptPage.jsx";
import { PaymentConfirmationPage } from "../staff/payments/PaymentConfirmationPage.jsx";
import { ReturnInspectionPage } from "../staff/returns/ReturnInspectionPage.jsx";
import { StaffSupportPage } from "../staff/support/StaffSupportPage.jsx";
import { StaffDashboardPage } from "../staff/dashboard/StaffDashboardPage.jsx";
import { CustomerVerificationPage } from "../staff/handovers/CustomerVerificationPage.jsx";
import { useMe } from "../staff/hooks/useStaffIdentity.js";
import { StaffTaskList } from "./components/StaffTasks.jsx";

// Tab nhân viên: không có ?id → lưới 3x3 các việc của tab; có ?id → màn xử lý chi tiết
const LIST_KIND = { reconcile: "reconcile", verify: "verify", handover: "handover", keys: "handover", return: "return", support: "support" };
function StaffTab({ kind, Detail, query }) {
  const me = useMe();
  if (query.get("id")) return <Detail key={query.get("id")} query={query} />;
  // #7: "Kiểm tra ô cũ" gộp vào trang Kiểm tra trả kho (không còn tab riêng dưới navbar)
  return <><StaffTaskList kind={kind} query={query} me={me} />{kind === "return" && <OldUnitInspectionPage embedded />}</>;
}

// #/staff/...  (Figma S01–S09)      #/manager/...  (Figma M01–M08)
const STAFF = {
  "renewal-payments": [RenewalCollectionPage, "staff/reconcile"],
  "cash-refunds": [CashRefundCounterPage, "staff/reconcile"],
  recheck: [ReturnRecheckPage, "staff/return"],
  "unit-moves": [OldUnitInspectionPage, "staff/return"],
  overdue: [OverdueRemovalPage, "staff/return"], // #7: việc "Đồ quá hạn" nằm trong trang Kiểm tra trả kho
  inquiries: [StaffInquiryPage, "staff/support"],
  "": [StaffDashboardPage, "staff"],
  reconcile: [PaymentConfirmationPage, "staff/reconcile"],
  verify: [CustomerVerificationPage, "staff/verify"],
  handover: [KeyReceiptPage, "staff/verify"],
  keys: [KeyReceiptPage, "staff/verify"],
  return: [ReturnInspectionPage, "staff/return"],
  support: [StaffSupportPage, "staff/support"],
  done: [StaffResultPage, "staff"],
};
const MANAGER = {
  // #7 (12/11): navbar quản lý chỉ còn Tổng quan · Danh sách kho · Hợp đồng & quá hạn · Hoàn tiền · Báo cáo.
  // Các màn con vẫn giữ đường dẫn để mở từ thẻ việc / nút trong trang.
  incidents: [IncidentManagementPage, "manager/units"], // mở từ Danh sách kho
  overdue: [OverdueCasePage, "manager/contracts"], // nút "Xử lý quá hạn" trên hợp đồng
  refund: [RefundCenterPage, "manager/refund"],
  "cash-refunds": [CashRefundApprovalPage, "manager/refund"],
  "unit-conflicts": [UnitConflictListPage, "manager"], // thẻ "Cần xử lý" khi không còn ô tương đương
  "daily-report": [DailyStaffReportPage, "manager/report"],
  "deposit-refunds": [DepositRefundPage, "manager/refund"],
  "": [ManagerDashboardPage, "manager"],
  units: [UnitManagementPage, "manager/units"],
  allocate: [UnitAllocationPage, "manager"], // chỉ còn cho đơn đã thanh toán mà hệ thống không bố trí được ô
  assign: [StaffAssignmentPage, "manager"], // bỏ khỏi navbar: yêu cầu của khách hiện thẳng bên nhân viên
  renewals: [RenewalApprovalPage, "manager/renewals"],
  contracts: [ContractListPage, "manager/contracts"],
  refunds: [CancellationRefundPage, "manager/refund"],
  report: [FacilityReportPage, "manager/report"],
  done: [ManagerResultPage, "manager"],
};

/**
 * Bộ định tuyến các chức năng tác nghiệp của nhân viên và quản lý chi nhánh.
 * @param {{ parts: string[], query: URLSearchParams }} props
 */
export default function FacilityOperationsRoutes({ role, parts, query }) {
  const staff = role === "STAFF";
  const table = staff ? STAFF : MANAGER;
  const hit = table[parts[0] || ""];
  const [Page, active] = hit || [null, ""];
  return (
    <FacilityOperationsLayout role={role} active={active} subActive={parts[0] || ""}>
      {/* key theo đường dẫn: nội dung trang dựng lại khi đổi trang, header/menu/dữ liệu giữ nguyên */}
      <React.Fragment key={parts.join("/")}>
      {Page ? (
        staff && LIST_KIND[parts[0]] ? <StaffTab kind={LIST_KIND[parts[0]]} Detail={Page} query={query} /> : <Page key={query.get("id") || "list"} query={query} />
      ) : (
        <main className="container page">
          <Empty title="Không tìm thấy trang" text="Đường dẫn này không tồn tại.">
            <LinkButton to={staff ? "staff" : "manager"}>Về trang chính</LinkButton>
          </Empty>
        </main>
      )}
      </React.Fragment>
    </FacilityOperationsLayout>
  );
}
