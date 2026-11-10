/**
 * UNIT CHANGE PAGE - XỬ LÝ ĐỀ XUẤT ĐỔI Ô KHO DO XUNG ĐỘT (C-D41a / D41)
 *
 * Nghiệp vụ D41:
 * - Khi đơn đặt trước bị ảnh hưởng bởi khách cũ chưa trả kho, hệ thống gửi đề xuất cho khách:
 *   1. Chấp nhận đổi ô tương đương / nâng cấp ô lớn miễn phí (ACCEPT).
 *   2. Dời ngày bắt đầu thuê sang thời điểm ô kho trống (RESCHEDULE).
 *   3. Hủy đơn và nhận hoàn tiền 100% không mất bất kỳ khoản phí nào (CANCEL).
 */
import React, { useRef, useState } from "react";
import { DatePicker } from "../../../shared/components/Pickers.jsx";
import { Button, DetailList, Empty, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundMethodFields from "../../../shared/components/RefundMethodFields.jsx";
import { money } from "../../../shared/utils/format.js";
import { emptyRefundBank, isCashRefund, validateRefundChoice } from "../../../shared/utils/refundRequest.js";
import { vnDate, vnMillis, vnStamp } from "../../../shared/utils/vnTime.js";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { contractOf, facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { useUnitConflicts } from "./useUnitConflicts.js";
import "../../../shared/styles/customer-detail.css";

// D41 · Figma C-D41a: ô đặt trước chưa về Trống 5 ngày trước ngày nhận → đổi ngang / nâng cấp miễn phí / dời ngày / huỷ hoàn 100%.
const RESOLUTION = { SWAP: "Đã nhận ô đổi ngang", UPGRADE: "Đã nhận nâng cấp miễn phí", AUTO_SWAP: "Hệ thống tự đổi ngang (quá 48 giờ)", AUTO_UPGRADE: "Hệ thống tự nâng cấp (quá 48 giờ)", RESCHEDULE: "Đã dời ngày nhận kho", CANCEL: "Đã huỷ · hoàn 100%" };
const dayMonth = iso => vnDate(iso).slice(0, 5);
function timeLeft(expiresAt, now = Date.now()) {
  const t = vnMillis(expiresAt);
  if (!Number.isFinite(t)) return null;
  const mins = Math.max(0, Math.floor((t - now) / 60000));
  return `Còn ${Math.floor(mins / 60)} giờ ${mins % 60} phút để chọn`;
}

/**
 * Màn hình khách hàng xem xét phương án giải quyết khi ô kho đã đặt bị xung đột lịch.
 * @param {{ contract: Object }} props
 */
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
  const unitText = (unit, type, area) => `Ô ${unit}${type ? ` · ${type}` : ""}${area ? ` ${area} m²` : ""}`;
  const choices = item ? [
    ...(item.option === "SWAP" ? [["ACCEPT", `Đổi ngang · ${unitText(item.proposedUnit, item.proposedUnitType, item.proposedArea)} · cùng giá · nhận đúng ${dayMonth(item.startDate)}`]] : []),
    ...(item.option === "UPGRADE" ? [["ACCEPT", `Nâng cấp miễn phí · ${unitText(item.proposedUnit, item.proposedUnitType, item.proposedArea)} · giữ giá ${money(c.monthly_rate)}/tháng đến hết kỳ`]] : []),
    ["RESCHEDULE", `Dời ngày nhận kho · chọn ngày mới sau khi ô ${item.oldUnit} sẵn sàng`],
    ["CANCEL", `Huỷ đơn · hoàn 100% (${money(paid)}), không tính phí huỷ`],
  ] : [];
  const orderId = c.reservation_id || id, facility = facilityOf(data, c.facility_id, c.facility_name);
  const booked = `${item?.oldUnit || c.unit_number} · ${typeLabel(c.type)}${c.size_m2 ? ` ${c.size_m2} m²` : ""} · nhận ${vnDate(item?.startDate || c.start_date)} · ${money(c.monthly_rate)}/tháng`;
  const pill = item?.status === "OPEN" ? timeLeft(item.expiresAt) || "Chờ bạn chọn" : "Đã xử lý";
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Đặt chỗ / {orderId}</p>
    <PageHeader title={`Đề xuất đổi kho trước ngày nhận · Đơn ${orderId}`} description={item ? `Kho ${item.oldUnit} bạn đặt nhận ngày ${vnDate(item.startDate)} chưa sẵn sàng. Chọn một phương án để vẫn nhận kho đúng ngày.` : "Khách thuê trước chưa trả kho hoặc kho chưa kiểm tra đạt tiêu chuẩn trước ngày nhận của bạn."}>{item && <Tag tone={item.status === "OPEN" ? "amber" : "green"}>{pill}</Tag>}</PageHeader>
    {load.demo ? <Notice>Chế độ mô phỏng chưa có đề xuất đổi kho. Vui lòng dùng chế độ kết nối máy chủ.</Notice>
      : load.loading ? <Notice>Đang tải…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : !item ? <Empty title="Không có đề xuất đổi kho" text="Kho của bạn sẵn sàng theo lịch." />
      : <div className="customer-detail__grid">
        <div className="customer-detail__column">
          <section className="panel customer-detail__card"><h2>Kho bạn đã đặt</h2>
            <DetailList items={[["Kho đã đặt", <strong>{booked}</strong>], ["Lý do", <strong>{item.reason || "Ô chưa về trạng thái Trống"}</strong>], ...(item.earliestFreeDate ? [["Có ô trống sớm nhất từ", vnDate(item.earliestFreeDate)]] : [])]} />
            <p className="hint">Hệ thống kiểm tra lúc {vnStamp(item.detectedAt)} (5 ngày trước ngày nhận kho). Đã gửi thông báo vào chuông trong ứng dụng.</p>
            {item.status !== "OPEN" && <Notice tone="success">{RESOLUTION[item.resolution] || "Đã xử lý"}{item.newUnit ? ` · ô ${item.newUnit}` : ""}{item.newStartDate ? ` · nhận kho từ ${vnDate(item.newStartDate)}` : ""}.</Notice>}
          </section>
          {item.status === "OPEN" && <form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Chọn phương án</h2>
            <fieldset className="choice-list" disabled={busy}>
              {choices.map(([k, text]) => <label key={k} className="choice-list__item"><input type="radio" name="unit-change" checked={choice === k} onChange={() => { setChoice(k); setError(""); }} /><span>{text}</span></label>)}
            </fieldset>
            {choice === "RESCHEDULE" && <DatePicker label="Ngày nhận kho mới" value={date} min={item.earliestFreeDate || item.startDate} onChange={setDate} />}
            {choice === "CANCEL" && <RefundMethodFields value={bank} onChange={setBank} disabled={busy} expectedName={c.customer_name || data.user?.full_name} facility={facility} />}
            <p className="hint">{item.option !== "NONE" ? `Ô đề xuất được giữ riêng cho bạn đến ${vnStamp(item.expiresAt)}. Quá 48 giờ chưa chọn, hệ thống tự ${item.option === "SWAP" ? "đổi ngang" : "nâng cấp miễn phí"}. ` : "Hiện không còn ô cùng loại hoặc lớn hơn đang trống. "}Đã chọn thì không đổi lại ô {item.oldUnit}, kể cả khi khách thuê trước trả kho sau đó.</p>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="customer-detail__actions"><Button type="submit" disabled={busy}>Xác nhận phương án</Button></div>
          </form>}
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Chi phí sau khi đổi kho</h2>
          <DetailList items={[["Tiền thuê / tháng", money(c.monthly_rate)], ["Cọc đang giữ", money(c.deposit)], ["Chênh lệch khi nâng cấp", "0 đ · SafeSpace chịu"], ["QR & PIN", "Cấp lại cho ô mới"]]} />
          <div className="summary-total"><span>Phải trả thêm</span><strong>{money(0)}</strong></div>
          <p className="hint">Khi gia hạn sau nâng cấp, bạn chọn giá của ô lớn hơn hoặc chuyển về loại cũ nếu còn ô. Huỷ đơn được hoàn 100% vì kho không sẵn sàng do phía cơ sở.</p>
        </aside>
      </div>}
    {confirm && <ConfirmDialog title="Xác nhận phương án đổi kho?" tone="warning" text="Bạn chỉ chọn được một lần cho đề xuất này." rows={[["Phương án", choices.find(x => x[0] === choice)?.[1] || choice], ...(choice === "RESCHEDULE" ? [["Ngày mới", vnDate(date)]] : []), ...(choice === "CANCEL" ? [["Cách nhận hoàn", isCashRefund(bank) ? "Tiền mặt tại quầy · trong 30 ngày" : `${bank.bankName} · ${bank.accountNumber}`]] : [])]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận phương án" />}
  </main>;
}
