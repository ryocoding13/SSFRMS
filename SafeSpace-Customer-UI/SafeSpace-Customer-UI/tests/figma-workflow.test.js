import test from 'node:test';
import assert from 'node:assert/strict';
import { pendingTaskCounts } from '../src/features/facility-operations/utils/pendingTaskCounts.js';
import { createOpsData } from '../src/features/facility-operations/data/facilityOperationsSeed.js';
import { reduceOps } from '../src/features/facility-operations/state/facilityOperationsReducer.js';
import { createSeedData } from '../src/app/data/appSeed.js';
import { reduce } from '../src/app/state/appReducer.js';
import { TICKET_TOPICS, ticketTitle } from '../src/shared/utils/status.js';
const now = new Date('2026-10-22T09:00:00+07:00');

test('staff badges derive from pending work and exclude waiting customers or another assignee', () => {
  const ops = { payments: [{status:'PENDING'}], verifications:[{id:'v',status:'TODO'}], handovers:[{verification_id:'v',status:'WAITING'}], returns:[{status:'SCHEDULED'}], tickets:[{status:'OPEN',assignee:'me'},{status:'WAITING_CUSTOMER',assignee:'me'},{status:'OPEN',assignee:'other'}] };
  assert.deepEqual(pendingTaskCounts(ops,'STAFF',{staff_id:'me'}),{'staff/reconcile':1,'staff/verify':1,'staff/return':1,'staff/support':1,staff:4});
  ops.payments[0].status='CONFIRMED'; ops.verifications[0].status='DONE'; ops.handovers[0].status='DONE'; ops.returns[0].status='SUBMITTED'; ops.tickets[0].status='DONE';
  assert.ok(Object.values(pendingTaskCounts(ops,'STAFF',{staff_id:'me'})).every(n=>n===0));
});
test('manager allocation badge decreases after allocation and reaches zero',()=>{
  let ops=createOpsData("2026-10-22"); const before=pendingTaskCounts(ops,'MANAGER')['manager/allocate'];
  for(const a of ops.allocations.filter(a=>a.status==='PENDING')) a.status='DONE';
  assert.ok(before>0); assert.equal(pendingTaskCounts(ops,'MANAGER')['manager/allocate'],0);
});
// D36/D40 (Thắng chốt 04/11): C12 thêm chủ đề "Nhận chìa khóa · lần đầu nhận kho" → 9 nhóm
test('nine support topic groups incl. key pickup and each access reissue title',()=>{
  assert.equal(Object.values(TICKET_TOPICS).filter(t=>!t.legacy).length,9);
  assert.equal(ticketTitle({topic:'KEY_PICKUP'}),'Nhận chìa khóa · lần đầu nhận kho');
  assert.equal(TICKET_TOPICS.KEY_PICKUP.issueType,'KEY_PICKUP');
  assert.equal(ticketTitle({topic:'ACCESS',access_request:'PIN'}),'Hỗ trợ ra vào kho · Đặt lại PIN 6 số');
  assert.equal(ticketTitle({topic:'ACCESS',access_request:'QR'}),'Hỗ trợ ra vào kho · Cấp lại mã QR');
  assert.equal(ticketTitle({topic:'ACCESS',access_request:'KEY'}),'Hỗ trợ ra vào kho · Cấp lại chìa khóa vật lý');
  assert.equal(ticketTitle({topic:'PAYMENT',option:'VAT'}),'Thanh toán & hóa đơn · Cần hóa đơn VAT');
});
test('other topic requires and preserves a separate custom subject',()=>{
  const state=createSeedData(); const payload={topic:'OTHER',subject:'   ',description:'Nội dung chi tiết'};
  assert.ok(reduce(state,{type:'CREATE_TICKET',payload},{now}).error);
  payload.subject='Cập nhật người liên hệ';
  const out=reduce(state,{type:'CREATE_TICKET',payload},{now});
  assert.equal(out.state.tickets[0].title,payload.subject); assert.equal(out.state.tickets[0].description,payload.description);
  payload.subject='a'.repeat(101); assert.ok(reduce(state,{type:'CREATE_TICKET',payload},{now}).error);
});
test('key receipt is idempotent and never activates a unit',()=>{
  let ops=createOpsData("2026-10-22"); const h=ops.handovers[0]; ops.verifications.find(v=>v.id===h.verification_id).status='DONE';
  const before=JSON.stringify(ops.units);
  ops=reduceOps(ops,{type:'RECORD_KEY_RECEIPT',payload:{id:h.id,identity_checked:true,condition_checked:true,key_delivered:true}},now).state;
  assert.equal(JSON.stringify(ops.units),before);
  const second=reduceOps(ops,{type:'RECORD_KEY_RECEIPT',payload:{id:h.id,identity_checked:true,condition_checked:true,key_delivered:true}},now);
  assert.equal(second.state,ops);
});

test('customer event IDs persist on refresh and replies use server timestamp', async()=>{
  const {customerNotifications}=await import('../src/features/customer/notifications/customerNotifications.js');
  const input={contracts:[{contractId:4,status:'ACTIVE',startDate:'2026-10-22',unitNumber:'K01',activatedAt:'2026-10-22T00:00:00Z',accessUpdatedAt:'2026-10-22T01:00:00Z'}],tickets:[{ticketId:8,title:'Cấp lại QR',responses:[{message:'Đã cấp lại',createdAt:'2026-10-22T01:01:00Z'}]}]};
  const a=customerNotifications(input), b=customerNotifications(input);
  assert.deepEqual(a,b); assert.equal(new Set(a.map(n=>n.id)).size,3);
  assert.equal(a.at(-1).created_at,'2026-10-22T01:01:00Z'); assert.match(a.at(-1).detail,/Đã cấp lại/);
});

test('D41/D45: đề xuất đổi kho hiện trong chuông (không email), ID ổn định, có thông báo tự đổi', async()=>{
  const {customerNotifications}=await import('../src/features/customer/notifications/customerNotifications.js');
  const unitConflicts=[
    {id:'XD-0012',contractId:'HĐ-2026-0151',oldUnit:'K02',startDate:'2026-10-01',detectedAt:'2026-09-26T00:00:00',expiresAt:'2026-09-28T00:00:00',status:'OPEN'},
    {id:'XD-0013',contractId:'HĐ-2026-0152',oldUnit:'K05',proposedUnit:'K06',newUnit:'K06',startDate:'2026-10-02',detectedAt:'2026-09-27T00:00:00',status:'RESOLVED',resolution:'AUTO_SWAP',resolvedAt:'2026-09-29T00:00:00'},
    {id:'XD-0014',contractId:'HĐ-2026-0153',oldUnit:'K07',startDate:'2026-10-03',detectedAt:'2026-09-28T00:00:00',status:'RESOLVED',resolution:'ACCEPT',resolvedAt:'2026-09-29T00:00:00'},
  ];
  const a=customerNotifications({unitConflicts}), b=customerNotifications({unitConflicts});
  assert.deepEqual(a,b);
  assert.deepEqual(a.map(n=>n.id),['SERVER-UNIT-CHANGE-XD-0012','SERVER-UNIT-CHANGE-XD-0013-AUTO']);
  assert.equal(a[0].to,'units/HĐ-2026-0151/unit-change');
  assert.match(a[0].title,/K02 chưa sẵn sàng ngày 01\/10/); assert.match(a[0].detail,/trước 28\/09 · 00:00/);
  assert.equal(a[0].created_at,'2026-09-25T17:00:00.000Z');
  assert.match(a[1].detail,/ô K06/);
  assert.ok(!a.some(n=>/email/i.test(n.title+n.detail)));
});
