import React from "react";
import { ReportExportPage } from "./reports/ReportExportPage.jsx";
import { RentalPolicyEditorPage } from "./policies/RentalPolicyEditorPage.jsx";
import { PolicyStatusPage } from "./policies/PolicyStatusPage.jsx";
import { FacilityRatePage } from "./pricing/FacilityRatePage.jsx";
import { Empty, LinkButton } from "../../shared/components/UI.jsx";
import BusinessLayout from "./BusinessLayout.jsx";
import FacilityManagementPage from "./facilities/FacilityManagementPage.jsx";
import BusinessDashboardPage from "./dashboard/BusinessDashboardPage.jsx";
import PolicySettingsPage from "./policies/PolicySettingsPage.jsx";
import PricingPage from "./pricing/PricingPage.jsx";
import BusinessReportPage from "./reports/BusinessReportPage.jsx";

// Khu Quản lý vận hành KD (Figma B01–B05), role OPERATIONS:
// #/business · #/business/facilities · #/business/policies · #/business/pricing · #/business/reports
export default function BusinessRoutes({ parts, query }) {
  const [a] = parts;
  let active = "business";
  let body;
  if (!a) body = <BusinessDashboardPage />;
  else if (a === "export") { active = "business/reports"; body = <ReportExportPage />; }
  else if (a === "policy-content") { active = "business/policies"; body = <RentalPolicyEditorPage />; }
  else if (a === "policy-status") { active = "business/policies"; body = <PolicyStatusPage />; }
  else if (a === "rates") { active = "business/pricing"; body = <FacilityRatePage query={query} />; }
  else if (a === "facilities") {
    active = "business/facilities";
    body = <FacilityManagementPage query={query} />;
  } else if (a === "policies") {
    active = "business/policies";
    body = <PolicySettingsPage />;
  } else if (a === "pricing") {
    active = "business/pricing";
    body = <PricingPage />;
  } else if (a === "reports") {
    active = "business/reports";
    body = <BusinessReportPage query={query} />;
  } else {
    active = "";
    body = (
      <main className="container page">
        <Empty title="Không tìm thấy trang" text="Đường dẫn này không có trong khu vận hành kinh doanh.">
          <LinkButton to="business">Về tổng quan hệ thống</LinkButton>
        </Empty>
      </main>
    );
  }
  return <BusinessLayout active={active}>{body}</BusinessLayout>;
}
