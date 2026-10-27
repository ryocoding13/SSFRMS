import test from "node:test";
import assert from "node:assert/strict";
import { canPayLedger, cleaningFee, returnDeductions, supportsReturnPolicy } from "../src/shared/utils/returnPolicy.js";
import { reduceOps } from "../src/features/facility-operations/state/facilityOperationsReducer.js";
import { createOpsData } from "../src/features/facility-operations/data/facilityOperationsSeed.js";
import { reduce } from "../src/app/state/appReducer.js";
import { createSeedData } from "../src/app/data/appSeed.js";
import { OPS_ACTIONS } from "../src/features/facility-operations/api/facilityOperationsApi.js";
import { composeData } from "../src/shared/api/apiMappers.js";
import { pendingTaskCounts } from "../src/features/facility-operations/utils/pendingTaskCounts.js";

test("D32: phí vượt cọc không tạo nợ, vệ sinh đúng 10%, không cộng khoản nợ legacy", () => {
  assert.equal(cleaningFee(1150000, true), 115000);
  assert.equal(cleaningFee(1150000, false), 0);
  assert.deepEqual(returnDeductions({deposit:100,unpaid:999,report:{damage_fee:120,cleaning_required:true,cleaning_fee:999,overdue_fee:50}}), {owed:180,deduction:100,refund:0,debt:0});
  assert.equal(returnDeductions({deposit:100,unpaid:999,report:{}}).refund,100);
});
test("D32: chặn phí legacy cả QR/quầy, vẫn trả gia hạn", () => {
  for (const kind of ["DAMAGE_FEE","CLEANING_FEE","OVERDUE_FEE"]) {
    assert.equal(canPayLedger({kind,payable:true,status:"UNPAID"}),false);
    const state=createSeedData(); state.ledger=[{kind,ref:"fee",status:"UNPAID",payable:true}];
    const out=reduce(state,{type:"PAYOS_PAID",payload:{ref:"fee"}},{now:new Date()});
    assert.match(out.error.message,/không thu thêm/); assert.equal(out.state,state);
    assert.ok(reduce(state,{type:"CHOOSE_FEE_AT_COUNTER",payload:{refs:["fee"]}},{now:new Date()}).error);
  }
  assert.equal(canPayLedger({kind:"RENEWAL",payable:true,status:"UNPAID"}),true);
  assert.equal(canPayLedger({kind:"RENEWAL",payable:true,status:"RECONCILED"}),false);
  assert.equal(OPS_ACTIONS.CONFIRM_FEE_COLLECTION,undefined);
  assert.equal(OPS_ACTIONS.REVOKE_CREDENTIAL,undefined);
  assert.equal(typeof OPS_ACTIONS.REISSUE_CREDENTIAL,"function");
});
test("D32: kiểm kê tính vệ sinh cố định, chốt chỉ PENDING và giữ kho bảo trì", () => {
  const state=createOpsData(); const ret=state.returns[0];
  const a=reduceOps(state,{type:"SUBMIT_RETURN",payload:{id:ret.id,report:{items:"Trống",walls:"Bẩn",keys:"Đủ",proposal:"Sẵn sàng cho thuê lại",cleaning_required:true,cleaning_fee:999999,damage_fee:0,fee_reason:"Vệ sinh"}}});
  assert.ifError(a.error);
  assert.equal(a.state.returns[0].report.cleaning_fee,Math.round(ret.deposit*.1));
  const b=reduceOps(a.state,{type:"CONFIRM_REFUND",payload:{id:ret.contract}});
  assert.ifError(b.error); assert.equal(b.result.refundStatus,"PENDING");
  assert.equal(b.state.units.find(u=>u.code===ret.unit).status,"MAINTENANCE");
  assert.ok(reduceOps(b.state,{type:"CONFIRM_REFUND",payload:{id:ret.contract}}).error);
});
test("D32: refund PENDING không hiện đã hoàn; PAID mới đã hoàn", () => {
  const remote={reservations:[],reservationDetails:{},tickets:[],contracts:[{contractId:1,unitNumber:"K01",payments:[{paymentId:1,paymentType:"REFUND",amount:100,status:"PENDING"},{paymentId:2,paymentType:"REFUND",amount:100,status:"PAID"},{paymentId:3,paymentType:"DAMAGE_FEE",amount:100,status:"PENDING"}]}]};
  const d=composeData({catalog:{facilities:[],unitTypes:[]},remote,overlay:{},session:{user:{userId:1,fullName:"A"}},timeoutSeconds:600,now:new Date()});
  assert.equal(d.ledger.find(l=>l.api_id===1).status,"REFUND_PENDING");
  assert.equal(d.ledger.find(l=>l.api_id===2).status,"REFUNDED");
  assert.equal(d.ledger.find(l=>l.api_id===3).payable,false);
});
test("D32: không tin capability thiếu/cũ; badge không đếm phí legacy", () => {
  assert.equal(supportsReturnPolicy({}),false);
  assert.equal(supportsReturnPolicy({return_policy_version:"D27"}),false);
  assert.equal(supportsReturnPolicy({return_policy_version:"D32"}),true);
  assert.equal(pendingTaskCounts({fee_collections:[{status:"PENDING"}]},"STAFF",{})["staff/reconcile"],0);
});
