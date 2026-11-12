// Danh mục ngân hàng Việt Nam và quy tắc kiểm tra định dạng số tài khoản (chỉ kiểm tra định dạng/độ dài, không xác minh tài khoản tồn tại thực tế).
export const BANK_CATALOG = [
  { name: "Vietcombank", short: "VCB", label: "Vietcombank (VCB) — Ngoại thương Việt Nam", min: 10, max: 13, example: "0123456789", aliases: ["vcb", "vietcombank", "ngoai thuong"] },
  { name: "VietinBank", short: "CTG", label: "VietinBank (CTG) — Công thương Việt Nam", min: 12, max: 14, example: "102000123456", aliases: ["ctg", "icb", "vietinbank", "vietin"] },
  { name: "BIDV", short: "BIDV", label: "BIDV — Đầu tư và Phát triển Việt Nam", min: 10, max: 14, example: "12010001234567", aliases: ["bid", "bidv"] },
  { name: "Agribank", short: "VBA", label: "Agribank (VBA) — Nông nghiệp & PTNT Việt Nam", min: 13, max: 13, example: "1500205123456", aliases: ["vba", "agribank"] },
  { name: "Techcombank", short: "TCB", label: "Techcombank (TCB) — Kỹ thương Việt Nam", min: 10, max: 14, example: "19030001234567", aliases: ["tcb", "techcombank"] },
  { name: "MB Bank", short: "MB", label: "MB Bank (MB) — Quân đội", min: 9, max: 15, example: "0981234567", aliases: ["mb", "mbb", "mbbank", "mb bank"] },
  { name: "ACB", short: "ACB", label: "ACB — Á Châu", min: 8, max: 15, example: "123456789", aliases: ["acb"] },
  { name: "VPBank", short: "VPB", label: "VPBank (VPB) — Việt Nam Thịnh Vượng", min: 8, max: 12, example: "1234567890", aliases: ["vpb", "vpbank"] },
  { name: "TPBank", short: "TPB", label: "TPBank (TPB) — Tiên Phong", min: 11, max: 12, example: "01234567890", aliases: ["tpb", "tpbank"] },
  { name: "Sacombank", short: "STB", label: "Sacombank (STB) — Sài Gòn Thương Tín", min: 12, max: 16, example: "060012345678", aliases: ["stb", "sacombank"] },
  { name: "HDBank", short: "HDB", label: "HDBank (HDB) — Phát triển TP.HCM", min: 11, max: 14, example: "001704070001234", aliases: ["hdb", "hdbank"] },
  { name: "VIB", short: "VIB", label: "VIB — Quốc tế Việt Nam", min: 9, max: 12, example: "001704060012", aliases: ["vib"] },
  { name: "SHB", short: "SHB", label: "SHB — Sài Gòn - Hà Nội", min: 10, max: 14, example: "1012345678", aliases: ["shb"] },
  { name: "MSB", short: "MSB", label: "MSB — Hàng Hải Việt Nam", min: 11, max: 15, example: "03001010123456", aliases: ["msb"] },
  { name: "OCB", short: "OCB", label: "OCB — Phương Đông", min: 10, max: 16, example: "0011100012345678", aliases: ["ocb"] },
  { name: "SeABank", short: "SEAB", label: "SeABank — Đông Nam Á", min: 12, max: 15, example: "000001234567", aliases: ["seab", "seabank"] },
  { name: "Eximbank", short: "EIB", label: "Eximbank (EIB) — Xuất Nhập Khẩu", min: 13, max: 15, example: "200014849123456", aliases: ["eib", "eximbank"] },
  { name: "LPBank", short: "LPB", label: "LPBank (LPB) — Lộc Phát Việt Nam", min: 12, max: 14, example: "001234567890", aliases: ["lpb", "lpbank", "lienvietpostbank"] },
];

export function findBankRule(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  return BANK_CATALOG.find((b) =>
    b.name.toLowerCase() === raw || b.short.toLowerCase() === raw || b.aliases.includes(raw)
  ) || null;
}

export function bankLengthLabel(rule) {
  if (!rule) return "6–19 chữ số";
  return rule.min === rule.max ? `${rule.min} chữ số` : `${rule.min}–${rule.max} chữ số`;
}
