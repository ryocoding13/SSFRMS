import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDamageAction, createDamageSeed, parseVnDeadline, prepareDamageAction, selectDamageCases, validateDamageFiles } from '../src/features/facility-operations/damage/damageModel.js';
import { loadDamageCases, normalizeDamageCase, saveDamageAction } from '../src/features/facility-operations/damage/damageApi.js';
const NOW=new Date('2026-10-28T03:00:00Z');
const customer={id:101,roles:['CUSTOMER'],name:'Khách'};
const manager={id:9,roles:['MANAGER'],facilityId:1,name:'Quản lý'};
const seed=()=>createDamageSeed(NOW);
const act=(cases,action,payload,actor=customer,now=NOW)=>applyDamageAction(cases,action,{id:cases[0].id,expectedVersion:cases[0].version,...payload},actor,now);
const replied=()=>act(seed(),'RESPOND_DAMAGE',{choice:'REMEDIATE',note:'Đề nghị thay bản lề tương đương.'});
const allowed=()=>act(replied(),'DECIDE_DAMAGE_RESPONSE',{decision:'ALLOW',deadline:'2026-10-29T17:00'},manager);
const reported=()=>act(allowed(),'REPORT_DAMAGE_REMEDIATION',{note:'Đã thay bản lề mới.'});

