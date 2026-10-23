// Derive badges from the same work queues as each page; never store a second counter.
export function pendingTaskCounts(ops, role, me) {
  const count = (items, test) => (items || []).filter(test).length;
  if (role === "STAFF") {
    const result = {
      "staff/reconcile": count(ops.payments, p => p.status === "PENDING"),
      "staff/verify": count(ops.verifications, v => v.status === "TODO") + count(ops.handovers, h => h.status === "WAITING" && ops.verifications.some(v => v.id === h.verification_id && v.status === "DONE")),
      "staff/return": count(ops.returns, r => r.status === "SCHEDULED"),
      "staff/support": count(ops.tickets, t => ["OPEN", "IN_PROGRESS"].includes(t.status) && (!t.assignee || t.assignee === me?.staff_id)),
    };
    return { ...result, staff: Object.values(result).reduce((sum, n) => sum + n, 0) };
  }
  return {
    "manager/allocate": count(ops.allocations, a => a.status === "PENDING"),
    "manager/assign": count(ops.assignments, a => a.status === "OPEN"),
    "manager/renewals": count(ops.renewals, r => r.status === "PENDING"),
    "manager/contracts": count(ops.contracts, c => ["OVERDUE", "RETURNED"].includes(c.state)) + count(ops.refunds, r => r.status === "PENDING"),
  };
}
