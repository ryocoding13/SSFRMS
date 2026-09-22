// Tài khoản nhận chuyển khoản hiển thị ở màn C04. Cấu hình trong .env:
//   VITE_BANK_BIN      mã BIN ngân hàng theo NAPAS (vd. MB Bank 970422, Vietcombank 970436)
//   VITE_BANK_NAME     tên ngân hàng hiển thị
//   VITE_BANK_ACCOUNT  số tài khoản nhận
//   VITE_BANK_HOLDER   tên chủ tài khoản (in hoa, không dấu)
const env = import.meta.env || {};

export const bankAccount = {
  bin: env.VITE_BANK_BIN || "970422",
  bankName: env.VITE_BANK_NAME || "MB Bank",
  accountNo: env.VITE_BANK_ACCOUNT || "0901234567890",
  holder: env.VITE_BANK_HOLDER || "CONG TY TNHH SAFESPACE",
};
