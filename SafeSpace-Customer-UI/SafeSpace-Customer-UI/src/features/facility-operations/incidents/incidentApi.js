import { request, ApiError } from "../../../shared/api/httpClient.js";
import { readPhotoData, verifyPhotoFile } from "../../../shared/utils/refundRequest.js";
import { validateDamageFiles } from "../damage/damageModel.js";
import { INCIDENT_STATUS, equivalentUnit, incidentNextStatus, incidentRefund, prepareIncidentAction } from "./incidentModel.js";
export function normalizeIncident(value) {
  if(!value || !["id","contractId","oldUnitId","oldUnit","unitType","customer","startDate","endDate"].every(k=>typeof value[k]==="string"&&value[k]) || !["ownerId","facilityId","version","sizeM2"].every(k=>Number.isSafeInteger(value[k])&&value[k]>0) || !INCIDENT_STATUS[value.status] || !["ACTIVE","EXPIRING","ENDED","OVERDUE","RETURN_PENDING"].includes(value.contractStatus))throw new Error("Hồ sơ sự cố từ máy chủ thiếu thông tin hoặc sai định dạng.");
  if(value.status!=="DRAFT" && (value.confirmed!==true||!value.description||!Number.isFinite(Date.parse(value.affectedAt))||!["TRANSFER","TERMINATE"].includes(value.proposal)))throw new Error("Chưa có bằng chứng cơ sở xác nhận sự cố/phương án.");
  if(["TRANSFER_PENDING","TRANSFERRED"].includes(value.status)&&value.choice?.choice!=="TRANSFER")throw new Error("Chưa có bằng chứng khách đồng ý chuyển.");
  if(["TERMINATION_PENDING","TERMINATED"].includes(value.status)&&value.choice?.choice!=="TERMINATE")throw new Error("Chưa có bằng chứng khách chọn kết thúc.");
  for(const key of ["description","affectedAt","movedAt","proposal","currentUnit"])if(value[key]!=null&&typeof value[key]!=="string")throw new Error("Nội dung hồ sơ sự cố không hợp lệ.");
  if(value.choice!=null&&(!["TRANSFER","TERMINATE"].includes(value.choice.choice)||typeof value.choice.note!=="string"||!Number.isFinite(Date.parse(value.choice.at))))throw new Error("Lựa chọn khách chưa có bằng chứng hợp lệ.");
  if(value.targetUnit!=null && (!value.targetUnit || !["id","code","type"].every(k=>typeof value.targetUnit[k]==="string") || !Number.isSafeInteger(value.targetUnit.facilityId) || !Number.isSafeInteger(value.targetUnit.sizeM2)))throw new Error("Ô thay thế từ máy chủ sai định dạng.");
  if(value.files!=null && (!Array.isArray(value.files)||value.files.some(f=>!f||typeof f.fileName!=="string")))throw new Error("Tệp biên bản không hợp lệ.");
  if(value.refundBank!=null && !["bankName","accountNumber","accountHolder"].every(k=>typeof value.refundBank[k]==="string"))throw new Error("Tài khoản hoàn không hợp lệ.");
  if(value.status==="TRANSFERRED" && (value.currentUnit!==value.targetUnit?.code||value.targetUnit?.facilityId!==value.facilityId||value.targetUnit?.type!==value.unitType||value.targetUnit?.sizeM2!==value.sizeM2||value.oldUnitStatus!=="MAINTENANCE"||value.access?.oldUnit!=="INVALID"||value.access?.newUnit!=="ISSUED"||value.surcharge!==0||!Number.isFinite(Date.parse(value.movedAt))))throw new Error("Chưa đủ bằng chứng hoàn tất chuyển và mã mới.");
  if(value.status==="TERMINATED" && (value.contractStatus!=="ENDED"||!["PENDING","PAID"].includes(value.refund?.status)||!value.refund?.id||incidentRefund(value)===null||value.refund.amount!==incidentRefund(value)||value.access?.oldUnit!=="INVALID"))throw new Error("Kết quả kết thúc/khoản chờ hoàn chưa đầy đủ.");
  if(value.refund?.status==="PAID" && (typeof value.refund.transactionRef!=="string"||!value.refund.transactionRef.trim()||!Number.isFinite(Date.parse(value.refund.paidAt))))throw new Error("Chưa có bằng chứng chuyển tiền hoàn.");
  return {...value,photos:Array.isArray(value.photos)?value.photos:[],candidates:Array.isArray(value.candidates)?value.candidates:[]};
}
const pathFor=scope=>{if(scope==="customer")return "/api/incidents";if(scope==="manager")return "/api/ops/incidents";throw new Error("Phạm vi không hợp lệ.");};
const explain=error=>[404,405].includes(error.status)?new ApiError("Máy chủ chưa hỗ trợ luồng sự cố cơ sở. Chưa ghi nhận thay đổi; vui lòng liên hệ cơ sở.",error.status):error;
export async function loadIncidents(scope) {
  try{const data=await request(pathFor(scope));if(!Array.isArray(data?.items))throw new Error("Danh sách sự cố từ máy chủ không hợp lệ.");return data.items.map(normalizeIncident);}catch(error){throw explain(error);}
}
export function validateIncidentReceipt(dto,item,action,clean) {
  const result=normalizeIncident(dto?.incident);
  if(result.id!==item.id||result.contractId!==item.contractId||result.ownerId!==item.ownerId||result.facilityId!==item.facilityId||result.version<=item.version||result.status!==incidentNextStatus(action,clean))throw new Error("Kết quả không khớp hồ sơ, phiên bản hoặc thao tác.");
  if(["SEND_INCIDENT_PROPOSAL","SAVE_INCIDENT"].includes(action) && (result.description!==clean.description||result.affectedAt!==clean.affectedAt||result.confirmed!==true||result.proposal!==clean.proposal||(clean.targetUnitId && (result.targetUnit?.id!==clean.targetUnitId || !equivalentUnit(result,result.targetUnit)))))throw new Error("Chưa xác nhận đủ nội dung ghi nhận/phương án.");
  if(action==="CHOOSE_INCIDENT_OPTION" && (result.choice?.choice!==clean.choice||result.choice?.note!==clean.note))throw new Error("Chưa xác nhận lựa chọn khách.");
  if(clean.choice==="TERMINATE" && ["bankName","accountNumber","accountHolder"].some(k=>result.refundBank?.[k]!==clean.refundBank[k]))throw new Error("Chưa xác nhận tài khoản nhận hoàn.");
  if(action==="COMPLETE_INCIDENT_TRANSFER") {
    if(result.currentUnit!==item.targetUnit?.code||result.targetUnit?.id!==item.targetUnit?.id||result.oldUnitId!==item.oldUnitId||result.oldUnitStatus!=="MAINTENANCE"||result.access?.oldUnit!=="INVALID"||result.access?.newUnit!=="ISSUED"||result.surcharge!==0||!Number.isFinite(Date.parse(result.movedAt)))throw new Error("Chưa xác nhận chuyển ô và đổi mã ra vào đầy đủ.");
  }
  if(["startDate","endDate","monthlyRate","deposit"].some(k=>result[k]!==item[k]) || (action!=="FINALIZE_INCIDENT_TERMINATION" && result.contractStatus!==item.contractStatus))throw new Error("Kỳ thuê, giá hoặc hợp đồng bị thay đổi ngoài phạm vi.");
  if(action==="FINALIZE_INCIDENT_TERMINATION" && (result.contractStatus!=="ENDED"||!result.refund?.id||result.refund?.status!=="PENDING"||result.refund?.amount!==incidentRefund(item)||incidentRefund(item)===null||result.access?.oldUnit!=="INVALID"||result.oldUnitStatus!=="MAINTENANCE"))throw new Error("Chưa xác nhận kết thúc và khoản chờ hoàn đúng chính sách.");
  if(["CHOOSE_INCIDENT_OPTION","COMPLETE_INCIDENT_TRANSFER"].includes(action)&&clean.targetUnitId&&result.targetUnit?.id!==clean.targetUnitId)throw new Error("Ô thay thế không khớp lựa chọn.");
  return result;
}
export async function saveIncidentAction(scope,item,action,payload,actor,now=new Date(), shouldContinue=()=>true) {
  pathFor(scope);
  if((scope==="customer")!==(action==="CHOOSE_INCIDENT_OPTION"))throw new Error("Thao tác không đúng phạm vi tài khoản.");
  const clean=prepareIncidentAction(item,action,payload,actor,now),photos=[];
  validateDamageFiles(payload.files||[]);
  for(const file of payload.files||[]){await verifyPhotoFile(file);photos.push(await readPhotoData(file));}
  if(!shouldContinue())throw new Error("Màn hình hoặc tài khoản đã thay đổi. Tải lại hồ sơ trước khi gửi.");
  let data;
  const root=pathFor("manager"),id=encodeURIComponent(item.id);
  const url=action==="CHOOSE_INCIDENT_OPTION"?`/api/contracts/${encodeURIComponent(item.contractId)}/incident-choice`:action==="COMPLETE_INCIDENT_TRANSFER"?`${root}/${id}/complete-transfer`:action==="FINALIZE_INCIDENT_TERMINATION"?`${root}/${id}/terminate`:root;
  try{data=await request(url,{method:"POST",body:{action,...clean,...(photos.length?{photos}:{})}});}catch(error){throw explain(error);}
  try{return validateIncidentReceipt(data,item,action,clean);}catch(error){error.uncertain=true;error.message=`Máy chủ chưa xác nhận đầy đủ kết quả. Tải lại trước khi gửi tiếp. ${error.message}`;throw error;}
}
