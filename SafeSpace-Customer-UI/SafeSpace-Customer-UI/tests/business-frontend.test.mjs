import test from 'node:test';
import assert from 'node:assert/strict';
import { setToken } from '../src/api/http.js';
import { businessApi } from '../src/api/business.js';
import { homeFor, isBusinessRoles, isOpsRoles } from '../src/lib/roles.js';
import { policyFields, fieldValue, fieldPolicy, policyJobs } from '../src/business/policy-fields.js';
import { activateWithConfirm, replacePolicy } from '../src/business/actions.js';
import { parseCsv, workbookBytes } from '../src/business/export.js';
import { startMockApi } from '../mock/mock-api.mjs';
const field = key => policyFields.find(f => f.key === key);
const day='2026-10-15';
const p=(extra={})=>({policyId:1,policyName:'Mức đặt cọc mặc định',policyType:'DEPOSIT',calculationType:'FIXED',value:1,status:'ACTIVE',facilityId:null,unitTypeId:null,effectiveFrom:'2026-01-01',effectiveTo:null,ruleDescription:'',...extra});
test('new business home preserves every existing role priority',()=>{
 assert.equal(homeFor(['OPERATIONS']),'business');assert.equal(homeFor(['ADMIN','OPERATIONS']),'admin');
 assert.equal(homeFor(['CUSTOMER']),'overview');assert.equal(homeFor(['STAFF']),'staff');assert.equal(homeFor(['MANAGER']),'manager');
 assert.equal(isOpsRoles(['OPERATIONS']),false);assert.equal(isBusinessRoles(['STAFF']),false);
});
test('policy selection excludes scoped, draft, scheduled and expired rows',()=>{
 const global=p();const list=[p({policyId:2,facilityId:5}),p({policyId:3,status:'DRAFT'}),p({policyId:4,effectiveFrom:'2027-01-01'}),p({policyId:5,effectiveTo:'2026-09-01'}),global];
 assert.equal(fieldPolicy(list,field('deposit'),day),global);assert.equal(fieldValue(null,field('inspection')),'');
});
test('8 fields create one job per type/scope; RETURN fields roundtrip in ruleDescription',()=>{
 const drafts={deposit:'1 tháng tiền thuê',refund:'5 ngày',reminder:'7 ngày',renewals:'Không giới hạn',cancel:'Miễn phí trước 48 giờ',inspection:'24 giờ',grace:'3 ngày',overdue:'20.000đ / ngày'};
 const jobs=policyJobs([],drafts,day);assert.equal(jobs.length,5);assert.ok(jobs.every(j=>j.body.ruleDescription));assert.equal(new Set(jobs.map(j=>j.body.policyType)).size,5);
 const ret=jobs.find(j=>j.body.policyType==='RETURN').body;
 assert.equal(fieldValue(ret,field('refund')),'5 ngày');assert.equal(fieldValue(ret,field('inspection')),'24 giờ');
 assert.equal(jobs.find(j=>j.body.policyType==='OVERDUE').body.value,20000);
});
test('money/month semantics and validation prevent ambiguous or fabricated values',()=>{
 assert.equal(policyJobs([p()],{deposit:'1,5 tháng tiền thuê'},day)[0].body.value,1.5);
 assert.equal(policyJobs([p()],{deposit:'500.000đ'},day)[0].body.value,500000);
 assert.throws(()=>policyJobs([p()],{deposit:'500.000đ hoặc 1 tháng tiền thuê'},day));
 assert.throws(()=>policyJobs([],{grace:'3 ngày'},day),/thiết lập/);
 assert.throws(()=>policyJobs([p()],{deposit:'-1'},day));
 assert.throws(()=>policyJobs([p({calculationType:'PERCENTAGE'})],{deposit:'101%'},day));
});
test('editing one RETURN field preserves the other and existing numeric policy semantics',()=>{
 const ret=p({policyType:'RETURN',calculationType:'RULE',ruleDescription:'Hoàn cọc trong 5 ngày làm việc'});
 const next=policyJobs([ret],{inspection:'24 giờ'},day)[0].body;
 assert.equal(fieldValue(next,field('refund')),'Hoàn cọc trong 5 ngày làm việc');assert.equal(fieldValue(next,field('inspection')),'24 giờ');
 const renewal=p({policyType:'RENEWAL',value:7});const job=policyJobs([renewal],{renewals:'Không giới hạn'},day)[0];
 assert.equal(job.body.value,7);assert.equal(job.body.calculationType,'FIXED');
});
test('XLSX is an OOXML ZIP and formula-like strings remain text; multiline CSV parses',()=>{
 const rows=parseCsv('\ufeff"Cơ sở","Ghi chú"\r\n"Nhà Bè","Dòng 1\nDòng ""2"""');assert.equal(rows[1][1],'Dòng 1\nDòng "2"');
 const bytes=workbookBytes([...rows,['=1+1',1000]]);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
 const xml=new TextDecoder().decode(bytes);assert.match(xml,/inlineStr/);assert.ok(!xml.includes('<f>'));assert.match(xml,/<v>1000<\/v>/);
});
test('business API sends the shared JWT and correct query/body; returns 401/403/409',async()=>{
 const old=globalThis.fetch;let got;setToken('jwt-operations');
 try{
  globalThis.fetch=async(url,options)=>{got={url,options};return {ok:true,text:async()=>'[]'};};
  await businessApi.facilities({status:'ACTIVE',search:'quận 7'});assert.match(got.url,/\/api\/operations\/facilities\?status=ACTIVE&search=/);assert.equal(got.options.headers.Authorization,'Bearer jwt-operations');
  await businessApi.createPolicy({policyType:'RETURN'});assert.equal(got.options.method,'POST');assert.equal(JSON.parse(got.options.body).policyType,'RETURN');
  for(const status of [401,403,409]){globalThis.fetch=async()=>({ok:false,status,text:async()=>JSON.stringify({error:'Conflict',details:{conflictingPolicyIds:[3]}})});await assert.rejects(businessApi.policies(),e=>e.status===status&&e.data.details.conflictingPolicyIds[0]===3);}
 }finally{globalThis.fetch=old;setToken(null);}
});
test('strict contract: conflict cancellation never sends replaceExisting; confirmation does',async()=>{
 const {server}=await startMockApi(5151,{business:true});let asked=0;
 try{
  const response=await fetch('http://localhost:5151/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ops01',password:'Ops@123'})});setToken((await response.json()).token);
  const old=(await businessApi.policies()).find(x=>x.policyType==='OVERDUE');
  const job=policyJobs([old],{overdue:'25000'},day)[0];
  assert.equal(await replacePolicy(old,job.body,async()=>{asked++;return false;}),false);
  let active=await businessApi.policies({status:'ACTIVE'});assert.ok(active.some(x=>x.policyId===old.policyId));assert.equal(asked,1);
  const draft=(await businessApi.policies({status:'DRAFT'})).find(x=>x.policyType==='OVERDUE');
  assert.equal(await activateWithConfirm(draft,async()=>true),true);active=await businessApi.policies({status:'ACTIVE'});assert.ok(active.some(x=>x.policyId===draft.policyId));assert.ok(!active.some(x=>x.policyId===old.policyId));
 }finally{setToken(null);server.close();}
});
