// D72 · Nội dung khách phản hồi khoản khấu trừ trả kho, hiển thị cho nhân viên và quản lý.
const ITEM_CHOICE = { AGREE: "Đồng ý trừ", SELF_CLEAN: "Tự dọn dẹp", SELF_REPLACE: "Tự thay vật dụng tương đương", DISPUTE: "Khiếu nại" };

/** Các dòng [nhãn, nội dung] mô tả phản hồi của khách; rỗng khi khách chưa phản hồi. */
export function deductionReplyRows(r = {}) {
  const rows = [];
  if (r.cleaning_decision) rows.push(["Khoản vệ sinh", ITEM_CHOICE[r.cleaning_decision] || r.cleaning_decision]);
  if (r.damage_decision) rows.push(["Khoản hư hỏng", ITEM_CHOICE[r.damage_decision] || r.damage_decision]);
  if (r.deduction_note) rows.push(["Khách ghi", r.deduction_note]);
  if (r.recheck_note) rows.push(["Kết quả kiểm tra lại", r.recheck_note]);
  return rows;
}
