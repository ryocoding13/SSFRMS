import { localOffers } from "../../shared/utils/catalog.js";
import { addDays, addMonths, today } from "../../shared/utils/format.js";

export const SEED_EMAIL = "mai.nguyen@example.com";
export const SEED_PASSWORD = "SafeSpace@123";

// Danh sách 12 cơ sở SafeSpace (Figma 14/10). Cơ sở nào cũng có kho thường và kho lạnh, cỡ M và L.
// Gợi ý theo khu vực khách chọn, không theo vị trí người dùng → không có khoảng cách.
const FACILITIES = [
  [1, "SafeSpace Nguyễn Lương Bằng", "Quận 7", 1150000, "Số 12 Nguyễn Lương Bằng, Tân Phú"],
  [2, "SafeSpace Him Lam", "Quận 7", 1050000, "Khu dân cư Him Lam, Tân Hưng"],
  [3, "SafeSpace Phú Xuân", "Quận 7", 890000, "Đường Nguyễn Hữu Thọ, Phú Xuân"],
  [4, "SafeSpace Tân Thuận", "Quận 7", 1100000, "Đường Huỳnh Tấn Phát, Tân Thuận"],
  [5, "SafeSpace Phú Mỹ Hưng", "Quận 7", 1250000, "Đường Nguyễn Lương Bằng, Tân Phong"],
  [6, "SafeSpace Bình Thạnh", "Quận Bình Thạnh", 980000, "Đường Nguyễn Xí, Phường 26"],
  [7, "SafeSpace Nhà Bè", "Huyện Nhà Bè", 850000, "Đường Huỳnh Tấn Phát, Thị trấn Nhà Bè"],
  [8, "SafeSpace Bình Chánh", "Huyện Bình Chánh", 790000, "Quốc lộ 50, Bình Hưng"],
  [9, "SafeSpace Thủ Đức", "TP. Thủ Đức", 920000, "Đường Võ Văn Ngân, Linh Chiểu"],
  [10, "SafeSpace Gò Vấp", "Quận Gò Vấp", 930000, "Đường Quang Trung, Phường 10"],
  [11, "SafeSpace Tân Bình", "Quận Tân Bình", 1020000, "Đường Cộng Hòa, Phường 13"],
  [12, "SafeSpace Bình Tân", "Quận Bình Tân", 820000, "Đường Kinh Dương Vương, An Lạc"],
];

export function createFacilities() {
  return FACILITIES.map(([facility_id, name, district, base_price, street]) => withOffers({
    facility_id,
    name,
    district,
    city: "TP. Hồ Chí Minh",
    address: `${street}, ${district}, TP. Hồ Chí Minh`,
    base_price,
    has_climate: true,
    camera: true,
    hours: "06:00–22:00",
  }));
}

const withOffers = (f) => ({ ...f, offers: localOffers(f) });

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
        offer_key: "normal-M",
        size_label: "Cỡ M · 15 m²",
        months: 3,
        start_date: t,
        end_date: a102End,
        monthly_rate: 1150000,
        deposit: 1150000,
        rent_total: 3450000,
        initial_total: 4600000,
        status: "CONFIRMED", // đã thanh toán qua QR PayOS, chờ nhận kho (Figma C14)
        created_at: at(addDays(t, -6), "09:12"),
      },
      {
        reservation_id: "SS-20260615-0086",
        facility_id: 1,
        type: "climate",
        band: "M",
        offer_key: "climate-M",
        size_label: "Cỡ M · 15 m²",
        months: 3,
        start_date: b015Start,
        end_date: b015End,
        monthly_rate: 1380000,
        deposit: 1380000,
        rent_total: 4140000,
        initial_total: 5520000,
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
        size_m2: 15,
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
        band: "M",
        size_m2: 15,
        location: "Tầng 1 · Dãy B",
        months: 3,
        start_date: b015Start,
        end_date: b015End,
        monthly_rate: 1380000,
        deposit: 1380000,
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
        amount: 4140000,
        status: "RECONCILED",
      },
      {
        ref: "SS-0086-DEP",
        label: "Cọc hợp đồng B-015",
        contract_id: "HĐ-2026-0086",
        reservation_id: "SS-20260615-0086",
        amount: 1380000,
        status: "DEPOSIT_HELD",
      },
      {
        // C11: gia hạn đã được cơ sở duyệt, chờ khách thanh toán qua QR PayOS (C11q)
        ref: "SS-0086-REN",
        kind: "RENEWAL",
        label: "Gia hạn B-015 · 3 tháng",
        contract_id: "HĐ-2026-0086",
        unit_number: "B-015",
        amount: 4140000,
        status: "UNPAID",
        payable: true,
        period: { from: b015End, to: addMonths(b015End, 3), months: 3 },
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
    renewals: [
      {
        renewal_id: "GH-0012",
        contract_id: "HĐ-2026-0086",
        months: 3,
        old_end: b015End,
        new_end: addMonths(b015End, 3),
        amount: 4140000,
        status: "APPROVED",
        requested_at: at(addDays(t, -2), "10:20"),
      },
    ],
    returns: [],
    tickets: [
      {
        ticket_id: "HT-0082",
        contract_id: "HĐ-2026-0142",
        topic: "ACCESS",
        description: "Thẻ ra vào chưa mở được cổng cơ sở.",
        attachments: [],
        status: "IN_PROGRESS",
        staff_note: "Nhân viên Trần Văn Long đang kiểm tra.",
        responses: [
          {
            text: "Thẻ cũ bị lỗi từ. Bạn qua quầy lễ tân nhận thẻ mới, mang theo CCCD giúp mình nhé.",
            by: "Trần Văn Long",
            at: at(addDays(t, -6), "11:02"),
          },
        ],
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
        text: "Thanh toán thuê kho 3 tháng qua QR thành công",
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
