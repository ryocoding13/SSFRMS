import React from "react";
import { Empty, LinkButton } from "../components/UI";
import BusinessShell from "./BusinessShell";
import BusinessFacilities from "./Facilities";
import BusinessOverview from "./Overview";
import BusinessPolicies from "./Policies";
import BusinessPricing from "./Pricing";
import BusinessReports from "./Reports";

// Khu Quản lý vận hành KD (Figma B01–B05), role OPERATIONS:
// #/business · #/business/facilities · #/business/policies · #/business/pricing · #/business/reports
export default function BusinessApp({ parts, query }) {
  const [a] = parts;
  let active = "business";
  let body;
  if (!a) body = <BusinessOverview />;
  else if (a === "facilities") {
    active = "business/facilities";
    body = <BusinessFacilities query={query} />;
  } else if (a === "policies") {
    active = "business/policies";
    body = <BusinessPolicies />;
  } else if (a === "pricing") {
    active = "business/pricing";
    body = <BusinessPricing />;
  } else if (a === "reports") {
    active = "business/reports";
    body = <BusinessReports query={query} />;
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
  return <BusinessShell active={active}>{body}</BusinessShell>;
}
