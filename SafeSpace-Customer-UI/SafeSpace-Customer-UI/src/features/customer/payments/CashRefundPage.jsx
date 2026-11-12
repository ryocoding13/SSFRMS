/**
 * CASH REFUND PAGE - THEO DÕI KHOẢN TIỀN HOÀN MẶT TẠI QUẦY (D30-15b / D44)
 *
 * Nghiệp vụ D44:
 * - Hiển thị mã phiếu hoàn tiền mặt, số tiền, tên chi nhánh nhận tiền và giờ mở cửa.
 * - Hạn chót nhận tiền trong vòng 30 ngày (quá 30 ngày khoản hoàn bị tịch thu).
 * - Cung cấp nút chuyển đổi sang nhận hoàn bằng chuyển khoản ngân hàng nếu khách không tiện đến quầy.
 */
import React, { useRef, useState } from "react";
import { Button, DetailList, Dialog, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundBankFields from "../../../shared/components/RefundBankFields.jsx";
import { daysBetween, money, today } from "../../../shared/utils/format.js";
import { go } from "../../../app/router.js";
import { emptyRefundBank, validateRefundBank } from "../../../shared/utils/refundRequest.js";
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

// Figma D30-15b: thẻ "Khoản hoàn tiền mặt" + "Đổi sang chuyển khoản", cột "Khoản hoàn" và "Lưu ý khi nhận"; popup xác nhận / thành công / thất bại.
function CashRefundDetail({ item, expectedName, onSwitch }) {
  const [bank, setBank] = useState(emptyRefundBank), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [result, setResult] = useState(null);
  const guard = useRef(false);
  const [label, tone] = STATUS[item.status] || [item.status, "blue"];
  const left = item.deadlineDate ? daysBetween(today(), String(item.deadlineDate).slice(0, 10)) : null;
  const submit = e => { e.preventDefault(); const invalid = validateRefundBank(bank, expectedName); setError(invalid); if (!invalid) setConfirm(true); };
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await onSwitch(item.id, bank); setConfirm(false); setResult({ ok: true }); }
    catch (e) { setConfirm(false); setResult({ ok: false, error: e?.message || "Chưa đổi được cách nhận hoàn." }); }
    finally { guard.current = false; setBusy(false); }
  };
  const tail = bank.accountNumber ? `••••${String(bank.accountNumber).replace(/\s/g, "").slice(-4)}` : "";
  return <>
    <PageHeader title={`Nhận tiền hoàn tại quầy · ${item.reference}`} description={switchable(item.status) ? "Quản lý cơ sở duyệt chi khoản hoàn. Đến quầy trong thời hạn, hoặc đổi sang chuyển khoản nếu không tiện đến." : "Theo dõi khoản hoàn tiền mặt của bạn."}>
      <Tag tone={switchable(item.status) && left != null ? (left <= 5 ? "red" : "amber") : tone}>{switchable(item.status) && left != null && left >= 0 ? `Còn ${left} ngày để nhận` : label}</Tag>
    </PageHeader>
    <div className="customer-detail__grid">
      <div className="customer-detail__column">
        <section className="panel customer-detail__card"><h2>Khoản hoàn tiền mặt</h2>
          <DetailList items={[
            ["Mã khoản", item.id], ["Lý do", `${SOURCE[item.source] || "Khoản hoàn"} · ${item.reference}`],
            ["Số tiền", <strong className="money-total">{money(item.amount)}</strong>], ["Nơi nhận", "Quầy lễ tân của cơ sở"],
            ["Duyệt chi", item.approvedAt ? vnStamp(item.approvedAt) : "Chưa duyệt"],
            ["Hạn nhận", item.deadlineDate ? `22:00 · ${vnDate(item.deadlineDate)} (30 ngày sau khi quản lý duyệt)` : "Tính 30 ngày từ khi quản lý duyệt"],
            ...(item.appointmentDate ? [["Ngày hẹn đến quầy", vnDate(item.appointmentDate)]] : []),
            ...(item.paidAt ? [["Đã nhận lúc", vnStamp(item.paidAt)]] : []),
            ["Trạng thái", <strong>{label}</strong>],
          ]} />
          {switchable(item.status) && <p className="hint">Mang CCCD trùng tên trên hợp đồng{expectedName ? ` (${expectedName})` : ""}. Nhân viên hỏi mã đơn và số điện thoại, đếm tiền trước mặt bạn rồi mời bạn ký sổ chi. Quá hạn nhận không đến, bạn mất khoản hoàn.</p>}
          {item.status === "FORFEITED" && <Notice tone="error">Đã quá 30 ngày kể từ khi cơ sở duyệt chi mà chưa nhận tiền mặt, nên khoản hoàn này không còn được chi theo chính sách bạn đã đồng ý.</Notice>}
        </section>
        {switchable(item.status) && <form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Đổi sang chuyển khoản</h2>
          <p className="hint">Không tiện đến quầy? Trong thời hạn nhận, bạn đổi được sang chuyển khoản ngân hàng (chấp nhận tài khoản của chính bạn, người thân hoặc người nhận hộ). Sau khi đổi, khoản này không nhận tiền mặt được nữa.</p>
          <RefundBankFields intro={false} value={bank} onChange={setBank} disabled={busy} expectedName={expectedName} />
          {error && <Notice tone="error">{error}</Notice>}
          <div className="customer-detail__actions"><Button type="submit" disabled={busy}>Đổi sang chuyển khoản</Button></div>
        </form>}
      </div>
      <aside className="customer-detail__column customer-detail__sidebar">
        <section className="panel customer-detail__card"><h2>Khoản hoàn</h2>
          <div className="summary-total"><span>Tổng hoàn</span><strong>{money(item.amount)}</strong></div>
          <p className="hint">Số tiền đã được quản lý cơ sở chốt. Hệ thống nhắc bạn ở ngày 10, 20 và 25 nếu chưa đến nhận.</p>
        </section>
        <section className="panel customer-detail__card return-request__warning"><h2>Lưu ý khi nhận</h2>
          <ul><li>Chỉ người đứng tên hợp đồng nhận tiền, mang CCCD bản gốc.</li><li>Không nhận thay, không nhận qua người khác.</li><li>Đổi sang chuyển khoản thì hoàn trong 3–5 ngày làm việc.</li><li>Quá 30 ngày không đến nhận, bạn mất khoản hoàn.</li></ul>
        </section>
      </aside>
    </div>
    {confirm && <ConfirmDialog title="Đổi khoản hoàn sang chuyển khoản?" tone="warning" text={`Sau khi đổi, khoản ${item.id} không nhận tiền mặt tại quầy được nữa. Quản lý cơ sở chuyển khoản và ghi mã giao dịch.`} rows={[["Số tiền", money(item.amount)], ["Ngân hàng", bank.bankName], ["Số tài khoản", bank.accountNumber], ["Chủ tài khoản", bank.accountHolder]]} hint="Hoàn trong 3–5 ngày làm việc vào tài khoản nhận hoàn đã khai báo." cancelLabel="Giữ tiền mặt" busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Đổi sang chuyển khoản" />}
    {result?.ok && <Dialog title="Đã đổi sang chuyển khoản" message={`Khoản ${item.id} sẽ được chuyển vào tài khoản ${bank.bankName} ${tail}. Bạn nhận thông báo khi cơ sở ghi nhận đã chuyển.`} actionLabel="Theo dõi khoản hoàn" onClose={() => { setResult(null); go("refunds"); }} />}
    {result && !result.ok && <Dialog title="Chưa đổi được cách nhận hoàn" message={`${result.error} Thông tin bạn đã nhập được giữ nguyên.${item.deadlineDate ? ` Khoản hoàn vẫn chờ nhận tiền mặt tại quầy đến 22:00 · ${vnDate(item.deadlineDate)}.` : ""}`} actionLabel="Thử lại" onClose={() => setResult(null)} />}
  </>;
}

