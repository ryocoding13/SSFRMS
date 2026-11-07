import { money } from "../../../shared/utils/format.js";

// D46 · gia hạn sang ô khác: quản lý thấy ô khách chọn và cọc chênh thu cùng khoản gia hạn trước khi duyệt.
// Ô bị lấy trước khi duyệt → máy chủ báo "Ô vừa có người đặt"; quản lý từ chối để khách chọn ô khác.
export function unitMoveText(r) {
  const topUp = Number(r?.deposit_top_up) || 0;
  return `Sang ô ${r.target_unit} · ${topUp > 0 ? `cọc chênh ${money(topUp)} (thu cùng tiền gia hạn)` : "không thu thêm cọc"} · khách tự chuyển đồ trong 3 ngày cuối kỳ`;
}
