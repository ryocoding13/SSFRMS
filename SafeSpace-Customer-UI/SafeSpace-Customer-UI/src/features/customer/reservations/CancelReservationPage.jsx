import React, { useEffect, useRef, useState } from "react";
import { Button, DetailList, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import RefundBankFields from "../../../shared/components/RefundBankFields.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { useRefundSupport } from "../../../shared/hooks/useRefundSupport.js";
import { emptyRefundBank, validateRefundBank } from "../../../shared/utils/refundRequest.js";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { CANCEL_FEE_LABEL } from "../../../shared/utils/policy.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "../contracts/components/ContractNotFound.jsx";
import { canCancel } from "./ReservationListPage.jsx";
import "../../../shared/styles/customer-detail.css";
export function CancelReservationPage({ id }) {
  const { data, dispatch, services, mode } = useApp();
  const support = useRefundSupport("cancellationBankSupported");
  const r = data.reservations.find(x => x.reservation_id === id);
  const c = data.contracts.find(x => x.reservation_id === id);
  const paid = r?.status === "CONFIRMED";
  const [bank, setBank] = useState(emptyRefundBank), [accepted, setAccepted] = useState(false), [reason, setReason] = useState("");
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
  const allowed = canCancel(data, r), ready = !paid || (support.ready && preview !== null);
  const submit = e => {
    e.preventDefault(); if (busy || !allowed || !ready) return;
    const invalid = paid ? validateRefundBank(bank, expectedName) || (!accepted ? "Vui lòng xác nhận đây là tài khoản chính chủ." : "") : "";
    setError(invalid); if (!invalid) setConfirm(true);
  };
  const send = async () => {
    if (guard.current || !allowed || !ready) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const res = await dispatch("CANCEL_RESERVATION", { reservation_id: id, reason: reason.trim() || "Khách hàng huỷ đặt chỗ", bank, bankConfirmed: accepted });
      if (!res.ok) { setError(res.error); setConfirm(false); return; }
      setConfirm(false); setDone(true);
    } catch { setError("Chưa xác nhận được kết quả huỷ. Hãy kiểm tra trạng thái đơn trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Đặt chỗ / {id}</p>
    <PageHeader title={`Huỷ đơn ${id}`} description={r.start_date ? `Ngày bắt đầu thuê: ${dateLabel(r.start_date)}. Từ ngày bắt đầu thuê, vui lòng sử dụng quy trình trả kho.` : "Kiểm tra thông tin trước khi huỷ đơn."}><Tag tone="blue">{r.status === "CANCELLED" ? "Đã huỷ đơn" : paid ? "Đã thanh toán" : "Chưa thanh toán"}</Tag></PageHeader>
    {done ? <section className="panel customer-detail__card"><h2>Đã huỷ đơn {id}</h2><p>Đơn đã được huỷ thành công. {r.refund_amount > 0 ? `Khoản hoàn ${money(r.refund_amount)} được theo dõi tại danh sách đơn đặt chỗ.` : "Xem trạng thái hoàn tiền tại danh sách đơn đặt chỗ."}</p><div className="customer-detail__actions"><LinkButton to="reservations">Về đơn đặt chỗ</LinkButton></div></section> :
    <div className="customer-detail__grid">
      <form className="customer-detail__column" onSubmit={submit}>
        {paid && <section className="panel customer-detail__card"><h2>Tài khoản nhận hoàn · Chính chủ</h2><RefundBankFields value={bank} onChange={setBank} disabled={busy || !allowed} expectedName={expectedName} /><label className="customer-detail__choice"><input type="checkbox" checked={accepted} disabled={busy || !allowed} onChange={e => setAccepted(e.target.checked)} /><span>Tôi xác nhận đây là tài khoản chính chủ</span></label></section>}
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
        {paid ? preview ? <DetailList items={[["Đã thanh toán", money(preview.paid)], [CANCEL_FEE_LABEL, `− ${money(preview.fee)}`], ["Tổng hoàn", money(preview.refund)]]} /> : <Notice>{previewError || "Đang tính khoản hoàn…"}</Notice> : <Notice>Đơn chưa thanh toán nên huỷ không phát sinh phí và không có khoản hoàn.</Notice>}
        {previewError && <Button variant="outline" disabled={busy} onClick={() => setAttempt(a => a + 1)}>Tải lại khoản hoàn</Button>}
        {paid && <p className="hint">Huỷ trước ngày bắt đầu: hoàn 100% tiền thuê và 90% tiền cọc. Hoàn vào tài khoản chính chủ trong 3–5 ngày làm việc.</p>}
      </aside>
    </div>}
    {confirm && <ConfirmDialog title={`Xác nhận huỷ đơn ${id}?`} tone="danger" text="Đơn sẽ được huỷ sau khi xác nhận." rows={paid ? [["Tổng hoàn dự kiến", money(preview.refund)], ["Ngân hàng", bank.bankName], ["Số tài khoản", bank.accountNumber], ["Chủ tài khoản", bank.accountHolder]] : [["Phí huỷ", money(0)]]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận huỷ đơn" />}
  </main>;
}
