import React, { useRef, useState } from "react";
import { DatePicker, Select } from "../../../shared/components/Pickers.jsx";
import { Button, DetailList, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundBankFields from "../../../shared/components/RefundBankFields.jsx";
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
import { useRefundSupport } from "../../../shared/hooks/useRefundSupport.js";
import { RETURN_SLOTS, emptyRefundBank, validateRefundBank, validateReturnPhotos } from "../../../shared/utils/refundRequest.js";
import { addDays, dateLabel, money, today } from "../../../shared/utils/format.js";
import { go } from "../../../app/router.js";
import { contractOf, pendingRenewal } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import "../../../shared/styles/customer-detail.css";
export { RETURN_SLOTS };
export function ReturnRequestPage({ id }) {
  const { data, dispatch, mode } = useApp();
  const support = useRefundSupport("returnRequestSupported");
  const c = contractOf(data, id);
  const [date, setDate] = useState(() => c && c.end_date >= today() ? c.end_date : addDays(today(), 1));
  const [slot, setSlot] = useState(RETURN_SLOTS[0]), [notes, setNotes] = useState("");
  const [bank, setBank] = useState(emptyRefundBank), [photos, setPhotos] = useState([]), [emptied, setEmptied] = useState(false);
  const [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [reading, setReading] = useState(false);
  const guard = useRef(false);
  if (!c) return <NotFound />;
  const expectedName = c.customer_name || (mode === "local" ? data.user?.full_name : null);
  const hasReturn = data.returns.some(r => r.contract_id === id && !["CANCELLED", "REJECTED"].includes(r.status));
  const blocked = ["ENDED", "RETURN_PENDING"].includes(c.status) || c.start_date > today() || hasReturn || Boolean(pendingRenewal(data, id));
  const validate = () => validateRefundBank(bank, expectedName) || validateReturnPhotos(photos) || (!emptied ? "Vui lòng xác nhận đã chuyển hết đồ ra khỏi kho." : "") || (!date || date < today() ? "Ngày kiểm tra không được ở quá khứ." : "");
  const submit = e => { e.preventDefault(); if (busy || reading || blocked || !support.ready) return; const invalid = validate(); setError(invalid); if (!invalid) setConfirm(true); };
  const send = async () => {
    if (guard.current || blocked || !support.ready) return;
    const invalid = validate(); if (invalid) { setConfirm(false); return setError(invalid); }
    guard.current = true; setBusy(true); setError("");
    try {
      const res = await dispatch("REQUEST_RETURN", { contract_id: id, date, slot, notes, bank, photos, emptied });
      if (!res.ok) { setError(res.error); setConfirm(false); return; }
      go(`sent?type=return&contract=${encodeURIComponent(id)}`);
    } catch { setError("Chưa xác nhận được kết quả gửi. Vui lòng kiểm tra trạng thái hợp đồng trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id}</p>
    <PageHeader title={`Yêu cầu trả kho ${c.unit_number}`} description="Chuyển hết đồ ra ngoài trước khi gửi. Phí dừng ngay khi gửi thành công, không chờ lịch kiểm tra."><Tag tone="blue">{dateLabel(c.end_date)}</Tag></PageHeader>
    <div className="customer-detail__grid">
      <form className="customer-detail__column" onSubmit={submit}>
        <fieldset className="panel customer-detail__card return-request__fields" disabled={busy || blocked}>
          <h2>1 · Hiện trạng kho</h2>
          <ReturnPhotoInput files={photos} onChange={setPhotos} disabled={busy || blocked || reading} onReading={setReading} />
          <div className="form-row"><DatePicker label="Ngày kiểm tra mong muốn" value={date} min={today()} onChange={setDate} /><Field label="Khung giờ"><Select value={slot} onChange={e => setSlot(e.target.value)}>{RETURN_SLOTS.map(s => <option key={s}>{s}</option>)}</Select></Field></div>
          <Field label="Ghi chú cho nhân viên (không bắt buộc)"><input maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          <label className="customer-detail__choice"><input type="checkbox" checked={emptied} onChange={e => setEmptied(e.target.checked)} /><span>Tôi xác nhận đã chuyển hết đồ ra khỏi kho</span></label>
        </fieldset>
        <section className="panel customer-detail__card"><h2>2 · Tài khoản nhận hoàn · Chính chủ</h2>
          <RefundBankFields value={bank} onChange={setBank} expectedName={expectedName} disabled={busy || blocked} />
          {support.demo && <Notice>Chế độ mô phỏng: ngân hàng và thông tin tệp lưu trong trình duyệt; ảnh chỉ xem trước trong phiên này, chưa gửi tới cơ sở.</Notice>}
          {!support.ready && <Notice>{support.loading ? "Đang kiểm tra chức năng gửi trả kho…" : support.error || "Chức năng gửi trả kho đang được cập nhật. Vui lòng liên hệ cơ sở để được hỗ trợ."}</Notice>}
          {support.error && <Button variant="outline" onClick={support.reload}>Tải lại</Button>}
          {blocked && <Notice>Chưa thể gửi thêm: hợp đồng chưa bắt đầu, đã kết thúc hoặc đang có yêu cầu gia hạn/trả kho. <a href={`#/units/${encodeURIComponent(id)}`}>Xem hợp đồng</a></Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="customer-detail__actions"><LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton><Button type="submit" disabled={busy || reading || blocked || !support.ready}>{reading ? "Đang đọc ảnh…" : "Kiểm tra & gửi yêu cầu"}</Button></div>
        </section>
      </form>
      <aside className="customer-detail__column customer-detail__sidebar">
        <section className="panel customer-detail__card"><h2>Hợp đồng {id}</h2><DetailList items={[["Kho", c.unit_number], ["Dùng đến hết", `${dateLabel(c.end_date)} · 23:59`], ["Cọc đang giữ", money(c.deposit)]]} /></section>
        <section className="panel customer-detail__card return-request__warning"><h2>Sau khi gửi thành công</h2><ul><li>Dừng tính phí quá hạn ngay.</li><li>QR/PIN khoá ngay, không mở lại.</li><li>Không thể huỷ yêu cầu.</li><li>Đồ còn lại do nhân viên dọn; cơ sở không nhận bảo quản.</li></ul><p className="hint">Số hoàn được xác nhận sau kiểm tra. Tổng khấu trừ tối đa bằng tiền cọc, không thu thêm ngoài cọc.</p></section>
      </aside>
    </div>
    {confirm && <ConfirmDialog title="Xác nhận gửi trả kho?" tone="warning" text="QR/PIN sẽ hết hiệu lực ngay khi gửi thành công, phí quá hạn dừng và bạn không thể huỷ yêu cầu." rows={[["Kho", c.unit_number], ["Lịch kiểm tra", `${dateLabel(date)} · ${slot}`], ["Ảnh kho trống", photos.length], ["Ngân hàng", bank.bankName], ["Tài khoản", bank.accountNumber], ["Chủ tài khoản", bank.accountHolder]]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận trả kho" />}
  </main>;
}
