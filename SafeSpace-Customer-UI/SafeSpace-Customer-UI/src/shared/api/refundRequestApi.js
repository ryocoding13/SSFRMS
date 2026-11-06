import { refundChoicePayload, validateRefundChoice, validateReturnPhotos, verifyPhotoFile, readPhotoData } from "../utils/refundRequest.js";
export async function submitCancellation(api, id, reason, bank, paid, expectedName) {
  if (paid) {
    const error = validateRefundChoice(bank, expectedName);
    if (error) throw new Error(error);
    const policy = await api.currentRentalPolicy();
    if (policy?.cancellationBankSupported !== true) throw new Error("Chức năng huỷ đơn đang chờ máy chủ hỗ trợ tài khoản nhận hoàn.");
  }
  return api.cancelReservation(id, reason, paid ? refundChoicePayload(bank) : undefined);
}
export async function submitReturnRequest(api, id, payload, expectedName, encodePhoto = readPhotoData) {
  const error = validateRefundChoice(payload.bank, expectedName) || validateReturnPhotos(payload.photos);
  if (error) throw new Error(error);
  if (payload.emptied !== true) throw new Error("Vui lòng xác nhận đã chuyển hết đồ ra khỏi kho.");
  const policy = await api.currentRentalPolicy();
  if (policy?.returnRequestSupported !== true) throw new Error("Chức năng trả kho đang chờ máy chủ hỗ trợ lưu ảnh và tài khoản nhận hoàn.");
  for (const file of payload.photos) await verifyPhotoFile(file);
  const photos = await Promise.all(payload.photos.map(encodePhoto));
  return api.requestMoveOut(id, { date: payload.date, slot: payload.slot, note: payload.notes, ...refundChoicePayload(payload.bank), emptied: true, photos });
}
