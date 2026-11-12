/**
 * CANCEL RESERVATION PAGE - HỦY ĐƠN ĐẶT CHỖ VÀ YÊU CẦU HOÀN TIỀN (C14a / D21 / D40)
 *
 * Chính sách hủy D40:
 * - Đơn hủy trước ngày bắt đầu thuê: Hoàn lại 100% tiền thuê và 95% tiền cọc (khấu trừ phí hủy 5% cọc).
 * - Khách hàng nhập thông tin tài khoản ngân hàng hoặc chọn nhận tiền mặt tại chi nhánh (D42).
 */
import React, { useEffect, useRef, useState } from "react";
import { Button, DetailList, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import RefundMethodFields from "../../../shared/components/RefundMethodFields.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { useRefundSupport } from "../../../shared/hooks/useRefundSupport.js";
import { emptyRefundBank, isCashRefund, validateRefundChoice } from "../../../shared/utils/refundRequest.js";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { CANCEL_DEPOSIT_FEE_RATE } from "../../../shared/utils/policy.js";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "../contracts/components/ContractNotFound.jsx";
import { canCancel } from "./ReservationListPage.jsx";
import "../../../shared/styles/customer-detail.css";
// Figma D30-07 · cột "Khoản hoàn dự kiến": đã thanh toán, tiền thuê hoàn 100%, cọc ban đầu, phí huỷ 5% cọc (D40).
function cancelRows(r, preview) {
  const deposit = Number(r.deposit), rows = [["Đã thanh toán", money(preview.paid)]];
  if (Number.isFinite(deposit) && deposit > 0 && preview.paid >= deposit) rows.push(["Tiền thuê · hoàn 100%", money(preview.paid - deposit)], ["Cọc ban đầu", money(deposit)]);
  rows.push([CANCEL_DEPOSIT_FEE_RATE === 0 ? "Phí huỷ (0%)" : `Phí huỷ · ${Math.round(CANCEL_DEPOSIT_FEE_RATE * 100)}% cọc`, preview.fee > 0 ? <span className="money-deduct">− {money(preview.fee)}</span> : money(0)]);
  return rows;
}
/**
 * Màn hình xác nhận hủy đơn đặt trước và đăng ký thông tin nhận tiền hoàn.
 * @param {{ id: string|number }} props
 */
export function CancelReservationPage({ id }) {
  const { data, dispatch, services, mode } = useApp();
  const support = useRefundSupport("cancellationBankSupported");
  const r = data.reservations.find(x => x.reservation_id === id);
  const c = data.contracts.find(x => x.reservation_id === id);
  const paid = r?.status === "CONFIRMED";
  const [bank, setBank] = useState(emptyRefundBank), [reason, setReason] = useState("");
  const [preview, setPreview] = useState(null), [previewError, setPreviewError] = useState(""), [attempt, setAttempt] = useState(0);
  const [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const guard = useRef(false);
  useEffect(() => {
    let alive = true;
    if (!paid || !r) return;
    setPreview(null); setPreviewError("");
    Promise.resolve().then(() => services.cancelPreview(r)).then(res => { if (!alive) return; if (res.ok && res.preview) setPreview(res.preview); else setPreviewError(res.error || "Chưa lấy được khoản hoàn. Vui lòng tải lại hoặc liên hệ cơ sở."); }).catch(() => { if (alive) setPreviewError("Chưa tải được khoản hoàn. Vui lòng thử lại."); });
    return () => { alive = false; };
  }, [id, paid, attempt, services]); // r chỉ dùng làm đầu vào xem trước của đơn hiện tại
  if (!r) return <NotFound />;
  const expectedName = c?.customer_name || r.customer_name || (mode === "local" ? data.user?.full_name : null);
  const facility = facilityOf(data, r.facility_id ?? c?.facility_id, r.facility_name || c?.facility_name);
  const prestart = r.start_date && r.start_date > today();
  const allowed = canCancel(data, r), ready = !paid || (support.ready && preview !== null);
  const submit = e => {
    e.preventDefault(); if (busy || !allowed || !ready) return;
    const invalid = paid ? validateRefundChoice(bank, expectedName) : "";
    setError(invalid); if (!invalid) setConfirm(true);
  };
  const send = async () => {
    if (guard.current || !allowed || !ready) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const res = await dispatch("CANCEL_RESERVATION", { reservation_id: id, reason: reason.trim() || "Khách hàng huỷ đặt chỗ", bank, bankConfirmed: true }); // Thắng chốt 06/11: bỏ ô tick, tên chủ tài khoản đã được kiểm trùng hợp đồng
      if (!res.ok) { setError(res.error); setConfirm(false); return; }
      setConfirm(false); setDone(true);
    } catch { setError("Chưa xác nhận được kết quả huỷ. Hãy kiểm tra trạng thái đơn trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Đặt chỗ / {id}</p>
    <PageHeader title={`Huỷ đơn ${id}`} description={r.start_date ? (prestart ? `Chưa đến ngày bắt đầu thuê (${dateLabel(r.start_date)}) nên không cần kiểm tra trả kho.` : `Ngày bắt đầu thuê: ${dateLabel(r.start_date)}. Từ ngày bắt đầu thuê, vui lòng sử dụng quy trình trả kho.`) : "Kiểm tra thông tin trước khi huỷ đơn."}><Tag tone="blue">{r.status === "CANCELLED" ? "Đã huỷ đơn" : !paid ? "Chưa thanh toán" : prestart ? "Chưa bắt đầu thuê" : "Đã thanh toán"}</Tag></PageHeader>
    {done ? <section className="panel customer-detail__card"><h2>Đã huỷ đơn {id}</h2><p>Đơn đã được huỷ thành công. {r.refund_amount > 0 ? `Khoản hoàn ${money(r.refund_amount)} được theo dõi tại danh sách đơn đặt chỗ.` : "Xem trạng thái hoàn tiền tại danh sách đơn đặt chỗ."}</p><div className="customer-detail__actions"><LinkButton to="reservations">Về đơn đặt chỗ</LinkButton></div></section> :
    <div className="customer-detail__grid">
      <form className="customer-detail__column" onSubmit={submit}>
        {paid && <section className="panel customer-detail__card"><h2>Nhận tiền hoàn</h2><RefundMethodFields value={bank} onChange={setBank} disabled={busy || !allowed} expectedName={expectedName} facility={facility} /></section>}
        <section className="panel customer-detail__card"><h2>Lý do huỷ</h2><Field label="Lý do (không bắt buộc)"><input maxLength={255} value={reason} onChange={e => setReason(e.target.value)} disabled={busy || !allowed} /></Field>
          {support.demo && <Notice>Chế độ mô phỏng: thao tác chỉ lưu trong trình duyệt, không chuyển tiền thật.</Notice>}
          {paid && !support.ready && <Notice>{support.loading ? "Đang kiểm tra chức năng hoàn tiền…" : support.error || "Chức năng huỷ đơn đã thanh toán đang được cập nhật. Vui lòng liên hệ cơ sở để được hỗ trợ."}</Notice>}
          {paid && support.error && <Button variant="outline" onClick={support.reload}>Tải lại</Button>}
          {!allowed && <Notice>Đơn này không còn đủ điều kiện huỷ. {c && <a href={`#/units/${encodeURIComponent(c.contract_id)}`}>Xem hợp đồng và yêu cầu trả kho</a>}</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="customer-detail__actions"><LinkButton to="reservations" variant="outline">Giữ đơn</LinkButton><Button type="submit" variant="danger" disabled={busy || !allowed || !ready}>Huỷ đơn</Button></div>
        </section>
      </form>
      <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Khoản hoàn dự kiến</h2>
        {paid ? preview ? <><DetailList items={cancelRows(r, preview)} /><div className="summary-total"><span>Tổng hoàn</span><strong>{money(preview.refund)}</strong></div></> : <Notice>{previewError || "Đang tính khoản hoàn…"}</Notice> : <Notice>Đơn chưa thanh toán nên huỷ không phát sinh phí và không có khoản hoàn.</Notice>}
        {previewError && <Button variant="outline" disabled={busy} onClick={() => setAttempt(a => a + 1)}>Tải lại khoản hoàn</Button>}
        {paid && <p className="hint">{isCashRefund(bank) ? "Nhận tiền mặt tại quầy trong 30 ngày sau khi quản lý duyệt. Mang CCCD trùng tên trên hợp đồng." : "Hoàn về tài khoản nhận tiền đã khai báo trong 3–5 ngày làm việc."}</p>}
      </aside>
    </div>}
    {confirm && <ConfirmDialog title={`Xác nhận huỷ đơn ${id}?`} tone="danger" text="Đơn sẽ được huỷ sau khi xác nhận." rows={paid ? [["Tổng hoàn dự kiến", money(preview.refund)], ...(isCashRefund(bank) ? [["Cách nhận", "Tiền mặt tại quầy · trong 30 ngày"]] : [["Ngân hàng", bank.bankName], ["Số tài khoản", bank.accountNumber], ["Chủ tài khoản", bank.accountHolder]])] : [["Phí huỷ", money(0)]]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận huỷ đơn" />}
  </main>;
}
