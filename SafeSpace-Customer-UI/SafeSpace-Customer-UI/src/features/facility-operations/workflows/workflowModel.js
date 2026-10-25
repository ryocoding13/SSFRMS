import { addDays, today } from "../../../shared/utils/format.js";

export const POLICY_SECTIONS = [
  ["payment", "Thanh toán và thời hạn sử dụng", "Hợp đồng và quyền mở kho được cấp sau khi hệ thống xác nhận thanh toán hoặc nhân viên xác nhận đã thu đủ tại quầy. Bạn sử dụng kho từ ngày bắt đầu hợp đồng; kiểm tra ngày bắt đầu, ngày hết hạn và trạng thái thanh toán trong Kho của tôi."],
  ["access", "Hiệu lực QR mở kho", "QR chỉ sử dụng trong thời hạn hợp đồng. QR hết hiệu lực ngay khi hết hạn thuê hoặc khi yêu cầu trả kho được ghi nhận thành công. Chuyển hết đồ trước khi xác nhận trả kho; cần hỗ trợ ra vào sau đó thì liên hệ nhân viên cơ sở."],
  ["renewal", "Gia hạn và thanh toán", "Gửi yêu cầu để cơ sở kiểm tra kỳ thuê tiếp theo. Trong lúc chờ duyệt, ngày hết hạn giữ nguyên. Sau khi duyệt, thanh toán đủ tiền gia hạn qua PayOS hoặc tại quầy để cập nhật kỳ thuê. Không thu lại cọc; yêu cầu bị từ chối hiển thị lý do."],
  ["overdue", "Quá hạn và khấu trừ tiền cọc", "Nếu quá hạn mà chưa trả kho, mỗi ngày trừ 5% giá trị cọc ban đầu, tối đa 100% cọc. Sau 20 ngày cọc còn 0 đ, nhân viên kho đưa đồ của khách ra ngoài. Khách hàng tự chịu trách nhiệm theo chính sách."],
  ["return", "Trả kho, đối soát và hoàn cọc", "Chuyển hết đồ trước khi xác nhận trả kho. Cơ sở kiểm tra kho, nhận lại chìa khóa và lập biên bản. Cọc, khoản chưa thanh toán và phí được đối soát; bạn xem được khấu trừ và số tiền hoàn. Không còn cọc thì số tiền hoàn bằng 0 đ."],
  ["cancellation", "Huỷ đặt chỗ và theo dõi hoàn tiền", "Trước khi huỷ, kiểm tra điều kiện, khoản khấu trừ và tiền hoàn trên đơn. Chờ hoàn là cơ sở chưa ghi nhận hoàn thành chuyển tiền; Đã hoàn là giao dịch đã được xác nhận. Chưa nhận tiền thì liên hệ cơ sở kèm mã đơn/khoản hoàn."],
  ["support", "Theo dõi và liên hệ cơ sở", "Xem ngày hết hạn, lịch sử thanh toán, lịch trừ cọc và tiến độ trả kho trong tài khoản. Bạn có thể gửi hỗ trợ tới cơ sở liên quan, kể cả khi chưa có hợp đồng, để được tư vấn loại kho phù hợp."],
];

// Tỷ lệ khấu trừ mỗi ngày lấy từ chính sách đang hiển thị (OPERATIONS chỉnh được); không ghi cứng ở từng màn
export const policyRate = (policy) => (Number(policy?.rate) > 0 && Number(policy.rate) <= 100 ? Number(policy.rate) : defaultRentalPolicy().rate);

export const defaultRentalPolicy = () => ({ rate: 5, sections: Object.fromEntries(POLICY_SECTIONS.map(([id, , text]) => [id, text])), version: 1 });

