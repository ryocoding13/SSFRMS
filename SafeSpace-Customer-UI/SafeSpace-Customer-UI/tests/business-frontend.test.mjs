import test from 'node:test';
import assert from 'node:assert/strict';
import { setToken } from "../src/shared/api/httpClient.js";
import { businessApi } from "../src/features/business/api/businessApi.js";
import { homeFor, isBusinessRoles, isOpsRoles } from "../src/shared/utils/roles.js";
import {
  policyFields,
  fieldValue,
  fieldRawValue,
  validatePolicyNumber,
  fieldPolicy,
  policyJobs,
  isLegacyRenewal,
  legacyPolicies,
  ENGINE_SECTIONS,
  SYSTEM_ENFORCED_POLICIES,
  GUIDELINE_SECTIONS,
} from "../src/features/business/policies/policyFields.js";
import { activateWithConfirm, replacePolicy } from "../src/features/business/policies/policyActions.js";
import { parseCsv, workbookBytes } from "../src/features/business/reports/reportExport.js";
import { facilityToForm, formToRequest, managerLabel, splitCoordinates } from "../src/features/business/facilities/facilityForm.js";
import { startMockApi } from '../mock/mock-api.mjs';
import { API_URL } from '../src/app/config/api.js';
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
 // Port 0 isolates the test from the developer's API on :5151.
 // Keep the real HTTP client and policy endpoints; route only the test transport.
 const {server,state}=await startMockApi(0,{business:true,ops:false,legacy:false});
 const base=`http://127.0.0.1:${server.address().port}`;
 const realFetch=globalThis.fetch,requests=[];let asked=0;
 try{
  globalThis.fetch=(url,options)=>{
   const target=new URL(url);
   assert.equal(target.origin,new URL(API_URL).origin,'businessApi must use the configured API origin');
   requests.push({method:options?.method||'GET',path:target.pathname,replaceExisting:target.searchParams.get('replaceExisting')});
   return realFetch(`${base}${target.pathname}${target.search}`,options);
  };
  const response=await realFetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ops01',password:'Ops@123'})});
  assert.equal(response.status,200,'mock operations login must succeed');
  const session=await response.json();assert.ok(session.token,'mock login must return a token');setToken(session.token);
  const old=(await businessApi.policies()).find(x=>x.policyType==='OVERDUE');
  assert.ok(old,'isolated mock must return the OVERDUE policy');
  assert.equal(old.policyId,state.policies.find(x=>x.policyType==='OVERDUE')?.policyId);
  const job=policyJobs([old],{overdue:'25000'},old.effectiveFrom)[0];
  assert.equal(await replacePolicy(old,job.body,async()=>{asked++;return false;}),false);
  let active=await businessApi.policies({status:'ACTIVE'});assert.ok(active.some(x=>x.policyId===old.policyId));assert.equal(asked,1);
  const activations=()=>requests.filter(x=>x.method==='POST' && x.path.endsWith('/activate'));
  assert.equal(activations().length,1);assert.equal(activations()[0].replaceExisting,null,'cancel must never send replaceExisting');
  const draft=(await businessApi.policies({status:'DRAFT'})).find(x=>x.policyType==='OVERDUE');
  assert.ok(draft,'cancelled replacement must remain a draft');
  assert.equal(await activateWithConfirm(draft,async()=>true),true);active=await businessApi.policies({status:'ACTIVE'});assert.ok(active.some(x=>x.policyId===draft.policyId));assert.ok(!active.some(x=>x.policyId===old.policyId));
  assert.deepEqual(activations().map(x=>x.replaceExisting),[null,null,'true'],'only the confirmed retry may replace an active policy');
 }finally{
  globalThis.fetch=realFetch;setToken(null);
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
 }
});

test('B05a: toạ độ cơ sở — dán cặp số, bắt buộc đủ hai ô, trong Việt Nam, làm tròn 6 chữ số',()=>{
 assert.deepEqual(splitCoordinates('10.6935, 106.7222'),{latitude:'10.6935',longitude:'106.7222'});
 assert.equal(splitCoordinates('Phú Xuân'),null);
 const base=facilityToForm({facilityId:3,name:'SafeSpace Phú Xuân',address:'Đường Nguyễn Hữu Thọ',contactPhone:null,openingTime:'06:00',closingTime:'22:00',latitude:null,longitude:null});
 assert.equal(base.latitude,'');
 assert.deepEqual(formToRequest(base).body,{name:'SafeSpace Phú Xuân',address:'Đường Nguyễn Hữu Thọ',contactPhone:null,openingTime:'06:00',closingTime:'22:00',status:null,latitude:null,longitude:null});
 assert.ok(formToRequest({...base,latitude:'10.69'}).errors.coords);
 assert.ok(formToRequest({...base,latitude:'106.7222',longitude:'10.6935'}).errors.coords);
 const ok=formToRequest({...base,latitude:'10,69351234',longitude:'106.7222'}).body;
 assert.equal(ok.latitude,10.693512);assert.equal(ok.longitude,106.7222);
 assert.ok(formToRequest({...base,openingTime:'22:00',closingTime:'06:00'}).errors.hours);
});
test('D41 · ngày đệm cho thuê lại (RELET_BUFFER) lưu FIXED số ngày 0–60',()=>{
 const job=policyJobs([],{relet:'3 ngày'},day)[0];
 assert.equal(job.body.policyType,'RELET_BUFFER');assert.equal(job.body.calculationType,'FIXED');assert.equal(job.body.value,3);
 assert.throws(()=>policyJobs([],{relet:'61 ngày'},day),/0 đến 60/);
 assert.equal(fieldValue({calculationType:'FIXED',value:5},field('relet')),'5 ngày');
});

