// Định dạng hiển thị theo Figma: "1.150.000 đ", "20/09/2026", "20/09–20/12/2026", "09••  •••  142".

export const money = (n) =>
  `${new Intl.NumberFormat("vi-VN").format(Math.round(Number(n) || 0))} đ`;

const pad = (n) => String(n).padStart(2, "0");

export function localDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const today = () => localDate(new Date());

const parse = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00`);

export function addDays(iso, days) {
  const d = parse(iso);
  d.setDate(d.getDate() + days);
  return localDate(d);
}

export function addMonths(iso, months) {
  const d = parse(iso);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(months));
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return localDate(d);
}

export const dateLabel = (iso) => {
  if (!iso) return "—";
  const d = parse(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

export const dayMonth = (iso) => {
  if (!iso) return "—";
  const d = parse(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

// "20/09–20/12/2026"
export const rangeLabel = (start, end) =>
  `${dayMonth(start)}–${dateLabel(end)}`;

export const timeLabel = (isoDateTime) => {
  const d = new Date(isoDateTime);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const dateTimeLabel = (isoDateTime) => {
  const d = new Date(isoDateTime);
  return `${dateLabel(localDate(d))} · ${timeLabel(isoDateTime)}`;
};

export function daysBetween(fromIso, toIso) {
  return Math.round((parse(toIso) - parse(fromIso)) / 86400000);
}

export const distanceLabel = (km) =>
  `${new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(km)} km`;

// Số điện thoại hiển thị dạng che bớt: 09•• ••• 142
export function maskPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return phone || "Chưa cập nhật";
  return `${digits.slice(0, 2)}•• ••• ${digits.slice(-3)}`;
}

// SS-20260914-0142 -> SS-0142
export const shortCode = (id) => {
  const m = /^SS-\d{8}-(\d{4})$/.exec(id || "");
  return m ? `SS-${m[1]}` : id;
};

export const formatCountdown = (seconds) => {
  const s = Math.max(0, Math.ceil(seconds));
  const h = Math.floor(s / 3600);
  const mmss = `${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  return h ? `${pad(h)}:${mmss}` : mmss;
};

export const timeoutLabel = (seconds) =>
  seconds >= 3600 && seconds % 3600 === 0
    ? `${seconds / 3600} giờ`
    : seconds % 60 === 0
      ? `${seconds / 60} phút`
      : `${seconds} giây`;

export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
export const isPhone = (v) =>
  /^(0\d{9}|\+84\d{9})$/.test(String(v || "").replace(/[\s.-]/g, ""));
