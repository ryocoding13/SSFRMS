import React, { useState } from "react";
import { Button, Empty, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { PAYMENT_STATE } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { Facts } from "../../facility-operations/components/FacilityOperationsComponents.jsx";

export function paymentParts(p) {
  if (p.rent != null && p.deposit != null) return { months: p.months || null, rent: Number(p.rent), deposit: Number(p.deposit) };
  const [y1, m1, d1] = String(p.start || "").split("-").map(Number);
  const [y2, m2, d2] = String(p.end || "").split("-").map(Number);
  const months = y1 && y2 ? Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)) : null;
  if (!months) return { months: null, rent: null, deposit: null };
  const monthly = Math.round(p.amount / (months + 1));
  return { months, rent: p.amount - monthly, deposit: monthly };
}

export const HOLD_HOURS = 24;

export function PaymentConfirmationPage({ query }) {
  const { ops, run } = useOps();
  const pending = ops.payments.filter((p) => p.status === "PENDING");
  const p = query.get("id") ? ops.payments.find((x) => x.id === query.get("id")) : pending[0];
  const [busy, setBusy] = useState(false);
  if (!p)
    return (
      <main className="container page">
        <Empty title="Chưa có đơn nào cần thu tại kho" text={'Khi khách chọn "Thanh toán tại cửa hàng", đơn sẽ hiện ở đây để thu tiền.'}>
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const done = p.status !== "PENDING";
  const parts = paymentParts(p);
  const holdUntil = p.reported_at ? new Date(new Date(p.reported_at).getTime() + HOLD_HOURS * 3600000).toISOString() : null;
  const confirm = async () => {
    setBusy(true);
    const r = await run("CONFIRM_PAYMENT", { id: p.id }, `Đã thu tiền đơn ${p.id}`);
    setBusy(false);
    if (r.ok) go("staff/done?kind=payment");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/reconcile")}>← Danh sách thu tiền</a>
      <section className="panel ops-card">
        <h1>Thu tiền tại kho</h1>
        <p className="muted">Đơn #{p.id} — khách chọn thanh toán tại cửa hàng. Thu đủ số tiền rồi bấm xác nhận; chưa thu thì chưa cấp hợp đồng và mã ra vào.</p>
        <Facts
          rows={[
            ["Khách hàng", p.customer],
            ["Số tiền cần thu", <span className="price" key="a">{money(p.amount)}</span>],
            ["Hình thức thu", "Tiền mặt / chuyển khoản tại quầy"],
            ["Giữ chỗ đến", holdUntil ? dateTimeLabel(holdUntil) : "—"],
            ["Gồm", parts.months ? `Thuê ${parts.months} tháng ${money(parts.rent)} + cọc ${money(parts.deposit)}` : p.offer],
          ]}
        />
        {done ? (
          <Notice tone={p.status === "CONFIRMED" ? "success" : "error"}>
            {PAYMENT_STATE[p.status][0]}{p.note ? `: ${p.note}` : ""}.
          </Notice>
        ) : (
          <>
            <Notice>Chỉ bấm xác nhận khi đã thu đủ tiền. Đơn đã thanh toán qua PayOS không hiện ở đây.</Notice>
            <div className="ops-actions">
              <Button onClick={confirm} disabled={busy}>{busy ? "Đang xác nhận…" : "Xác nhận đã thu"}</Button>
              <LinkButton to="staff/reconcile" variant="outline">Để sau</LinkButton>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
