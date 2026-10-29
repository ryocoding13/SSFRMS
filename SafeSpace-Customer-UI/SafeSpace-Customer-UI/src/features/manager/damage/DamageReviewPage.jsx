import React, { useState } from "react";
import { Button, Empty, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { DAMAGE_STATUS, prepareDamageAction, vnDateTimeInput } from "../../facility-operations/damage/damageModel.js";
import { useDamageCases } from "../../facility-operations/damage/useDamageCases.js";
import { DamageFinance, DamageOutcome, DamageRecord, DamageResponseRecord, DamageState, useDamageChange } from "../../facility-operations/damage/DamageComponents.jsx";
import { DamageCaseList } from "../../facility-operations/damage/DamageManagerView.jsx";
import "../../../shared/styles/customer-detail.css";
function ReviewForm({item,load,actor}) {
  const [decision,setDecision] = useState(""), [deadline,setDeadline] = useState(""), [note,setNote] = useState(""), [error,setError] = useState("");
  const [dialog,ask] = useDamageChange(load);
  const disabled = load.busy || load.needsRefresh || item.status !== "RESPONSE_SUBMITTED" || item.settlementStatus !== "OPEN";
  const submit = e => {e.preventDefault();if(disabled)return;const payload={expectedVersion:item.version,decision,deadline,note};try{prepareDamageAction(item,"DECIDE_DAMAGE_RESPONSE",payload,actor);setError("");ask({id:item.id,action:"DECIDE_DAMAGE_RESPONSE",payload,title:decision==="ALLOW"?"Đồng ý cho khách khắc phục?":"Từ chối phản hồi?",summary:decision==="ALLOW"?"Tạm giữ khoản khấu trừ đến khi kiểm tra khắc phục. Hạn được ghi theo giờ Việt Nam.":"Lý do sẽ hiển thị cho khách; khoản khấu trừ giữ để đối soát."});}catch(error){setError(error.message);}};
  return <><form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Quyết định của cơ sở</h2><DamageOutcome item={item} />
    {item.status !== "RESPONSE_SUBMITTED" && <Notice>Hồ sơ không ở bước chờ xử lý phản hồi; xem trạng thái hiện tại trước khi thao tác.</Notice>}
    <fieldset className="customer-detail__choices" disabled={disabled}><legend>Chọn cách xử lý</legend><label className="customer-detail__choice"><input type="radio" name="damage-decision" checked={decision==="ALLOW"} onChange={()=>setDecision("ALLOW")} /><span>Đồng ý cho khách khắc phục · tạm giữ khấu trừ</span></label><label className="customer-detail__choice"><input type="radio" name="damage-decision" checked={decision==="REJECT"} onChange={()=>setDecision("REJECT")} /><span>Từ chối · giữ khấu trừ theo biên bản</span></label></fieldset>
    <Field label="Hạn khắc phục · giờ Việt Nam *"><input type="datetime-local" value={deadline} min={vnDateTimeInput()} disabled={disabled || decision!=="ALLOW"} onChange={e=>setDeadline(e.target.value)} /></Field>
    <Field label="Lý do (bắt buộc khi từ chối)"><textarea rows={3} maxLength={1000} value={note} disabled={disabled} onChange={e=>{setNote(e.target.value);setError("");}} /></Field>{error&&<Notice tone="error">{error}</Notice>}
    <div className="customer-detail__actions"><LinkButton to="manager/damage-responses" variant="outline">Về danh sách</LinkButton><Button type="submit" disabled={disabled}>{decision==="REJECT"?"Từ chối phản hồi":"Đồng ý cho khắc phục"}</Button></div>
  </form>{dialog}</>;
}
export function DamageReviewPage({query}) {
  const {user,roles}=useApp(),{ops}=useOps();const facilityId=ops?.facility?.facility_id ?? null,load=useDamageCases("manager",facilityId);
  const id=query.get("id"),item=id?load.data.find(c=>c.id===id):null;
  return <main className="container page customer-records customer-detail damage-page"><p className="customer-records__breadcrumb">SafeSpace / Quản lý cơ sở / Hợp đồng &amp; quá hạn</p><PageHeader title={item?`Phản hồi hư hỏng · Kho ${item.unit}`:"Phản hồi hư hỏng"} description="Đồng ý hoặc từ chối có lý do trước khi chốt đối soát.">{item&&<Tag tone="amber">{DAMAGE_STATUS[item.status]}</Tag>}</PageHeader>
    <DamageState load={load}>{!id?<DamageCaseList items={load.data} route="manager/damage-responses" />:!item?<Empty title="Không tìm thấy hồ sơ" text="Chỉ hiển thị hồ sơ của cơ sở bạn phụ trách." />:<div className="customer-detail__grid"><div className="customer-detail__column"><DamageRecord item={item}/><DamageResponseRecord item={item}/><ReviewForm key={item.id} item={item} load={load} actor={{id:user?.user_id,name:user?.full_name,roles,facilityId}}/></div><DamageFinance item={item}/></div>}</DamageState><div className="workflow-links"><LinkButton to="manager/damage-inspections" variant="outline">Kiểm tra khắc phục</LinkButton><LinkButton to="manager/contracts" variant="outline">Về hợp đồng</LinkButton></div></main>;
}
