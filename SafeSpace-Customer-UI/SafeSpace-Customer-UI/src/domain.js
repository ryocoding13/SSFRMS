export const money = (n) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(n);
export const today = () => localDate(new Date());
export function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function addDays(date, days) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return localDate(d);
}
export function addMonths(date, months) {
  const d = new Date(`${date}T12:00:00`),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(months));
  d.setDate(
    Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
  );
  return localDate(d);
}
export const dateLabel = (value) =>
  value
    ? new Date(
        value.length === 10 ? `${value}T12:00:00` : value,
      ).toLocaleDateString("vi-VN")
    : "Chưa xác định";
export const dateTimeLabel = (value) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "Chờ cơ sở sắp lịch";
export const statuses = {
  ACTIVE: ["Đang thuê", "green"],
  EXPIRING: ["Sắp hết hạn", "amber"],
  OVERDUE: ["Quá hạn", "red"],
  DRAFT: ["Chờ nhận kho", "blue"],
  RETURN_PENDING: ["Chờ trả kho", "amber"],
  COMPLETED: ["Đã hoàn tất", "gray"],
  PENDING_PAYMENT: ["Chờ phân bổ", "amber"],
  UNIT_ASSIGNED: ["Chờ thanh toán", "amber"],
  CONFIRMED: ["Đã xác nhận", "green"],
  CHECKED_IN: ["Đã nhận kho", "green"],
  CANCELLED: ["Đã hủy", "gray"],
  EXPIRED: ["Hết hạn", "gray"],
  PENDING: ["Chờ xử lý", "amber"],
  PAID: ["Đã thanh toán", "green"],
  FAILED: ["Thất bại", "red"],
  REFUNDED: ["Đã hoàn tiền", "gray"],
  OPEN: ["Mới gửi", "blue"],
  ASSIGNED: ["Đã phân công", "blue"],
  IN_PROGRESS: ["Đang xử lý", "amber"],
  RESOLVED: ["Đã xử lý", "green"],
  CLOSED: ["Đã đóng", "gray"],
  SCHEDULED: ["Đã lên lịch", "blue"],
  VERIFIED: ["Đã kiểm tra", "amber"],
  HANDED_OVER: ["Đã bàn giao", "green"],
  APPROVED: ["Đã duyệt", "green"],
  REJECTED: ["Từ chối", "red"],
};
export const paymentTypes = {
  DEPOSIT: "Tiền đặt cọc",
  RENT: "Phí thuê kho",
  RENEWAL: "Phí gia hạn",
  EXTRA_FEE: "Phí phát sinh",
  OVERDUE_FEE: "Phí quá hạn",
  LOST_KEY_FEE: "Phí cấp lại khóa",
  REFUND: "Hoàn tiền",
};
export const issueTypes = {
  UNIT: "Tình trạng kho",
  LOCK: "Khóa / chìa khóa",
  ACCESS_CODE: "Mã ra vào",
  ACCESS_CARD: "Thẻ ra vào",
  PAYMENT: "Thanh toán",
  STORED_ITEM: "Đồ đạc lưu trữ",
  OTHER: "Vấn đề khác",
};
export function validateBooking(
  { start_date, rental_period_months },
  current = today(),
) {
  const e = {};
  if (
    !start_date ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    Number.isNaN(Date.parse(start_date))
  )
    e.start_date = "Vui lòng chọn ngày bắt đầu.";
  else if (start_date < current)
    e.start_date = "Ngày bắt đầu không được ở quá khứ.";
  if (
    !Number.isInteger(Number(rental_period_months)) ||
    Number(rental_period_months) < 1 ||
    Number(rental_period_months) > 24
  )
    e.rental_period_months = "Chọn số tháng từ 1 đến 24 (giới hạn demo).";
  return e;
}
export const uid = (prefix) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;

