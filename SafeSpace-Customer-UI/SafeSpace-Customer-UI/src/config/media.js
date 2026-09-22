// Ảnh giao diện, đặt trong public/images/ (xem public/images/README.md).
const BASE = `${import.meta.env?.BASE_URL ?? "/"}images/`;
const url = (file) => `${BASE}${file}`;

// Ảnh hero trang chủ: hành lang bên trong cơ sở
export const heroImage = url("hero.jpg");

// Mỗi cơ sở một ảnh mặt tiền (facilities/kho-1.jpg … kho-9.jpg), gán theo TÊN cơ sở để đúng ảnh
// dù id trong database là bao nhiêu. Cơ sở chưa có ảnh riêng dùng lại ảnh cơ sở khác; thêm file rồi sửa bảng này.
const PHOTO_BY_NAME = [
  ["Nguyễn Lương Bằng", 1],
  ["Him Lam", 2],
  ["Phú Xuân", 3],
  ["Tân Thuận", 4],
  ["Phú Mỹ Hưng", 5],
  ["Bình Thạnh", 6],
  ["Nhà Bè", 7],
  ["Bình Chánh", 8],
  ["Thủ Đức", 9],
  ["Gò Vấp", 6],
  ["Tân Bình", 4],
  ["Bình Tân", 8],
  ["Quận 7", 1],
];
const PHOTO_BY_ID = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 6, 11: 4, 12: 8 };
const photoNo = (f) => {
  const facility = typeof f === "object" && f ? f : { facility_id: f };
  const hit = PHOTO_BY_NAME.find(([key]) => (facility.name || "").includes(key));
  return hit ? hit[1] : PHOTO_BY_ID[facility.facility_id] || ((Number(facility.facility_id) || 1) - 1) % 9 + 1;
};
export const facilityCard = (f) => url(`facilities/kho-${photoNo(f)}.jpg`);
export const facilityCover = facilityCard;

// 3 sơ đồ mặt bằng; mỗi cơ sở được gán ngẫu nhiên một sơ đồ, cố định theo mã cơ sở
// (cùng một cơ sở luôn hiện cùng sơ đồ).
const PLANS = ["plans/so-do-1.jpg", "plans/so-do-2.jpg", "plans/so-do-3.jpg"];
export function planFor(f) {
  const key = typeof f === "object" && f ? f.name || f.facility_id : f;
  let h = 2166136261;
  for (const ch of `safespace-${key}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return PLANS[(h >>> 0) % PLANS.length];
}

// Thư viện ảnh cơ sở (C03c): ảnh cơ sở + 4 ảnh bên trong kho + sơ đồ mặt bằng ở cuối
export const GALLERY = [
  { id: "cover", caption: "Mặt tiền cơ sở" },
  { id: "inside-1", caption: "Kho kiểm soát nhiệt độ", file: "inside/ben-trong-1.jpg" },
  { id: "inside-2", caption: "Kho thường nhìn từ cửa cuốn", file: "inside/ben-trong-2.jpg" },
  { id: "inside-3", caption: "Khu kệ lưu trữ kiểm soát nhiệt độ", file: "inside/ben-trong-3.jpg" },
  { id: "inside-4", caption: "Lối đi bên trong kho thường", file: "inside/ben-trong-4.jpg" },
  { id: "plan", caption: "Sơ đồ mặt bằng cơ sở", fit: "contain" },
];
export function galleryImage(facility, index) {
  const item = GALLERY[index % GALLERY.length];
  const src = item.id === "cover" ? facilityCover(facility) : item.id === "plan" ? url(planFor(facility)) : url(item.file);
  return { ...item, src };
}

// Thời gian giữ đơn chờ chuyển khoản (Figma: 01:00). Đổi bằng VITE_PAYMENT_TIMEOUT_SECONDS.
export const paymentTimeoutSeconds = Number(import.meta.env?.VITE_PAYMENT_TIMEOUT_SECONDS) || 60;
