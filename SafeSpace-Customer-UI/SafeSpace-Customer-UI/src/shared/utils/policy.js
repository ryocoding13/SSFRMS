// Chính sách huỷ đơn / hoàn tiền dùng chung cho C14a (khách), M07 và M08 (quản lý).
// Khi nhóm chốt bảng chính sách mới (DECISIONS.md), chỉ sửa ở file này.
// Số tiền thực tế luôn ưu tiên lấy từ backend (cancel-preview, board); các giá trị dưới đây chỉ dùng để hiển thị
// nhãn và tính dự phòng khi chạy không backend.

// D49 (thay D40/D32/D27): huỷ trước ngày bắt đầu thuê hoàn 100% tiền thuê + 100% cọc (phí huỷ = 0%).
export const CANCEL_DEPOSIT_FEE_RATE = 0;

const pct = (x) => `${Math.round(x * 100)}%`;

export const CANCEL_FEE_LABEL = `Phí huỷ (${pct(CANCEL_DEPOSIT_FEE_RATE)} tiền cọc)`;
export const CANCEL_REFUND_SHORT = `100% tiền thuê + ${pct(1 - CANCEL_DEPOSIT_FEE_RATE)} cọc`;
export const CANCEL_POLICY_NAME = CANCEL_DEPOSIT_FEE_RATE === 0 ? "Huỷ trước ngày bắt đầu: miễn phí huỷ (0%)" : `Huỷ trước ngày bắt đầu: phí ${pct(CANCEL_DEPOSIT_FEE_RATE)} tiền cọc`;
export const CANCEL_POLICY_HINT = CANCEL_DEPOSIT_FEE_RATE === 0 ? "Huỷ trước ngày bắt đầu thuê: miễn phí huỷ (0%), hoàn 100% tiền thuê và 100% cọc. Từ ngày bắt đầu thuê, sử dụng quy trình trả kho." : `Huỷ trước ngày bắt đầu thuê: phí huỷ ${pct(CANCEL_DEPOSIT_FEE_RATE)} tiền cọc, hoàn 100% tiền thuê và ${pct(1 - CANCEL_DEPOSIT_FEE_RATE)} cọc. Từ ngày bắt đầu thuê, sử dụng quy trình trả kho.`;
export const CANCEL_REFUND_NOTE = `Bạn được hoàn 100% tiền thuê và ${pct(1 - CANCEL_DEPOSIT_FEE_RATE)} tiền cọc trong 3–5 ngày làm việc. Quản lý cơ sở chuyển khoản thủ công và cập nhật trạng thái hoàn tiền.`;
