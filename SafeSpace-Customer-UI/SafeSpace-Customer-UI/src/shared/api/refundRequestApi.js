import { refundChoicePayload, validateRefundChoice } from "../utils/refundRequest.js";
export async function submitCancellation(api, id, reason, bank, paid, expectedName) {
  if (paid) {
    const error = validateRefundChoice(bank, expectedName);
    if (error) throw new Error(error);
    const policy = await api.currentRentalPolicy();
    if (policy?.cancellationBankSupported !== true) throw new Error("Chức năng huỷ đơn đang chờ máy chủ hỗ trợ tài khoản nhận hoàn.");
  }
  return api.cancelReservation(id, reason, paid ? refundChoicePayload(bank) : undefined);
}
export async function submitReturnRequest(api, id, payload, expectedName) {
  const error = validateRefundChoice(payload.bank, expectedName);
  if (error) throw new Error(error);
  if (payload.emptied !== true) throw new Error("Vui lòng xác nhận đã chuyển hết đồ ra khỏi kho.");
  const policy = await api.currentRentalPolicy();
  if (policy?.returnRequestSupported !== true) throw new Error("Chức năng trả kho đang chờ máy chủ hỗ trợ lưu thông tin nhận hoàn.");
  return api.requestMoveOut(id, { date: payload.date, note: payload.notes, ...refundChoicePayload(payload.bank), emptied: true, photos: [] });
}
