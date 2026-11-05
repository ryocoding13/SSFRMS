// Chuỗi giờ Việt Nam "yyyy-MM-ddTHH:mm:ss" do BE trả (không kèm múi giờ) → hiển thị và tính thời gian còn lại.
export const vnStamp = s => typeof s === "string" && s.length >= 16 ? `${s.slice(11, 16)} · ${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "Chưa có thông tin";
export const vnDate = s => typeof s === "string" && s.length >= 10 ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "Chưa có thông tin";
export const vnMillis = s => typeof s === "string" && s.length >= 16 ? Date.parse(`${s.slice(0, 19)}+07:00`) : NaN;
export function hoursLeft(s, now = Date.now()) {
  const t = vnMillis(s);
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - now) / 3600000)) : null;
}
