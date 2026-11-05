import React, { useRef, useState } from "react";
import { DatePicker } from "../../../shared/components/Pickers.jsx";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundMethodFields from "../../../shared/components/RefundMethodFields.jsx";
import { money } from "../../../shared/utils/format.js";
import { emptyRefundBank, isCashRefund, validateRefundChoice } from "../../../shared/utils/refundRequest.js";
import { vnDate, vnStamp } from "../../../shared/utils/vnTime.js";
import { contractOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { useUnitConflicts } from "./useUnitConflicts.js";
import "../../../shared/styles/customer-detail.css";

// D41 · Ô đặt trước chưa về Trống 5 ngày trước ngày nhận kho: đổi ngang / nâng cấp miễn phí / dời ngày / huỷ hoàn 100%.
const OPTION = { SWAP: "Đổi ngang sang ô cùng loại đang trống", UPGRADE: "Nâng cấp miễn phí sang ô lớn hơn · giữ giá và cọc đến hết kỳ thuê", NONE: "Không còn ô phù hợp" };
const RESOLUTION = { SWAP: "Đã nhận ô đổi ngang", UPGRADE: "Đã nhận nâng cấp miễn phí", AUTO_SWAP: "Hệ thống tự đổi ngang (quá 48 giờ)", AUTO_UPGRADE: "Hệ thống tự nâng cấp (quá 48 giờ)", RESCHEDULE: "Đã dời ngày nhận kho", CANCEL: "Đã huỷ · hoàn 100%" };

export function UnitChangePage({ id }) {
  const { data, retry } = useApp();
  const c = contractOf(data, id);
  const load = useUnitConflicts();
  const [choice, setChoice] = useState(""), [date, setDate] = useState(""), [bank, setBank] = useState(emptyRefundBank);
  const [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const guard = useRef(false);
  if (!c) return <NotFound />;
  const item = (Array.isArray(load.data) ? load.data : []).find(x => x.contractId === c.contract_id);
  const paid = Number(c.deposit) + Number(c.monthly_rate) * Number(c.months || 1);
  const submit = e => {
    e.preventDefault();
    if (!choice) return setError("Chọn một phương án.");
    if (choice === "RESCHEDULE" && !date) return setError("Chọn ngày nhận kho mới.");
    if (choice === "CANCEL") { const invalid = validateRefundChoice(bank, c.customer_name || data.user?.full_name); if (invalid) return setError(invalid); }
    setError(""); setConfirm(true);
  };
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await load.choose(c.api_id, choice, { newStartDate: date, bank }); setConfirm(false); await load.reload(); retry?.(); }
    catch (e) { setError(e?.message || "Chưa gửi được lựa chọn. Tải lại trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  const choices = item ? [
    ...(item.option !== "NONE" ? [["ACCEPT", `Nhận ô ${item.proposedUnit}${item.option === "UPGRADE" ? ` (${item.proposedUnitType}${item.proposedArea ? ` · ${item.proposedArea} m²` : ""})` : ""}`]] : []),
    ["RESCHEDULE", "Dời ngày nhận kho"],
    ["CANCEL", "Huỷ đơn · hoàn 100% tiền thuê và cọc, không phí huỷ"],
  ] : [];
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id} / Đổi kho</p>
    <PageHeader title={`Đề xuất đổi kho · Kho ${c.unit_number}`} description="Khách thuê trước chưa trả kho hoặc kho chưa kiểm tra đạt tiêu chuẩn trước ngày nhận của bạn.">{item && <Tag tone={item.status === "OPEN" ? "amber" : "green"}>{item.status === "OPEN" ? "Chờ bạn chọn" : "Đã xử lý"}</Tag>}</PageHeader>
    {load.demo ? <Notice>Chế độ mô phỏng chưa có đề xuất đổi kho. Vui lòng dùng chế độ kết nối máy chủ.</Notice>
      : load.loading ? <Notice>Đang tải…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : !item ? <Empty title="Không có đề xuất đổi kho" text="Kho của bạn sẵn sàng theo lịch." />
      : <div className="customer-detail__grid">
        <div className="customer-detail__column">
          <section className="panel customer-detail__card"><h2>{OPTION[item.option]}</h2>
            <DetailList items={[["Lý do", item.reason], ["Ô đã đặt", item.oldUnit], ...(item.proposedUnit ? [["Ô đề xuất", `${item.proposedUnit}${item.proposedUnitType ? ` · ${item.proposedUnitType}` : ""}`]] : []), ["Ngày nhận kho", vnDate(item.startDate)], ...(item.expiresAt && item.status === "OPEN" ? [["Giữ ô đề xuất đến", vnStamp(item.expiresAt)]] : []), ...(item.earliestFreeDate ? [["Có ô trống sớm nhất từ", vnDate(item.earliestFreeDate)]] : [])]} />
            {item.status === "OPEN" && item.option !== "NONE" && <p className="hint">Ô đề xuất được giữ 48 giờ. Quá hạn chưa chọn, hệ thống tự chuyển bạn sang ô đề xuất; mã QR/PIN cấp lại cho ô mới.</p>}
            {item.status !== "OPEN" && <Notice tone="success">{RESOLUTION[item.resolution] || "Đã xử lý"}{item.newUnit ? ` · ô ${item.newUnit}` : ""}{item.newStartDate ? ` · nhận kho từ ${vnDate(item.newStartDate)}` : ""}.</Notice>}
          </section>
          {item.status === "OPEN" && <form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Chọn phương án</h2>
            <fieldset className="deduction-options" disabled={busy}>
              {choices.map(([k, text]) => <label key={k} className={`refund-method__option${choice === k ? " is-active" : ""}`}><input type="radio" name="unit-change" checked={choice === k} onChange={() => { setChoice(k); setError(""); }} /><span><strong>{text}</strong></span></label>)}
            </fieldset>
            {choice === "RESCHEDULE" && <DatePicker label="Ngày nhận kho mới" value={date} min={item.earliestFreeDate || item.startDate} onChange={setDate} />}
            {choice === "CANCEL" && <RefundMethodFields value={bank} onChange={setBank} disabled={busy} expectedName={c.customer_name || data.user?.full_name} />}
            {error && <Notice tone="error">{error}</Notice>}
            <div className="customer-detail__actions"><LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton><Button type="submit" disabled={busy}>Gửi lựa chọn</Button></div>
          </form>}
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Giữ nguyên quyền lợi</h2>
          <ul><li>Giá thuê và tiền cọc giữ như đã thanh toán; nâng cấp không thu thêm.</li><li>Huỷ do xung đột: hoàn 100% tiền thuê và cọc, không áp phí huỷ 5%.</li><li>Đã chọn ô mới thì không đổi lại ô cũ.</li></ul>
          <p className="hint">Tổng đã thanh toán (ước tính): {money(paid)}</p>
        </aside>
      </div>}
    {confirm && <ConfirmDialog title="Gửi lựa chọn đổi kho?" tone="warning" text="Bạn chỉ chọn được một lần cho đề xuất này." rows={[["Phương án", choices.find(x => x[0] === choice)?.[1] || choice], ...(choice === "RESCHEDULE" ? [["Ngày mới", vnDate(date)]] : []), ...(choice === "CANCEL" ? [["Cách nhận hoàn", isCashRefund(bank) ? "Tiền mặt tại quầy · trong 30 ngày" : `${bank.bankName} · ${bank.accountNumber}`]] : [])]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Gửi lựa chọn" />}
  </main>;
}
