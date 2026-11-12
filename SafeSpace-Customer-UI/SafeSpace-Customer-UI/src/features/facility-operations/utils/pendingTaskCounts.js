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

    const result = {
      "staff/reconcile": reconcile,
      "staff/verify": verify,
      "staff/return": returns,
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
  const unitConflicts = count(ops.unit_conflicts, c => c.status === "OPEN");
  const depositRefunds = count(ops.deposit_refunds, r => r.status === "PENDING");
  const refunds = count(ops.refunds, r => r.status === "PENDING");

  const allocate = count(ops.allocations, a => a.status === "PENDING");
  const assign = count(ops.assignments, a => a.status === "OPEN");
  const contracts = count(ops.contracts, c => c.state === "OVERDUE" || isReturnSettlementReady(ops, c)) +
    refunds + depositRefunds + managerCashRefunds + unitConflicts + overdueCases;

  const result = {
    "manager/allocate": allocate,
    "manager/assign": assign,
    "manager/contracts": contracts,
  };

  if (overdueCases > 0 || ops.overdue_cases !== undefined) result["manager/overdue"] = overdueCases;
  if (managerCashRefunds > 0 || ops.cash_refunds !== undefined) result["manager/cash-refunds"] = managerCashRefunds;
  if (unitConflicts > 0 || ops.unit_conflicts !== undefined) result["manager/unit-conflicts"] = unitConflicts;
  if (depositRefunds > 0 || ops.deposit_refunds !== undefined) result["manager/deposit-refunds"] = depositRefunds;
  if (refunds > 0 || ops.refunds !== undefined) result["manager/refunds"] = refunds;
  result["manager"] = allocate + assign + contracts;

  return result;
}
