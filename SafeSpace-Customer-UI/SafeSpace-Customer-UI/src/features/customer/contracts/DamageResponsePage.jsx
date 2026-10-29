import React, { useState } from "react";
import { Button, Empty, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { DAMAGE_CHOICES, DAMAGE_STATUS, prepareDamageAction } from "../../facility-operations/damage/damageModel.js";
import { useDamageCases } from "../../facility-operations/damage/useDamageCases.js";
import { DamageFinance, DamageOutcome, DamageRecord, DamageResponseRecord, DamageState, useDamageChange, timeLabel } from "../../facility-operations/damage/DamageComponents.jsx";
import "../../../shared/styles/customer-detail.css";

function ResponseForm({ item, load, actor }) {
  const [choice,setChoice] = useState(""), [note,setNote] = useState(""), [files,setFiles] = useState([]), [reading,setReading] = useState(false), [error,setError] = useState("");
  const [dialog,ask] = useDamageChange(load);
  const repairing = item.status === "REMEDIATION_ALLOWED";
  const editable = item.settlementStatus === "OPEN" && ["AWAITING_RESPONSE","REMEDIATION_ALLOWED"].includes(item.status);
  const expired = repairing && (!item.deadline || Date.parse(item.deadline) <= Date.now());
  const disabled = load.busy || load.needsRefresh || reading || !editable || Boolean(expired);
  const submit = event => {
    event.preventDefault();if (disabled) return;
    const action = repairing ? "REPORT_DAMAGE_REMEDIATION" : "RESPOND_DAMAGE";
    const payload = {expectedVersion:item.version,choice,note,files};
    try { prepareDamageAction(item,action,payload,actor);setError("");ask({id:item.id,action,payload,title:repairing?"Báo đã khắc phục xong?":"Gửi phản hồi hư hỏng?",summary:repairing?"Cơ sở sẽ kiểm tra thực tế trước khi bỏ khoản khấu trừ hư hỏng.":"Phản hồi này được gửi tới cơ sở trước bước chốt đối soát."}); } catch(error) {setError(error.message);}
  };
  return <><form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>{repairing ? "Báo kết quả khắc phục" : "Phản hồi của bạn"}</h2><DamageOutcome item={item} />
    {item.status === "RESPONSE_SUBMITTED" && <Notice>Đã gửi phản hồi, đang chờ cơ sở xử lý. Bạn không cần gửi lại.</Notice>}
    {item.status === "AWAITING_INSPECTION" && <Notice>Đã báo khắc phục xong, đang chờ cơ sở kiểm tra.</Notice>}
    {editable && <>
      {!repairing && <fieldset className="customer-detail__choices" disabled={disabled}><legend>Chọn phương án phản hồi</legend>{Object.entries(DAMAGE_CHOICES).map(([value,label]) => <label className="customer-detail__choice" key={value}><input type="radio" name="damage-choice" checked={choice === value} onChange={() => {setChoice(value);setError("");}} /><span>{label}</span></label>)}</fieldset>}
      {repairing && <p>Hạn khắc phục: {timeLabel(item.deadline)} · giờ Việt Nam</p>}
      <Field label={repairing ? "Nội dung đã khắc phục *" : "Nội dung đề nghị / khiếu nại"}><textarea maxLength={1000} rows={3} value={note} disabled={disabled} onChange={e => {setNote(e.target.value);setError("");}} /></Field>
      <ReturnPhotoInput files={files} onChange={setFiles} disabled={disabled} onReading={setReading} label="Đính kèm ảnh / ảnh hoá đơn" required={false} />
      {expired && <Notice tone="error">Đã hết hạn khắc phục. Liên hệ cơ sở để được xử lý; không tự xác nhận hoàn tất.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <div className="customer-detail__actions"><Button type="submit" disabled={disabled}>{repairing?"Báo đã khắc phục xong":"Gửi phản hồi cho cơ sở"}</Button></div>
    </>}
    {item.settlementStatus !== "OPEN" && <Notice>Hồ sơ đã chốt đối soát hoặc chưa có dữ liệu hợp lệ; không thể gửi thêm phản hồi.</Notice>}
  </form>{dialog}</>;
}
export function DamageResponsePage({ id, query = new URLSearchParams() }) {
  const {data,user,roles} = useApp(), load = useDamageCases("customer");
  const contract = data.contracts.find(c => c.contract_id === id);
  const rows = load.data.filter(c => c.contractId === id), selected = query.get("case");
  const item = selected ? rows.find(c => c.id === selected) : rows[0];
  if (!contract) return <NotFound />;
  return <main className="container page customer-records customer-detail damage-page"><p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id}</p><PageHeader title={`Đối chiếu hư hỏng · Kho ${contract.unit_number}`} description="Xem ảnh và nội dung cơ sở ghi nhận trước khi phản hồi. Đối soát chưa chốt.">{item && <Tag tone="amber">{DAMAGE_STATUS[item.status]}</Tag>}</PageHeader>
    <DamageState load={load}>{!item ? <Empty title={selected?"Không tìm thấy hồ sơ":"Chưa có hư hỏng cần phản hồi"} text="Chỉ hiển thị hồ sơ thuộc hợp đồng của bạn."><LinkButton to={`units/${encodeURIComponent(id)}/progress`} variant="outline">Xem tiến độ trả kho</LinkButton></Empty> : <>
      {rows.length > 1 && <Field label="Hạng mục cần xem"><select value={item.id} onChange={e => {window.location.hash=`/units/${encodeURIComponent(id)}/damage?case=${encodeURIComponent(e.target.value)}`;}}>{rows.map(c => <option key={c.id} value={c.id}>{c.item} · {DAMAGE_STATUS[c.status]}</option>)}</select></Field>}
      <div className="customer-detail__grid"><div className="customer-detail__column"><DamageRecord item={item} />{item.response && <DamageResponseRecord item={item} />}<ResponseForm key={item.id} item={item} load={load} actor={{id:user?.user_id,roles:roles || []}} /></div><DamageFinance item={item} /></div>
    </>}</DamageState><div className="workflow-links"><LinkButton to={`units/${encodeURIComponent(id)}/progress`} variant="outline">Tiến độ trả kho</LinkButton><LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Liên hệ cơ sở</LinkButton></div></main>;
}
