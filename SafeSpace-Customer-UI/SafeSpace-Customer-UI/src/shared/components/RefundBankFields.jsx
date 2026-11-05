import React from "react";
import { Field } from "./UI.jsx";
export default function RefundBankFields({ value, onChange, disabled, expectedName }) {
  const change = key => e => onChange({ ...value, [key]: e.target.value });
  return <>
    <p className="hint">Mọi khoản hoàn chuyển vào tài khoản chính chủ, kể cả khi bạn đã thanh toán bằng tiền mặt. Thời hạn hoàn: 3–5 ngày làm việc.</p>
    <div className="form-row">
      <Field label="Ngân hàng *"><input required maxLength={100} autoComplete="off" value={value.bankName} onChange={change("bankName")} disabled={disabled} /></Field>
      <Field label="Số tài khoản *"><input required inputMode="numeric" pattern="[0-9]{6,19}" minLength={6} maxLength={19} autoComplete="off" value={value.accountNumber} onChange={change("accountNumber")} disabled={disabled} /></Field>
    </div>
    <Field label="Chủ tài khoản *"><input required maxLength={150} autoComplete="off" value={value.accountHolder} onChange={change("accountHolder")} disabled={disabled} /></Field>
    <p className="hint">{expectedName ? `Tên trên hợp đồng: ${expectedName}. Có thể nhập tên không dấu.` : "Tên chủ tài khoản phải trùng tên trên hợp đồng; cơ sở sẽ đối chiếu khi xử lý."}</p>
  </>;
}
