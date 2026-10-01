import React from "react";
import { Empty, LinkButton } from "../components/UI";
import {
  ManagerAllocate, ManagerAssign, ManagerContracts, ManagerDone, ManagerOverview, ManagerRenewals, ManagerReport, ManagerUnits,
} from "./ManagerPages";
import OpsShell from "./OpsShell";
import { StaffDone, StaffHandover, StaffReconcile, StaffReturn, StaffSupport, StaffToday, StaffVerify, useMe } from "./StaffPages";
import { StaffTaskList } from "./tasks";

// Tab nhân viên: không có ?id → lưới 3x3 các việc của tab; có ?id → màn xử lý chi tiết
const LIST_KIND = { reconcile: "reconcile", verify: "verify", handover: "handover", return: "return", support: "support" };
function StaffTab({ kind, Detail, query }) {
  const me = useMe();
  return query.get("id") ? <Detail query={query} /> : <StaffTaskList kind={kind} query={query} me={me} />;
}

// #/staff/...  (Figma S01–S09)      #/manager/...  (Figma M01–M08)
const STAFF = {
  "": [StaffToday, "staff"],
  reconcile: [StaffReconcile, "staff/reconcile"],
  verify: [StaffVerify, "staff/verify"],
  handover: [StaffHandover, "staff/handover"],
  return: [StaffReturn, "staff/return"],
  support: [StaffSupport, "staff/support"],
  done: [StaffDone, "staff"],
};
const MANAGER = {
  "": [ManagerOverview, "manager"],
  units: [ManagerUnits, "manager/units"],
  allocate: [ManagerAllocate, "manager/allocate"],
  assign: [ManagerAssign, "manager/assign"],
  renewals: [ManagerRenewals, "manager/renewals"],
  contracts: [ManagerContracts, "manager/contracts"],
  report: [ManagerReport, "manager/report"],
  done: [ManagerDone, "manager"],
};

export default function OpsApp({ role, parts, query }) {
  const staff = role === "STAFF";
  const table = staff ? STAFF : MANAGER;
  const hit = table[parts[0] || ""];
  const [Page, active] = hit || [null, ""];
  return (
    <OpsShell role={role} active={active}>
      {Page ? (
        staff && LIST_KIND[parts[0]] ? <StaffTab kind={LIST_KIND[parts[0]]} Detail={Page} query={query} /> : <Page query={query} />
      ) : (
        <main className="container page">
          <Empty title="Không tìm thấy trang" text="Đường dẫn này không tồn tại.">
            <LinkButton to={staff ? "staff" : "manager"}>Về trang chính</LinkButton>
          </Empty>
        </main>
      )}
    </OpsShell>
  );
}
