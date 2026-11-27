import React, { useState } from "react";
import { Button, DetailList, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import RefundSummary, { refundMoney, refundStatus } from "../../../shared/components/RefundSummary.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel } from "../../../shared/utils/format.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import "../../../shared/styles/customer-detail.css";
const stamp = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat("vi-VN", {timeZone:"Asia/Ho_Chi_Minh",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date(value)) : "Chưa có thông tin";
const safePhoto = url => typeof url === "string" && (/^https:\/\//.test(url) || /^\/[^/]/.test(url));
export function RefundTrackingPage() {
  const { user, data } = useApp(), load = useWorkflowData("customerRefunds");
  const [selected, setSelected] = useState(""), [detail, setDetail] = useState(false);
  const rows = (Array.isArray(load.data) ? load.data : []).filter(r => user?.user_id != null && r.ownerId != null && String(r.ownerId) === String(user.user_id));
  const r = rows.find(r => String(r.id) === selected) || rows[0];
  const ret = r && data.returns.find(x => x.contract_id === r.contractId);
  const photos = r?.photos?.filter(p => safePhoto(typeof p === "string" ? p : p.url)) || [];
  // D67: tiền mặt "đã hoàn" nghĩa là cơ sở đã giao tiền về quầy, chưa phải khách đã nhận. Chỉ khoản tiền mặt còn chờ (PENDING)
  // mới đổi được sang chuyển khoản (D44) — đã về quầy thì không còn lựa chọn đó, nên không ghi.
  const cash = r?.method === "CASH";
  const cashPending = cash && r?.status === "PENDING";
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / Hoàn cọc</p>
    <PageHeader title={r ? `Hoàn cọc · Kho ${r.unit}` : "Theo dõi hoàn cọc"} description="Theo dõi trạng thái thực tế của khoản hoàn sau khi trả kho.">{r && <Tag tone={r.status === "PAID" ? "green" : "amber"}>{refundStatus(r)} · {refundMoney(r.amount)}</Tag>}</PageHeader>
    <WorkflowState load={load}>
      {!load.error && <>{rows.length > 1 && <section className="panel customer-detail__card"><Field label="Chọn khoản hoàn"><select value={r?.id || ""} onChange={e => { setSelected(e.target.value); setDetail(false); }}>{rows.map(row => <option key={row.id} value={row.id}>{row.contractId} · Kho {row.unit}</option>)}</select></Field></section>}
      {r ? <>
        <ol className="panel refund-timeline" aria-label="Tiến độ hoàn cọc">{[["Gửi trả kho", r.requestedAt || ret?.requested_at], ["Nhân viên kiểm tra", r.inspectedAt], ["Duyệt đối soát", r.approvedAt], [cash ? "Tiền về quầy" : "Chuyển khoản", r.status === "PAID" ? r.paidAt : null]].map(([label,time],i) => <li key={label}><span className={`refund-timeline__step${time ? " refund-timeline__step--done" : ""}`}>{time ? "✓" : i+1}</span><div><strong>{label}</strong><p>{i === 3 && r.status === "PAID" ? time ? stamp(time) : (cash ? "Đã về quầy · chưa có thời điểm" : "Đã chuyển · chưa có thời điểm") : i === 3 && r.amount != null && r.amount <= 0 ? "Không có khoản hoàn" : stamp(time)}</p></div></li>)}</ol>
        <div className="customer-detail__grid">
          <section className="panel customer-detail__card"><h2>Khoản hoàn cọc · {r.contractId}</h2><RefundSummary refund={r} facilityName={data.contracts.find(c => c.contract_id === r.contractId)?.facility_name} /><div className="customer-detail__actions"><Button variant="outline" onClick={() => setDetail(true)}>Xem biên bản & ảnh</Button><LinkButton to={`support?contract=${encodeURIComponent(r.contractId)}`} variant="outline">Liên hệ cơ sở</LinkButton></div></section>
          <aside className="panel customer-detail__card customer-detail__sidebar"><h2>{cash ? "Tiền mặt tại quầy" : "Chuyển khoản"}</h2>{cashPending && <Notice>Bạn chọn nhận tiền mặt tại quầy. Khi khoản này chưa về quầy, bạn có thể <a href="#/refunds/cash">đổi sang chuyển khoản</a>.</Notice>}<DetailList items={[["Nhận tiền", cash ? "Tại quầy cơ sở · mang CCCD" : r.bankName && r.accountNumber ? `${r.bankName} · ••••${String(r.accountNumber).slice(-4)}` : "Chưa có thông tin"]].concat(!cash || r.status !== "PAID" ? [[cash ? "Hạn chuyển về quầy" : "Hạn hoàn", r.refundDueDate && Number.isFinite(Date.parse(r.refundDueDate)) ? dateLabel(r.refundDueDate) : "Chưa có thông tin"]] : []).concat(r.status === "PAID" && r.paidAt ? [[cash ? "Tiền về quầy" : "Ngày chuyển khoản", dateLabel(r.paidAt)]] : [])} /><p className="hint">{cash ? (r.status === "PAID" ? "Tiền đã ở quầy cơ sở. Mang CCCD đến quầy để nhận; nếu đến mà chưa nhận được, hãy liên hệ cơ sở kèm mã hợp đồng." : "Trạng thái cập nhật khi cơ sở chuyển tiền về quầy.") : r.status === "PAID" ? "Cơ sở đã xác nhận chuyển khoản. Nếu chưa nhận được, hãy liên hệ cơ sở kèm mã hợp đồng." : "Chờ hoàn chưa có nghĩa tiền đã được chuyển. Trạng thái cập nhật khi cơ sở ghi nhận chuyển khoản."}</p><Button variant="outline" onClick={load.reload}>Kiểm tra trạng thái</Button></aside>
        </div>
      </> : <WorkflowEmpty text="Chưa có khoản hoàn cọc thuộc tài khoản của bạn." />}</>}
    </WorkflowState>
    <div className="customer-detail__actions">{cashPending && <LinkButton to="refunds/cash" variant="outline">Đổi sang chuyển khoản</LinkButton>}<LinkButton to="payments" variant="outline">Về thanh toán</LinkButton></div>
    {detail && r && <ConfirmDialog title={`Biên bản · ${r.contractId}`} tone="info" label="Đóng" cancelLabel={null} hint="" onCancel={() => setDetail(false)} onConfirm={() => setDetail(false)} rows={[["Kiểm tra", stamp(r.inspectedAt)], ["Kết quả", r.inspectionNote || "Chưa có nội dung biên bản"]]}>{photos.length ? <ul>{photos.map((p,i) => <li key={i}><a href={typeof p === "string" ? p : p.url} target="_blank" rel="noreferrer">Xem ảnh biên bản {i+1}</a></li>)}</ul> : <Notice>Cơ sở chưa cung cấp ảnh biên bản.</Notice>}</ConfirmDialog>}
  </main>;
}
