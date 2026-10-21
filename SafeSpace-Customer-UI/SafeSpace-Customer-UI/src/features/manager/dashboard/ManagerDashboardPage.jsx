import React from "react";
import { Empty, LinkButton } from "../../../shared/components/UI.jsx";
import { dateLabel, today } from "../../../shared/utils/format.js";
import { href } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { millions } from "../../facility-operations/components/FacilityOperationsComponents.jsx";

export const RENTED = ["ACTIVE", "EXPIRING", "OVERDUE", "WAITING_HANDOVER"];

export const occupancy = (units) => Math.round((units.filter((u) => RENTED.includes(u.status)).length / Math.max(1, units.length)) * 100);

export const growth = (months) => {
  if (months.length < 2) return 0;
  const [a, b] = months.slice(-2).map((m) => m.value);
  return a ? ((b - a) / a) * 100 : 0;
};

export const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;

export function ManagerDashboardPage() {
  const { ops } = useOps();
  const renewals = ops.renewals.filter((r) => r.status === "PENDING");
  const overdue = ops.units.filter((u) => u.status === "OVERDUE");
  const allocations = ops.allocations.filter((a) => a.status === "PENDING");
  const returned = ops.contracts.filter((c) => c.state === "RETURNED");
  const unassigned = ops.assignments.filter((a) => a.status === "OPEN");
  const mismatch = ops.payments.filter((p) => p.status === "MISMATCH");
  const month = ops.revenue.months.at(-1) || { value: 0 };
  const g = growth(ops.revenue.months);
  const items = [
    renewals.length && { key: "r", title: `${renewals.length} yêu cầu gia hạn đang chờ duyệt`, sub: "Cần phản hồi trong vòng 24 giờ", to: "manager/renewals", label: "Xem yêu cầu", primary: true },
    allocations.length && { key: "a", title: `${allocations.length} đơn đã thanh toán chờ phân bổ kho`, sub: allocations.map((a) => a.id).join(", "), to: "manager/allocate", label: "Phân bổ kho", primary: true },
    unassigned.length && { key: "u", title: `${unassigned.length} công việc chưa phân công`, sub: unassigned.map((a) => a.title).join(" · "), to: "manager/assign", label: "Phân công" },
    overdue.length && { key: "o", title: `${overdue.length} kho quá hạn thanh toán`, sub: `Kho ${overdue.map((u) => `#${u.code}`).join(", ")}`, to: "manager/units?tab=OVERDUE", label: "Xem danh sách kho" },
    returned.length && { key: "t", title: `${returned.length} biên bản trả kho chờ xác nhận hoàn cọc`, sub: returned.map((c) => `${c.unit} · ${c.customer}`).join(", "), to: "manager/contracts", label: "Xem hợp đồng" },
    mismatch.length && { key: "m", title: `${mismatch.length} khoản thanh toán báo sai lệch`, sub: mismatch.map((p) => `${p.id} · ${p.customer}`).join(", "), to: "manager/contracts", label: "Xem chi tiết" },
  ].filter(Boolean);
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>Tổng quan cơ sở — {ops.facility.name}</h1>
          <p>Cập nhật đến {dateLabel(today())}</p>
        </div>
      </header>
      <div className="stats stats--4">
        <div className="stat"><strong>{ops.units.length}</strong><span>Tổng số kho</span></div>
        <div className="stat"><strong className="tone-blue">{occupancy(ops.units)}%</strong><span>Tỷ lệ lấp đầy</span></div>
        <div className="stat"><strong className="ok">{millions(month.value)}</strong><span>Doanh thu tháng này</span><small className="ok">{pct(g)} so với tháng trước</small></div>
        <div className="stat"><strong className="warn">{renewals.length}</strong><span>Yêu cầu chờ duyệt</span></div>
      </div>
      <h2 className="section-title">Cần xử lý</h2>
      {items.length === 0 ? (
        <Empty title="Không có việc tồn đọng" text="Các yêu cầu mới từ khách hàng và nhân viên sẽ hiện ở đây." />
      ) : (
        <ul className="rows">
          {items.map((it) => (
            <li className="row ops-row" key={it.key}>
              <div className="row__main"><strong>{it.title}</strong><span>{it.sub}</span></div>
              <a className={`btn ${it.primary ? "btn--primary" : "btn--outline"}`} href={href(it.to)}>{it.label}</a>
            </li>
          ))}
        </ul>
      )}
      <div className="ops-actions">
        <LinkButton to="manager/units">Xem danh sách kho</LinkButton>
        <LinkButton to="manager/report" variant="outline">Xem báo cáo doanh thu</LinkButton>
      </div>
    </main>
  );
}