test('3.5 · B04a: tổng hợp hợp đồng, khoản chờ thu, mã hợp đồng và dòng mô tả', async()=>{
 const { summarizeFacilityContracts, facilityContractLine, contractCodeOf } = await import('../src/features/business/reports/facilityReportModel.js');
 const rows=[
  {contractId:102,startDate:'2026-06-01',status:'OVERDUE',outstanding:1150000,overdueCases:1},
  {contractId:86,startDate:'2026-06-25',status:'EXPIRING',outstanding:920000,overdueCases:0},
  {contractId:142,startDate:'2026-09-14',status:'ACTIVE',outstanding:0,overdueCases:0},
  {contractId:50,startDate:'2026-01-01',status:'COMPLETED',outstanding:-5,overdueCases:null},
 ];
 assert.deepEqual(summarizeFacilityContracts(rows),{active:3,overdue:1,pending:2070000,openCases:1});
 assert.deepEqual(summarizeFacilityContracts(null),{active:0,overdue:0,pending:0,openCases:0});
 assert.equal(contractCodeOf(rows[0]),'HĐ-2026-0102');
 const money=v=>`${v} đ`;
 assert.equal(facilityContractLine(rows[0],money),'Khoản chờ thu 1150000 đ · 1 hồ sơ quá hạn đang mở');
 assert.equal(facilityContractLine(rows[2],money),'Không có khoản chờ thu · không có hồ sơ quá hạn');
});