test('khách chỉ xem/sửa hồ sơ của mình; quản lý chỉ cơ sở phụ trách',()=>{
 const cases=seed();assert.equal(selectDamageCases(cases,customer,'customer').length,2);
 assert.equal(selectDamageCases(cases,{id:3,roles:['CUSTOMER']},'customer').length,1);
 assert.equal(selectDamageCases(cases,{roles:['CUSTOMER']},'customer').length,0);
 assert.equal(selectDamageCases(cases,{...manager,facilityId:2},'manager').length,0);
 for(const actor of [{id:3,roles:['CUSTOMER']},{id:101,roles:['STAFF']}])assert.throws(()=>act(cases,'RESPOND_DAMAGE',{choice:'AGREE'},actor),/quyền/);
 assert.throws(()=>act(replied(),'DECIDE_DAMAGE_RESPONSE',{decision:'REJECT',note:'Có bằng chứng'}, {...manager,facilityId:2}),/quyền/);
 assert.throws(()=>act(replied(),'DECIDE_DAMAGE_RESPONSE',{decision:'REJECT',note:'Có bằng chứng'}, {...manager,roles:['STAFF']}),/quyền/);
});
test('phản hồi bắt buộc phương án, nội dung khi khiếu nại/khắc phục; đồng ý chưa chốt tiền',()=>{
 assert.throws(()=>act(seed(),'RESPOND_DAMAGE',{}),/Chọn/);
 for(const choice of ['REMEDIATE','DISPUTE'])assert.throws(()=>act(seed(),'RESPOND_DAMAGE',{choice}),/nội dung/);
 assert.throws(()=>act(seed(),'RESPOND_DAMAGE',{choice:'AGREE',note:'x'.repeat(1001)}),/1.000/);
 const cases=seed(),original=structuredClone(cases);const result=act(cases,'RESPOND_DAMAGE',{choice:'AGREE'});
 assert.equal(result[0].status,'CUSTOMER_ACCEPTED');assert.equal(result[0].damageDeduction,200000);assert.equal(result[0].settlementStatus,'OPEN');assert.deepEqual(cases,original);
});
test('phiên bản và bước xử lý chặn gửi lặp; hồ sơ chốt không bị sửa',()=>{
 const cases=replied();assert.throws(()=>act(cases,'RESPOND_DAMAGE',{choice:'AGREE'}),/đã có phản hồi/);
 assert.throws(()=>act(cases,'DECIDE_DAMAGE_RESPONSE',{expectedVersion:1,decision:'REJECT',note:'Lý do'},manager),/thay đổi/);
 assert.throws(()=>act([{...cases[0],settlementStatus:'FINALIZED'}],'DECIDE_DAMAGE_RESPONSE',{decision:'REJECT',note:'Lý do'},manager),/đã chốt/);
 assert.throws(()=>act(seed(),'INSPECT_DAMAGE_REMEDIATION',{result:'PASS',note:'Đạt'},manager),/chưa báo/);
});
test('hạn khắc phục dùng giờ Việt Nam, không nhận quá khứ hoặc ngày cuộn sai',()=>{
 assert.equal(parseVnDeadline('2026-10-29T17:00'),'2026-10-29T10:00:00.000Z');
 for(const date of ['2026-02-30T17:00','2026-10-29','bad'])assert.throws(()=>parseVnDeadline(date));
 for(const deadline of ['', '2026-10-28T09:00'])assert.throws(()=>act(replied(),'DECIDE_DAMAGE_RESPONSE',{decision:'ALLOW',deadline},manager));
 const out=allowed()[0];assert.equal(out.status,'REMEDIATION_ALLOWED');assert.equal(out.damageDeduction,200000);assert.equal(out.deadline,'2026-10-29T10:00:00.000Z');
});
test('từ chối phải có lý do và giữ khấu trừ; khách thấy lý do',()=>{
 assert.throws(()=>act(replied(),'DECIDE_DAMAGE_RESPONSE',{decision:'REJECT'},manager),/lý do/);
 const out=act(replied(),'DECIDE_DAMAGE_RESPONSE',{decision:'REJECT',note:'Vật tư đề nghị không tương đương.'},manager)[0];
 assert.equal(out.status,'REJECTED');assert.equal(out.decision.note,'Vật tư đề nghị không tương đương.');assert.equal(out.damageDeduction,200000);
});
test('chỉ báo xong sau khi được phép và trong hạn; không tự hoàn tiền',()=>{
 assert.throws(()=>act(replied(),'REPORT_DAMAGE_REMEDIATION',{note:'Đã xong'}),/chưa cho phép/);
 assert.throws(()=>act(allowed(),'REPORT_DAMAGE_REMEDIATION',{note:'Đã xong'},customer,new Date('2026-10-29T10:00:01Z')),/hết hạn/);
 const bad=allowed();bad[0].deadline='invalid';assert.throws(()=>act(bad,'REPORT_DAMAGE_REMEDIATION',{note:'Đã xong'}),/hết hạn/);
 assert.equal(reported()[0].status,'AWAITING_INSPECTION');assert.equal(reported()[0].damageDeduction,200000);
});
test('đạt bỏ đúng khoản hư hỏng, cap tiền cọc; không đổi trạng thái đối soát/QR/thanh toán',()=>{
 const cases=reported();cases[0].accessIssued=false;cases[0].paymentStatus='PENDING';
 const out=act(cases,'INSPECT_DAMAGE_REMEDIATION',{result:'PASS',note:'Đã kiểm tra thực tế.'},manager);
 assert.equal(out[0].status,'REMEDIATED');assert.equal(out[0].damageDeduction,0);assert.equal(out[0].refundPreview,862500);
 assert.equal(out[0].settlementStatus,'OPEN');assert.equal(out[0].paymentStatus,'PENDING');assert.equal(out[0].accessIssued,false);assert.equal(out[0].damageAmount,200000);
 assert.equal(cases[0].damageDeduction,200000);assert.throws(()=>act(out,'INSPECT_DAMAGE_REMEDIATION',{result:'PASS',note:'Lại'},manager));
 const huge=reported();huge[0].otherDeductions=999999999;assert.equal(act(huge,'INSPECT_DAMAGE_REMEDIATION',{result:'PASS',note:'Đạt'},manager)[0].refundPreview,0);
});
test('chưa đạt cần ghi chú và giữ khấu trừ; không tăng phí',()=>{
 assert.throws(()=>act(reported(),'INSPECT_DAMAGE_REMEDIATION',{result:'FAIL'},manager),/ghi chú/);
 const out=act(reported(),'INSPECT_DAMAGE_REMEDIATION',{result:'FAIL',note:'Cửa vẫn chưa đóng kín.'},manager)[0];assert.equal(out.status,'REMEDIATION_FAILED');assert.equal(out.damageDeduction,200000);assert.equal(out.refundPreview,662500);
});
test('ảnh đính kèm có giới hạn, demo chỉ lưu metadata',()=>{
 assert.doesNotThrow(()=>validateDamageFiles([]));assert.throws(()=>validateDamageFiles(Array(6).fill({})));assert.throws(()=>validateDamageFiles([{type:'application/pdf',size:1}]));assert.throws(()=>validateDamageFiles([{type:'image/png',size:6*1024*1024}]));
 const file={name:'hoa-don.jpg',type:'image/jpeg',size:100,dataBase64:'SHOULD_NOT_PERSIST'};const out=act(seed(),'RESPOND_DAMAGE',{choice:'REMEDIATE',note:'Sẽ thay bản lề.',files:[file]});
 assert.deepEqual(out[0].response.files,[{fileName:'hoa-don.jpg',contentType:'image/jpeg',size:100}]);assert.ok(!JSON.stringify(out).includes('SHOULD_NOT_PERSIST'));
});
test('API không fallback mock khi thiếu endpoint; không gửi owner/tiền do client tự gán',async()=>{
 const saved=globalThis.fetch;const calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,body:options.body&&JSON.parse(options.body)});return new Response(JSON.stringify({error:'missing'}),{status:404});};
 try {await assert.rejects(loadDamageCases('customer'),/chưa hỗ trợ/);await assert.rejects(saveDamageAction('customer',seed()[0],'RESPOND_DAMAGE',{expectedVersion:1,choice:'AGREE',damageAmount:0,ownerId:999},customer,NOW),/chưa hỗ trợ/);
 assert.ok(calls[0].url.endsWith('/api/damage-cases'));assert.deepEqual(calls[1].body,{action:'RESPOND_DAMAGE',id:seed()[0].id,expectedVersion:1,choice:'AGREE',note:''});}finally{globalThis.fetch=saved;}
});
test('API 200 thiếu/sai acknowledgement không được báo thành công',async()=>{
 const original=globalThis.fetch,item=seed()[0],result=act(seed(),'RESPOND_DAMAGE',{choice:'AGREE'})[0];
 try {for(const dto of [{},{case:{...result,id:'other'}},{case:{...result,ownerId:3}},{case:{...result,version:1}},{case:{...result,status:'REJECTED'}}]){globalThis.fetch=async()=>new Response(JSON.stringify(dto));await assert.rejects(saveDamageAction('customer',item,'RESPOND_DAMAGE',{expectedVersion:1,choice:'AGREE'},customer,NOW),error=>error.uncertain===true);}
 globalThis.fetch=async()=>new Response(JSON.stringify({case:result}));assert.equal((await saveDamageAction('customer',item,'RESPOND_DAMAGE',{expectedVersion:1,choice:'AGREE'},customer,NOW)).status,'CUSTOMER_ACCEPTED');
 }finally{globalThis.fetch=original;}
});
test('API kiểm tra đạt phải nhận damageDeduction bằng 0 và đúng scope',async()=>{
 const original=globalThis.fetch,item=reported()[0],result=act(reported(),'INSPECT_DAMAGE_REMEDIATION',{result:'PASS',note:'Đạt'},manager)[0];
 try{globalThis.fetch=async()=>new Response(JSON.stringify({case:{...result,damageDeduction:200000}}));await assert.rejects(saveDamageAction('manager',item,'INSPECT_DAMAGE_REMEDIATION',{expectedVersion:item.version,result:'PASS',note:'Đạt'},manager,NOW),error=>error.uncertain===true);
 await assert.rejects(saveDamageAction('customer',item,'INSPECT_DAMAGE_REMEDIATION',{expectedVersion:item.version,result:'PASS',note:'Đạt'},manager,NOW),/phạm vi/);
 assert.throws(()=>normalizeDamageCase({...item,status:'UNKNOWN'}));
 }finally{globalThis.fetch=original;}
});