// Customer commands only. Production services must authenticate and validate on the server.
export function reduceCustomer(state, action) {
  const { type, payload: p } = action;
  const owned = (id) =>
    state.contracts.find(
      (c) => c.contract_id === id && c.customer_id === state.user.user_id,
    );
  switch (type) {
    case "BOOK": {
      const errors = validateBooking(p);
      if (Object.keys(errors).length) throw Error(Object.values(errors)[0]);
      const rate = state.rates.find(
        (r) =>
          r.facility_id === p.facility_id && r.unit_type_id === p.unit_type_id,
      );
      if (!rate || rate.available < 1)
        throw Error("Loại kho này hiện không còn chỗ.");
      return {
        ...state,
        reservations: [
          {
            ...p,
            customer_id: state.user.user_id,
            status: "PENDING_PAYMENT",
            created_at: new Date().toISOString(),
            expected_end_date: addMonths(p.start_date, p.rental_period_months),
            quoted_monthly_rate: rate.monthly_rate,
            required_deposit: rate.monthly_rate,
            estimated_amount:
              rate.monthly_rate * (Number(p.rental_period_months) + 1),
          },
          ...state.reservations,
        ],
      };
    }
    case "CANCEL_RESERVATION": {
      const r = state.reservations.find((r) => r.reservation_id === p.id);
      if (!r || r.status !== "PENDING_PAYMENT")
        throw Error("Đơn này cần cơ sở hỗ trợ hủy.");
      if (!p.reason?.trim()) throw Error("Vui lòng nhập lý do hủy.");
      return {
        ...state,
        reservations: state.reservations.map((r) =>
          r.reservation_id === p.id
            ? {
                ...r,
                status: "CANCELLED",
                cancellation_reason: p.reason,
                cancelled_at: new Date().toISOString(),
              }
            : r,
        ),
      };
    }
    case "PAYMENT_NOTICE": {
      const pay = state.payments.find((x) => x.payment_id === p.id);
      if (
        !pay ||
        !owned(pay.contract_id) ||
        !["PENDING", "FAILED"].includes(pay.status) ||
        state.paymentNotices[p.id]
      )
        throw Error("Khoản thanh toán không thể gửi lại.");
      if (!["CASH", "BANK_TRANSFER"].includes(p.method))
        throw Error("Phương thức không hợp lệ.");
      return {
        ...state,
        payments: state.payments.map((x) =>
          x.payment_id === p.id
            ? { ...x, status: "PENDING", payment_method: p.method }
            : x,
        ),
        paymentNotices: {
          ...state.paymentNotices,
          [p.id]: { method: p.method, sent_at: new Date().toISOString() },
        },
      };
    }
    case "RENEW": {
      const c = owned(p.contract_id);
      if (!c || !["ACTIVE", "EXPIRING"].includes(c.status))
        throw Error("Hợp đồng chưa thể gia hạn.");
      if (
        state.renewals.some(
          (r) =>
            r.contract_id === c.contract_id &&
            ["PENDING", "APPROVED"].includes(r.status),
        )
      )
        throw Error("Đã có yêu cầu gia hạn đang xử lý.");
      if (!Number.isInteger(p.months) || p.months < 1 || p.months > 24)
        throw Error("Số tháng không hợp lệ.");
      return {
        ...state,
        renewals: [
          {
            renewal_id: uid("GH"),
            contract_id: c.contract_id,
            renewal_period_months: p.months,
            old_end_date: c.end_date,
            new_end_date: addMonths(c.end_date, p.months),
            renewal_amount: p.months * c.agreed_monthly_rate,
            status: "PENDING",
            requested_at: new Date().toISOString(),
          },
          ...state.renewals,
        ],
      };
    }
    case "RETURN": {
      const c = owned(p.contract_id);
      if (!c || !["ACTIVE", "EXPIRING", "OVERDUE"].includes(c.status))
        throw Error("Hợp đồng chưa thể yêu cầu trả kho.");
      if (!p.date || p.date < today() || p.date < c.start_date)
        throw Error("Ngày trả kho không hợp lệ.");
      return {
        ...state,
        contracts: state.contracts.map((x) =>
          x.contract_id === c.contract_id
            ? { ...x, status: "RETURN_PENDING" }
            : x,
        ),
        returnRequests: [
          {
            contract_id: c.contract_id,
            requested_date: p.date,
            notes: p.notes,
            status: "PENDING",
          },
          ...state.returnRequests,
        ],
      };
    }
    case "CONFIRM_HANDOVER": {
      const h = state.handovers.find((h) => h.handover_id === p.id);
      if (
        !h ||
        !owned(h.contract_id) ||
        !["VERIFIED", "HANDED_OVER"].includes(h.status) ||
        !h.staff_confirmed
      )
        throw Error("Nhân viên cần kiểm tra và xác nhận trước.");
      return {
        ...state,
        handovers: state.handovers.map((h) =>
          h.handover_id === p.id ? { ...h, customer_confirmed: true } : h,
        ),
      };
    }
    case "TICKET": {
      const c = owned(p.contract_id);
      if (!c) throw Error("Vui lòng chọn hợp đồng của bạn.");
      if (
        !p.title?.trim() ||
        p.title.length > 150 ||
        !p.description?.trim() ||
        !issueTypes[p.issue_type]
      )
        throw Error("Vui lòng kiểm tra nội dung yêu cầu.");
      return {
        ...state,
        tickets: [
          {
            ...p,
            customer_id: state.user.user_id,
            unit_id: c.unit_id,
            status: "OPEN",
            priority: "NORMAL",
            created_at: new Date().toISOString(),
          },
          ...state.tickets,
        ],
      };
    }
    case "PROFILE":
      return {
        ...state,
        user: { ...state.user, full_name: p.full_name, phone: p.phone },
      };
    default:
      return state;
  }
}
