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
import { payableCount, unpaidCount } from "../src/app/state/appSelectors.js";

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
  assert.ok(reduceOps(a.state,{type:"CONFIRM_REFUND",payload:{id:ret.contract}}).error);
  const agreedState = {
    ...a.state,
    returns: a.state.returns.map((r) => (r.id === ret.id ? { ...r, deduction_status: "AGREED", damage_workflow_resolved: true } : r)),
    contracts: a.state.contracts.map((c) => (c.id === ret.contract ? { ...c, state: "RETURNED" } : c)),
  };
  const b=reduceOps(agreedState,{type:"CONFIRM_REFUND",payload:{id:ret.contract}});
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
test("badge staff/reconcile đếm cả đơn đặt chỗ và yêu cầu gia hạn tại quầy pending", () => {
  const ops = {
    payments: [{ status: "PENDING" }],
    counter_renewals: [{ status: "PENDING" }, { status: "PAID" }],
    verifications: [],
    handovers: [],
    returns: [],
    tickets: [],
  };
  assert.equal(pendingTaskCounts(ops, "STAFF", {})["staff/reconcile"], 2);
});

test("badge nhân viên và quản lý hiển thị đúng cho tất cả các tab và subtab theo ca phụ trách", () => {
  const meStaff = { staff_id: "NV-01" };
  const opsStaff = {
    payments: [{ status: "PENDING" }],
    counter_renewals: [{ status: "PENDING" }, { status: "CANCELLED" }],
    cash_refunds: [
      { id: "CH-01", status: "READY", staff_id: "NV-01" },
      { id: "CH-02", status: "REMIND", staff_id: "NV-02" }, // khác nhân viên
      { id: "CH-03", status: "APPOINTMENT", staffId: "NV-01" },
    ],
    verifications: [{ id: "v1", status: "TODO" }, { id: "v2", status: "DONE" }],
    handovers: [{ id: "h1", verification_id: "v2", status: "WAITING" }],
    returns: [
      { id: "TK-01", status: "SCHEDULED" },
      { id: "TK-02", status: "SUBMITTED", deduction_status: "SELF_CLEAN" },
      { id: "TK-03", status: "SUBMITTED", deduction_status: "NONE" },
    ],
    tickets: [
      { id: "T-01", status: "OPEN", assignee: "NV-01" },
      { id: "T-02", status: "OPEN", assignee: "NV-02" },
      { id: "T-03", status: "OPEN", assignee: null },
    ],
    inquiries: [{ id: "TV-01", status: "OPEN" }, { id: "TV-02", status: "CLOSED" }],
    overdue_cases: [{ id: "OD-01", status: "INSPECTION", assignee: "NV-01" }],
  };

  const staffBadges = pendingTaskCounts(opsStaff, "STAFF", meStaff);
  assert.equal(staffBadges["staff/renewal-payments"], 1);
  assert.equal(staffBadges["staff/cash-refunds"], 2); // CH-01 và CH-03
  assert.equal(staffBadges["staff/recheck"], 1); // TK-02
  assert.equal(staffBadges["staff/overdue"], 1);
  assert.equal(staffBadges["staff/inquiries"], 1);
  assert.equal(staffBadges["staff/reconcile"], 4); // 1 payment + 1 renewal + 2 cash refunds
  assert.equal(staffBadges["staff/verify"], 2); // 1 verify + 1 handover
  assert.equal(staffBadges["staff/return"], 2); // 1 scheduled + 1 recheck
  assert.equal(staffBadges["staff/support"], 3); // 2 tickets (NV-01 + null) + 1 inquiry
  assert.equal(staffBadges["staff"], 12); // 4 + 2 + 2 + 3 + 1 overdue

  const opsManager = {
    allocations: [{ status: "PENDING" }],
    assignments: [{ status: "OPEN" }],
    renewals: [{ status: "APPROVED" }],
    contracts: [{ state: "OVERDUE" }],
    refunds: [{ status: "PENDING" }],
    deposit_refunds: [{ status: "PENDING" }],
    cash_refunds: [{ status: "WAITING_APPROVAL" }, { status: "READY" }],
    unit_conflicts: [{ status: "OPEN" }],
    overdue_cases: [{ status: "OPEN" }],
  };

  const mgrBadges = pendingTaskCounts(opsManager, "MANAGER", {});
  assert.equal(mgrBadges["manager/allocate"], 1);
  assert.equal(mgrBadges["manager/assign"], 1);
  assert.equal(mgrBadges["manager/renewals"], undefined);
  assert.equal(mgrBadges["manager/cash-refunds"], 1);
  assert.equal(mgrBadges["manager/deposit-refunds"], 1);
  assert.equal(mgrBadges["manager/unit-conflicts"], 1);
  assert.equal(mgrBadges["manager/overdue"], 1);
  assert.equal(mgrBadges["manager/refunds"], 1);
  assert.equal(mgrBadges["manager/contracts"], 6); // 1 overdue + 1 refund + 1 dep refund + 1 cash waiting + 1 conflict + 1 overdue case
  assert.equal(mgrBadges["manager"], 8); // 1 + 1 + 6
});

test("badge khách hàng: nút Thanh toán & lịch hẹn hiển thị số khoản cần thanh toán", () => {
  const dataWithPayable = {
    ledger: [
      { ref: "TT-0011", kind: "RENEWAL", payable: true, status: "UNPAID", amount: 3000 },
      { ref: "TT-0012", kind: "RENT", payable: false, status: "RECONCILED", amount: 1000 },
      { ref: "LEGACY-FEE", kind: "DAMAGE_FEE", fee: true, payable: true, status: "UNPAID", amount: 999999 },
    ],
    reservations: [{ status: "PENDING_PAYMENT" }, { status: "CONFIRMED" }],
  };
  assert.equal(payableCount(dataWithPayable), 1);
  assert.equal(unpaidCount(dataWithPayable), 1);
  assert.equal(dataWithPayable.reservations.filter((r) => r.status === "PENDING_PAYMENT").length, 1);
});
