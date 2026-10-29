import React from "react";
import { EmptyInline } from "../../../shared/components/Inline.jsx";
import { Button, LinkButton, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, money, shortCode, today } from "../../../shared/utils/format.js";
import { CANCEL_POLICY_HINT } from "../../../shared/utils/policy.js";
import { shortName } from "../../../shared/hooks/useBrowserEvents.js";
import { RESERVATION_STATUS } from "../../../shared/utils/status.js";
import { facilityOf, sortedReservations } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

import RecordSummaryCard from "../../../shared/components/RecordSummaryCard.jsx";

// Đơn khách tự huỷ được — cùng quy tắc backend ReservationService.CancelReservationAsync:
// PENDING_PAYMENT / PENDING_AT_FACILITY (chưa thu tiền) huỷ lúc nào cũng được;
// CONFIRMED (đã thanh toán) chỉ huỷ trước ngày bắt đầu thuê, từ ngày bắt đầu dùng quy trình trả kho.
const CANCELLABLE_API = ["PENDING_PAYMENT", "PENDING_AT_FACILITY", "CONFIRMED"];
export function canCancel(data, r, now = today()) {
  if (r.status === "CANCELLED") return false;
  const started = r.start_date && now >= r.start_date;
  if (r.api_status) return CANCELLABLE_API.includes(r.api_status) && !(r.api_status === "CONFIRMED" && started);
  if (r.status === "PENDING_PAYMENT") return true;
  if (r.status !== "CONFIRMED" || started) return false;
  return !data.contracts.some((c) => c.reservation_id === r.reservation_id && c.handed_over);
}

// C14b/C14c — đơn đã huỷ có khoản hoàn (D27): PENDING = chờ quản lý chuyển khoản, COMPLETED = đã hoàn
const isRefundPending = (r) => r.status === "CANCELLED" && r.refund_status === "PENDING";
const isRefunded = (r) => r.status === "CANCELLED" && r.refund_status === "COMPLETED";
function statusCell(r) {
  if (isRefundPending(r)) return <Tag tone="amber">Đã huỷ · Đang hoàn tiền</Tag>;
  if (isRefunded(r)) return <Tag tone="green">Đã huỷ · Đã hoàn tiền</Tag>;
  return <StatusTag map={RESERVATION_STATUS} status={r.status} />;
}

// C14 — Đơn đặt chỗ của tôi (C14b sau khi huỷ, C14c khi đã hoàn tiền)
export default function ReservationListPage() {
  const { data, retry } = useApp();
  const done = null;
  const list = sortedReservations(data);
  const anyCancellable = list.some((r) => canCancel(data, r));
  const pending = done ? null : list.find(isRefundPending);
  const refunded = done ? null : list.find(isRefunded);
  return (
    <main className="container page customer-records">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Đặt chỗ</p>
      <PageHeader title="Đơn đặt chỗ của tôi" description="Theo dõi thanh toán, phân bổ kho và lịch nhận theo từng đơn."><Tag tone="blue">{list.length} đơn</Tag></PageHeader>
      {list.length === 0 ? (
        <EmptyInline text="Bạn chưa có đơn đặt chỗ nào." cta="Tìm & đặt kho" to="find" />
      ) : (
        <>
          <div className="customer-records__list">
            {list.map((r) => (
              <RecordSummaryCard key={r.reservation_id} title={r.reservation_id} status={statusCell(r)}
                actions={<>
                  {canCancel(data, r) && <LinkButton variant="outline" to={`reservations/${r.reservation_id}/cancel`} aria-label={`Huỷ đơn ${shortCode(r.reservation_id)}`}>Huỷ đơn</LinkButton>}
                  <LinkButton to={`reservations/${r.reservation_id}`}>Xem đơn</LinkButton>
                </>}>
                <p>{shortName(facilityOf(data, r.facility_id, r.facility_name))} · {r.months} tháng · {money(r.initial_total)}</p>
                {r.start_date && <p>Bắt đầu thuê {dateLabel(r.start_date)}</p>}
              </RecordSummaryCard>
            ))}
          </div>
          <div className="panel customer-records__footer">
            {done ? (
              <p className="hint tone-green">
                Đã huỷ đơn {done.id}.{done.refund ? ` Khoản ${money(done.refund)} đang chờ quản lý cơ sở hoàn về tài khoản nhận hoàn đã khai báo.` : ""}
              </p>
            ) : pending ? (
              <p className="hint tone-green">Đã huỷ đơn {pending.reservation_id}. Khoản {money(pending.refund_amount)} đang chờ quản lý cơ sở hoàn về tài khoản nhận hoàn đã khai báo.</p>
            ) : refunded ? (
              <p className="hint tone-green">Đã hoàn {money(refunded.refund_amount)} cho đơn {refunded.reservation_id} về tài khoản nhận hoàn đã khai báo.</p>
            ) : (
              anyCancellable && <p className="hint hint--narrow">{CANCEL_POLICY_HINT}</p>
            )}
            <div className="customer-records__footer-actions">
            <LinkButton to="find" variant="outline">Đặt thêm kho</LinkButton>
            {(done?.refund || pending) && <Button onClick={() => retry?.()}>Kiểm tra trạng thái hoàn tiền</Button>}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