export function depositSchedule(deposit, endDate, asOf = today(), rate = 5) {
  const initial = Math.max(0, Number(deposit) || 0);
  const start = Date.parse(`${String(endDate).slice(0, 10)}T00:00:00Z`);
  const stop = Date.parse(`${asOf}T00:00:00Z`);
  const days = Number.isFinite(start) && Number.isFinite(stop) ? Math.max(0, Math.floor((stop - start) / 86400000)) : 0;
  const percentage = Number(rate);
  if (!(percentage > 0 && percentage <= 100)) throw new Error("Mức khấu trừ mỗi ngày phải lớn hơn 0 và không quá 100%.");
  const limitDays = Math.ceil(100 / percentage);
  const rows = Array.from({ length: Math.min(days, limitDays) }, (_, i) => {
    const before = Math.min(initial, Math.round(initial * i * percentage / 100));
    const deducted = Math.min(initial, Math.round(initial * (i + 1) * percentage / 100));
    return { day: i + 1, date: addDays(String(endDate).slice(0, 10), i + 1), amount: deducted - before, balance: initial - deducted };
  });
  const deducted = Math.min(initial, Math.round(initial * days * percentage / 100));
  return { initial, days, deducted, balance: initial - deducted, limitDays, rows };
}

export function createWorkflowSeed() {
  return {
    policy: defaultRentalPolicy(),
    discrepancies: [{ id: "SL-0001", facilityId: 1, customer: "Lê Văn An", reference: "PHI-0098", expected: 150000, actual: 100000, note: "Thực nhận thiếu 50.000 đ; cần kiểm tra giao dịch ngân hàng.", status: "PENDING", createdAt: new Date().toISOString() }],
    overdue: [{ id: "QH-0061", facilityId: 1, contractId: "HĐ-0061", unit: "K03", customer: "Trần Quốc Bảo", deposit: 1150000, endDate: addDays(today(), -20), notes: [], status: "PENDING", assignee: "Trần Văn Long" }],
    depositRefunds: [{ id: "HC-0098", facilityId: 1, ownerId: 3, contractId: "HĐ-0098", unit: "K04", customer: "Nguyễn Văn An", deposit: 1150000, unpaid: 460000, cleaning: 150000, damage: 0, amount: 540000, status: "PENDING", inspectedAt: new Date().toISOString() }],
    counterRenewals: [{ id: "GHQ-0142", facilityId: 1, contractId: "HĐ-0142", unit: "K01", customer: "Nguyễn Văn An", amount: 3450000, months: 3, status: "PENDING" }],
    inquiries: [{ id: "HT-0091", facilityId: 1, ownerId: 3, customer: "Nguyễn Văn An", title: "Tư vấn đặt kho", description: "Tôi muốn biết loại kho phù hợp trước khi đặt chỗ.", status: "OPEN", responses: [], createdAt: new Date().toISOString() }],
  };
}

const requireText = (s, label) => { if (!String(s || "").trim()) throw new Error(`Vui lòng nhập ${label}.`); };
const moneyValue = (v) => { const n = Number(v); if (!Number.isFinite(n) || n < 0) throw new Error("Số tiền không hợp lệ."); return n; };

