// Dữ liệu vận hành tại cơ sở cho khu Nhân viên (S01–S09) và Quản lý cơ sở (M01–M08).
// Backend chưa có API cho hai vai trò này → dữ liệu khởi tạo ở đây, lưu trong trình duyệt
// (ops/store.jsx). Khi có API, thay từng nhánh trong ops/store.jsx, giữ nguyên hình dạng dữ liệu.
import { addDays, addMonths, today } from "../lib/format.js";

export const OPS_PASSWORD = "SafeSpace@123";
// Tài khoản dùng khi chạy không cần backend (VITE_USE_API=false)
export const OPS_ACCOUNTS = [
  { username: "long.tran", email: "long.tran@safespace.vn", full_name: "Trần Văn Long", role: "STAFF", staff_id: "NV-01" },
  { username: "ha.pham", email: "ha.pham@safespace.vn", full_name: "Phạm Thu Hà", role: "MANAGER" },
];

const FACILITY = { facility_id: 1, name: "SafeSpace Nguyễn Lương Bằng", address: "Số 12 Nguyễn Lương Bằng, Tân Phú, Quận 7" };

export const STAFF = [
  { staff_id: "NV-01", full_name: "Trần Văn Long", shift: "08:00–17:00" },
  { staff_id: "NV-02", full_name: "Nguyễn Minh Tâm", shift: "13:00–22:00" },
  { staff_id: "NV-03", full_name: "Lý Thanh Vy", shift: "06:00–14:00" },
];

// Trạng thái ô kho tại cơ sở (M02)
export const UNIT_STATE = {
  ACTIVE: ["Đang hoạt động", "green"],
  EMPTY: ["Trống", "blue"],
  EXPIRING: ["Sắp hết hạn", "amber"],
  OVERDUE: ["Quá hạn", "red"],
  WAITING_HANDOVER: ["Chờ bàn giao", "blue"],
  INSPECTION: ["Chờ kiểm tra", "gray"],
  MAINTENANCE: ["Bảo trì", "gray"],
};

const at = (iso, time) => `${iso}T${time}:00`;
const ZONES = ["A", "B", "C", "D", "E", "F"];
const SIZES = [6, 8, 10, 12, 15];
const NAMES = [
  "Lê Minh Châu", "Phạm Gia Huy", "Trịnh Thu Trang", "Võ Quốc Việt", "Đặng Mỹ Linh", "Bùi Anh Tuấn", "Hồ Ngọc Hân",
  "Ngô Thành Đạt", "Đỗ Khánh Vy", "Mai Xuân Lộc", "Tạ Minh Khôi", "Lâm Bảo Ngọc", "Châu Gia Kiệt", "Kiều Phương Anh",
];

// 86 ô kho của cơ sở (Figma M01: 86 kho, tỷ lệ lấp đầy 78%)
function createUnits(t) {
  const named = [
    { code: "A-102", tenant: "Nguyễn Thị Mai", area: 12, floor: 1, type: "normal", status: "WAITING_HANDOVER", end: addMonths(addDays(t, 6), 3) },
    { code: "C-208", tenant: "Lê Văn Tùng", area: 8, floor: 2, type: "normal", status: "EXPIRING", end: addDays(t, 14) },
    { code: "A-045", tenant: "Trần Quốc Bảo", area: 15, floor: 1, type: "normal", status: "OVERDUE", end: addDays(t, -3) },
    { code: "D-019", tenant: "Hoàng Thị Lan", area: 10, floor: 1, type: "climate", status: "OVERDUE", end: addDays(t, -3) },
    { code: "E-301", tenant: null, area: 6, floor: 3, type: "normal", status: "EMPTY", end: null },
    { code: "C-012", tenant: "Lê Văn An", area: 10, floor: 1, type: "normal", status: "OVERDUE", end: addDays(t, -4) },
    { code: "B-015", tenant: "Nguyễn Thị Mai", area: 5, floor: 1, type: "climate", status: "EXPIRING", end: addDays(t, 5) },
    { code: "F-077", tenant: "Đỗ Minh Khang", area: 12, floor: 2, type: "normal", status: "EXPIRING", end: addDays(t, 6) },
    { code: "A-108", tenant: null, area: 15, floor: 1, type: "normal", status: "EMPTY", end: null },
    { code: "A-110", tenant: "Phan Quốc Huy", area: 10, floor: 1, type: "normal", status: "WAITING_HANDOVER", end: addMonths(addDays(t, 1), 6) },
    { code: "B-021", tenant: "Đặng Thu Trang", area: 6, floor: 1, type: "climate", status: "WAITING_HANDOVER", end: addMonths(addDays(t, 2), 3) },
    { code: "A-104", tenant: null, area: 12, floor: 1, type: "normal", status: "EMPTY", end: null },
    { code: "A-115", tenant: "Võ Thị Hạnh", area: 12, floor: 1, type: "normal", status: "WAITING_HANDOVER", end: addMonths(t, 3) },
    { code: "B-004", tenant: null, area: 5, floor: 1, type: "climate", status: "EMPTY", end: null },
    { code: "D-006", tenant: null, area: 4, floor: 1, type: "climate", status: "EMPTY", end: null },
  ];
  const taken = new Set(named.map((u) => u.code));
  const out = [...named];
  let i = 0;
  while (out.length < 86) {
    const zone = ZONES[i % ZONES.length];
    const num = 100 + Math.floor(i / ZONES.length) * 7 + (i % 5);
    const code = `${zone}-${String(num).padStart(3, "0")}`;
    i++;
    if (taken.has(code)) continue;
    taken.add(code);
    // ~78% đang có khách; còn lại trống / bảo trì
    const r = (i * 37) % 100;
    const status = r < 70 ? "ACTIVE" : r < 76 ? "EXPIRING" : r < 96 ? "EMPTY" : "MAINTENANCE";
    const rented = status === "ACTIVE" || status === "EXPIRING";
    out.push({
      code,
      tenant: rented ? NAMES[i % NAMES.length] : null,
      area: SIZES[i % SIZES.length],
      floor: Number(num.toString()[0]),
      type: zone === "D" || zone === "B" ? "climate" : "normal",
      status,
      end: rented ? addDays(t, status === "EXPIRING" ? 5 + (i % 20) : 40 + ((i * 11) % 200)) : null,
    });
  }
  return out;
}

