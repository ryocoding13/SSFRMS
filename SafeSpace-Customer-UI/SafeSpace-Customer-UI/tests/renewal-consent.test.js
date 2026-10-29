import test from "node:test";
import assert from "node:assert/strict";
import { submitRenewalWithConsent } from "../src/shared/api/renewalConsentApi.js";
import { createSeedData } from "../src/app/data/appSeed.js";
import { reduce } from "../src/app/state/appReducer.js";
const consent = { version: "2", acceptedAt: "2026-10-27T04:00:00Z", channel: "WEB" };
const client = (policy, response) => {
  const calls = [];
  return { calls, currentRentalPolicy: async () => policy, requestRenewal: async (...args) => { calls.push(args); return response; } };
};
test("không ghi yêu cầu khi thiếu phiên bản, thiếu consent hoặc chính sách đổi", async () => {
  for (const [policy, value] of [[{},consent], [{version:3},consent], [{version:2},null]]) {
    const api = client(policy, {});
    await assert.rejects(submitRenewalWithConsent(api, 7, 3, value));
    assert.equal(api.calls.length, 0);
  }
});
test("gửi đúng bằng chứng; thiếu acknowledgement không được coi đã lưu consent", async () => {
  const api = client({version:2}, {renewalId:10});
  assert.equal((await submitRenewalWithConsent(api,7,3,consent)).acknowledged, false);
  assert.deepEqual(api.calls, [[7,3,consent]]);
  const supported = client({version:2}, {renewalId:10,policyVersion:2,acceptedAt:"2026-10-27T04:00:02Z"});
  assert.equal((await submitRenewalWithConsent(supported,7,3,consent)).acknowledged, true);
});
test("mô phỏng lưu consent và giữ EndDate; hết hạn không gửi thêm", () => {
  const state = createSeedData("2026-09-21"), c = state.contracts[0];
  state.renewals = []; state.returns = [];
  c.end_date = "2027-01-01";
  const action = {type:"REQUEST_RENEWAL",payload:{contract_id:c.contract_id,months:3,policy_consent:consent}};
  const out = reduce(state,action,{now:new Date("2026-10-27T04:00:00Z")});
  assert.equal(out.error,undefined);
  assert.deepEqual(out.state.renewals[0].policy_consent,consent);
  assert.equal(out.state.contracts[0].end_date,c.end_date);
  assert.ok(reduce(state,action,{now:new Date("2027-01-01T04:00:00Z")}).error);
});

test("không xác nhận consent sai phiên bản hoặc thiếu thời điểm server", async () => {
  for (const dto of [{renewalId:10,policyVersion:3,acceptedAt:consent.acceptedAt},{renewalId:10,policyVersion:2},{renewalId:10,policyVersion:2,acceptedAt:"invalid"}]) {
    const api = client({version:2},dto);
    assert.equal((await submitRenewalWithConsent(api,7,3,consent)).acknowledged,false);
    assert.equal(api.calls.length,1);
  }
});
