// Dữ liệu vận hành tại cơ sở cho khu Nhân viên (S01–S09) và Quản lý cơ sở (M01–M08) khi chạy không backend
// (VITE_USE_API=false) hoặc máy chủ giả lập. Có backend thì dữ liệu lấy từ GET /api/ops/board (ops/api.js);
// hình dạng dữ liệu hai bên giống nhau.
import { addDays, addMonths, today } from "../../../shared/utils/format.js";

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

// 12 ô kho của cơ sở theo D17 (Figma 14/10) — cùng sơ đồ với giao diện khách (src/lib/units.js) và DbSeeder:
// dãy A cỡ M 15 m² (K01–K04 thường, K05–K06 lạnh), dãy B cỡ L 30 m² (K07–K10 thường, K11–K12 lạnh).
const LAYOUT = [
  ["K01", "normal", 15], ["K02", "normal", 15], ["K03", "normal", 15], ["K04", "normal", 15],
  ["K05", "climate", 15], ["K06", "climate", 15],
  ["K07", "normal", 30], ["K08", "normal", 30], ["K09", "normal", 30], ["K10", "normal", 30],
  ["K11", "climate", 30], ["K12", "climate", 30],
];

function createUnits(t) {
  const usage = {
    K01: ["Nguyễn Thị Mai", "WAITING_HANDOVER", addMonths(addDays(t, 6), 3)],
    K02: ["Lê Văn Tùng", "EXPIRING", addDays(t, 14)],
    K03: ["Trần Quốc Bảo", "OVERDUE", addDays(t, -3)],
    K04: ["Lê Văn An", "OVERDUE", addDays(t, -4)],
    K05: ["Võ Thị Hạnh", "WAITING_HANDOVER", addMonths(t, 3)],
    K06: [null, "EMPTY", null],
    K07: ["Đỗ Minh Khang", "EXPIRING", addDays(t, 6)],
    K08: ["Phan Quốc Huy", "WAITING_HANDOVER", addMonths(addDays(t, 1), 6)],
    K09: [null, "EMPTY", null],
    K10: ["Hoàng Thị Lan", "OVERDUE", addDays(t, -3)],
    K11: ["Đặng Thu Trang", "WAITING_HANDOVER", addMonths(addDays(t, 2), 3)],
    K12: ["Nguyễn Thị Mai", "EXPIRING", addDays(t, 5)],
  };
  return LAYOUT.map(([code, type, area]) => {
    const [tenant, status, end] = usage[code];
    return { code, tenant, area, floor: "trệt", type, status, end };
  });
}

