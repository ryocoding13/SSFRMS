/**
 * MANAGER DASHBOARD PAGE - TỔNG QUAN HOẠT ĐỘNG VẬN HÀNH CƠ SỞ (M01–M08)
 *
 * Chức năng trung tâm điều hành:
 * - Hiển thị 4 thẻ KPI: Tổng số ô kho, Tỷ lệ lấp đầy (%), Doanh thu tháng này, Yêu cầu chờ duyệt.
 * - Danh sách việc cần xử lý gấp: Gia hạn chờ duyệt (M01), Đơn chờ phân bổ (M05),
 *   Việc chưa giao (M06), Kho quá hạn (M04), Hợp đồng chờ hoàn cọc (M07).
 */
import React from "react";
import { Empty, LinkButton } from "../../../shared/components/UI.jsx";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { href } from "../../../app/router.js";
import { isReturnSettlementReady } from "../../facility-operations/settlements/settlementModel.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";

export const RENTED = ["ACTIVE", "EXPIRING", "OVERDUE", "WAITING_HANDOVER"];

export const occupancy = (units) => Math.round((units.filter((u) => RENTED.includes(u.status)).length / Math.max(1, units.length)) * 100);

export const growth = (months) => {
  if (months.length < 2) return 0;
  const [a, b] = months.slice(-2).map((m) => m.value);
  return a ? ((b - a) / a) * 100 : 0;
};

export const pct = (n) => `${n >= 0 ? "+" : ""}${n.toFixed(1).replace(".", ",")}%`;

/**
 * Trang bảng điều khiển chính dành cho Quản lý cơ sở SafeSpace.
 */
export function ManagerDashboardPage() {
  const { ops } = useOps();
  const overdue = ops.units.filter((u) => u.status === "OVERDUE");
  const allocations = ops.allocations.filter((a) => a.status === "PENDING");
  const returned = ops.contracts.filter((c) => isReturnSettlementReady(ops, c));
  // #7: bỏ Phân bổ kho / Phân công / Xung đột khỏi navbar — chỉ hiện thẻ khi hệ thống không tự bố trí được ô.
  const noUnit = (ops.unit_conflicts || []).filter((c) => c.status === "OPEN" && c.option === "NONE");
  const overdueCases = (ops.overdue_cases || []).filter((c) => c.status !== "DONE");
  const month = ops.revenue.months.at(-1) || { value: 0 };
  const g = growth(ops.revenue.months);
  const items = [
    allocations.length && { key: "a", title: `${allocations.length} đơn đã thanh toán nhưng hệ thống chưa bố trí được ô`, sub: `${allocations.map((a) => a.id).join(", ")} · không còn ô trống cả kỳ, chọn ô thủ công hoặc liên hệ khách`, to: "manager/allocate", label: "Chọn ô", primary: true },
    noUnit.length && { key: "c", title: `${noUnit.length} khách sắp nhận kho nhưng không còn ô tương đương`, sub: `${noUnit.map((c) => c.customer || c.id).join(", ")} · dời ngày hoặc huỷ và hoàn 100%`, to: "manager/unit-conflicts", label: "Xử lý", primary: true },
    (overdue.length || overdueCases.length) && { key: "o", title: `${Math.max(overdue.length, overdueCases.length)} hợp đồng quá hạn`, sub: overdue.length ? `Kho ${overdue.map((u) => `#${u.code}`).join(", ")}` : "Nhắc khách, ngày 20 lập biên bản", to: "manager/contracts", label: "Xem hợp đồng" },
    returned.length && { key: "t", title: `${returned.length} biên bản trả kho chờ xác nhận hoàn cọc`, sub: returned.map((c) => `${c.unit} · ${c.customer}`).join(", "), to: "manager/contracts", label: "Xem hợp đồng" },
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
        <div className="stat"><strong className="ok">{money(month.value)}</strong><span>Doanh thu tháng này</span><small className="ok">{pct(g)} so với tháng trước</small></div>
        <div className="stat"><strong className="warn">{allocations.length + noUnit.length + returned.length}</strong><span>Việc cần xử lý</span></div>
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
