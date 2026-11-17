import { api } from "./customerApi.js";

/**
 * Trước khi huỷ đơn PayOS hết giờ giữ chỗ: hỏi máy chủ (máy chủ đối soát thẳng với PayOS, tối đa 1 lần / 5 giây / đơn)
 * để không huỷ đơn khách vừa trả tiền ở những giây cuối. true = đã trả, false = chưa trả (được huỷ),
 * null = chưa kiểm tra được (giữ nguyên, thử lại lần sau).
 */
export async function paidBeforeExpiry(apiId, statusApi = (id) => api.reservationStatus(id), wait = (ms) => new Promise((done) => setTimeout(done, ms))) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let s;
    try { s = await statusApi(apiId); } catch { return null; }
    if (s?.isPaid) return true;
    if (s?.status && s.status !== "PENDING_PAYMENT") return false;
    if (attempt === 0) await wait(5500);
  }
  return false;
}
