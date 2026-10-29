import test from 'node:test';
import assert from 'node:assert/strict';
import {canFinalizeReturn,opsMutationCheck,opsReceiptCheck,transferProof,validateInspection,validateKeyReceipt,validateRemoval} from '../src/features/facility-operations/settlements/settlementModel.js';
import {createOpsData} from '../src/features/facility-operations/data/facilityOperationsSeed.js';
import {reduceOps} from '../src/features/facility-operations/state/facilityOperationsReducer.js';
const now=new Date('2026-10-28T05:00:00Z'),proof={transactionRef:'FT-001',transferredAt:'2026-10-28T11:30',confirmed:true};
const item={id:'HC-test',customer:'Nguyễn Thị Mai',amount:1000,status:'PENDING',bankName:'VCB',accountNumber:'0123456789',accountHolder:'NGUYEN THI MAI'};
test('hoàn tiền cần đủ tài khoản chính chủ, số tiền, mã giao dịch, thời gian thực tế và checkbox',()=>{
 assert.equal(transferProof(item,proof,now).transferredAt,'2026-10-28T04:30:00.000Z');
 for(const patch of [{amount:undefined},{amount:0},{amount:-1},{status:'PAID'},{accountHolder:'NGUOI KHAC'},{accountNumber:'123'},{bankName:''}])assert.throws(()=>transferProof({...item,...patch},proof,now));
 for(const patch of [{transactionRef:''},{confirmed:false},{transferredAt:'2026-10-29T10:00'},{transferredAt:'2026-02-30T10:00'}])assert.throws(()=>transferProof(item,{...proof,...patch},now));
});
test('thiếu hồ sơ xác minh hoặc checklist không được nhận chìa khóa; không đổi ô/ngày',()=>{
 const ops=createOpsData('2026-10-28'),h=ops.handovers.find(h=>h.status==='WAITING'),p={id:h.id,identity_checked:true,condition_checked:true,key_delivered:true};
 const v=ops.verifications.find(v=>v.id===h.verification_id);v.status='DONE';assert.doesNotThrow(()=>validateKeyReceipt(ops,p));
 const original=createOpsData("2026-10-28"),verification=original.verifications.find(v=>v.status==="TODO");const verified=reduceOps(original,{type:"VERIFY_CUSTOMER",payload:{id:verification.id,original_valid:true,photo_ok:true,info_ok:true,booking_matched:true}},now);assert.equal(verified.state.verifications.find(v=>v.id===verification.id).status,"DONE");assert.equal(verified.state.verifications.find(v=>v.id===verification.id).doc_last4,undefined);assert.ok(reduceOps(original,{type:"VERIFY_CUSTOMER",payload:{id:verification.id,photo_ok:true,info_ok:true}},now).error);
 const before=JSON.stringify(ops.units);const out=reduceOps(ops,{type:'RECORD_KEY_RECEIPT',payload:p},now);assert.equal(out.error,undefined);assert.equal(JSON.stringify(out.state.units),before);assert.equal(out.state.handovers.find(x=>x.id===h.id).status,'DONE');
 assert.throws(()=>validateKeyReceipt({...ops,verifications:[]},p));assert.throws(()=>validateKeyReceipt(ops,{...p,key_delivered:false}));
});
test('hư hỏng cần ảnh, hạng mục/lý do, vệ sinh cố định và không cho kho cần sửa về trống',()=>{
 const r={status:'SCHEDULED',deposit:1000},report={items:'Trống',walls:'Cửa cong',keys:'Đã nhận',proposal:'Cần bảo trì trước khi cho thuê lại',damage_fee:100,damage_item:'Bản lề',fee_reason:'Bị cong'},file={type:'image/png',size:100};
 assert.doesNotThrow(()=>validateInspection(r,report,[file]));assert.throws(()=>validateInspection(r,report,[]));assert.throws(()=>validateInspection(r,{...report,damage_item:''},[file]));assert.throws(()=>validateInspection(r,{...report,proposal:'Sẵn sàng cho thuê lại'},[file]));assert.throws(()=>validateInspection({...r,status:'SUBMITTED'},report,[file]));
});
test('M07 chặn biên bản thiếu và phản hồi/khắc phục chưa đóng kể cả có marker D32',()=>{
 const c={id:'HĐ-1',state:'RETURNED'},r={contract:'HĐ-1',status:'SUBMITTED'};
 assert.equal(canFinalizeReturn({},c,r),true);assert.equal(canFinalizeReturn({},c,null),false);assert.equal(canFinalizeReturn({},c,{...r,damage_workflow_resolved:false}),false);assert.equal(canFinalizeReturn({damage_cases_pending:[{contractId:'HĐ-1'}]},c,r),false);
 const board={contracts:[c],returns:[r]};assert.throws(()=>opsMutationCheck('CONFIRM_REFUND',{id:c.id},board,'api','MANAGER'),/chưa xác nhận/);
});
test('API chưa hỗ trợ ảnh/bằng chứng hoàn không được gửi dù form hợp lệ',()=>{
 const report={items:'Trống',walls:'Tốt',keys:'Đã nhận',proposal:'Sẵn sàng cho thuê lại',damage_fee:0};
 assert.throws(()=>opsMutationCheck('SUBMIT_RETURN',{id:'TK-1',report,files:[]},{returns:[{id:'TK-1',status:'SCHEDULED',deposit:1000}]},'api','STAFF'),/chưa hỗ trợ/);
 assert.throws(()=>opsMutationCheck('CONFIRM_REFUND',{id:'x'},{},'local','STAFF'),/Vai trò/);
});
test('receipt 200 thiếu board/trạng thái/evidence không báo thành công',()=>{
 assert.throws(()=>opsReceiptCheck('RECORD_KEY_RECEIPT',{id:'BG-1'},{ok:true},null));assert.throws(()=>opsReceiptCheck('RECORD_KEY_RECEIPT',{id:'BG-1'},{ok:true},{handovers:[]}));assert.doesNotThrow(()=>opsReceiptCheck('RECORD_KEY_RECEIPT',{id:'BG-1'},{},{handovers:[{id:'BG-1',status:'DONE',done_at:now.toISOString()}]}));
 assert.throws(()=>opsReceiptCheck('CONFIRM_REFUND',{id:'HĐ-1'},{refund:100,refundStatus:'PAID'},{contracts:[{id:'HĐ-1',state:'CLOSED'}]}));
});
test('M07 local tạo hàng chờ hoàn đúng số tiền, không PAID; chuyển tiền không đổi trạng thái ô',()=>{
 let s=createOpsData('2026-10-28');s=reduceOps(s,{type:'SUBMIT_RETURN',payload:{id:'TK-0098',report:{items:'Trống',walls:'Tốt',keys:'Đã nhận',proposal:'Cần bảo trì trước khi cho thuê lại',damage_fee:0,cleaning_required:true}}},now).state;
 const id=s.returns.find(r=>r.id==='TK-0098').contract;s=reduceOps(s,{type:'CONFIRM_REFUND',payload:{id}},now).state;const r=s.deposit_refunds.find(r=>r.contractId===id);assert.ok(r);assert.equal(r.status,'PENDING');assert.equal(r.transactionRef,undefined);Object.assign(r,{customer:item.customer,bankName:item.bankName,accountHolder:item.accountHolder,accountNumber:item.accountNumber});const units=JSON.stringify(s.units);
 const out=reduceOps(s,{type:'CONFIRM_DEPOSIT_REFUND',payload:{id:r.id,...proof,transferredAt:'2026-10-28T12:00'}},now);assert.equal(out.error,undefined);assert.equal(out.state.deposit_refunds.find(x=>x.id===r.id).status,'PAID');assert.equal(JSON.stringify(out.state.units),units);assert.ok(reduceOps(out.state,{type:'CONFIRM_DEPOSIT_REFUND',payload:{id:r.id,...proof,transferredAt:'2026-10-28T12:00'}},now).error);
});
test('ngày xử lý thực tế phải đủ mốc, đúng cơ sở/phân công, có ảnh trước/sau và xác nhận',()=>{
 const r={status:'ASSIGNED',facilityId:1,assignee:'Long',endDate:'2026-10-08'},a={roles:['STAFF'],name:'Long',facilityId:1},photo={name:'a.png',type:'image/png',size:20},p={inventory:'2 thùng',location:'Khu B',performedAt:'2026-10-28T11:00',unitStatus:'INSPECTION',confirmed:true,beforePhotos:[photo],afterPhotos:[photo]};
 assert.doesNotThrow(()=>validateRemoval(r,p,{rate:10},a,now));assert.throws(()=>validateRemoval(r,{...p,performedAt:'2026-10-27T11:00'},{rate:10},a,now),/mốc 20/);assert.throws(()=>validateRemoval(r,p,{}, {...a,facilityId:2},now));assert.throws(()=>validateRemoval(r,p,{}, {...a,name:'Khác'},now));assert.throws(()=>validateRemoval(r,{...p,beforePhotos:[]},{},a,now));assert.throws(()=>validateRemoval(r,{...p,confirmed:false},{},a,now));
});
