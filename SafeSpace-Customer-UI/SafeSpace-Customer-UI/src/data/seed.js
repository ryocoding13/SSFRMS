import { addDays, addMonths, today } from "../lib/format.js";

export const SEED_EMAIL = "mai.nguyen@example.com";
export const SEED_PASSWORD = "SafeSpace@123";

// Danh sách 12 cơ sở SafeSpace (tên, giá, khoảng cách theo Figma C02).
const FACILITIES = [
  [1, "SafeSpace Nguyễn Lương Bằng", "Quận 7", 1.2, 1150000, true, "Số 12 Nguyễn Lương Bằng, Tân Phú"],
  [2, "SafeSpace Him Lam", "Quận 7", 2.8, 1050000, true, "Khu dân cư Him Lam, Tân Hưng"],
  [3, "SafeSpace Phú Xuân", "Quận 7", 5.4, 890000, true, "Đường Nguyễn Hữu Thọ, Phú Xuân"],
  [4, "SafeSpace Tân Thuận", "Quận 4", 6.1, 1100000, true, "Đường Huỳnh Tấn Phát, Tân Thuận"],
  [5, "SafeSpace Phú Mỹ Hưng", "Huyện Nhà Bè", 6.8, 1250000, true, "Đường Nguyễn Lương Bằng, Phú Mỹ"],
  [6, "SafeSpace Bình Thạnh", "Quận Bình Thạnh", 8.7, 980000, true, "Đường Nguyễn Xí, Phường 26"],
  [7, "SafeSpace Nhà Bè", "Huyện Nhà Bè", 9.3, 850000, true, "Đường Huỳnh Tấn Phát, Thị trấn Nhà Bè"],
  [8, "SafeSpace Bình Chánh", "Huyện Bình Chánh", 12.4, 790000, false, "Quốc lộ 50, Bình Chánh"],
  [9, "SafeSpace Thủ Đức", "TP. Thủ Đức", 15.2, 920000, false, "Đường Võ Văn Ngân, Linh Chiểu"],
  [10, "SafeSpace Gò Vấp", "Quận Gò Vấp", 16.8, 930000, true, "Đường Quang Trung, Phường 10"],
  [11, "SafeSpace Tân Bình", "Quận Tân Bình", 18.1, 1020000, true, "Đường Cộng Hòa, Phường 13"],
  [12, "SafeSpace Bình Tân", "Quận Bình Tân", 19.5, 820000, false, "Đường Kinh Dương Vương, An Lạc"],
];

export function createFacilities() {
  return FACILITIES.map(([facility_id, name, district, distance_km, base_price, has_climate, street]) => ({
    facility_id,
    name,
    district,
    city: "TP. Hồ Chí Minh",
    address: `${street}, ${district}, TP. Hồ Chí Minh`,
    distance_km,
    base_price,
    has_climate,
    camera: true,
    hours: "06:00–22:00",
  }));
}

const at = (iso, time) => `${iso}T${time}:00`;

