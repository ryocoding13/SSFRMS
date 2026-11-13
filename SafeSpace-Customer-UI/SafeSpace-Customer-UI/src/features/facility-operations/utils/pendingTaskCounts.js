import { isReturnSettlementReady } from "../settlements/settlementModel.js";

// Derive badges from the same work queues as each page; never store a second counter.
export function pendingTaskCounts(ops, role, me) {
  const count = (items, test) => (items || []).filter(test).length;
  if (!ops) return {};

  if (role === "STAFF") {
    const counterPayments = count(ops.payments, p => p.status === "PENDING");
    const renewalPayments = count(ops.counter_renewals, r => r.status === "PENDING");
    const cashRefunds = count(ops.cash_refunds, r =>
      ["READY", "REMIND", "APPOINTMENT"].includes(r.status) &&
      (!r.staff_id && !r.staffId || !me?.staff_id || (r.staff_id || r.staffId) === me.staff_id)
    );
    const reconcile = counterPayments + renewalPayments + cashRefunds;

    const verifications = count(ops.verifications, v => v.status === "TODO");
    const handovers = count(ops.handovers, h =>
      h.status === "WAITING" && ops.verifications?.some(v => v.id === h.verification_id && v.status === "DONE")
    );
    const verify = verifications + handovers;

    const scheduledReturns = count(ops.returns, r => r.status === "SCHEDULED");
    const recheckReturns = count(ops.returns, r =>
      ["SELF_CLEAN", "SELF_REPLACE", "SELF_REMEDY", "DISPUTE"].includes(r.deduction_status)
    );
    const returns = scheduledReturns + recheckReturns;

    const tickets = count(ops.tickets, t =>
      ["OPEN", "IN_PROGRESS"].includes(t.status) && (!t.assignee || t.assignee === me?.staff_id)
    );
    const inquiries = count(ops.inquiries, i => i.status === "OPEN");
    const support = tickets + inquiries;

    const overdueRemovals = count(ops.overdue_cases, c =>
      c.status !== "DONE" && (!c.assignee || c.assignee === me?.full_name || c.assignee === me?.staff_id)
    );

    // #7: không còn tab con; số trên mỗi mục navbar = mọi việc hiện trong trang đó (đồ quá hạn nằm ở Kiểm tra trả kho)
    const result = {
      "staff/reconcile": reconcile,
      "staff/verify": verify,
      "staff/return": returns + overdueRemovals,
      "staff/support": support,
    };

    if (renewalPayments > 0 || ops.counter_renewals !== undefined) result["staff/renewal-payments"] = renewalPayments;
    if (cashRefunds > 0 || ops.cash_refunds !== undefined) result["staff/cash-refunds"] = cashRefunds;
    if (recheckReturns > 0) result["staff/recheck"] = recheckReturns;
    if (overdueRemovals > 0 || ops.overdue_cases !== undefined) result["staff/overdue"] = overdueRemovals;
    if (inquiries > 0 || ops.inquiries !== undefined) result["staff/inquiries"] = inquiries;

    return { ...result, staff: reconcile + verify + returns + support + overdueRemovals };
  }

  // MANAGER
  const overdueCases = count(ops.overdue_cases, c => c.status !== "DONE");
  const managerCashRefunds = count(ops.cash_refunds, r => r.status === "WAITING_APPROVAL");
  // Xung đột đặt kho: hệ thống tự đề xuất đổi ô cho khách; quản lý chỉ cần xử lý khi không còn ô tương đương (NONE).
  const unitConflicts = count(ops.unit_conflicts, c => c.status === "OPEN" && c.option === "NONE");
  const depositRefunds = count(ops.deposit_refunds, r => r.status === "PENDING");
  const refunds = count(ops.refunds, r => r.status === "PENDING");

  // #7 (12/11): navbar quản lý = Tổng quan · Danh sách kho · Hợp đồng & quá hạn · Hoàn tiền · Báo cáo.
  // Phân bổ kho / Xung đột đặt kho chỉ còn là thẻ "Cần xử lý" ở Tổng quan khi không bố trí được ô.
  const allocate = count(ops.allocations, a => a.status === "PENDING");
  const contracts = count(ops.contracts, c => c.state === "OVERDUE" || isReturnSettlementReady(ops, c)) + overdueCases;
  const refund = refunds + depositRefunds + managerCashRefunds;

  const result = {
    "manager/contracts": contracts,
    "manager/refund": refund,
  };

  if (overdueCases > 0 || ops.overdue_cases !== undefined) result["manager/overdue"] = overdueCases;
  if (managerCashRefunds > 0 || ops.cash_refunds !== undefined) result["manager/cash-refunds"] = managerCashRefunds;
  if (unitConflicts > 0 || ops.unit_conflicts !== undefined) result["manager/unit-conflicts"] = unitConflicts;
  if (depositRefunds > 0 || ops.deposit_refunds !== undefined) result["manager/deposit-refunds"] = depositRefunds;
  if (refunds > 0 || ops.refunds !== undefined) result["manager/refunds"] = refunds;
  result["manager"] = allocate + unitConflicts;

  return result;
}
