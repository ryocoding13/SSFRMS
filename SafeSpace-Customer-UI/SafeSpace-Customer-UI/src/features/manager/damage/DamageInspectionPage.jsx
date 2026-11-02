import React, { useState } from "react";
import { Button, Empty, Field, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { DAMAGE_STATUS, prepareDamageAction } from "../../facility-operations/damage/damageModel.js";
import { useDamageCases } from "../../facility-operations/damage/useDamageCases.js";
import { DamageFinance, DamageOutcome, DamageRecord, DamageResponseRecord, DamageState, useDamageChange } from "../../facility-operations/damage/DamageComponents.jsx";
import { DamageCaseList } from "../../facility-operations/damage/DamageManagerView.jsx";
import "../../../shared/styles/customer-detail.css";
function InspectionForm({item,load,actor}) {
  const [result,setResult]=useState(""),[note,setNote]=useState(""),[error,setError]=useState("");const[dialog,ask]=useDamageChange(load);
  const disabled=load.busy||load.needsRefresh||item.status!=="AWAITING_INSPECTION"||item.settlementStatus!=="OPEN";
  const submit=e=>{e.preventDefault();if(disabled)return;const payload={expectedVersion:item.version,result,note};try{prepareDamageAction(item,"INSPECT_DAMAGE_REMEDIATION",payload,actor);setError("");ask({id:item.id,action:"INSPECT_DAMAGE_REMEDIATION",payload,title:"Ghi nhận kết quả kiểm tra?",summary:result==="PASS"?"Khắc phục đạt: bỏ khoản khấu trừ hư hỏng này. Khoản hoàn chính thức chờ chốt đối soát.":"Khắc phục chưa đạt: giữ khoản khấu trừ, khách sẽ xem được lý do."});}catch(error){setError(error.message);}};
  return <><form className="panel customer-detail__card" onSubmit={submit} noValidate><h2>Kiểm tra việc khắc phục</h2><DamageOutcome item={item}/>{item.status!=="AWAITING_INSPECTION"&&<Notice>Chỉ ghi kết quả khi khách đã báo khắc phục xong và hồ sơ chưa được kiểm tra.</Notice>}
    <fieldset className="customer-detail__choices" disabled={disabled}><legend>Kết quả kiểm tra</legend><label className="customer-detail__choice"><input type="radio" name="damage-result" checked={result==="PASS"} onChange={()=>setResult("PASS")}/><span>Đạt · bỏ khấu trừ hư hỏng</span></label><label className="customer-detail__choice"><input type="radio" name="damage-result" checked={result==="FAIL"} onChange={()=>setResult("FAIL")}/><span>Chưa đạt · giữ khấu trừ, ghi lý do</span></label></fieldset>
    <Field label="Ghi chú kiểm tra *"><textarea rows={3} maxLength={1000} value={note} disabled={disabled} onChange={e=>{setNote(e.target.value);setError("");}}/></Field>{error&&<Notice tone="error">{error}</Notice>}<div className="customer-detail__actions"><Button type="submit" disabled={disabled}>Ghi nhận kết quả</Button></div>
  </form>{dialog}</>;
}
export function DamageInspectionPage({query}) {
  const{user,roles}=useApp(),{ops}=useOps();const facilityId=ops?.facility?.facility_id??null,load=useDamageCases("manager",facilityId),id=query.get("id"),item=id?load.data.find(c=>c.id===id):null;
  return <main className="container page customer-records customer-detail damage-page"><p className="customer-records__breadcrumb">SafeSpace / Quản lý cơ sở / Hợp đồng &amp; quá hạn</p><PageHeader title={item?`Kiểm tra khắc phục · Kho ${item.unit}`:"Kiểm tra khắc phục hư hỏng"} description="Ghi kết quả kiểm tra thực tế trước khi cập nhật khấu trừ.">{item&&<Tag tone="amber">{DAMAGE_STATUS[item.status]}</Tag>}</PageHeader>
    <DamageState load={load}>{!id?<DamageCaseList items={load.data.filter(c=>["AWAITING_INSPECTION","REMEDIATED","REMEDIATION_FAILED"].includes(c.status))} route="manager/damage-inspections" inspect/>:!item?<Empty title="Không tìm thấy hồ sơ" text="Chỉ hiển thị hồ sơ của cơ sở bạn phụ trách."/>:<div className="customer-detail__grid"><div className="customer-detail__column"><DamageRecord item={item}/><DamageResponseRecord item={item}/><InspectionForm key={item.id} item={item} load={load} actor={{id:user?.user_id,name:user?.full_name,roles,facilityId}}/></div><DamageFinance item={item} inspection/></div>}</DamageState><div className="workflow-links"><LinkButton to="manager/damage-responses" variant="outline">Phản hồi hư hỏng</LinkButton><LinkButton to="manager/deposit-refunds" variant="outline">Theo dõi hoàn cọc</LinkButton></div></main>;
}
