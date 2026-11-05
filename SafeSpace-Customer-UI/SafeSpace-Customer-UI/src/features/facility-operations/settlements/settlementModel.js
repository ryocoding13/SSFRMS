import { parseVnDeadline, validateDamageFiles } from "../damage/damageModel.js";
import { validateRefundBank } from "../../../shared/utils/refundRequest.js";
export const knownMoney=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0;
export function actualVnTime(value,now=new Date()) {
 const at=typeof value==="string"&&/^\d{4}-\d{2}-\d{2}T.*Z$/.test(value)&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():parseVnDeadline(value);if(Date.parse(at)>now.getTime())throw new Error("Thời gian thực tế không được ở tương lai.");return at;
}
export function transferProof(item,payload,now=new Date()) {
 if(!item||item.status!=="PENDING"||!knownMoney(item.amount)||item.amount<=0)throw new Error("Khoản hoàn chưa có số tiền hợp lệ hoặc không còn chờ xử lý.");
 if(!item.customer)throw new Error("Thiếu tên khách trên hợp đồng.");
 const error=validateRefundBank({bankName:item.bankName,accountNumber:item.accountNumber,accountHolder:item.accountHolder},item.customer);if(error)throw new Error(error);
 const ref=String(payload.transactionRef||payload.transaction_ref||"").trim();if(!ref||ref.length>100)throw new Error("Nhập mã giao dịch không quá 100 ký tự.");
 if(payload.confirmed!==true)throw new Error("Cần xác nhận đã chuyển đúng số tiền vào đúng tài khoản.");
 const paidAt=actualVnTime(payload.transferredAt,now);
 if(item.inspectedAt&&Number.isFinite(Date.parse(item.inspectedAt))&&Date.parse(paidAt)<Math.floor(Date.parse(item.inspectedAt)/60000)*60000)throw new Error("Thời gian chuyển không được trước khi chốt đối soát.");
 return {transactionRef:ref,transferredAt:paidAt,confirmed:true};
}
export function validateKeyReceipt(ops,payload) {
 const h=ops.handovers.find(h=>h.id===payload.id);if(!h||h.status!=="WAITING")throw new Error("Lịch nhận chìa khóa không còn chờ xử lý.");
 const v=ops.verifications.find(v=>v.id===h.verification_id);if(!v||v.status!=="DONE")throw new Error("Thiếu hồ sơ xác minh hợp lệ. Xác minh khách trước khi giao chìa khóa.");
 if(!payload.identity_checked||!payload.condition_checked||!payload.key_delivered)throw new Error("Đánh dấu đủ ba mục đối chiếu và chỉ xác nhận sau khi đã giao chìa khóa.");
}
export function validateInspection(ret,report,files=[]) {
 if(!ret||ret.status!=="SCHEDULED")throw new Error("Lịch kiểm tra không còn chờ xử lý.");
 if(!knownMoney(ret.deposit))throw new Error("Chưa có tiền cọc hợp lệ.");
 if(["items","walls","keys","proposal"].some(k=>!String(report[k]||"").trim()))throw new Error("Điền đủ bốn mục kiểm kê.");
 if(!knownMoney(report.damage_fee)||!Number.isSafeInteger(report.damage_fee))throw new Error("Khấu trừ hư hỏng phải là số tiền nguyên không âm.");
 validateDamageFiles(files);
 if(report.damage_fee>0&&(!files.length||!String(report.damage_item||"").trim()))throw new Error("Hư hỏng cần hạng mục và ảnh bằng chứng.");
 if((report.damage_fee>0||report.cleaning_required)&&!String(report.fee_reason||"").trim())throw new Error("Nhập lý do khấu trừ.");
 if((report.damage_fee>0||report.cleaning_required)&&report.proposal==="Sẵn sàng cho thuê lại")throw new Error("Kho cần vệ sinh hoặc sửa phải chờ kiểm tra/bảo trì.");
}
export function canFinalizeReturn(board,contract,ret) {
 if(!contract||contract.state!=="RETURNED"||!ret||ret.status!=="SUBMITTED")return false;
 if(board.damage_cases_pending?.some(c=>(c.contractId||c.contract_id)===contract.id))return false;
 return ret.damage_workflow_resolved!==false;
}
export function opsMutationCheck(type,payload,ops,source,role) {
 const staff=["VERIFY_CUSTOMER","RECORD_KEY_RECEIPT","SUBMIT_RETURN"].includes(type),manager=["CONFIRM_REFUND","CONFIRM_RESERVATION_REFUND","CONFIRM_DEPOSIT_REFUND"].includes(type);
 if((staff&&!["STAFF","MANAGER"].includes(role))||(manager&&role!=="MANAGER"))throw new Error("Vai trò không được thực hiện thao tác này.");
 if(type==="VERIFY_CUSTOMER") {if(!["original_valid","photo_ok","info_ok","booking_matched"].every(k=>payload[k]===true))throw new Error("Đánh dấu đủ bốn mục đối chiếu.");if(source==="api"&&ops.verification_checklist_supported!==true)throw new Error("Máy chủ chưa hỗ trợ xác minh bằng checklist.");}
 if(type==="RECORD_KEY_RECEIPT")validateKeyReceipt(ops,payload);
 if(type==="SUBMIT_RETURN") {validateInspection(ops.returns.find(r=>r.id===payload.id),payload.report,payload.files);if(source==="api"&&ops.inspection_evidence_supported!==true)throw new Error("Máy chủ chưa hỗ trợ lưu đủ ảnh và khấu trừ kiểm kê. Chưa gửi biên bản.");}
 if(type==="CONFIRM_REFUND") {const c=ops.contracts.find(c=>c.id===payload.id),r=ops.returns.find(r=>r.contract===payload.id);if(!canFinalizeReturn(ops,c,r))throw new Error("Chưa đủ biên bản hoặc phản hồi/khắc phục chưa xử lý xong.");if(source==="api"&&r.damage_workflow_resolved!==true)throw new Error("Máy chủ chưa xác nhận đã giải quyết phản hồi/khắc phục.");}
 if(type==="CONFIRM_DEPOSIT_REFUND")transferProof(ops.deposit_refunds?.find(r=>r.id===payload.id),payload);
 if(type==="CONFIRM_RESERVATION_REFUND") {const item=ops.refunds?.find(r=>r.id===payload.id);transferProof(item,payload);if(source==="api"&&ops.refund_evidence_supported!==true)throw new Error("Máy chủ chưa hỗ trợ lưu tài khoản và bằng chứng chuyển tiền. Chưa ghi nhận đã hoàn.");}
}
export function opsReceiptCheck(type,payload,res,board) {
 if(!board)throw new Error("Chưa tải lại được kết quả sau thao tác. Tải lại trước khi gửi tiếp.");
 if(type==="VERIFY_CUSTOMER"&&!board.verifications?.some(v=>v.id===payload.id&&v.status==="DONE"&&v.verified_at))throw new Error("Chưa xác nhận hồ sơ đã được xác minh.");
 if(type==="RECORD_KEY_RECEIPT"&&!board.handovers?.some(h=>h.id===payload.id&&h.status==="DONE"&&h.done_at))throw new Error("Chưa xác nhận đã lưu việc giao chìa khóa.");
 if(type==="SUBMIT_RETURN") {const r=board.returns?.find(r=>r.id===payload.id);if(r?.status!=="SUBMITTED"||!r.submitted_at||["damage_fee","cleaning_fee","cleaning_required","damage_item","fee_reason"].some(k=>r.report?.[k]!==payload.report[k])||(payload.files?.length&&!r.report?.photos?.length))throw new Error("Chưa xác nhận ảnh và các khoản khấu trừ đã được lưu đầy đủ.");}
 if(type==="CONFIRM_REFUND"&&(!knownMoney(res?.refund)||res?.refundStatus!=="PENDING"||!board.contracts?.some(c=>c.id===payload.id&&c.state==="CLOSED")))throw new Error("Chưa xác nhận khoản hoàn chờ chuyển tiền.");
 if(type==="CONFIRM_DEPOSIT_REFUND")transferProof(ops.deposit_refunds?.find(r=>r.id===payload.id),payload);
 if(type==="CONFIRM_RESERVATION_REFUND") {const r=board.refunds?.find(r=>r.id===payload.id);if(r?.status!=="PAID"||r.transaction_ref!==payload.transaction_ref?.trim()||!r.paid_at)throw new Error("Máy chủ chưa xác nhận bằng chứng chuyển tiền.");}
}
export function validateRemoval(item,payload,policy,actor,now=new Date()) {
 if(!item||item.status==="DONE")throw new Error("Biên bản đã được lưu; không gửi lại.");
 if(!actor.roles?.some(r=>["STAFF","MANAGER"].includes(r))||actor.facilityId!==item.facilityId)throw new Error("Hồ sơ không thuộc cơ sở phụ trách.");
 if(actor.roles.includes("STAFF")&&item.assignee!==actor.name)throw new Error("Bạn chưa được phân công hồ sơ này.");
 const performedAt=actualVnTime(payload.performedAt,now),day=new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Ho_Chi_Minh"}).format(new Date(performedAt)),days=Math.floor((Date.parse(`${day}T00:00:00Z`)-Date.parse(`${item.endDate}T00:00:00Z`))/86400000),removalDay=Number.isSafeInteger(policy?.removalDay)&&policy.removalDay>=20?policy.removalDay:20;
 if(!Number.isFinite(days)||days<removalDay)throw new Error(`Chưa đến mốc ${removalDay} ngày quá hạn tại thời điểm thực hiện.`);
 if(!payload.inventory?.trim()||!payload.location?.trim())throw new Error("Điền danh sách đồ và vị trí thực tế.");
 if(!["INSPECTION","MAINTENANCE"].includes(payload.unitStatus))throw new Error("Kho cần chờ kiểm tra hoặc bảo trì.");
 if(payload.confirmed!==true)throw new Error("Cần xác nhận nội dung phản ánh đúng việc đã thực hiện.");
 for(const files of [payload.beforePhotos,payload.afterPhotos]) {validateDamageFiles(files);if(!files?.length)throw new Error("Cần ít nhất một ảnh trước và một ảnh sau xử lý.");}
 return performedAt;
}
