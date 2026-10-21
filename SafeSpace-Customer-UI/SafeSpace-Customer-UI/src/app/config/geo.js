// Toạ độ các cơ sở cho màn Tìm kho trên bản đồ (Figma C02m). Gán theo TÊN cơ sở như ảnh
// (config/media.js) để đúng vị trí dù id trong database là bao nhiêu.
// Khi backend có toạ độ (Facility.Latitude / Longitude), mapper chỉ cần gán facility.lat / lng.
const BY_NAME = [
  ["Nguyễn Lương Bằng", 10.7295, 106.7219],
  ["Him Lam", 10.7456, 106.6980],
  ["Phú Xuân", 10.6935, 106.7222],
  ["Tân Thuận", 10.7560, 106.7290],
  ["Phú Mỹ Hưng", 10.7285, 106.7060],
  ["Bình Thạnh", 10.8150, 106.7090],
  ["Nhà Bè", 10.6960, 106.7390],
  ["Bình Chánh", 10.6970, 106.6560],
  ["Thủ Đức", 10.8500, 106.7700],
  ["Gò Vấp", 10.8350, 106.6660],
  ["Tân Bình", 10.8010, 106.6420],
  ["Bình Tân", 10.7390, 106.6150],
];

// Trung tâm TP.HCM, dùng khi cơ sở chưa có toạ độ
export const HCMC_CENTER = [10.7769, 106.7009];

export function coordsOf(facility) {
  if (facility?.lat != null && facility?.lng != null) return [Number(facility.lat), Number(facility.lng)];
  const hit = BY_NAME.find(([key]) => (facility?.name || "").includes(key));
  if (hit) return [hit[1], hit[2]];
  // Rải quanh trung tâm theo mã cơ sở để không trùng điểm
  const id = Number(facility?.facility_id) || 1;
  return [HCMC_CENTER[0] + ((id * 37) % 11 - 5) * 0.012, HCMC_CENTER[1] + ((id * 53) % 13 - 6) * 0.012];
}