export function createSeedData(t = today()) {
  const b015End = addDays(t, 5);
  const b015Start = addMonths(b015End, -3);
  const a102End = addMonths(t, 3);
  return {
    user: {
      user_id: 101,
      full_name: "Nguyễn Thị Mai",
      email: SEED_EMAIL,
      phone: "0901234142",
      password: SEED_PASSWORD, // kho dữ liệu cục bộ; khi nối backend, mật khẩu chỉ nằm ở server
    },
    facilities: createFacilities(),
    reservations: [
      {
        reservation_id: "SS-20260914-0142",
        facility_id: 1,
        type: "normal",
        band: "M",
        months: 3,
        start_date: t,
        end_date: a102End,
        monthly_rate: 1150000,
        deposit: 1150000,
        rent_total: 3450000,
        initial_total: 4600000,
        status: "PENDING_VERIFICATION",
        created_at: at(addDays(t, -6), "09:12"),
      },
      {
        reservation_id: "SS-20260615-0086",
        facility_id: 1,
        type: "climate",
        band: "S",
        months: 3,
        start_date: b015Start,
        end_date: b015End,
        monthly_rate: 500000,
        deposit: 500000,
        rent_total: 1500000,
        initial_total: 2000000,
        status: "CHECKED_IN",
        created_at: at(addDays(b015Start, -2), "14:30"),
      },
    ],
    contracts: [
      {
        contract_id: "HĐ-2026-0142",
        reservation_id: "SS-20260914-0142",
        facility_id: 1,
        unit_number: "A-102",
        type: "normal",
        band: "M",
        size_m2: 12,
        location: "Tầng 1 · Dãy A",
        months: 3,
        start_date: t,
        end_date: a102End,
        monthly_rate: 1150000,
        deposit: 1150000,
        status: "ACTIVE",
        handed_over: false,
      },
      {
        contract_id: "HĐ-2026-0086",
        reservation_id: "SS-20260615-0086",
        facility_id: 1,
        unit_number: "B-015",
        type: "climate",
        band: "S",
        size_m2: 5,
        location: "Tầng 1 · Dãy B",
        months: 3,
        start_date: b015Start,
        end_date: b015End,
        monthly_rate: 500000,
        deposit: 500000,
        status: "EXPIRING",
        handed_over: true,
      },
    ],
    ledger: [
      {
        ref: "SS-0142-RENT",
        label: "Thuê kho · 3 tháng",
        contract_id: "HĐ-2026-0142",
        reservation_id: "SS-20260914-0142",
        amount: 3450000,
        status: "RECONCILED",
      },
      {
        ref: "SS-0142-DEP",
        label: "Cọc hợp đồng",
        contract_id: "HĐ-2026-0142",
        reservation_id: "SS-20260914-0142",
        amount: 1150000,
        status: "DEPOSIT_HELD",
      },
      {
        ref: "SS-0086-RENT",
        label: "Thuê kho B-015 · 3 tháng",
        contract_id: "HĐ-2026-0086",
        reservation_id: "SS-20260615-0086",
        amount: 1500000,
        status: "RECONCILED",
      },
      {
        ref: "SS-0086-DEP",
        label: "Cọc hợp đồng B-015",
        contract_id: "HĐ-2026-0086",
        reservation_id: "SS-20260615-0086",
        amount: 500000,
        status: "DEPOSIT_HELD",
      },
    ],
    appointments: [
      {
        appointment_id: "LH-0142",
        kind: "CHECK_IN",
        contract_id: "HĐ-2026-0142",
        reservation_id: "SS-20260914-0142",
        facility_id: 1,
        unit_number: "A-102",
        date: addDays(t, 1),
        slot: "09:00–09:30",
        status: "CONFIRMED",
        note: "Mang giấy đăng ký và mã đặt chỗ. Nhân viên xác minh, hướng dẫn và bàn giao kho.",
      },
    ],
    renewals: [],
    returns: [],
    tickets: [
      {
        ticket_id: "HT-0082",
        contract_id: "HĐ-2026-0142",
        topic: "ACCESS",
        description: "Thẻ ra vào chưa mở được cổng cơ sở.",
        attachments: [],
        status: "IN_PROGRESS",
        staff_note: "Nhân viên Trần Minh đang kiểm tra.",
        created_at: at(addDays(t, -6), "09:40"),
        updated_at: at(addDays(t, -6), "10:15"),
      },
    ],
    notifications: [
      {
        id: "N-3",
        title: "Lịch nhận kho đã xác nhận",
        detail: `${addDaysLabel(t, 1)} · 09:00 tại Nguyễn Lương Bằng.`,
        to: "payments",
        created_at: at(t, "08:00"),
        read: false,
      },
      {
        id: "N-2",
        title: "Yêu cầu hỗ trợ được cập nhật",
        detail: "HT-0082 · Nhân viên đang xử lý.",
        to: "support",
        created_at: at(t, "07:30"),
        read: false,
      },
      {
        id: "N-1",
        title: "Kho B-015 sắp hết hạn",
        detail: `Hợp đồng kết thúc ngày ${addDaysLabel(t, 5)}.`,
        to: "units/HĐ-2026-0086",
        created_at: at(t, "07:00"),
        read: false,
      },
    ],
    activities: [
      {
        id: "A-3",
        text: "Yêu cầu hỗ trợ HT-0082 đang được xử lý",
        tone: "blue",
        at: addDays(t, -6),
      },
      {
        id: "A-2",
        text: "Thanh toán thuê kho 3 tháng đã đối soát",
        tone: "green",
        at: addDays(t, -6),
      },
      {
        id: "A-1",
        text: "Hợp đồng B-015 sắp hết hạn — có thể gửi yêu cầu gia hạn",
        tone: "amber",
        at: addDays(t, -7),
      },
    ],
  };
}

// Tài khoản mới đăng ký: chưa có đơn / hợp đồng nào.
export function createEmptyData(user, t = today()) {
  return {
    user,
    facilities: createFacilities(),
    reservations: [],
    contracts: [],
    ledger: [],
    appointments: [],
    renewals: [],
    returns: [],
    tickets: [],
    notifications: [
      {
        id: "N-welcome",
        title: "Chào mừng đến SafeSpace",
        detail: "Tìm không gian phù hợp để bắt đầu đặt chỗ.",
        to: "find",
        created_at: at(t, "08:00"),
        read: false,
      },
    ],
    activities: [],
  };
}

function addDaysLabel(t, n) {
  const iso = addDays(t, n);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