test('3.5 · facilityContracts gọi đúng route BE kèm bộ lọc; máy chủ giả trả danh sách theo cơ sở', async()=>{
 const {server}=await startMockApi(0,{business:true,ops:false,legacy:false});
 const base=`http://127.0.0.1:${server.address().port}`, realFetch=globalThis.fetch, seen=[];
 try{
  globalThis.fetch=(url,options)=>{const t=new URL(url);seen.push(`${t.pathname}${t.search}`);return realFetch(`${base}${t.pathname}${t.search}`,options);};
  const login=await realFetch(`${base}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'ops01',password:'Ops@123'})});
  setToken((await login.json()).token);
  const rows=await businessApi.facilityContracts(1,{status:'ACTIVE',unitTypeId:undefined});
  assert.ok(Array.isArray(rows));
  assert.ok(rows.every(r=>r.status==='ACTIVE' && typeof r.outstanding==='number'));
  assert.equal(seen.at(-1),'/api/operations/reports/facilities/1/contracts?status=ACTIVE');
  await assert.rejects(()=>businessApi.facilityContracts(999999,{}));
 } finally { globalThis.fetch=realFetch; setToken(null); await new Promise(r=>server.close(r)); }
});

test('P0 · chính sách: phân nhóm rõ ràng, bỏ ánh xạ RENEWAL=24 sang 24 ngày thông báo, nhận diện legacy', () => {
 const legacySeed = p({
  policyId: 2,
  policyName: 'Thời gian giữ chỗ đặt trước',
  policyType: 'RENEWAL',
  calculationType: 'FIXED',
  value: 24,
  ruleDescription: 'Đơn đặt chỗ chưa thanh toán sẽ tự động hết hạn sau 24 giờ kể từ lúc tạo',
 });
 assert.ok(isLegacyRenewal(legacySeed));
 assert.equal(legacyPolicies([legacySeed]).length, 1);
 // Không ánh xạ RENEWAL=24 vào field reminder
 assert.equal(fieldPolicy([legacySeed], field('reminder'), day), undefined);
 assert.equal(fieldValue(legacySeed, field('reminder')), '');

 // Renewal thực tế khác 24 giờ vẫn đọc được
 const activeRenewal = p({ policyId: 99, policyType: 'RENEWAL', calculationType: 'FIXED', value: 7, ruleDescription: '' });
 assert.equal(isLegacyRenewal(activeRenewal), false);
 assert.equal(fieldPolicy([activeRenewal], field('reminder'), day), activeRenewal);
 assert.equal(fieldValue(activeRenewal, field('reminder')), '7 ngày');

 // Kiểm tra cấu trúc 3 nhóm phân định
 assert.ok(ENGINE_SECTIONS[0].fields.some(f => f.key === 'deposit'));
 assert.ok(ENGINE_SECTIONS[0].fields.some(f => f.key === 'overdue'));
 assert.ok(ENGINE_SECTIONS[0].fields.some(f => f.key === 'relet'));
 assert.ok(SYSTEM_ENFORCED_POLICIES.some(f => f.key === 'expiring' && f.value.includes('30 ngày')));
 assert.ok(GUIDELINE_SECTIONS[0].fields.some(f => f.key === 'refund'));
});

test('UI Simplification: validatePolicyNumber, fieldRawValue, and numeric pure number support', () => {
 // Validation tỷ lệ quá hạn (overdue): 0.01 - 100, max 2 decimals, nhận dấu phẩy hoặc chấm
 assert.equal(validatePolicyNumber('overdue', '5'), null);
 assert.equal(validatePolicyNumber('overdue', '5,25'), null);
 assert.equal(validatePolicyNumber('overdue', '5.25'), null);
 assert.equal(validatePolicyNumber('overdue', '100'), null);
 assert.equal(validatePolicyNumber('overdue', '0.01'), null);
 assert.ok(validatePolicyNumber('overdue', ''));
 assert.ok(validatePolicyNumber('overdue', '0'));
 assert.ok(validatePolicyNumber('overdue', '-1'));
 assert.ok(validatePolicyNumber('overdue', '100.01'));
 assert.ok(validatePolicyNumber('overdue', '5,255'));
 assert.ok(validatePolicyNumber('overdue', '5 abc'));

 // Validation ngày đệm cho thuê lại (relet): số nguyên 0 - 60
 assert.equal(validatePolicyNumber('relet', '0'), null);
 assert.equal(validatePolicyNumber('relet', '3'), null);
 assert.equal(validatePolicyNumber('relet', '60'), null);
 assert.ok(validatePolicyNumber('relet', ''));
 assert.ok(validatePolicyNumber('relet', '-1'));
 assert.ok(validatePolicyNumber('relet', '61'));
 assert.ok(validatePolicyNumber('relet', '3.5'));
 assert.ok(validatePolicyNumber('relet', '3 ngày'));

 // fieldRawValue: trả về chuỗi thô để nạp vào form
 assert.equal(fieldRawValue(null, field('deposit')), '1 tháng tiền thuê');
 assert.equal(fieldRawValue(p({ value: 5 }), field('overdue')), '5');
 assert.equal(fieldRawValue(p({ value: 3 }), field('relet')), '3');
 assert.equal(fieldRawValue(null, field('overdue')), '');
 assert.equal(fieldRawValue(null, field('relet')), '');

 // policyJobs lưu DEPOSIT_PERCENT_PER_DAY khi nhập số thuần overdue
 const overdueJob = policyJobs([], { overdue: '5,25' }, day)[0];
 assert.equal(overdueJob.body.policyType, 'OVERDUE');
 assert.equal(overdueJob.body.calculationType, 'DEPOSIT_PERCENT_PER_DAY');
 assert.equal(overdueJob.body.value, 5.25);

 const reletZeroJob = policyJobs([], { relet: '0' }, day)[0];
 assert.equal(reletZeroJob.body.policyType, 'RELET_BUFFER');
 assert.equal(reletZeroJob.body.calculationType, 'FIXED');
 assert.equal(reletZeroJob.body.value, 0);
});

test('FM-02 / B05: managerLabel hiển thị đúng họ tên, danh sách managers, Quản lý #ID và Chưa phân công; không trả Chưa có thông tin', () => {
 // 1. Cơ sở có Manager hợp lệ
 assert.equal(managerLabel({ managerName: 'Nguyễn Văn Quản Lý' }), 'Nguyễn Văn Quản Lý');
 assert.equal(managerLabel({ manager_name: 'Trần Thị Trưởng Cơ Sở' }), 'Trần Thị Trưởng Cơ Sở');

 // 2. Cơ sở có danh sách managers
 assert.equal(
  managerLabel({
   managers: [
    { userId: 10, fullName: 'Lê Văn An' },
    { userId: 11, fullName: 'Phạm Thị Bình' },
   ],
  }),
  'Lê Văn An, Phạm Thị Bình'
 );

 // 3. Có phân công nhưng tên rỗng/whitespace, có managerId -> fallback Quản lý #ID
 assert.equal(managerLabel({ managerId: 42, managerName: '   ' }), 'Quản lý #42');
 assert.equal(
  managerLabel({
   managers: [
    { userId: 5, fullName: '' },
    { userId: 8, fullName: 'Vũ Văn Cường' },
   ],
  }),
  'Quản lý #5, Vũ Văn Cường'
 );

 // 4. Cơ sở không có Manager hoặc đối tượng rỗng -> Chưa phân công
 assert.equal(managerLabel(null), 'Chưa phân công');
 assert.equal(managerLabel(undefined), 'Chưa phân công');
 assert.equal(managerLabel({}), 'Chưa phân công');
 assert.equal(managerLabel({ managerName: null, managerId: null }), 'Chưa phân công');
 assert.equal(managerLabel({ managerName: '', managers: [] }), 'Chưa phân công');

 // 5. Tuyệt đối không bao giờ trả về "Chưa có thông tin"
 assert.notEqual(managerLabel({}), 'Chưa có thông tin');
 assert.notEqual(managerLabel({ managerName: null }), 'Chưa có thông tin');
});
