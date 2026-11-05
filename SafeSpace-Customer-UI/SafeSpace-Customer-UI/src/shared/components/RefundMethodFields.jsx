import React from "react";
import RefundBankFields from "./RefundBankFields.jsx";
import { CASH_REFUND_TERMS, REFUND_METHODS } from "../utils/refundRequest.js";
// D42/D44 · Khách chọn cách nhận hoàn khi huỷ đơn, trả kho hoặc kết thúc do sự cố cơ sở.
// Cơ sở chỉ làm theo lựa chọn này, không đổi được. Tiền mặt: khách tick xác nhận điều kiện 30 ngày.
export default function RefundMethodFields({ value, onChange, disabled, expectedName }) {
  const method = value.method === REFUND_METHODS.CASH ? REFUND_METHODS.CASH : REFUND_METHODS.BANK_TRANSFER;
  const pick = next => () => onChange({ ...value, method: next, cashAccepted: next === REFUND_METHODS.CASH ? value.cashAccepted === true : false });
  return <div className="refund-method">
    <div className="refund-method__options" role="radiogroup" aria-label="Cách nhận hoàn">
      <label className={`refund-method__option${method === REFUND_METHODS.BANK_TRANSFER ? " is-active" : ""}`}>
        <input type="radio" name="refund-method" checked={method === REFUND_METHODS.BANK_TRANSFER} disabled={disabled} onChange={pick(REFUND_METHODS.BANK_TRANSFER)} />
        <span><strong>Chuyển khoản ngân hàng</strong><small>Vào tài khoản chính chủ trong 3–5 ngày làm việc</small></span>
      </label>
      <label className={`refund-method__option${method === REFUND_METHODS.CASH ? " is-active" : ""}`}>
        <input type="radio" name="refund-method" checked={method === REFUND_METHODS.CASH} disabled={disabled} onChange={pick(REFUND_METHODS.CASH)} />
        <span><strong>Tiền mặt tại quầy</strong><small>Nhận tại cơ sở, mang CCCD trùng tên hợp đồng</small></span>
      </label>
    </div>
    {method === REFUND_METHODS.BANK_TRANSFER
      ? <RefundBankFields value={value} onChange={next => onChange({ ...next, method })} disabled={disabled} expectedName={expectedName} />
      : <div className="refund-method__cash">
          <p className="hint">{CASH_REFUND_TERMS}</p>
          <label className="customer-detail__choice"><input type="checkbox" checked={value.cashAccepted === true} disabled={disabled}
            onChange={e => onChange({ ...value, cashAccepted: e.target.checked })} /><span>Tôi đã hiểu: quá 30 ngày không đến nhận, tôi mất khoản hoàn</span></label>
        </div>}
  </div>;
}
