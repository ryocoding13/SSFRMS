import React, { useEffect, useRef, useState } from "react";
import { Button, DetailList, Empty, LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { dateLabel } from "../../../shared/utils/format.js";
import { amountLabel, DamagePhotos } from "../damage/DamageComponents.jsx";
import { INCIDENT_STATUS, incidentStatusLabel, incidentRefund } from "./incidentModel.js";
import "./incidents.css";
export const incidentTime=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"}).format(new Date(value)):"Chưa có thông tin";
export function IncidentState({load,children}) {
 return <>{load.demo&&<Notice>Chế độ mô phỏng FE: hồ sơ sự cố lưu riêng trên trình duyệt, không đổi hợp đồng, mã ra vào hoặc chuyển tiền thật. Ảnh chỉ giữ tên tệp sau gửi.</Notice>}{load.needsRefresh&&<Notice tone="error">Chưa xác minh kết quả lần gửi trước. Tải lại trước khi thao tác tiếp.<Button disabled={load.busy} onClick={load.reload}>Tải lại hồ sơ</Button></Notice>}<div className="customer-detail__actions"><Button variant="outline" disabled={load.busy||load.loading} onClick={load.reload}>Cập nhật trạng thái</Button></div>{load.loading?<p role="status">Đang tải hồ sơ sự cố…</p>:load.error?<Empty title="Chưa tải được hồ sơ sự cố" text={load.error}><Button onClick={load.reload}>Thử lại</Button></Empty>:children}</>;
}
export function IncidentContract({item}) {
 return <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Hợp đồng {item.contractId}</h2><DetailList items={[["Khách hàng",item.customer],["Kho hiện tại",item.currentUnit||item.oldUnit],["Kỳ thuê",`${dateLabel(item.startDate)} – ${dateLabel(item.endDate)}`],["Giá thuê / tháng",amountLabel(item.monthlyRate)],["Cọc đang giữ",amountLabel(item.deposit)]]}/></aside>;
}
export function IncidentRefund({item}) {
 return <div className="incident-refund"><DetailList items={[["Tháng đang thuê · 100%",amountLabel(item.currentMonthRent)],["Tháng chưa dùng · 100%",amountLabel(item.unusedRent)],["Tiền cọc · 100%",amountLabel(item.deposit)],["Tổng hoàn dự kiến",amountLabel(incidentRefund(item))]]}/><p className="hint">Không phạt dừng sớm, không tính theo số ngày còn lại. Số tiền do cơ sở đối chiếu; chưa xác nhận đã chuyển tiền.</p></div>;
}
export function IncidentRecord({item}) {
 return <section className="panel customer-detail__card"><h2>Ghi nhận sự cố</h2><DetailList items={[["Hồ sơ",item.id],["Ô bị ảnh hưởng",item.oldUnit],["Nguyên nhân",item.description||"Chưa có mô tả"],["Bắt đầu ảnh hưởng",incidentTime(item.affectedAt)]]}/><DamagePhotos photos={item.photos}/>{Array.isArray(item.files)&&item.files.length>0&&<p className="hint">Tệp ghi nhận: {item.files.map(f=>f.fileName).join(", ")}</p>}</section>;
}
export function IncidentOutcome({item}) {
 return <>{item.choice&&<Notice>Khách đã chọn {item.choice.choice==="TRANSFER"?"chuyển ô tương đương":"kết thúc hợp đồng do sự cố"} lúc {incidentTime(item.choice.at)}.{item.choice.note&&<p>Ghi chú: {item.choice.note}</p>}</Notice>}
 {item.status==="TRANSFER_PENDING"&&<Notice>Đang chờ cơ sở xác nhận chuyển đồ thực tế. Chưa đổi mã ra vào; mã chỉ sử dụng trong điều kiện hợp đồng còn hiệu lực.</Notice>}
 {item.status==="TRANSFERRED"&&<section className="panel customer-detail__card"><h2>Kho mới của bạn</h2><DetailList items={[["Kho mới",`${item.currentUnit} · ${item.sizeM2} m² · tương đương ${item.oldUnit}`],["Thời điểm chuyển",incidentTime(item.movedAt)],["Kho cũ",`${item.oldUnit} · đang bảo trì`],["QR/PIN",`Mã mới đã cấp cho ${item.currentUnit} · mã của ${item.oldUnit} đã hết hiệu lực`],["Giá và kỳ thuê","Giữ nguyên · không phụ phí"]]}/></section>}
 {item.status==="TERMINATION_PENDING"&&<Notice>Cơ sở đang đối chiếu để kết thúc theo lựa chọn của bạn và tạo khoản chờ hoàn. Chưa xác nhận đã hoàn tiền.</Notice>}
 {item.status==="TERMINATED"&&<section className="panel customer-detail__card"><h2>Kết thúc do sự cố cơ sở</h2><Notice>Đã kết thúc hợp đồng; mã ô cũ hết hiệu lực. Khoản hoàn: {item.refund?.status==="PAID"?"Đã hoàn":"Chờ hoàn"}.</Notice><IncidentRefund item={item}/><DetailList items={[["Mã khoản hoàn",item.refund?.id||"Chưa có dữ liệu"],["Số tiền chờ hoàn",amountLabel(item.refund?.amount)]]}/><p className="hint">{item.refund?.status==="PAID"?`Cơ sở đã ghi nhận chuyển tiền: ${item.refund.transactionRef}.`:"Chuyển khoản trong 3–5 ngày làm việc. Xác nhận chuyển tiền là bước riêng của cơ sở."}</p></section>}</>;
}
export function IncidentChoices({item,value,onChange,disabled}) {
 return <fieldset className="incident-options" disabled={disabled}><legend>Chọn phương án hỗ trợ</legend><label className={`incident-option ${value==="TRANSFER"?"is-selected":""}`}><span className="customer-detail__choice"><input type="radio" name="incident-choice" value="TRANSFER" checked={value==="TRANSFER"} disabled={disabled||item.proposal!=="TRANSFER"||!item.targetUnit} onChange={()=>onChange("TRANSFER")}/><strong>Chuyển sang kho {item.targetUnit?.code||"chưa có ô đề xuất"}</strong></span><DetailList items={[["Diện tích",`${item.sizeM2} m² · tương đương`],["Phụ phí","0 đ"],["Kỳ thuê và giá","Giữ nguyên"]]}/></label><label className={`incident-option ${value==="TERMINATE"?"is-selected":""}`}><span className="customer-detail__choice"><input type="radio" name="incident-choice" value="TERMINATE" checked={value==="TERMINATE"} onChange={()=>onChange("TERMINATE")}/><strong>Kết thúc hợp đồng</strong></span><DetailList items={[["Hoàn cọc","100%"],["Hoàn tiền thuê","Tháng đang thuê + tháng chưa dùng"],["Phạt dừng sớm","0 đ"]]}/></label></fieldset>;
}
export function IncidentList({items}) {
 return items.length?<div className="customer-detail__column">{items.map(item=><section key={item.id} className="panel customer-detail__card incident-list"><div><h2>{item.customer} · {item.contractId}</h2><p>{item.id} · Kho {item.oldUnit}</p><Tag tone="amber">{incidentStatusLabel(item)}</Tag></div><LinkButton to={`manager/incidents?id=${encodeURIComponent(item.id)}`}>Xử lý sự cố</LinkButton></section>)}</div>:<Empty title="Chưa có hồ sơ sự cố" text="Chỉ hiển thị hồ sơ/hợp đồng đủ điều kiện tại cơ sở bạn phụ trách."/>;
}
export function useIncidentChange(load, contextKey) {
 const [pending,setPending]=useState(null),guard=useRef(false);
 useEffect(()=>{setPending(null);},[contextKey]);
 const ask=value=>{if(!load.busy&&!load.needsRefresh)setPending({...value,stage:"confirm"});};
 const close=()=>{if(!load.busy&&!guard.current)setPending(null);};
 const confirm=async()=>{if(pending.stage!=="confirm"){close();return;}if(guard.current)return;guard.current=true;try{const result=await load.run(pending.id,pending.action,pending.payload);setPending(p=>p?{...p,stage:result.ok?"success":"failure",error:result.error}:null);}finally{guard.current=false;}};
 return [pending&&<ConfirmDialog title={pending.stage==="confirm"?pending.title:pending.stage==="success"?"Đã ghi nhận":"Chưa xác minh được kết quả"} tone={pending.stage==="confirm"?(pending.danger?"danger":"confirm"):pending.stage} text={pending.stage==="confirm"?pending.summary:pending.stage==="success"?(load.demo?"Đã cập nhật kịch bản mô phỏng. Hợp đồng và mã ra vào thật chưa thay đổi.":"Máy chủ đã xác nhận kết quả phù hợp hồ sơ. Khoản hoàn (nếu có) vẫn chờ chuyển tiền."):pending.error} hint={pending.stage==="failure"?"Nội dung và tệp vẫn được giữ. Kiểm tra hoặc tải lại hồ sơ trước khi gửi tiếp.":""} rows={[]} busy={load.busy} label={pending.stage==="confirm"?"Xác nhận":"Về hồ sơ"} cancelLabel={pending.stage==="confirm"?"Quay lại":null} onCancel={close} onConfirm={confirm}/>,ask];
}
