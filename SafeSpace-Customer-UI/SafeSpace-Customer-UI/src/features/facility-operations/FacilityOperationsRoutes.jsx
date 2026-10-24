import React from "react";
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
import { FeeCollectionPage } from "../staff/payments/FeeCollectionPage.jsx";
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
  return query.get("id") ? <Detail query={query} /> : <StaffTaskList kind={kind} query={query} me={me} />;
}

// #/staff/...  (Figma S01–S09)      #/manager/...  (Figma M01–M08)
const STAFF = {
  "": [StaffDashboardPage, "staff"],
  reconcile: [PaymentConfirmationPage, "staff/reconcile"],
  fees: [FeeCollectionPage, "staff/reconcile"],
  verify: [CustomerVerificationPage, "staff/verify"],
  handover: [KeyReceiptPage, "staff/verify"],
  keys: [KeyReceiptPage, "staff/verify"],
  return: [ReturnInspectionPage, "staff/return"],
  support: [StaffSupportPage, "staff/support"],
  done: [StaffResultPage, "staff"],
};
const MANAGER = {
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
      {Page ? (
        staff && LIST_KIND[parts[0]] ? <StaffTab kind={LIST_KIND[parts[0]]} Detail={Page} query={query} /> : <Page query={query} />
      ) : (
        <main className="container page">
          <Empty title="Không tìm thấy trang" text="Đường dẫn này không tồn tại.">
            <LinkButton to={staff ? "staff" : "manager"}>Về trang chính</LinkButton>
          </Empty>
        </main>
      )}
    </FacilityOperationsLayout>
  );
}
