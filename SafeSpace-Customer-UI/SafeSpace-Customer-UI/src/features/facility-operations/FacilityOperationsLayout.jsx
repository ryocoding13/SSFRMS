import StickyHeader from "../../shared/components/StickyHeader.jsx";
import React, { useEffect, useRef, useState } from "react";
import { LinkButton, Icon } from "../../shared/components/UI.jsx";
import { go, href } from "../../app/router.js";
import { useApp } from "../../app/state/AppProvider.jsx";
import PendingBadge from "../../shared/components/PendingBadge.jsx";
import { pendingTaskCounts } from "./utils/pendingTaskCounts.js";
import { useOps } from "./state/FacilityOperationsProvider.jsx";

export const STAFF_TABS = [
  ["staff", "Công việc ngày"],
  ["staff/reconcile", "Thu tiền"],
  ["staff/verify", "Xác minh"],
  ["staff/return", "Kiểm tra trả kho"],
  ["staff/support", "Hỗ trợ"],
];
export const MANAGER_TABS = [
  ["manager", "Tổng quan"],
  ["manager/units", "Danh sách kho"],
  ["manager/allocate", "Phân bổ kho"],
  ["manager/assign", "Phân công"],
  ["manager/renewals", "Gia hạn"],
  ["manager/contracts", "Hợp đồng & quá hạn"],
  ["manager/report", "Báo cáo"],
];

function useOutside(open, setOpen, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, ref]);
}

function UserMenu({ roleLabel, tone, facilityName }) {
  const { user, logout } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(open, setOpen, ref);
  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className={`usermenu__btn usermenu__btn--${tone}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu">
        <strong>{user?.full_name}</strong>
        <small>{roleLabel}</small>
        {facilityName && <span className="usermenu__facility" title={facilityName}>{facilityName}</span>}
      </button>
      {open && (
        <div className="usermenu__pop" role="menu">
          <p>
            {user?.username || user?.full_name}
            <br />
            <span>{user?.email}</span>
          </p>
          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              await logout();
              go("login");
            }}
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

// Khung chung khu vận hành (Figma S01 / M01): logo, tên + vai trò, chuông, thanh điều hướng theo vai trò
export default function FacilityOperationsLayout({ role, active, children }) {
  const { mode, user } = useApp();
  const { source, ops } = useOps();
  const counts = pendingTaskCounts(ops, role, ops.me || ops.staff.find(s => s.full_name === user?.full_name) || ops.staff[0]);
  const staff = role === "STAFF";
  const tabs = staff ? STAFF_TABS : MANAGER_TABS;
  const home = staff ? "staff" : "manager";
  return (
    <>
      <StickyHeader>
      <header className="header">
        <div className="header__inner">
          <a className="brand" href={href(home)} aria-label="SafeSpace — Trang vận hành">
            <span className="brand__mark"><Icon name="box" size={22} /></span>
            SafeSpace
          </a>
          <nav className="header__nav" aria-label="Điều hướng chính" />
          <div className="header__user">
            {/* Figma 14/10: mỗi nhân viên / quản lý phụ trách đúng 1 cơ sở (SRS A06) → hiện tên cơ sở dưới vai trò */}
            <UserMenu roleLabel={staff ? "Nhân viên cơ sở" : "Quản lý cơ sở"} tone={staff ? "staff" : "manager"} facilityName={ops?.facility?.name} />
          </div>
        </div>
      </header>
      <nav className="subnav" aria-label={staff ? "Điều hướng nhân viên" : "Điều hướng quản lý"}>
        <div className="subnav__inner">
          {tabs.map(([to, label]) => (
            <a key={to} href={href(to)} className={active === to ? "is-active" : ""} aria-current={active === to ? "page" : undefined}>
              {label}<PendingBadge count={counts[to]} />
            </a>
          ))}
        </div>
      </nav>
      </StickyHeader>
      {mode === "api" && source === "local" && (
        <p className="ops-banner" role="status">
          Chưa kết nối được dữ liệu vận hành của cơ sở. Thao tác trên màn hình này đang được lưu tạm trên trình duyệt.
        </p>
      )}
      <div className="container workflow-links" aria-label="Luồng liên quan">
        {staff ? <><LinkButton to="staff/renewal-payments" variant="outline">Thu gia hạn tại quầy</LinkButton><LinkButton to="staff/mismatch" variant="outline">Báo sai lệch</LinkButton><LinkButton to="staff/overdue" variant="outline">Đồ quá hạn</LinkButton><LinkButton to="staff/inquiries" variant="outline">Tư vấn chưa thuê kho</LinkButton></> : <><LinkButton to="manager/discrepancies" variant="outline">Đối soát sai lệch</LinkButton><LinkButton to="manager/overdue" variant="outline">Xử lý quá hạn</LinkButton><LinkButton to="manager/deposit-refunds" variant="outline">Hoàn cọc trả kho</LinkButton><LinkButton to="manager/refunds" variant="outline">Hoàn tiền đơn huỷ</LinkButton></>}
      </div>
      {children}
    </>
  );
}
