/**
 * RETURN REQUEST PAGE - ĐĂNG KÝ LỊCH TRẢ KHO (C08 / UC06)
 *
 * Thủ tục trả kho (Move-out):
 * - Chọn ngày hẹn trả kho thực tế và giờ kiểm kê dự kiến.
 * - Lựa chọn hình thức nhận hoàn tiền cọc (Chuyển khoản ngân hàng hoặc Tiền mặt tại quầy - D42).
 * - Lưu ý hướng dẫn dọn hết đồ đạc và bàn giao lại chìa khóa/thẻ từ.
 */
import React, { useRef, useState } from "react";
import { DatePicker } from "../../../shared/components/Pickers.jsx";
import { Button, DetailList, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundMethodFields from "../../../shared/components/RefundMethodFields.jsx";
import { useRefundSupport } from "../../../shared/hooks/useRefundSupport.js";
import { emptyRefundBank, isCashRefund, validateRefundChoice } from "../../../shared/utils/refundRequest.js";
import { dateLabel, daysBetween, money, today } from "../../../shared/utils/format.js";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { contractVisitRange, earlyStopKeep, isEarlyStop, unusedRent, visitDateError } from "../../../shared/utils/returnPolicy.js";
import { go } from "../../../app/router.js";
import { contractOf, facilityOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import "../../../shared/styles/customer-detail.css";
// D49 · Khoản hoàn dự kiến: trả sớm sau StartDate hoàn 100% cọc (trừ hư hỏng/vệ sinh nếu có sau kiểm tra) + hoàn tiền thuê tháng chưa bắt đầu.
// Ngày tính là hôm nay vì BE lấy thời điểm khách gửi yêu cầu làm mốc dừng (ConfirmRefundAsync).
function RefundPreview({ c, cash }) {
  const deposit = Number(c.deposit), known = Number.isFinite(deposit) && deposit >= 0, now = today();
  const early = isEarlyStop(c.end_date, now), keep = early ? earlyStopKeep(deposit) : 0;
  const rent = early ? unusedRent(c.monthly_rate, c.start_date, c.end_date, now) : 0;
  const rows = [["Cọc ban đầu", known ? money(deposit) : "Chưa có dữ liệu"]];
  if (keep > 0) rows.push(["Trả trước hạn · giữ cọc", <span className="money-deduct">− {money(keep)}</span>]);
  rows.push(["Tiền thuê tháng chưa bắt đầu", money(rent)], ["Khấu trừ (vệ sinh, hư hỏng, quá hạn)", "Sau kiểm tra"]);
  return <section className="panel customer-detail__card return-refund">
    <h2>Khoản hoàn dự kiến</h2>
    <DetailList items={rows} />
    <div className="return-refund__total"><span className="return-refund__label">Dự kiến hoàn<small>Trước kiểm tra kho</small></span><strong>{known ? money(Math.max(0, deposit - keep) + rent) : "Chưa có dữ liệu"}</strong></div>
    <p className="hint">{early ? `Trả trước ngày ${dateLabel(c.end_date)}: hoàn 100% cọc (nếu kho đạt chuẩn, không hư hỏng) và tiền thuê các tháng nguyên chưa bắt đầu; tháng đang dùng tính đủ.` : "Trả đúng hạn, kho đạt tiêu chuẩn: hoàn đủ cọc."} Số chính thức xác nhận sau kiểm tra kho; tổng khấu trừ tối đa bằng cọc. {cash ? "Nhận tiền mặt tại quầy trong 30 ngày sau khi quản lý duyệt." : "Hoàn trong 3–5 ngày làm việc vào tài khoản khách đăng ký."}</p>
  </section>;
}
/**
 * Màn hình biểu mẫu đăng ký lịch hẹn kết thúc hợp đồng và bàn giao trả kho.
 * @param {{ contract: Object }} props
 */
export function ReturnRequestPage({ id }) {
  const { data, dispatch, mode } = useApp();
  const support = useRefundSupport("returnRequestSupported");
  const c = contractOf(data, id);
  const [date, setDate] = useState(() => c ? contractVisitRange(c.end_date, today(), c.start_date).max : today());
  const [notes, setNotes] = useState("");
  const [bank, setBank] = useState(emptyRefundBank), [emptied, setEmptied] = useState(false);
  const [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const guard = useRef(false);
  if (!c) return <NotFound />;
  const expectedName = c.customer_name || (mode === "local" ? data.user?.full_name : null);
  const facility = facilityOf(data, c.facility_id, c.facility_name);
  const left = daysBetween(today(), c.end_date), visit = contractVisitRange(c.end_date, today(), c.start_date);
  const hasReturn = Boolean(pendingReturn(data, id));
  const blocked = ["ENDED", "RETURN_PENDING"].includes(c.status) || c.start_date > today() || hasReturn || Boolean(pendingRenewal(data, id));
  const validate = () => validateRefundChoice(bank, expectedName) || (!emptied ? "Vui lòng xác nhận đã chuyển hết đồ ra khỏi kho." : "") || visitDateError(date, c.end_date, today(), "trả kho", c.start_date);
  const submit = e => { e.preventDefault(); if (busy || blocked || !support.ready) return; const invalid = validate(); setError(invalid); if (!invalid) setConfirm(true); };
  const send = async () => {
    if (guard.current || blocked || !support.ready) return;
    const invalid = validate(); if (invalid) { setConfirm(false); return setError(invalid); }
    guard.current = true; setBusy(true); setError("");
    try {
      const res = await dispatch("REQUEST_RETURN", { contract_id: id, date, notes, bank, emptied });
      if (!res.ok) { setError(res.error); setConfirm(false); return; }
      go(`sent?type=return&contract=${encodeURIComponent(id)}`);
    } catch { setError("Chưa xác nhận được kết quả gửi. Vui lòng kiểm tra trạng thái hợp đồng trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id}</p>
    <PageHeader title={`Yêu cầu trả kho ${c.unit_number}`} description="Chuyển hết đồ ra ngoài trước khi gửi. Phí dừng ngay khi gửi thành công, không chờ lịch kiểm tra."><Tag tone={left >= 0 ? "blue" : "amber"}>{left >= 0 ? `Đang thuê · còn ${left} ngày` : `Quá hạn ${-left} ngày`}</Tag></PageHeader>
    <div className="customer-detail__grid">
      <form className="customer-detail__column" onSubmit={submit}>
        <fieldset className="panel customer-detail__card return-request__fields" disabled={busy || blocked}>
          <h2>1 · Thông tin trả kho</h2>
          <p className="hint">Bạn không cần chụp ảnh. Nhân viên cơ sở sẽ kiểm tra kho, chụp ảnh hiện trạng và gửi biên bản cho bạn.</p>
          <DatePicker label="Ngày mong muốn trả kho *" value={date} min={visit.min} max={visit.max} onChange={setDate} />
          <Field label="Ghi chú cho nhân viên (không bắt buộc)"><input maxLength={300} value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          <label className="customer-detail__choice"><input type="checkbox" checked={emptied} onChange={e => setEmptied(e.target.checked)} /><span>Tôi xác nhận đã chuyển hết đồ ra khỏi kho</span></label>
        </fieldset>
        <section className="panel customer-detail__card"><h2>2 · Nhận tiền hoàn</h2>
          <RefundMethodFields value={bank} onChange={setBank} expectedName={expectedName} disabled={busy || blocked} facility={facility} />
          {support.demo && <Notice>Chế độ mô phỏng: lịch trả kho và thông tin nhận hoàn lưu trong trình duyệt.</Notice>}
          {!support.ready && <Notice>{support.loading ? "Đang kiểm tra chức năng gửi trả kho…" : support.error || "Chức năng gửi trả kho đang được cập nhật. Vui lòng liên hệ cơ sở để được hỗ trợ."}</Notice>}
          {support.error && <Button variant="outline" onClick={support.reload}>Tải lại</Button>}
          {blocked && <Notice>Chưa thể gửi thêm: hợp đồng chưa bắt đầu, đã kết thúc hoặc đang có yêu cầu gia hạn/trả kho. <a href={`#/units/${encodeURIComponent(id)}`}>Xem hợp đồng</a></Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="customer-detail__actions"><LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton><Button type="submit" disabled={busy || blocked || !support.ready}>Gửi yêu cầu trả kho</Button></div>
        </section>
      </form>
      <aside className="customer-detail__column customer-detail__sidebar">
        <section className="panel customer-detail__card"><h2>Hợp đồng {id}</h2><DetailList items={[["Kho", `${c.unit_number} · ${typeLabel(c.type)}${c.size_m2 ? ` ${c.size_m2} m²` : ""}`], ["Dùng đến hết", `${dateLabel(c.end_date)} · 23:59`], ["Cọc đang giữ", money(c.deposit)]]} /></section>
        <RefundPreview c={c} cash={isCashRefund(bank)} />
        <section className="panel customer-detail__card return-request__warning"><h2>Sau khi gửi thành công</h2><ul><li>Dừng tính phí quá hạn ngay.</li><li>QR/PIN khoá ngay, không mở lại.</li><li>Không thể huỷ yêu cầu.</li><li>Đồ còn lại do nhân viên dọn; cơ sở không nhận bảo quản.</li><li>Trong 3 ngày nhân viên gửi biên bản và tiền hoàn dự kiến; bạn có 48 giờ để xác nhận, quá hạn tự hoàn theo biên bản.</li></ul></section>
      </aside>
    </div>
    {confirm && <ConfirmDialog title="Xác nhận gửi trả kho?" tone="warning" text="QR/PIN sẽ hết hiệu lực ngay khi gửi thành công, phí quá hạn dừng và bạn không thể huỷ yêu cầu. Nhân viên sẽ kiểm tra thực tế và chụp ảnh hiện trạng kho." rows={[["Kho", c.unit_number], ["Ngày mong muốn trả kho", dateLabel(date)], ...(isCashRefund(bank) ? [["Cách nhận hoàn", "Tiền mặt tại quầy · trong 30 ngày"]] : [["Ngân hàng", bank.bankName], ["Tài khoản", bank.accountNumber], ["Chủ tài khoản", bank.accountHolder]])]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận trả kho" />}
  </main>;
}
