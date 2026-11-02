export const MAX_RETURN_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const RETURN_SLOTS = ["09:00–09:30", "10:00–10:30", "14:00–14:30", "15:30–16:00"];
export const emptyRefundBank = () => ({ bankName: "", accountNumber: "", accountHolder: "" });
export const normalizeHolder = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "D").trim().replace(/\s+/g, " ").toUpperCase();
export function validateRefundBank(bank, expectedName) {
  if (!bank?.bankName?.trim()) return "Vui lòng nhập tên ngân hàng.";
  if (!/^\d{6,19}$/.test(String(bank?.accountNumber || ""))) return "Số tài khoản phải có từ 6 đến 19 chữ số.";
  if (!bank?.accountHolder?.trim()) return "Vui lòng nhập tên chủ tài khoản.";
  if (expectedName && normalizeHolder(bank.accountHolder) !== normalizeHolder(expectedName)) return "Tên chủ tài khoản phải trùng tên trên hợp đồng.";
  return "";
}
export const cleanRefundBank = bank => ({ bankName: bank.bankName.trim(), accountNumber: bank.accountNumber, accountHolder: bank.accountHolder.trim().replace(/\s+/g, " ") });
export function validateReturnPhotos(photos) {
  if (!Array.isArray(photos) || !photos.length) return "Vui lòng tải ít nhất một ảnh kho trống.";
  if (photos.length > MAX_RETURN_PHOTOS) return "Chỉ được tải tối đa 5 ảnh kho trống.";
  if (photos.some(p => !["image/jpeg", "image/png"].includes(p.type) || !(p.size > 0) || p.size > MAX_PHOTO_BYTES)) return "Ảnh phải là JPG hoặc PNG, mỗi ảnh không quá 5 MB.";
  return "";
}
export async function verifyPhotoFile(file) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const valid = file.type === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v);
  if (!valid) throw new Error("Nội dung ảnh không đúng định dạng JPG/PNG. Vui lòng chọn ảnh khác.");
}
export const readPhotoData = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve({ fileName: file.name, contentType: file.type, dataBase64: String(reader.result).split(",")[1] });
  reader.onerror = () => reject(new Error("Không đọc được ảnh. Vui lòng chọn lại."));
  reader.readAsDataURL(file);
});