/**
 * Màn hình thông tin phiếu nhận tiền mặt hoàn lại dành cho khách hàng.
 */
export function CashRefundPage({ query }) {
  const { data } = useApp();
  const load = useCashRefunds();
  const expectedName = data.contracts.find(c => c.customer_name)?.customer_name || data.user?.full_name || null;
  const rows = Array.isArray(load.data) ? load.data : [];
  const selected = rows.find(r => r.id === query?.get?.("id")) || (rows.length === 1 ? rows[0] : null);
  const onSwitch = async (id, bank) => { await load.switchToBank(id, bank); await load.reload(); };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Thanh toán & lịch hẹn / Hoàn tiền mặt</p>
    {load.demo ? <><PageHeader title="Nhận tiền hoàn tại quầy" description="Khoản hoàn bạn chọn nhận tiền mặt." /><Notice>Chế độ mô phỏng chưa có khoản hoàn tiền mặt. Vui lòng dùng chế độ kết nối máy chủ.</Notice></>
      : load.loading ? <Notice>Đang tải…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : selected ? <CashRefundDetail key={selected.id} item={selected} expectedName={expectedName} onSwitch={onSwitch} />
      : <><PageHeader title="Nhận tiền hoàn tại quầy" description="Chọn khoản hoàn để xem hạn nhận hoặc đổi sang chuyển khoản." />
        {rows.length === 0 ? <Empty title="Chưa có khoản hoàn tiền mặt" text="Khoản hoàn bạn chọn nhận tiền mặt khi huỷ đơn, trả kho hoặc kết thúc do sự cố sẽ hiện ở đây." />
          : rows.map(item => { const [label, tone] = STATUS[item.status] || [item.status, "blue"]; return <section key={item.id} className="panel customer-detail__card">
            <div className="deadline-banner"><h2>{item.id} · {SOURCE[item.source] || "Khoản hoàn"} {item.reference}</h2><Tag tone={tone}>{label}</Tag></div>
            <p><strong className="money-total">{money(item.amount)}</strong>{item.deadlineDate ? ` · hạn nhận ${vnDate(item.deadlineDate)}` : ""}</p>
            <div className="customer-detail__actions"><LinkButton to={`refunds/cash?id=${encodeURIComponent(item.id)}`}>Xem</LinkButton></div>
          </section>; })}</>}
  </main>;
}
