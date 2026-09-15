/**
 * Adapters to map between .NET Core API camelCase DTOs and the UI's domain model.
 */

export function mapFacilityFromApi(f, index = 0) {
  const colors = ["blue", "teal", "indigo"];
  return {
    facility_id: f.facilityId,
    name: f.name,
    area: f.address?.includes("Hà Nội") ? "Hà Nội" : "TP. Hồ Chí Minh",
    address: f.address,
    hours: f.openingTime && f.closingTime ? `${f.openingTime} – ${f.closingTime}` : "08:00 – 20:00",
    phone: f.contactPhone || "028 0000 0000",
    tag: index === 0 ? "Được yêu thích" : "Thuận tiện di chuyển",
    color: colors[index % colors.length],
    status: f.status,
  };
}

export function mapUnitTypeFromApi(t) {
  return {
    unit_type_id: t.unitTypeId,
    name: t.typeName,
    size: Number(t.area || 0),
    dimensions: t.length && t.width && t.height ? `${t.length} × ${t.width} × ${t.height} m` : "Tiêu chuẩn",
    climate: Boolean(t.climateControlled),
    description: t.description || "Không gian lưu trữ tiêu chuẩn, an toàn và sạch sẽ.",
    status: t.status,
  };
}

export function mapRateFromApi(r) {
  return {
    rate_id: r.rateId,
    facility_id: r.facilityId,
    facility_name: r.facilityName,
    unit_type_id: r.unitTypeId,
    unit_type_name: r.unitTypeName,
    monthly_rate: Number(r.monthlyRate || 0),
    available: 5, // Default available slot estimation
  };
}

export function mapReservationFromApi(r) {
  return {
    reservation_id: r.reservationId,
    facility_id: r.facilityId,
    facility_name: r.facilityName,
    unit_type_id: r.unitTypeId,
    unit_type_name: r.unitTypeName,
    start_date: typeof r.startDate === "string" ? r.startDate.slice(0, 10) : r.startDate,
    expected_end_date: typeof r.expectedEndDate === "string" ? r.expectedEndDate.slice(0, 10) : r.expectedEndDate,
    rental_period_months: r.rentalPeriodMonths,
    quoted_monthly_rate: Number(r.quotedMonthlyRate || 0),
    required_deposit: Number(r.requiredDeposit || 0),
    estimated_amount: Number(r.estimatedAmount || 0),
    status: r.status,
    cancellation_reason: r.cancellationReason,
    cancelled_at: r.cancelledAt,
    created_at: r.createdAt,
  };
}

export function mapContractFromApi(c) {
  return {
    contract_id: c.contractId,
    reservation_id: c.reservationId,
    unit_id: c.unitId,
    unit_number: c.unitNumber,
    facility_name: c.facilityName,
    unit_type_name: c.unitTypeName,
    start_date: typeof c.startDate === "string" ? c.startDate.slice(0, 10) : c.startDate,
    end_date: typeof c.endDate === "string" ? c.endDate.slice(0, 10) : c.endDate,
    agreed_monthly_rate: Number(c.agreedMonthlyRate || 0),
    deposit_amount: Number(c.depositAmount || 0),
    status: c.status,
    activated_at: c.activatedAt,
  };
}

export function mapTicketFromApi(t) {
  return {
    ticket_id: t.ticketId,
    contract_id: t.contractId,
    unit_id: t.unitId,
    issue_type: t.issueType,
    title: t.title,
    description: t.description || "",
    priority: t.priority,
    status: t.status,
    created_at: t.createdAt,
    resolved_at: t.resolvedAt,
    closed_at: t.closedAt,
  };
}

export function mapHandoverFromApi(h, contractId) {
  return {
    handover_id: h.handoverId,
    contract_id: contractId,
    scheduled_at: h.scheduledAt,
    status: h.status,
    staff_confirmed: Boolean(h.staffConfirmed),
    customer_confirmed: Boolean(h.customerConfirmed),
    initial_condition: "Kho sạch sẽ, hệ thống khóa và thẻ ra vào hoạt động tốt.",
  };
}

export function mapPaymentFromApi(p) {
  return {
    payment_id: p.paymentId,
    contract_id: p.contractId,
    payment_type: p.paymentType,
    amount: Number(p.amount || 0),
    currency: p.currency || "VND",
    payment_method: p.paymentMethod,
    due_date: p.dueDate ? (typeof p.dueDate === "string" ? p.dueDate.slice(0, 10) : p.dueDate) : null,
    paid_at: p.paidAt,
    status: p.status,
    created_at: p.createdAt,
  };
}
