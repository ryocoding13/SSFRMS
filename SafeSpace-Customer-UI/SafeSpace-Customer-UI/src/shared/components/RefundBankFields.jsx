import React from "react";
import { Select } from "./Pickers.jsx";
import { Field } from "./UI.jsx";
import { BANK_CATALOG, bankLengthLabel, findBankRule } from "../utils/bankCatalog.js";

export default function RefundBankFields({ value, onChange, disabled, intro = true }) {
  const rule = findBankRule(value.bankName);
  const selectValue = rule ? rule.name : String(value.bankName || "").trim();
  const hasLegacyBank = Boolean(selectValue && !rule);
  const changeBank = e => onChange({ ...value, bankName: e.target.value });
  const changeNumber = e => {
    // Giữ nguyên số 0 đầu dạng chuỗi; chỉ giữ chữ số nếu khách gõ/dán kèm khoảng trắng nhẹ? Không: giữ đúng chuỗi người dùng nhập để validate thông báo lỗi rõ khi nhập chữ, hoặc cắt khoảng trắng hai đầu.
    onChange({ ...value, accountNumber: e.target.value });
  };
  const changeHolder = e => onChange({ ...value, accountHolder: e.target.value });
  return <>
    {intro && <p className="hint">Chấp nhận tài khoản ngân hàng của chính bạn, người thân hoặc người nhận hộ. Thời hạn hoàn: 3–5 ngày làm việc.</p>}
    <div className="form-row">
      <Field label="Ngân hàng *">
        <Select required value={selectValue} onChange={changeBank} disabled={disabled}>
          <option value="">Chọn ngân hàng</option>
          {hasLegacyBank && <option value={selectValue}>{selectValue}</option>}
          {BANK_CATALOG.map(b => <option key={b.name} value={b.name}>{b.label}</option>)}
        </Select>
      </Field>
      <Field label="Số tài khoản *">
        <input
          required
          inputMode="numeric"
          pattern={rule ? `[0-9]{${rule.min},${rule.max}}` : "[0-9]{6,19}"}
          minLength={rule ? rule.min : 6}
          maxLength={rule ? rule.max : 19}
          placeholder={rule ? `VD: ${rule.example}` : "Nhập số tài khoản"}
          autoComplete="off"
          value={value.accountNumber}
          onChange={changeNumber}
          disabled={disabled}
        />
      </Field>
    </div>
    <Field label="Chủ tài khoản nhận tiền *">
      <input
        required
        maxLength={150}
        placeholder="Nhập tên chủ tài khoản nhận tiền (có thể là người thân)"
        autoComplete="off"
        value={value.accountHolder}
        onChange={changeHolder}
        disabled={disabled}
      />
    </Field>
    <p className="hint">
      {rule ? `${rule.name} yêu cầu ${bankLengthLabel(rule)} (giữ nguyên số 0 đầu). ` : "Chọn ngân hàng để kiểm tra độ dài số tài khoản (giữ nguyên số 0 đầu). "}
      Có thể dùng tài khoản của người thân hoặc người khác. Kiểm tra định dạng chỉ xác nhận cấu trúc số tài khoản, không xác minh tài khoản tồn tại thực tế.
    </p>
  </>;
}
