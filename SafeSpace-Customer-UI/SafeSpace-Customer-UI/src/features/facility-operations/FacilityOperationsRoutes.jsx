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
import { DamageReviewPage } from "../manager/damage/DamageReviewPage.jsx";
import { DamageInspectionPage } from "../manager/damage/DamageInspectionPage.jsx";
import { DepositRefundPage } from "../manager/refunds/DepositRefundPage.jsx";

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
  return query.get("id") ? <Detail key={query.get("id")} query={query} /> : <StaffTaskList kind={kind} query={query} me={me} />;
}

// #/staff/...  (Figma S01–S09)      #/manager/...  (Figma M01–M08)
const STAFF = {
  "renewal-payments": [RenewalCollectionPage, "staff/reconcile"],
  "cash-refunds": [CashRefundCounterPage, "staff/reconcile"],
  recheck: [ReturnRecheckPage, "staff/return"],
  "unit-moves": [OldUnitInspectionPage, "staff/return"],
  overdue: [OverdueRemovalPage, "staff"],
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
  incidents: [IncidentManagementPage, "manager/contracts"],
  "damage-responses": [DamageReviewPage, "manager/contracts"],
  "damage-inspections": [DamageInspectionPage, "manager/contracts"],
  overdue: [OverdueCasePage, "manager/contracts"],
  "cash-refunds": [CashRefundApprovalPage, "manager/contracts"],
  "unit-conflicts": [UnitConflictListPage, "manager/contracts"],
  "daily-report": [DailyStaffReportPage, "manager/report"],
  "deposit-refunds": [DepositRefundPage, "manager/contracts"],
  "": [ManagerDashboardPage, "manager"],
  units: [UnitManagementPage, "manager/units"],
  allocate: [UnitAllocationPage, "manager/allocate"],
  assign: [StaffAssignmentPage, "manager/assign"],
  renewals: [RenewalApprovalPage, "manager/renewals"],
  contracts: [ContractListPage, "manager/contracts"],
  refunds: [CancellationRefundPage, "manager/contracts"],
  report: [FacilityReportPage, "manager/report"],
  done: [ManagerResultPage, "manager"],
};

export default function FacilityOperationsRoutes({ role, parts, query }) {
  const staff = role === "STAFF";
  const table = staff ? STAFF : MANAGER;
  const hit = table[parts[0] || ""];
  const [Page, active] = hit || [null, ""];
  return (
    <FacilityOperationsLayout role={role} active={active}>
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
