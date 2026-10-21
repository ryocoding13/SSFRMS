// Tạo chuỗi VietQR (chuẩn EMVCo / NAPAS 247) để ứng dụng ngân hàng quét và điền sẵn
// số tài khoản, số tiền, nội dung chuyển khoản.

const tlv = (id, value) => `${id}${String(value.length).padStart(2, "0")}${value}`;

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) theo EMVCo
export function crc16(input) {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// Nội dung chuyển khoản chỉ nên có chữ không dấu, số, khoảng trắng và gạch ngang
export const cleanContent = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9 -]/g, "")
    .slice(0, 25);

export function vietQrPayload({ bin, accountNo, amount, content }) {
  const beneficiary = tlv("00", bin) + tlv("01", accountNo);
  const merchant = tlv("00", "A000000727") + tlv("01", beneficiary) + tlv("02", "QRIBFTTA");
  let body =
    tlv("00", "01") +
    tlv("01", "12") +
    tlv("38", merchant) +
    tlv("53", "704") +
    (amount ? tlv("54", String(Math.round(amount))) : "") +
    tlv("58", "VN") +
    (content ? tlv("62", tlv("08", cleanContent(content))) : "");
  body += "6304";
  return body + crc16(body);
}
