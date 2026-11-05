import React, { useRef, useState } from "react";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundBankFields from "../../../shared/components/RefundBankFields.jsx";
import { money } from "../../../shared/utils/format.js";
import { CASH_REFUND_TERMS, emptyRefundBank, validateRefundBank } from "../../../shared/utils/refundRequest.js";
import { vnDate, vnStamp } from "../../../shared/utils/vnTime.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useCashRefunds } from "./useCashRefunds.js";
import "../../../shared/styles/customer-detail.css";

// D42/D44 · Khách theo dõi khoản hoàn tiền mặt tại quầy; trong 30 ngày có thể đổi sang chuyển khoản.
const STATUS = {
  WAITING_APPROVAL: ["Chờ cơ sở duyệt chi", "amber"], READY: ["Chờ bạn đến nhận", "blue"], REMIND: ["Chờ bạn đến nhận", "blue"],
  APPOINTMENT: ["Đã hẹn ngày đến", "blue"], PAID: ["Đã nhận tại quầy", "green"], FORFEITED: ["Quá 30 ngày · không còn nhận", "red"],
  SWITCHED_TO_BANK: ["Đã chuyển sang chuyển khoản", "green"],
};
const SOURCE = { RESERVATION: "Huỷ đơn", DEPOSIT: "Hoàn cọc trả kho", INCIDENT: "Kết thúc do sự cố cơ sở" };
const switchable = s => ["WAITING_APPROVAL", "READY", "REMIND", "APPOINTMENT"].includes(s);

function CashRefundCard({ item, expectedName, onSwitch }) {
  const [open, setOpen] = useState(false), [bank, setBank] = useState(emptyRefundBank), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [label, tone] = STATUS[item.status] || [item.status, "blue"];
  const submit = e => { e.preventDefault(); const invalid = validateRefundBank(bank, expectedName); setError(invalid); if (!invalid) setConfirm(true); };
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await onSwitch(item.id, bank); setConfirm(false); setOpen(false); }
    catch (e) { setError(e?.message || "Chưa đổi được cách nhận hoàn. Tải lại trước khi gửi lại."); setConfirm(false); }
    finally { guard.current = false; setBusy(false); }
  };
  return <section className="panel customer-detail__card">
    <div className="deadline-banner"><h2>{SOURCE[item.source] || "Khoản hoàn"} · {item.reference}</h2><Tag tone={tone}>{label}</Tag></div>
    <DetailList items={[
      ["Số tiền", <strong className="money-total">{money(item.amount)}</strong>],
      ["Cơ sở duyệt chi", item.approvedAt ? vnStamp(item.approvedAt) : "Chưa duyệt"],
      ["Hạn nhận tiền mặt", item.deadlineDate ? vnDate(item.deadlineDate) : "Tính 30 ngày từ khi cơ sở duyệt"],
      ...(item.appointmentDate ? [["Ngày hẹn đến quầy", vnDate(item.appointmentDate)]] : []),
      ...(item.paidAt ? [["Đã nhận lúc", vnStamp(item.paidAt)]] : []),
    ]} />
    {switchable(item.status) && <p className="hint">{CASH_REFUND_TERMS}</p>}
    {item.status === "FORFEITED" && <Notice tone="error">Đã quá 30 ngày kể từ khi cơ sở duyệt chi mà chưa nhận tiền mặt, nên khoản hoàn này không còn được chi theo chính sách bạn đã đồng ý.</Notice>}
    {switchable(item.status) && !open && <div className="customer-detail__actions"><Button variant="outline" onClick={() => setOpen(true)}>Đổi sang chuyển khoản</Button></div>}
    {open && <form onSubmit={submit} noValidate>
      <RefundBankFields value={bank} onChange={setBank} disabled={busy} expectedName={expectedName} />
      {error && <Notice tone="error">{error}</Notice>}
      <div className="customer-detail__actions"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Giữ tiền mặt</Button><Button type="submit" disabled={busy}>Kiểm tra & đổi</Button></div>
    </form>}
    {confirm && <ConfirmDialog title="Đổi sang chuyển khoản?" tone="warning" text="Cơ sở sẽ chuyển khoản vào tài khoản chính chủ trong 3–5 ngày làm việc; bạn không cần đến quầy." rows={[["Số tiền", money(item.amount)], ["Ngân hàng", bank.bankName], ["Số tài khoản", bank.accountNumber], ["Chủ tài khoản", bank.accountHolder]]} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận đổi" />}
  </section>;
}

export function CashRefundPage() {
  const { data } = useApp();
  const load = useCashRefunds();
  const expectedName = data.contracts.find(c => c.customer_name)?.customer_name || data.user?.full_name || null;
  const rows = Array.isArray(load.data) ? load.data : [];
  const onSwitch = async (id, bank) => { await load.switchToBank(id, bank); await load.reload(); };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Thanh toán / Hoàn tiền mặt</p>
    <PageHeader title="Hoàn tiền mặt tại quầy" description="Mang CCCD trùng tên hợp đồng khi đến nhận. Cơ sở gọi nhắc theo số điện thoại đã đăng ký." />
    {load.demo ? <Notice>Chế độ mô phỏng chưa có khoản hoàn tiền mặt. Vui lòng dùng chế độ kết nối máy chủ.</Notice>
      : load.loading ? <Notice>Đang tải…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : rows.length === 0 ? <Empty title="Chưa có khoản hoàn tiền mặt" text="Khoản hoàn bạn chọn nhận tiền mặt khi huỷ đơn, trả kho hoặc kết thúc do sự cố sẽ hiện ở đây." />
      : rows.map(item => <CashRefundCard key={item.id} item={item} expectedName={expectedName} onSwitch={onSwitch} />)}
    <div className="customer-detail__actions"><LinkButton to="refunds" variant="outline">Theo dõi hoàn cọc</LinkButton><LinkButton to="payments" variant="outline">Về thanh toán</LinkButton></div>
  </main>;
}
