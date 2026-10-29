import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncidentAction, createIncidentSeed, equivalentUnit, incidentRefund, prepareIncidentAction, selectIncidents } from '../src/features/facility-operations/incidents/incidentModel.js';
import { loadIncidents, normalizeIncident, saveIncidentAction, validateIncidentReceipt } from '../src/features/facility-operations/incidents/incidentApi.js';
const NOW=new Date('2026-10-28T05:30:00Z'),customer={id:101,roles:['CUSTOMER']},manager={id:201,roles:['MANAGER'],facilityId:1};
const bank={bankName:'VCB',accountNumber:'0123456789',accountHolder:'NGUYEN THI MAI'};
const draft=()=>createIncidentSeed(NOW);
const sendPayload={description:'Mái kho thấm nước',affectedAt:'2026-10-27T12:00',confirmed:true,proposal:'TRANSFER',targetUnitId:'unit-b016'};
const act=(items,action,extra={},actor=manager,now=NOW)=>applyIncidentAction(items,action,{id:items[0].id,expectedVersion:items[0].version,...extra},actor,now);
const proposed=()=>act(draft(),'SEND_INCIDENT_PROPOSAL',sendPayload);
const accepted=()=>act(proposed(),'CHOOSE_INCIDENT_OPTION',{choice:'TRANSFER',note:'Chuyển buổi chiều'},customer,new Date(NOW.getTime()-600000));
const terminating=()=>act(proposed(),'CHOOSE_INCIDENT_OPTION',{choice:'TERMINATE',refundBank:bank},customer);
test('khách không thấy nháp/khác owner; manager chỉ thấy đúng cơ sở; staff không xử lý',()=>{
 assert.equal(selectIncidents(draft(),customer,'customer').length,0);assert.equal(selectIncidents(proposed(),customer,'customer').length,1);assert.equal(selectIncidents(draft(),manager,'manager').length,2);
 assert.deepEqual(selectIncidents(draft(),{...manager,facilityId:2},'manager'),[]);assert.deepEqual(selectIncidents(draft(),{roles:['STAFF'],facilityId:1},'manager'),[]);
 assert.throws(()=>act(draft(),'SEND_INCIDENT_PROPOSAL',sendPayload,customer),/quyền/);assert.throws(()=>act(proposed(),'CHOOSE_INCIDENT_OPTION',{choice:'TRANSFER'},manager),/quyền/);
});
test('ghi nhận bắt buộc mô tả, checkbox, giờ VN hợp lệ và không tương lai',()=>{
 for(const patch of [{description:''},{confirmed:false},{affectedAt:'2026-02-30T12:00'},{affectedAt:'2026-10-29T12:00'},{proposal:''}])assert.throws(()=>act(draft(),'SEND_INCIDENT_PROPOSAL',{...sendPayload,...patch}));
 const saved=act(draft(),'SAVE_INCIDENT',sendPayload)[0];assert.equal(saved.status,'DRAFT');assert.equal(saved.affectedAt,'2026-10-27T05:00:00.000Z');assert.equal(saved.version,2);assert.equal(selectIncidents([saved],customer,'customer').length,0);
});
test('ô thay thế cần tương đương, cùng cơ sở, trống và phiên bản hợp lệ',()=>{
 const item=draft()[0],unit=item.candidates[0];assert.equal(equivalentUnit(item,unit),true);
 for(const patch of [{facilityId:2},{sizeM2:15},{type:'CLIMATE'},{id:item.oldUnitId},{status:'OCCUPIED'},{version:0},{status:'RESERVED',reservedFor:'another'}])assert.equal(equivalentUnit(item,{...unit,...patch}),false);
 const items=draft();items[0].candidates[0].status='MAINTENANCE';assert.throws(()=>act(items,'SEND_INCIDENT_PROPOSAL',sendPayload),/Ô thay thế/);
});
test('gửi phương án không đổi kỳ/giá/mã; không sửa sau gửi và chặn version cũ',()=>{
 const input=draft(),out=act(input,'SEND_INCIDENT_PROPOSAL',sendPayload),item=out[0];assert.equal(input[0].status,'DRAFT');assert.equal(item.status,'PROPOSED');assert.equal(item.access.oldUnit,'UNCHANGED');assert.equal(item.currentUnit,'B-015');assert.equal(item.monthlyRate,input[0].monthlyRate);assert.equal(item.endDate,input[0].endDate);assert.equal(item.targetUnit.status,'RESERVED');
 assert.throws(()=>act(out,'SAVE_INCIDENT',sendPayload),/đã gửi/);assert.throws(()=>act(out,'CHOOSE_INCIDENT_OPTION',{expectedVersion:1,choice:'TRANSFER'},customer),/thay đổi/);
});
test('khách tự chọn một lần, chuyển chỉ sang ô đã đề xuất; chưa đổi mã',()=>{
 assert.throws(()=>act(proposed(),'CHOOSE_INCIDENT_OPTION',{},customer),/Chọn phương án/);
 const out=accepted();assert.equal(out[0].status,'TRANSFER_PENDING');assert.equal(out[0].access.oldUnit,'UNCHANGED');assert.equal(out[0].currentUnit,'B-015');assert.throws(()=>act(out,'CHOOSE_INCIDENT_OPTION',{choice:'TERMINATE',refundBank:bank},customer));
 const items=act(draft(),'SEND_INCIDENT_PROPOSAL',{...sendPayload,proposal:'TERMINATE'});assert.throws(()=>act(items,'CHOOSE_INCIDENT_OPTION',{choice:'TRANSFER'},customer),/Chưa có ô/);
});
test('hoàn tất cần khách đồng ý + checklist + thời điểm thực tế sau lựa chọn',()=>{
 assert.throws(()=>act(proposed(),'COMPLETE_INCIDENT_TRANSFER',{confirmed:true,movedAt:'2026-10-28T12:30'}),/chưa đồng ý/);
 assert.throws(()=>act(accepted(),'COMPLETE_INCIDENT_TRANSFER',{movedAt:'2026-10-28T12:30'}),/Xác nhận/);
 assert.throws(()=>act(accepted(),'COMPLETE_INCIDENT_TRANSFER',{confirmed:true,movedAt:'2026-10-28T11:00'}),/sau sự cố/);
 assert.throws(()=>act(accepted(),'COMPLETE_INCIDENT_TRANSFER',{confirmed:true,movedAt:'2026-10-29T12:00'}),/tương lai/);
});
test('hoàn tất chuyển: ô cũ bảo trì, đổi mã đúng lúc, kỳ/giá/cọc giữ nguyên, không thu thêm',()=>{
 const before=accepted(),out=act(before,'COMPLETE_INCIDENT_TRANSFER',{confirmed:true,movedAt:'2026-10-28T12:30'})[0];assert.equal(out.status,'TRANSFERRED');assert.equal(out.currentUnit,'B-016');assert.equal(out.oldUnitStatus,'MAINTENANCE');assert.deepEqual(out.access,{oldUnit:'INVALID',newUnit:'ISSUED'});assert.equal(out.surcharge,0);
 for(const key of ['startDate','endDate','monthlyRate','deposit','contractStatus'])assert.equal(out[key],before[0][key]);assert.equal(before[0].currentUnit,'B-015');assert.throws(()=>act([out],'COMPLETE_INCIDENT_TRANSFER',{confirmed:true,movedAt:'2026-10-28T12:30'}));
});
test('kết thúc yêu cầu ngân hàng chính chủ và dữ liệu đủ; hoàn cả tháng đang thuê, không chia ngày',()=>{
 assert.equal(incidentRefund(proposed()[0]),3450000);assert.equal(incidentRefund({...proposed()[0],unusedRent:0}),2300000);assert.equal(incidentRefund({...proposed()[0],currentMonthRent:undefined}),null);
 for(const refundBank of [{},{...bank,accountNumber:'123'},{...bank,accountHolder:'Người khác'}])assert.throws(()=>act(proposed(),'CHOOSE_INCIDENT_OPTION',{choice:'TERMINATE',refundBank},customer));
 const p=proposed();delete p[0].deposit;assert.throws(()=>act(p,'CHOOSE_INCIDENT_OPTION',{choice:'TERMINATE',refundBank:bank},customer),/dữ liệu/);
 const out=terminating()[0];assert.equal(out.status,'TERMINATION_PENDING');assert.equal(out.contractStatus,'ACTIVE');assert.equal(out.refund,undefined);assert.equal(out.refundBank.accountNumber,bank.accountNumber);
});
test('kết thúc tạo khoản PENDING, không PAID/transaction; mã cũ hết hiệu lực, không xử lý lần hai',()=>{
 assert.throws(()=>act(terminating(),'FINALIZE_INCIDENT_TERMINATION'),/Xác nhận/);
 const out=act(terminating(),'FINALIZE_INCIDENT_TERMINATION',{confirmed:true})[0];assert.equal(out.contractStatus,'ENDED');assert.equal(out.status,'TERMINATED');assert.equal(out.refund.amount,3450000);assert.equal(out.refund.status,'PENDING');assert.equal(out.refund.transactionRef,undefined);assert.equal(out.access.oldUnit,'INVALID');assert.equal(out.oldUnitStatus,'MAINTENANCE');assert.throws(()=>act([out],'FINALIZE_INCIDENT_TERMINATION',{confirmed:true}));
});
test('chặn hợp đồng đã kết thúc/trả kho/quá hạn; ảnh chỉ metadata ở mô phỏng',()=>{
 for(const status of ['ENDED','RETURN_PENDING','OVERDUE']) {const p=draft();p[0].contractStatus=status;assert.throws(()=>act(p,'SAVE_INCIDENT',sendPayload),/đủ điều kiện/);}
 assert.throws(()=>act(draft(),'SAVE_INCIDENT',{...sendPayload,files:[{type:'application/pdf',size:10}]}));
 const out=act(draft(),'SAVE_INCIDENT',{...sendPayload,files:[{name:'anh.jpg',type:'image/jpeg',size:100,secret:'DO-NOT-SAVE'}]});assert.ok(!JSON.stringify(out).includes('DO-NOT-SAVE'));assert.equal(out[0].files[0].fileName,'anh.jpg');
});
test('API thiếu endpoint không fallback; payload không nhận số tiền/owner tự gán',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,body:options.body&&JSON.parse(options.body)});return new Response('{}',{status:404});};
 try {await assert.rejects(loadIncidents('customer'),/chưa hỗ trợ/);await assert.rejects(saveIncidentAction('manager',draft()[0],'SEND_INCIDENT_PROPOSAL',{expectedVersion:1,...sendPayload,ownerId:999,refund:0},manager,NOW),/chưa hỗ trợ/);assert.ok(calls[1].url.endsWith('/api/ops/incidents'));assert.equal(calls[1].body.ownerId,undefined);assert.equal(calls[1].body.refund,undefined);assert.equal(calls[1].body.expectedTargetVersion,1);}finally{globalThis.fetch=original;}
});
test('receipt thiếu/sai trạng thái/owner/version/giá không báo thành công; đúng thì nhận',async()=>{
 const original=globalThis.fetch,item=draft()[0],payload={expectedVersion:1,...sendPayload},result=proposed()[0];
 try{for(const dto of [{},{incident:{...result,ownerId:3}},{incident:{...result,version:1}},{incident:{...result,monthlyRate:1}},{incident:{...result,status:'TRANSFER_PENDING'}}]){globalThis.fetch=async()=>new Response(JSON.stringify(dto));await assert.rejects(saveIncidentAction('manager',item,'SEND_INCIDENT_PROPOSAL',payload,manager,NOW),error=>error.uncertain===true);}
 globalThis.fetch=async()=>new Response(JSON.stringify({incident:result}));assert.equal((await saveIncidentAction('manager',item,'SEND_INCIDENT_PROPOSAL',payload,manager,NOW)).status,'PROPOSED');
 }finally{globalThis.fetch=original;}
});
test('receipt chuyển cần ô/mã/bảo trì và giữ kỳ/giá; kết thúc đúng PENDING/số hoàn',()=>{
 const before=accepted()[0],payload={expectedVersion:before.version,confirmed:true,movedAt:'2026-10-28T12:30'},clean=prepareIncidentAction(before,'COMPLETE_INCIDENT_TRANSFER',payload,manager,NOW),result=act([before],'COMPLETE_INCIDENT_TRANSFER',payload)[0];
 assert.equal(validateIncidentReceipt({incident:result},before,'COMPLETE_INCIDENT_TRANSFER',clean).currentUnit,'B-016');
 for(const patch of [{access:{oldUnit:'UNCHANGED',newUnit:'ISSUED'}},{endDate:'2027-12-01'},{oldUnitStatus:'AVAILABLE'},{surcharge:500}])assert.throws(()=>validateIncidentReceipt({incident:{...result,...patch}},before,'COMPLETE_INCIDENT_TRANSFER',clean));
 const t=terminating()[0],ended=act([t],'FINALIZE_INCIDENT_TERMINATION',{confirmed:true})[0];assert.doesNotThrow(()=>validateIncidentReceipt({incident:ended},t,'FINALIZE_INCIDENT_TERMINATION',{id:t.id,expectedVersion:t.version,confirmed:true}));
 for(const refund of [{...ended.refund,status:'PAID'},{...ended.refund,amount:0}])assert.throws(()=>normalizeIncident({...ended,refund}));
});
test('đổi tài khoản trước POST thì dừng; customer không gọi scope manager',async()=>{
 let called=false;const original=globalThis.fetch;globalThis.fetch=async()=>{called=true;return new Response('{}');};
 try{await assert.rejects(saveIncidentAction('manager',draft()[0],'SEND_INCIDENT_PROPOSAL',{expectedVersion:1,...sendPayload},manager,NOW,()=>false),/tài khoản/);assert.equal(called,false);await assert.rejects(saveIncidentAction('customer',draft()[0],'SEND_INCIDENT_PROPOSAL',{expectedVersion:1,...sendPayload},manager,NOW),/phạm vi/);}finally{globalThis.fetch=original;}
});

test('hai hồ sơ không giữ cùng ô; khách chọn kết thúc giải phóng ô đã giữ',()=>{
 const items=draft();items[1]={...structuredClone(items[0]),id:'SC-second',contractId:'HĐ-second',ownerId:999};
 const sent=act(items,'SEND_INCIDENT_PROPOSAL',sendPayload);assert.equal(sent[1].candidates[0].reservedFor,sent[0].id);
 assert.throws(()=>applyIncidentAction(sent,'SEND_INCIDENT_PROPOSAL',{...sendPayload,id:sent[1].id,expectedVersion:1},manager,NOW),/Ô thay thế/);
 const declined=act(sent,'CHOOSE_INCIDENT_OPTION',{choice:'TERMINATE',refundBank:bank},customer);assert.equal(declined[1].candidates[0].status,'AVAILABLE');assert.equal(declined[1].candidates[0].reservedFor,undefined);
 assert.equal(applyIncidentAction(declined,'SEND_INCIDENT_PROPOSAL',{...sendPayload,id:declined[1].id,expectedVersion:1},manager,NOW)[1].status,'PROPOSED');
});
