/**
 * PAYMENT CONFIRMATION PAGE - ĐỐI SOÁT VÀ XÁC NHẬN THANH TOÁN (S09 / D21)
 *
 * Kiểm tra xác minh giao dịch thanh toán thành công, ghi nhận mã giao dịch
 * và thời điểm thu tiền thực tế vào sổ quỹ hệ thống.
 */
import React, { useState } from "react";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, money } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { PAYMENT_STATE } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import "../../../shared/styles/customer-detail.css";

// Backend (OpsPaymentDto) chưa trả tách tiền thuê / cọc → ước tính theo D-cọc = 1 tháng thuê, đánh dấu estimated
export function paymentParts(p) {
  if (p.rent != null && p.deposit != null) return { months: p.months || null, rent: Number(p.rent), deposit: Number(p.deposit), estimated: false };
  const [y1, m1, d1] = String(p.start || "").split("-").map(Number);
  const [y2, m2, d2] = String(p.end || "").split("-").map(Number);
  const months = y1 && y2 ? Math.max(1, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0)) : null;
  if (!months) return { months: null, rent: null, deposit: null, estimated: true };
  const monthly = Math.round(p.amount / (months + 1));
  return { months, rent: p.amount - monthly, deposit: monthly, estimated: true };
}

export const HOLD_HOURS = 24;

/**
 * Màn hình xác nhận đã thu tiền thành công cho đơn đặt chỗ hoặc gia hạn.
 */
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
    if (r.ok) go("staff/reconcile");
  };
  const months = parts.months;
  const monthly = months && parts.rent != null ? Math.round(parts.rent / months) : null;
  const period = p.start && p.end ? `${dateLabel(p.start)} – ${dateLabel(p.end)}${months ? ` · ${months} tháng` : ""}` : "—";
  // Figma S09 (13/11): 2 cột cân đối — trái thông tin đơn + xác nhận, phải số tiền cần thu + giữ chỗ.
  return (
    <main className="container page customer-detail payment-collect">
      <a className="back-link" href={href("staff/reconcile")}>← Danh sách thu tiền</a>
      <PageHeader title={`Thu tiền tại kho · Đơn #${p.id}`} description={`${p.customer} chọn thanh toán tại kho. Thu đủ rồi mới xác nhận; hợp đồng, QR và PIN chỉ cấp sau khi đã thu.`}>
        <Tag tone={done ? (p.status === "CONFIRMED" ? "green" : "red") : "amber"}>{done ? (PAYMENT_STATE[p.status] || [p.status])[0] : "Chờ thu tại kho"}</Tag>
      </PageHeader>
      <div className="customer-detail__grid">
        <div className="customer-detail__column">
          <section className="panel customer-detail__card">
            <h2>Thông tin đơn</h2>
            <DetailList items={[["Khách hàng", p.customer], ["Kho", p.offer || "—"], ["Kỳ thuê", period], ["Hình thức thu", "Tiền mặt hoặc chuyển khoản tại quầy"]]} />
          </section>
          <section className="panel customer-detail__card">
            <h2>Xác nhận đã thu</h2>
            {done ? (
              <Notice tone={p.status === "CONFIRMED" ? "success" : "error"}>
                {(PAYMENT_STATE[p.status] || [`Trạng thái ${p.status}`])[0]}{p.note ? `: ${p.note}` : ""}.
              </Notice>
            ) : (
              <>
                <Notice>Chỉ bấm xác nhận khi đã thu đủ {money(p.amount)}. Đơn đã trả qua PayOS không hiện ở đây. Khách đưa thiếu tiền thì chưa xác nhận, bấm "Để sau".</Notice>
                <div className="customer-detail__actions">
                  <LinkButton to="staff/reconcile" variant="outline">Để sau</LinkButton>
                  <Button onClick={confirm} disabled={busy}>{busy ? "Đang xác nhận…" : "Xác nhận đã thu"}</Button>
                </div>
              </>
            )}
          </section>
        </div>
        <aside className="customer-detail__column">
          <section className="panel customer-detail__card">
            <h2>Số tiền cần thu</h2>
            {months && parts.rent != null ? <>
              <div className="money-row"><span>Tiền thuê · Thuê {months} tháng{monthly ? ` × ${money(monthly)}` : ""}</span><strong>{money(parts.rent)}</strong></div>
              <div className="money-row"><span>Cọc · bằng 1 tháng thuê</span><strong>{money(parts.deposit)}</strong></div>
            </> : <div className="money-row"><span>{p.offer || "Tiền thuê và tiền cọc"}</span><strong>—</strong></div>}
            <div className="money-total"><span>Cần thu</span><strong>{money(p.amount)}</strong></div>
            <p className="hint">Gồm tiền thuê trả trước cả kỳ và tiền cọc 1 tháng{parts.estimated && months ? " (tách theo kỳ thuê)" : ""}.</p>
          </section>
          <section className="panel customer-detail__card">
            <h2>Giữ chỗ &amp; sau khi thu</h2>
            <p className="hint">Giữ chỗ đến {holdUntil ? dateTimeLabel(holdUntil) : "—"} — quá hạn chưa thu thì đơn tự huỷ, ô được mở lại.</p>
            <p className="hint">Sau khi bấm Xác nhận đã thu: hệ thống cấp hợp đồng, gửi QR và PIN cho khách; cọc được giữ đến khi trả kho.</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
