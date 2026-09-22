// Ảnh giao diện, đặt trong public/images/ (xem public/images/README.md).
const BASE = `${import.meta.env?.BASE_URL ?? "/"}images/`;
const url = (file) => `${BASE}${file}`;

// Ảnh hero trang chủ: hành lang bên trong cơ sở
export const heroImage = url("hero.jpg");

// Mỗi cơ sở một ảnh mặt tiền (facilities/kho-1.jpg … kho-9.jpg).
// Cơ sở 10–12 chưa có ảnh riêng nên dùng lại ảnh của cơ sở khác; thêm file mới rồi sửa bảng này.
const PHOTO = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 6, 11: 4, 12: 8 };
export const facilityCard = (id) => url(`facilities/kho-${PHOTO[id] || 1}.jpg`);
export const facilityCover = facilityCard;

// 3 sơ đồ mặt bằng; mỗi cơ sở được gán ngẫu nhiên một sơ đồ, cố định theo mã cơ sở
// (cùng một cơ sở luôn hiện cùng sơ đồ).
const PLANS = ["plans/so-do-1.jpg", "plans/so-do-2.jpg", "plans/so-do-3.jpg"];
export function planFor(id) {
  let h = 2166136261;
  for (const ch of `safespace-${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
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
export function galleryImage(facilityId, index) {
  const item = GALLERY[index % GALLERY.length];
  const src = item.id === "cover" ? facilityCover(facilityId) : item.id === "plan" ? url(planFor(facilityId)) : url(item.file);
  return { ...item, src };
}

// Thời gian giữ đơn chờ chuyển khoản (Figma: 01:00). Đổi bằng VITE_PAYMENT_TIMEOUT_SECONDS.
export const paymentTimeoutSeconds = Number(import.meta.env?.VITE_PAYMENT_TIMEOUT_SECONDS) || 60;
