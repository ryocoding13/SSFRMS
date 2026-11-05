import test from "node:test";
import assert from "node:assert/strict";
import { currentRate, RATE_SLOTS, rateTypeFor } from "../src/features/business/pricing/facilityRates.js";
import { validateRegister } from "../src/app/state/appReducer.js";
import { api } from "../src/shared/api/customerApi.js";

test("giá hiện hành lọc đúng cơ sở, loại, khoảng ngày; không lấy giá tương lai/ngừng áp dụng", () => {
  const rate = (rateId,facilityId,unitTypeId,effectiveFrom,extra={}) => ({rateId,facilityId,unitTypeId,effectiveFrom,status:"ACTIVE",...extra});
  const rates=[rate(1,1,1,"2026-01-01"),rate(2,1,1,"2026-10-01"),rate(3,2,1,"2026-10-20"),rate(4,1,2,"2026-10-20"),rate(5,1,1,"2026-11-01"),rate(6,1,1,"2026-10-27",{status:"INACTIVE"}),rate(7,1,1,"2026-10-26",{effectiveTo:"2026-10-27"})];
  assert.equal(currentRate(rates,1,1,"2026-10-28").rateId,2);
  assert.equal(currentRate(rates,999,1,"2026-10-28"),null);
  assert.equal(currentRate(rates,1,1,"2026-10-27").rateId,7);
});
test("bốn loại kho theo diện tích và climateControlled, không theo thứ tự ID", () => {
  const types=[{unitTypeId:20,area:30,climateControlled:true,status:"ACTIVE"},{unitTypeId:11,area:15,climateControlled:false,status:"ACTIVE"},{unitTypeId:14,area:30,climateControlled:false,status:"ACTIVE"},{unitTypeId:18,area:15,climateControlled:true,status:"ACTIVE"}];
  assert.deepEqual(RATE_SLOTS.map(slot=>rateTypeFor(types,slot).unitTypeId),[11,14,18,20]);
  assert.equal(rateTypeFor([{...types[1],status:"INACTIVE"}],RATE_SLOTS[0]),null);
});
test("đăng ký yêu cầu tên đăng nhập riêng; không nhận email hoặc khoảng trắng làm username", () => {
  const form={name:"Nguyễn Mai",email:"mai@example.com",phone:"0912345678",password:"Password@1",confirm:"Password@1"};
  for (const username of ["","a b","a@b.com","a".repeat(51)]) assert.ok(validateRegister({...form,username}).username);
  assert.deepEqual(validateRegister({...form,username:"mainguyen"}),{});
});
test("API gia hạn gửi đúng CreateRenewalRequest của main: policyVersion số và accepted true", async () => {
  const savedFetch=globalThis.fetch, savedStorage=globalThis.localStorage;
  const calls=[];
  globalThis.localStorage={getItem:()=>null};
  globalThis.fetch=async (url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});return new Response(JSON.stringify({renewalId:10,policyVersion:2,acceptedAt:"2026-10-28T03:00:00Z"}),{status:200});};
  try {
    await api.requestRenewal(7,3,{version:"2",acceptedAt:"2026-10-28T02:59:00Z",channel:"WEB"});
    assert.ok(calls[0].url.endsWith("/api/contracts/7/renewals"));
    assert.deepEqual(calls[0].body,{renewalPeriodMonths:3,policyVersion:2,accepted:true});
  } finally {globalThis.fetch=savedFetch;globalThis.localStorage=savedStorage;}
});
