import { parseVnDeadline, validateDamageFiles } from "../damage/damageModel.js";
import { cleanRefundBank, validateRefundBank } from "../../../shared/utils/refundRequest.js";
export const INCIDENT_STATUS = { DRAFT:"Ghi nhận sự cố", PROPOSED:"Chờ khách chọn", TRANSFER_PENDING:"Chờ hoàn tất chuyển", TRANSFERRED:"Đã chuyển kho", TERMINATION_PENDING:"Chờ kết thúc do sự cố", TERMINATED:"Đã kết thúc · Chờ hoàn" };
export const INCIDENT_ACTIONS = ["SAVE_INCIDENT","SEND_INCIDENT_PROPOSAL","CHOOSE_INCIDENT_OPTION","COMPLETE_INCIDENT_TRANSFER","FINALIZE_INCIDENT_TERMINATION"];
export const incidentStatusLabel=item=>item.status==="TERMINATED"&&item.refund?.status==="PAID"?"Đã kết thúc · Đã hoàn":INCIDENT_STATUS[item.status];
const finiteMoney = n => Number.isSafeInteger(n) && n >= 0;
export function incidentRefund(item) {
  const values = [item.currentMonthRent, item.unusedRent, item.deposit];
  return values.every(finiteMoney) && Number.isSafeInteger(values.reduce((a,b)=>a+b,0)) ? values.reduce((a,b)=>a+b,0) : null;
}
export function selectIncidents(items, actor, scope) {
  if (!["customer","manager"].includes(scope)) return [];
  return (items || []).filter(item => scope === "customer" ? actor.roles?.includes("CUSTOMER") && actor.id != null && item.ownerId != null && String(actor.id) === String(item.ownerId) && item.status !== "DRAFT" : actor.roles?.some(r=>["MANAGER","FACILITY_MANAGER"].includes(r)) && actor.facilityId != null && item.facilityId != null && String(actor.facilityId) === String(item.facilityId));
}
export function equivalentUnit(item, unit) {
  return Boolean(unit && typeof unit.id === "string" && unit.id && typeof unit.code === "string" && unit.code && unit.id !== item.oldUnitId && unit.code !== item.oldUnit && unit.facilityId === item.facilityId && unit.type === item.unitType && unit.sizeM2 === item.sizeM2 && ["AVAILABLE","RESERVED"].includes(unit.status) && (unit.status !== "RESERVED" || unit.reservedFor === item.id) && Number.isSafeInteger(unit.version) && unit.version > 0);
}
const noteOf = (value, required=false) => { const text=String(value || "").trim();if(required&&!text)throw new Error("Vui lòng nhập nội dung bắt buộc.");if(text.length>1000)throw new Error("Nội dung không quá 1.000 ký tự.");return text; };
const dateTime = (value,now) => {const iso=parseVnDeadline(value);if(Date.parse(iso)>now.getTime())throw new Error("Thời điểm thực tế không được ở tương lai.");return iso;};
export function prepareIncidentAction(item,action,payload,actor,now=new Date()) {
  if (!item || !INCIDENT_ACTIONS.includes(action)) throw new Error("Không tìm thấy hồ sơ hoặc thao tác hợp lệ.");
  const scope=action==="CHOOSE_INCIDENT_OPTION"?"customer":"manager";
  if(!selectIncidents([item],actor,scope).length)throw new Error("Bạn không có quyền xử lý hồ sơ này.");
  if(!Number.isSafeInteger(payload.expectedVersion)||payload.expectedVersion!==item.version)throw new Error("Hồ sơ đã thay đổi. Tải lại trước khi gửi tiếp.");
  if(!["ACTIVE","EXPIRING"].includes(item.contractStatus))throw new Error("Hợp đồng không còn đủ điều kiện xử lý sự cố này.");
  if(!Number.isSafeInteger(item.monthlyRate)||item.monthlyRate<=0)throw new Error("Chưa đủ giá thuê từ hợp đồng. Tải lại hoặc liên hệ cơ sở.");
  const clean={id:item.id,expectedVersion:item.version};
  if(["SAVE_INCIDENT","SEND_INCIDENT_PROPOSAL"].includes(action)) {
    if(item.status!=="DRAFT")throw new Error("Phương án đã gửi; không sửa lựa chọn khách đã nhận.");
    validateDamageFiles(payload.files || []);
    const description=noteOf(payload.description,true),affectedAt=dateTime(payload.affectedAt,now);
    if(payload.confirmed!==true)throw new Error("Cần xác nhận sự cố ảnh hưởng quyền sử dụng kho.");
    if(!["TRANSFER","TERMINATE"].includes(payload.proposal))throw new Error("Chọn phương án đề xuất cho khách.");
    let target;
    if(payload.proposal==="TRANSFER") {
      target=item.candidates?.find(u=>u.id===payload.targetUnitId);
      if(!equivalentUnit(item,target))throw new Error("Ô thay thế phải trống, tương đương và thuộc đúng cơ sở. Tải lại danh sách ô.");
    }
    return {...clean,description,affectedAt,confirmed:true,proposal:payload.proposal,...(target?{targetUnitId:target.id,expectedTargetVersion:target.version}:{})};
  }
  if(action==="CHOOSE_INCIDENT_OPTION") {
    if(item.status!=="PROPOSED")throw new Error("Hồ sơ không còn ở bước chờ khách chọn.");
    if(!["TRANSFER","TERMINATE"].includes(payload.choice))throw new Error("Chọn phương án hỗ trợ.");
    if(payload.choice==="TRANSFER" && (!equivalentUnit(item,item.targetUnit)||item.proposal!=="TRANSFER"))throw new Error("Chưa có ô tương đương được cơ sở đề xuất; liên hệ cơ sở hoặc chọn kết thúc.");
    if(payload.choice==="TERMINATE") {
      if(incidentRefund(item)===null)throw new Error("Chưa đủ dữ liệu khoản hoàn. Liên hệ cơ sở trước khi xác nhận.");
      if(!item.customer)throw new Error("Chưa xác định tên trên hợp đồng để đối chiếu tài khoản.");
      const error=validateRefundBank(payload.refundBank,item.customer);if(error)throw new Error(error);
    }
    return {...clean,choice:payload.choice,note:noteOf(payload.note),...(payload.choice==="TERMINATE"?{refundBank:cleanRefundBank(payload.refundBank)}:{targetUnitId:item.targetUnit.id,expectedTargetVersion:item.targetUnit.version})};
  }
  if(action==="COMPLETE_INCIDENT_TRANSFER") {
    if(item.status!=="TRANSFER_PENDING"||item.choice?.choice!=="TRANSFER")throw new Error("Khách chưa đồng ý chuyển ô hoặc đã hoàn tất.");
    if(!equivalentUnit(item,item.targetUnit))throw new Error("Ô thay thế không còn hợp lệ. Tải lại hồ sơ và liên hệ khách.");
    if(payload.confirmed!==true)throw new Error("Xác nhận đã chuyển đồ thực tế trước khi đổi mã ra vào.");
    const movedAt=dateTime(payload.movedAt,now);
    if(!Number.isFinite(Date.parse(item.affectedAt))||Date.parse(movedAt)<Date.parse(item.affectedAt)||!Number.isFinite(Date.parse(item.choice.at))||Date.parse(movedAt)<Math.floor(Date.parse(item.choice.at)/60000)*60000)throw new Error("Thời điểm chuyển phải sau sự cố và sau khi khách đồng ý.");
    return {...clean,targetUnitId:item.targetUnit.id,expectedTargetVersion:item.targetUnit.version,movedAt,confirmed:true};
  }
  if(item.status!=="TERMINATION_PENDING"||item.choice?.choice!=="TERMINATE")throw new Error("Khách chưa chọn kết thúc hoặc hồ sơ đã xử lý.");
  if(payload.confirmed!==true)throw new Error("Xác nhận kết thúc theo lựa chọn khách trước khi chốt.");
  const error=validateRefundBank(item.refundBank,item.customer);if(!item.customer||error)throw new Error(error||"Thiếu tên hợp đồng.");
  if(incidentRefund(item)===null)throw new Error("Chưa đủ dữ liệu khoản hoàn từ cơ sở.");
  return {...clean,confirmed:true};
}
export const incidentNextStatus=(action,payload)=>({SAVE_INCIDENT:"DRAFT",SEND_INCIDENT_PROPOSAL:"PROPOSED",COMPLETE_INCIDENT_TRANSFER:"TRANSFERRED",FINALIZE_INCIDENT_TERMINATION:"TERMINATED"}[action] || (payload.choice==="TRANSFER"?"TRANSFER_PENDING":"TERMINATION_PENDING"));
// Mô phỏng độc lập; không dùng để cập nhật hợp đồng/credential/ledger API.
export function applyIncidentAction(items,action,payload,actor,now=new Date()) {
  const item=items.find(c=>c.id===payload.id),clean=prepareIncidentAction(item,action,payload,actor,now),next={...structuredClone(item),status:incidentNextStatus(action,clean),version:item.version+1};
  if(["SAVE_INCIDENT","SEND_INCIDENT_PROPOSAL"].includes(action)) {
    Object.assign(next,{description:clean.description,affectedAt:clean.affectedAt,confirmed:true,proposal:clean.proposal,targetUnit:clean.targetUnitId?structuredClone(item.candidates.find(u=>u.id===clean.targetUnitId)):null});
    if(action==="SEND_INCIDENT_PROPOSAL"&&next.targetUnit){next.targetUnit.status="RESERVED";next.targetUnit.reservedFor=item.id;}
    next.files=[...(item.files||[])];
    for(const f of payload.files||[])if(!next.files.some(existing=>existing.fileName===f.name&&existing.size===f.size&&existing.contentType===f.type))next.files.push({fileName:f.name,contentType:f.type,size:f.size});
  }
  if(action==="CHOOSE_INCIDENT_OPTION") {next.choice={choice:clean.choice,note:clean.note,at:now.toISOString()};if(clean.refundBank){next.refundBank=clean.refundBank;if(next.targetUnit){next.targetUnit.status="AVAILABLE";delete next.targetUnit.reservedFor;}}}
  if(action==="COMPLETE_INCIDENT_TRANSFER") {next.movedAt=clean.movedAt;next.currentUnit=next.targetUnit.code;next.oldUnitStatus="MAINTENANCE";next.access={oldUnit:"INVALID",newUnit:"ISSUED"};next.targetUnit.status="OCCUPIED";next.surcharge=0;}
  if(action==="FINALIZE_INCIDENT_TERMINATION") {next.contractStatus="ENDED";next.refund={id:`HT-${next.id}`,amount:incidentRefund(next),status:"PENDING"};next.access={oldUnit:"INVALID",newUnit:"NONE"};next.oldUnitStatus="MAINTENANCE";}
  next.history=[...(next.history||[]),{action,by:actor.id||actor.name,at:now.toISOString()}];
  // Demo-only reservation propagation; production must lock this transaction in SQL Server.
  const updateUnit = unit => {
    if (!unit || unit.id !== next.targetUnit?.id) return unit;
    if (next.choice?.choice === "TERMINATE" && unit.reservedFor === item.id) return {...unit,status:"AVAILABLE",reservedFor:undefined};
    if (["PROPOSED","TRANSFER_PENDING","TRANSFERRED"].includes(next.status)) return {...unit,status:next.status === "TRANSFERRED" ? "OCCUPIED" : "RESERVED",reservedFor:next.id};
    return unit;
  };
  return items.map(c => c.id === item.id ? next : {...c,targetUnit:updateUnit(c.targetUnit),candidates:c.candidates?.map(updateUnit)});
}
export function createIncidentSeed(now=new Date()) {
  const base={facilityId:1,ownerId:101,customer:"Nguyễn Thị Mai",contractId:"HĐ-2026-0086",contractStatus:"ACTIVE",oldUnitId:"unit-b015",oldUnit:"B-015",currentUnit:"B-015",unitType:"STANDARD",sizeM2:30,startDate:"2026-08-01",endDate:"2026-12-01",monthlyRate:1150000,deposit:1150000,currentMonthRent:1150000,unusedRent:1150000,version:1,description:"Thấm nước mái kho sau mưa lớn",affectedAt:new Date(now.getTime()-86400000).toISOString(),confirmed:true,proposal:"TRANSFER",oldUnitStatus:"OCCUPIED",access:{oldUnit:"UNCHANGED",newUnit:"NONE"},photos:[],candidates:[{id:"unit-b016",code:"B-016",facilityId:1,type:"STANDARD",sizeM2:30,status:"AVAILABLE",version:1}]};
  return [{...structuredClone(base),id:"SC-local-0086",status:"DRAFT"},{...structuredClone(base),id:"SC-other-0001",ownerId:3,customer:"Nguyễn Văn An",contractId:"HĐ-2026-0001",status:"PROPOSED",targetUnit:{...base.candidates[0],id:"unit-b018",code:"B-018"}}];
}
