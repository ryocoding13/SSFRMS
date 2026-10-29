import test from "node:test";
import assert from "node:assert/strict";
import { recordReservationConsent } from "../src/shared/api/reservationConsentApi.js";
import { requireRentalPolicy, normalizePolicyConsent, hasReservationConsent } from "../src/shared/utils/rentalPolicy.js";
import { defaultRentalPolicy } from "../src/features/facility-operations/workflows/workflowModel.js";
import { createSeedData } from "../src/app/data/appSeed.js";
import { reduce } from "../src/app/state/appReducer.js";
import { composeData, emptyOverlay } from "../src/shared/api/apiMappers.js";
import { api } from "../src/shared/api/customerApi.js";
const policy={...defaultRentalPolicy(),version:2,displayVersion:"10/2026"};
const evidence={consentId:8,customerId:3,policyVersion:2,acceptedAt:"2026-10-28T04:00:00Z",channel:"WEB"};
function client(dto=evidence,current=policy){const calls=[];return {calls,currentRentalPolicy:async()=>current,acceptReservationPolicy:async(...args)=>{calls.push(args);return dto;}};}

test("consent: policy đổi/thiếu nội dung không gửi POST", async()=>{
 for(const current of [{...policy,version:3},{version:2},null]) {
  const c=client(evidence,current);await assert.rejects(recordReservationConsent(c,7,3,2));assert.equal(c.calls.length,0);
 }
});
test("consent: chỉ nhận đúng customer/version/timestamp/channel và consentId server",async()=>{
 const c=client();const saved=await recordReservationConsent(c,7,3,2);
 assert.equal(saved.accepted_at,new Date(evidence.acceptedAt).toISOString());assert.deepEqual(c.calls,[[7,2]]);
 for(const dto of [{...evidence,customerId:9},{...evidence,policyVersion:3},{...evidence,acceptedAt:null},{...evidence,consentId:null},{...evidence,channel:"STAFF"},{...evidence,demo:true}])await assert.rejects(recordReservationConsent(client(dto),7,3,2));
});
test("không dùng policy hiện hành để thay cho version cũ và không giả bằng chứng thiếu",()=>{
 assert.throws(()=>requireRentalPolicy(policy,1));
 assert.equal(normalizePolicyConsent({policyVersion:2}),null);
 assert.equal(hasReservationConsent({policy_consent:evidence},9,2),false);
 assert.equal(hasReservationConsent({policy_consent:evidence},3,1),false);
 assert.equal(hasReservationConsent({policy_consent:evidence},3,2),true);
});
test("demo: bắt buộc checkbox, giữ snapshot bất biến theo phiên bản và tách theo đơn",()=>{
 const state=createSeedData("2026-10-28"),r=state.reservations[0];
 r.status="PENDING_PAYMENT";
 r.expires_at="2026-10-29T04:00:00Z";
 const payload={reservation_id:r.reservation_id,policy_version:2,policy_snapshot:policy};
 const run=p=>reduce(state,{type:"ACCEPT_RESERVATION_POLICY",payload:p},{now:new Date(evidence.acceptedAt)});
 assert.ok(run(payload).error);assert.ok(run({...payload,accepted:true,policy_version:1}).error);
 const out=run({...payload,accepted:true});assert.equal(out.error,undefined);
 assert.equal(out.result.consent.demo,true);assert.equal(out.result.consent.customer_id,state.user.user_id);
 assert.equal(out.state.reservations.find(x=>x.reservation_id===r.reservation_id).policy_consent.version,2);
 assert.deepEqual(out.state.policy_versions[2],policy);assert.notEqual(out.state.policy_versions[2],policy);
 assert.ok(out.state.reservations.filter(x=>x.reservation_id!==r.reservation_id).every(x=>!x.policy_consent));
});
test("mapper: cache acknowledgement chỉ cho đơn, không tự thành policy của hợp đồng",()=>{
 const r={reservationId:7,facilityId:1,unitTypeId:1,unitTypeName:"Kho thường M",startDate:"2026-11-01",expectedEndDate:"2026-12-01",quotedMonthlyRate:1000000,estimatedAmount:1000000,requiredDeposit:1000000,rentalPeriodMonths:1,status:"PENDING_PAYMENT",createdAt:"2026-10-28T03:00:00Z",expiresAt:"2026-10-29T03:00:00Z"};
 const overlay=emptyOverlay();overlay.policyConsents[7]=evidence;
 const out=composeData({catalog:{facilities:[],unitTypes:[]},remote:{reservations:[r],reservationDetails:{},contracts:[],tickets:[]},overlay,session:{user:{userId:3}},timeoutSeconds:600,now:new Date(evidence.acceptedAt)});
 assert.equal(out.reservations[0].policy_consent.version,2);assert.equal(out.contracts.length,0);
});
test("API consent gửi policyVersion số và accepted true, đọc version cụ thể",async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,opts)=>{calls.push({url,body:opts.body&&JSON.parse(opts.body)});return new Response(JSON.stringify(evidence));};
 try {await api.acceptReservationPolicy(7,"2");await api.rentalPolicyVersion(1);assert.deepEqual(calls[0].body,{policyVersion:2,accepted:true});assert.ok(calls[0].url.endsWith("/api/reservations/7/policy-consent"));assert.ok(calls[1].url.endsWith("/api/rental-policy/versions/1"));}finally{globalThis.fetch=original;}
});

test("HTTP mock T20: owner lưu server time, sai version/owner bị từ chối, đọc version đúng",async()=>{
 const {startMockApi}=await import("../mock/mock-api.mjs");
 const {server,state}=await startMockApi(0);
 const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method="GET",body,token)=>{const res=await fetch(base+path,{method,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json()};};
 try {
  const login=await call("/api/auth/login","POST",{username:"customer01",password:"Customer@123"});const token=login.data.token;
  const current=await call("/api/rental-policy");assert.equal(current.status,200);const version=current.data.version;
  const own=state.reservations.find(r=>r.customerId===3);
  assert.equal((await call(`/api/reservations/${own.reservationId}/policy-consent`,"POST",{policyVersion:version+1,accepted:true},token)).status,400);
  assert.equal((await call(`/api/reservations/${own.reservationId}/policy-consent`,"POST",{policyVersion:version,accepted:false},token)).status,400);
  assert.equal((await call(`/api/reservations/99999/policy-consent`,"POST",{policyVersion:version,accepted:true},token)).status,404);
  assert.equal(state.policyConsents.length,0);
  const before=Date.now();const receipt=await call(`/api/reservations/${own.reservationId}/policy-consent`,"POST",{policyVersion:version,accepted:true},token);
  assert.equal(receipt.status,200);assert.equal(receipt.data.customerId,3);assert.equal(receipt.data.channel,"WEB");assert.ok(Date.parse(receipt.data.acceptedAt)>=before);
  assert.equal((await call(`/api/rental-policy/versions/${version}`)).data.version,version);
  assert.equal((await call(`/api/rental-policy/versions/${version+1}`)).status,404);
 } finally {server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
});