export function createOpsData(t = today()) {
  const pickup = addDays(t, 6);
  return {
    version: 1,
    facility: FACILITY,
    staff: STAFF,
    units: createUnits(t),

    // S09 · Thu tiền tại kho (khách chọn "Thanh toán tại cửa hàng" ở C04c)
    payments: [
      {
        id: "SS-20260914-0142", customer: "Nguyễn Thị Mai", amount: 4600000, method: "Tiền mặt / chuyển khoản tại quầy",
        reported_at: at(t, "09:12"), memo: "SS 20260914 0142 MAI", offer: "Kho thường · Cỡ M · 15 m²",
        start: pickup, end: addMonths(pickup, 3), pickup: at(pickup, "09:00"), status: "PENDING",
      },
      {
        id: "SS-20260913-0147", customer: "Trương Gia Bảo", amount: 2520000, method: "Tiền mặt / chuyển khoản tại quầy",
        reported_at: at(addDays(t, -1), "20:41"), memo: "SS 20260913 0147 BAO", offer: "Kho lạnh · Cỡ M · 15 m²",
        start: addDays(t, 3), end: addMonths(addDays(t, 3), 3), pickup: at(addDays(t, 3), "15:00"), status: "PENDING",
      },
      {
        id: "SS-20260930-0151", customer: "Lý Minh Đức", amount: 2160000, method: "Tiền mặt / chuyển khoản tại quầy",
        reported_at: at(t, "07:55"), memo: "SS 20260930 0151 DUC", offer: "Kho thường · Cỡ L · 30 m²",
        start: addDays(t, 4), end: addMonths(addDays(t, 4), 3), pickup: at(addDays(t, 4), "10:00"), status: "PENDING",
      },
    ],

    // M05 · Đơn đã thanh toán, chờ quản lý phân bổ ô kho
    allocations: [
      {
        id: "SS-20260912-0138", customer: "Hồ Ngọc Hân", type: "normal", offer: "Kho thường · Cỡ L · 30 m²", min_area: 30, max_area: 30,
        start: addDays(t, 6), end: addMonths(addDays(t, 6), 3), pickup: at(addDays(t, 6), "10:30"), status: "PENDING", unit: null,
      },
    ],

    // S02 · Xác minh khách khi đến nhận kho
    verifications: [
      { id: "XM-0115", reservation_id: "SS-20260908-0115", customer: "Võ Thị Hạnh", unit: "K05", appointment: at(t, "15:30"), status: "DONE", doc_type: "Căn cước công dân", doc_last4: "4821", verified_at: at(t, "08:40") },
      { id: "XM-0142", reservation_id: "SS-20260914-0142", customer: "Nguyễn Thị Mai", unit: "K01", appointment: at(pickup, "09:00"), status: "TODO" },
      { id: "XM-0131", reservation_id: "SS-20260910-0131", customer: "Phan Quốc Huy", unit: "K08", appointment: at(addDays(t, 1), "08:30"), status: "TODO" },
      { id: "XM-0135", reservation_id: "SS-20260911-0135", customer: "Đặng Thu Trang", unit: "K11", appointment: at(addDays(t, 2), "14:00"), status: "TODO" },
    ],

    // S03 · Bàn giao kho (sau khi xác minh)
    handovers: [
      { id: "BG-0115", verification_id: "XM-0115", unit: "K05", customer: "Võ Thị Hạnh", status: "WAITING", method: null },
      { id: "BG-0142", verification_id: "XM-0142", unit: "K01", customer: "Nguyễn Thị Mai", status: "WAITING", method: null },
      { id: "BG-0131", verification_id: "XM-0131", unit: "K08", customer: "Phan Quốc Huy", status: "WAITING", method: null },
      { id: "BG-0135", verification_id: "XM-0135", unit: "K11", customer: "Đặng Thu Trang", status: "WAITING", method: null },
    ],

    // S04 · Kiểm tra trả kho
    returns: [
      {
        id: "TK-0098", contract: "HĐ-0098", unit: "K04", customer: "Lê Văn An", appointment: at(pickup, "10:00"),
        deposit: 1150000, unpaid: 460000, status: "SCHEDULED", report: null,
      },
    ],

    // S05 · Yêu cầu hỗ trợ tại cơ sở
    tickets: [
      {
        id: "HT-0082", unit: "K12", customer: "Nguyễn Thị Mai", title: "Thẻ ra vào không mở được cổng", created_at: at(t, "09:45"),
        schedule: at(t, "14:00"), status: "OPEN", assignee: null, notes: [],
      },
      {
        id: "HT-0079", unit: "K03", customer: "Trần Quốc Bảo", title: "Cửa cuốn kho kẹt khi mở", created_at: at(addDays(t, -1), "16:20"),
        schedule: at(addDays(t, 1), "09:00"), status: "IN_PROGRESS", assignee: "NV-01", notes: [],
      },
    ],

    // M03 · Yêu cầu gia hạn chờ duyệt
    renewals: [
      { id: "GH-0208", contract: "HĐ-0088", customer: "Lê Văn Tùng", unit: "K02", from: addDays(t, 14), to: addMonths(addDays(t, 14), 3), months: 3, requested: at(addDays(t, -1), "10:05"), status: "PENDING" },
      { id: "GH-0077", contract: "HĐ-0077", customer: "Đỗ Minh Khang", unit: "K07", from: addDays(t, 6), to: addMonths(addDays(t, 6), 3), months: 3, requested: at(addDays(t, -2), "15:40"), status: "PENDING" },
      { id: "GH-0015", contract: "HĐ-2026-0086", customer: "Nguyễn Thị Mai", unit: "K12", from: addDays(t, 5), to: addMonths(addDays(t, 5), 1), months: 1, requested: at(addDays(t, -2), "08:12"), status: "PENDING" },
    ],

    // M07 · Hợp đồng quá hạn / cần xử lý
    contracts: [
      { id: "HĐ-0061", customer: "Trần Quốc Bảo", unit: "K03", end: addDays(t, -3), due: "Tiền thuê kỳ mới · Chưa thanh toán", amount: 1250000, state: "OVERDUE", reminders: [] },
      { id: "HĐ-0098", customer: "Lê Văn An", unit: "K04", end: addDays(t, -4), due: "460.000 đ · Chưa thanh toán", amount: 460000, state: "OVERDUE", reminders: [] },
      { id: "HĐ-0073", customer: "Hoàng Thị Lan", unit: "K10", end: addDays(t, -3), due: "Tiền thuê kỳ mới · Chưa thanh toán", amount: 1380000, state: "OVERDUE", reminders: [] },
      { id: "HĐ-0077", customer: "Đỗ Minh Khang", unit: "K07", end: addDays(t, 6), due: "Yêu cầu gia hạn", amount: 0, state: "RENEWAL", reminders: [] },
    ],

    // S09f / S09b · Phí phát sinh & công nợ khách chọn trả tại quầy (C11fc), nhân viên thu rồi xác nhận
    fee_collections: [
      { id: "PHI-0098", contract: "HĐ-0098", customer: "Lê Văn An", unit: "K04", items: [["Khoản chưa thanh toán", 460000], ["Phí vệ sinh", 150000]], amount: 610000, due: addDays(t, 2), status: "PENDING", requested_at: at(t, "08:20") },
      { id: "PHI-0086", contract: "HĐ-0086", customer: "Nguyễn Thị Mai", unit: "K12", items: [["Phí hư hỏng", 300000], ["Phí vệ sinh", 150000]], amount: 450000, due: addDays(t, 3), status: "PENDING", requested_at: at(t, "09:05") },
    ],

    // M08 · Hoàn tiền đơn khách huỷ trước ngày bắt đầu thuê (D27: phí 10% cọc, hoàn 100% tiền thuê + 90% cọc)
    deposit_refunds:[{id:"HC-0098",facilityId:1,ownerId:3,contractId:"HĐ-0098",unit:"K04",customer:"Nguyễn Văn An",deposit:1150000,overdue:172500,cleaning:115000,damage:200000,amount:662500,status:"PENDING",version:1,bankName:"Ngân hàng mô phỏng",accountNumber:"0000123456",accountHolder:"NGUYEN VAN AN",inspectedAt:at(t,"08:00")}],
    refunds: [
      { id: "SS-20260918-0151", customer: "Nguyễn Hoàng Yến",bankName:"Ngân hàng mô phỏng",accountNumber:"0000123456",accountHolder:"NGUYEN HOANG YEN", cancelled_at: at(addDays(t, -1), "08:40"), rent: 3450000, deposit: 1150000, paid: 4600000, fee: 115000, amount: 4485000, status: "PENDING" },
      { id: "SS-20260916-0149", customer: "Phạm Gia Hân",bankName:"Ngân hàng mô phỏng",accountNumber:"0000654321",accountHolder:"PHAM GIA HAN", cancelled_at: at(addDays(t, -3), "16:15"), rent: 1140000, deposit: 1140000, paid: 2280000, fee: 114000, amount: 2166000, status: "PENDING" },
      { id: "SS-20260905-0121", customer: "Võ Thanh Tùng", cancelled_at: at(addDays(t, -10), "10:05"), rent: 900000, deposit: 900000, paid: 1800000, fee: 0, amount: 1800000, status: "PAID", paid_at: at(addDays(t, -8), "15:20"), transaction_ref: "FT26249001233" },
    ],

    // M06 · Công việc được phân công
    assignments: [
      { id: "PC-01", title: "Bàn giao K01 · Nguyễn Thị Mai", when: at(pickup, "09:00"), staff: "NV-01", status: "ACCEPTED", ref: "BG-0142" },
      { id: "PC-02", title: "Kiểm tra trả kho K04 · Lê Văn An", when: at(pickup, "10:00"), staff: "NV-01", status: "WAITING", ref: "TK-0098" },
      { id: "PC-03", title: "HT-0082 · Lỗi thẻ ra vào", when: at(t, "14:00"), staff: null, status: "OPEN", ref: "HT-0082" },
    ],

    // M04 · Doanh thu thuê và phí 6 tháng gần nhất (triệu đồng) và cơ cấu theo loại kho của tháng này
    revenue: {
      months: [11.2, 12.4, 11.9, 13.1, 14.6, 15.8].map((value, i) => {
        const m = new Date(`${addMonths(t.slice(0, 8) + "01", i - 5)}T00:00:00`);
        return { label: `Tháng ${m.getMonth() + 1}`, month: m.getMonth() + 1, year: m.getFullYear(), value };
      }),
      by_type: [
        { label: "Kho thường", value: 10.6 },
        { label: "Kho lạnh", value: 5.2 },
      ],
      as_of: t,
    },

    log: [],
  };
}