export function createOpsData(t = today()) {
  const pickup = addDays(t, 6);
  return {
    version: 1,
    facility: FACILITY,
    staff: STAFF,
    units: createUnits(t),

    // S09 · Đối soát thanh toán (khách báo "Tôi đã chuyển khoản")
    payments: [
      {
        id: "SS-20260914-0142", customer: "Nguyễn Thị Mai", amount: 4600000, method: "Chuyển khoản ngân hàng",
        reported_at: at(t, "09:12"), memo: "SS 20260914 0142 MAI", offer: "Kho thường · 10–20 m²",
        start: pickup, end: addMonths(pickup, 3), pickup: at(pickup, "09:00"), status: "PENDING",
      },
      {
        id: "SS-20260913-0147", customer: "Trương Gia Bảo", amount: 2520000, method: "Chuyển khoản ngân hàng",
        reported_at: at(addDays(t, -1), "20:41"), memo: "SS 20260913 0147 BAO", offer: "Kiểm soát nhiệt độ · 2–5 m²",
        start: addDays(t, 3), end: addMonths(addDays(t, 3), 3), pickup: at(addDays(t, 3), "15:00"), status: "PENDING",
      },
      {
        id: "SS-20260930-0151", customer: "Lý Minh Đức", amount: 2160000, method: "Chuyển khoản ngân hàng",
        reported_at: at(t, "07:55"), memo: "SS 20260930 0151 DUC", offer: "Kho thường · 2–5 m²",
        start: addDays(t, 4), end: addMonths(addDays(t, 4), 3), pickup: at(addDays(t, 4), "10:00"), status: "PENDING",
      },
    ],

    // M05 · Đơn đã đối soát, chờ quản lý phân bổ ô kho
    allocations: [
      {
        id: "SS-20260912-0138", customer: "Hồ Ngọc Hân", type: "normal", offer: "Kho thường · 10–20 m²", min_area: 10, max_area: 20,
        start: addDays(t, 6), end: addMonths(addDays(t, 6), 3), pickup: at(addDays(t, 6), "10:30"), status: "PENDING", unit: null,
      },
    ],

    // S02 · Xác minh khách khi đến nhận kho
    verifications: [
      { id: "XM-0115", reservation_id: "SS-20260908-0115", customer: "Võ Thị Hạnh", unit: "A-115", appointment: at(t, "15:30"), status: "DONE", doc_type: "Căn cước công dân", doc_last4: "4821", verified_at: at(t, "08:40") },
      { id: "XM-0142", reservation_id: "SS-20260914-0142", customer: "Nguyễn Thị Mai", unit: "A-102", appointment: at(pickup, "09:00"), status: "TODO" },
      { id: "XM-0131", reservation_id: "SS-20260910-0131", customer: "Phan Quốc Huy", unit: "A-110", appointment: at(addDays(t, 1), "08:30"), status: "TODO" },
      { id: "XM-0135", reservation_id: "SS-20260911-0135", customer: "Đặng Thu Trang", unit: "B-021", appointment: at(addDays(t, 2), "14:00"), status: "TODO" },
    ],

    // S03 · Bàn giao kho (sau khi xác minh)
    handovers: [
      { id: "BG-0115", verification_id: "XM-0115", unit: "A-115", customer: "Võ Thị Hạnh", status: "WAITING", method: null },
      { id: "BG-0142", verification_id: "XM-0142", unit: "A-102", customer: "Nguyễn Thị Mai", status: "WAITING", method: null },
      { id: "BG-0131", verification_id: "XM-0131", unit: "A-110", customer: "Phan Quốc Huy", status: "WAITING", method: null },
      { id: "BG-0135", verification_id: "XM-0135", unit: "B-021", customer: "Đặng Thu Trang", status: "WAITING", method: null },
    ],

    // S04 · Kiểm tra trả kho
    returns: [
      {
        id: "TK-0098", contract: "HĐ-0098", unit: "C-012", customer: "Lê Văn An", appointment: at(pickup, "10:00"),
        deposit: 1150000, unpaid: 460000, status: "SCHEDULED", report: null,
      },
    ],

    // S05 · Yêu cầu hỗ trợ tại cơ sở
    tickets: [
      {
        id: "HT-0082", unit: "B-015", customer: "Nguyễn Thị Mai", title: "Thẻ ra vào không mở được cổng", created_at: at(t, "09:45"),
        schedule: at(t, "14:00"), status: "OPEN", assignee: null, notes: [],
      },
      {
        id: "HT-0079", unit: "A-045", customer: "Trần Quốc Bảo", title: "Cửa cuốn kho kẹt khi mở", created_at: at(addDays(t, -1), "16:20"),
        schedule: at(addDays(t, 1), "09:00"), status: "IN_PROGRESS", assignee: "NV-01", notes: [],
      },
    ],

    // M03 · Yêu cầu gia hạn chờ duyệt
    renewals: [
      { id: "GH-0208", contract: "HĐ-0088", customer: "Lê Văn Tùng", unit: "C-208", from: addDays(t, 14), to: addMonths(addDays(t, 14), 3), months: 3, requested: at(addDays(t, -1), "10:05"), status: "PENDING" },
      { id: "GH-0077", contract: "HĐ-0077", customer: "Đỗ Minh Khang", unit: "F-077", from: addDays(t, 6), to: addMonths(addDays(t, 6), 3), months: 3, requested: at(addDays(t, -2), "15:40"), status: "PENDING" },
      { id: "GH-0015", contract: "HĐ-2026-0086", customer: "Nguyễn Thị Mai", unit: "B-015", from: addDays(t, 5), to: addMonths(addDays(t, 5), 1), months: 1, requested: at(addDays(t, -2), "08:12"), status: "PENDING" },
      { id: "GH-0120", contract: "HĐ-0120", customer: "Lê Minh Châu", unit: "E-120", from: addDays(t, 9), to: addMonths(addDays(t, 9), 6), months: 6, requested: at(addDays(t, -3), "19:02"), status: "PENDING" },
    ],

    // M07 · Hợp đồng quá hạn / cần xử lý
    contracts: [
      { id: "HĐ-0061", customer: "Trần Quốc Bảo", unit: "A-045", end: addDays(t, -3), due: "Tiền thuê kỳ mới · Chưa thanh toán", amount: 1250000, state: "OVERDUE", reminders: [] },
      { id: "HĐ-0098", customer: "Lê Văn An", unit: "C-012", end: addDays(t, -4), due: "460.000 đ · Chờ đối soát", amount: 460000, state: "OVERDUE", reminders: [] },
      { id: "HĐ-0073", customer: "Hoàng Thị Lan", unit: "D-019", end: addDays(t, -3), due: "Tiền thuê kỳ mới · Chưa thanh toán", amount: 1380000, state: "OVERDUE", reminders: [] },
      { id: "HĐ-0077", customer: "Đỗ Minh Khang", unit: "F-077", end: addDays(t, 6), due: "Yêu cầu gia hạn", amount: 0, state: "RENEWAL", reminders: [] },
    ],

    // M06 · Công việc được phân công
    assignments: [
      { id: "PC-01", title: "Bàn giao A-102 · Nguyễn Thị Mai", when: at(pickup, "09:00"), staff: "NV-01", status: "ACCEPTED", ref: "BG-0142" },
      { id: "PC-02", title: "Kiểm tra trả kho C-012", when: at(pickup, "10:00"), staff: "NV-01", status: "WAITING", ref: "TK-0098" },
      { id: "PC-03", title: "HT-0082 · Lỗi thẻ ra vào", when: at(t, "14:00"), staff: null, status: "OPEN", ref: "HT-0082" },
    ],

    // M04 · Doanh thu 6 tháng gần nhất (triệu đồng) và cơ cấu theo loại kho
    revenue: {
      months: [66.0, 72.7, 69.6, 81.3, 87.0, 92.4].map((value, i) => {
        const m = new Date(`${addMonths(t.slice(0, 8) + "01", i - 5)}T00:00:00`);
        return { label: `Tháng ${m.getMonth() + 1}`, month: m.getMonth() + 1, year: m.getFullYear(), value };
      }),
      by_type: [
        { label: "Kho thường", value: 58.4 },
        { label: "Kiểm soát nhiệt độ", value: 34.0 },
      ],
      as_of: t,
    },

    log: [],
  };
}
