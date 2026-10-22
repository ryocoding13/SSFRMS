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
test('eight support topic groups and each access reissue title',()=>{
  assert.equal(Object.values(TICKET_TOPICS).filter(t=>!t.legacy).length,8);
  assert.equal(ticketTitle({topic:'ACCESS',access_request:'PIN'}),'Đặt lại PIN 6 số');
  assert.equal(ticketTitle({topic:'ACCESS',access_request:'QR'}),'Cấp lại mã QR');
  assert.equal(ticketTitle({topic:'ACCESS',access_request:'KEY'}),'Cấp lại chìa khóa vật lý');
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
  ops=reduceOps(ops,{type:'RECORD_KEY_RECEIPT',payload:{id:h.id}},now).state;
  assert.equal(JSON.stringify(ops.units),before);
  const second=reduceOps(ops,{type:'RECORD_KEY_RECEIPT',payload:{id:h.id}},now);
  assert.equal(second.state,ops);
});

test('customer event IDs persist on refresh and replies use server timestamp', async()=>{
  const {customerNotifications}=await import('../src/features/customer/notifications/customerNotifications.js');
  const input={contracts:[{contractId:4,status:'ACTIVE',startDate:'2026-10-22',unitNumber:'K01',activatedAt:'2026-10-22T00:00:00Z',accessUpdatedAt:'2026-10-22T01:00:00Z'}],tickets:[{ticketId:8,title:'Cấp lại QR',responses:[{message:'Đã cấp lại',createdAt:'2026-10-22T01:01:00Z'}]}]};
  const a=customerNotifications(input), b=customerNotifications(input);
  assert.deepEqual(a,b); assert.equal(new Set(a.map(n=>n.id)).size,3);
  assert.equal(a.at(-1).created_at,'2026-10-22T01:01:00Z'); assert.match(a.at(-1).detail,/Đã cấp lại/);
});