// Chỉ dành cho chế độ demo được bật rõ; không dùng để ghi nhận giao dịch API thật.
export function applyWorkflowAction(state, action, payload, actor, now = new Date()) {
  const next = structuredClone(state);
  const at = now.toISOString();
  const find = (key) => { const item = next[key].find(x => x.id === payload.id); if (!item) throw new Error("Không tìm thấy hồ sơ."); return item; };
  const allow = (...roles) => { if (!actor.roles.some(r => roles.includes(r))) throw new Error("Bạn không có quyền thực hiện thao tác này."); };
  switch (action) {
    case "REPORT_DISCREPANCY":
      allow("STAFF", "MANAGER"); requireText(payload.reference, "mã khoản thu"); requireText(payload.note, "lý do sai lệch");
      next.discrepancies.unshift({ ...payload, id: `SL-${now.getTime()}`, facilityId: 1, expected: moneyValue(payload.expected), actual: moneyValue(payload.actual), status: "PENDING", createdAt: at }); break;
    case "RESOLVE_DISCREPANCY": {
      allow("MANAGER"); const item = find("discrepancies"); if (item.status !== "PENDING") throw new Error("Báo cáo đã được xử lý. Hãy tải lại danh sách.");
      requireText(payload.note, "kết luận đối soát"); Object.assign(item, { status: "RESOLVED", resolution: payload.note, resolvedAt: at }); break;
    }
    case "ASSIGN_REMOVAL": {
      allow("MANAGER"); const item = find("overdue"); if (item.status === "DONE") throw new Error("Biên bản đã hoàn tất.");
      requireText(payload.assignee, "nhân viên phụ trách"); Object.assign(item, { assignee: payload.assignee, status: "ASSIGNED" }); break;
    }
    case "RECORD_REMOVAL": {
      allow("STAFF", "MANAGER"); const item = find("overdue"); if (item.status === "DONE") throw new Error("Biên bản đã được lưu; không gửi lại.");
      { const d = depositSchedule(item.deposit, item.endDate, undefined, policyRate(state.policy)); if (d.days < d.limitDays) throw new Error(`Chưa đến mốc ${d.limitDays} ngày quá hạn.`); }
      for (const [key, label] of [["inventory", "danh sách và tình trạng đồ"], ["location", "vị trí đưa đồ ra ngoài"], ["performedAt", "thời gian thực hiện"]]) requireText(payload[key], label);
      if (!Number.isFinite(Date.parse(payload.performedAt)) || Date.parse(payload.performedAt) > now.getTime()) throw new Error("Thời gian thực hiện không hợp lệ hoặc ở tương lai.");
      if (!["INSPECTION", "MAINTENANCE"].includes(payload.unitStatus)) throw new Error("Chọn trạng thái kho sau kiểm tra.");
      Object.assign(item, { status: "DONE", record: { ...payload, staff: actor.name, savedAt: at } }); break;
    }
    case "CONFIRM_DEPOSIT_REFUND": {
      allow("MANAGER"); const item = find("depositRefunds"); if (item.status !== "PENDING" || item.amount <= 0) throw new Error("Khoản hoàn không còn chờ xử lý.");
      requireText(payload.transactionRef, "mã giao dịch hoàn tiền"); Object.assign(item, { status: "PAID", transactionRef: payload.transactionRef.trim(), paidAt: at }); break;
    }
    case "COLLECT_RENEWAL": {
      allow("STAFF", "MANAGER"); const item = find("counterRenewals"); if (item.status !== "PENDING") throw new Error("Khoản gia hạn đã được thu. Không thu lần nữa.");
      Object.assign(item, { status: "PAID", paidAt: at }); break;
    }
    case "CREATE_INQUIRY":
      allow("CUSTOMER"); requireText(payload.title, "chủ đề"); requireText(payload.description, "nội dung yêu cầu");
      if (!payload.facilityId) throw new Error("Chọn cơ sở tiếp nhận.");
      next.inquiries.unshift({ ...payload, id: `HT-${now.getTime()}`, ownerId: actor.id, customer: actor.name, status: "OPEN", responses: [], createdAt: at }); break;
    case "REPLY_INQUIRY": {
      const item = find("inquiries"); const customer = actor.roles.includes("CUSTOMER");
      if (customer && String(item.ownerId) !== String(actor.id)) throw new Error("Yêu cầu không thuộc tài khoản của bạn.");
      if (!customer) allow("STAFF", "MANAGER"); if (item.status === "CLOSED") throw new Error("Yêu cầu đã đóng.");
      requireText(payload.note, "nội dung phản hồi"); item.responses.push({ text: payload.note.trim(), at, by: actor.name, customer });
      item.status = customer ? "OPEN" : payload.close ? "CLOSED" : "WAITING_CUSTOMER"; break;
    }
    case "SAVE_RENTAL_POLICY":
      allow("OPERATIONS"); if (!(Number(payload.rate) > 0 && Number(payload.rate) <= 100)) throw new Error("Tỷ lệ phải lớn hơn 0 và không quá 100%.");
      for (const [id, title] of POLICY_SECTIONS) requireText(payload.sections?.[id], title.toLowerCase());
      next.policy = { ...payload, rate: Number(payload.rate), version: (state.policy.version || 0) + 1, updatedAt: at }; break;
    default: throw new Error("Thao tác chưa được hỗ trợ.");
  }
  return next;
}
