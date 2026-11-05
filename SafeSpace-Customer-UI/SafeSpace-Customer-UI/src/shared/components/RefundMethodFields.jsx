import React from "react";
import RefundBankFields from "./RefundBankFields.jsx";
import { CASH_REFUND_DAYS, REFUND_METHODS } from "../utils/refundRequest.js";
// D42/D44 · Figma D30-07 / D30-03: thẻ "Nhận tiền hoàn · Chính chủ", hàng chọn "Nhận hoàn qua".
// Cơ sở chỉ làm theo lựa chọn này, không đổi được. Tiền mặt: khách tick xác nhận điều kiện 30 ngày (D44).
export function cashRefundText(facility) {
  const where = facility?.name ? `Đến ${facility.name}` : "Đến cơ sở";
  const hours = facility?.hours ? ` trong giờ mở cửa (${facility.hours})` : " trong giờ mở cửa";
  return `${where}${hours} trong ${CASH_REFUND_DAYS} ngày, mang CCCD trùng tên trên hợp đồng. Nhân viên đối chiếu CCCD rồi chi tiền. Quá ${CASH_REFUND_DAYS} ngày không đến nhận, bạn mất khoản hoàn; trong thời hạn này bạn vẫn đổi được sang chuyển khoản.`;
}
export default function RefundMethodFields({ value, onChange, disabled, expectedName, facility }) {
  const method = value.method === REFUND_METHODS.CASH ? REFUND_METHODS.CASH : REFUND_METHODS.BANK_TRANSFER;
  const pick = next => () => onChange({ ...value, method: next, cashAccepted: next === REFUND_METHODS.CASH ? value.cashAccepted === true : false });
  return <div className="refund-method">
    <p className="hint refund-method__intro">Chọn cách nhận tiền hoàn. Chuyển khoản chỉ vào tài khoản chính chủ, trùng tên trên hợp đồng.</p>
    <div className="refund-method__row">
      <span className="refund-method__label" id="refund-method-label">Nhận hoàn qua</span>
      <div className="refund-method__options" role="radiogroup" aria-labelledby="refund-method-label">
        <label className="refund-method__option"><input type="radio" name="refund-method" checked={method === REFUND_METHODS.BANK_TRANSFER} disabled={disabled} onChange={pick(REFUND_METHODS.BANK_TRANSFER)} /><span>Chuyển khoản ngân hàng</span></label>
        <label className="refund-method__option"><input type="radio" name="refund-method" checked={method === REFUND_METHODS.CASH} disabled={disabled} onChange={pick(REFUND_METHODS.CASH)} /><span>Tiền mặt tại quầy</span></label>
      </div>
    </div>
    {method === REFUND_METHODS.BANK_TRANSFER
      ? <RefundBankFields intro={false} value={value} onChange={next => onChange({ ...next, method })} disabled={disabled} expectedName={expectedName} />
      : <div className="refund-method__cash">
          <p className="hint">{cashRefundText(facility)}</p>
          <label className="customer-detail__choice"><input type="checkbox" checked={value.cashAccepted === true} disabled={disabled}
            onChange={e => onChange({ ...value, cashAccepted: e.target.checked })} /><span>Tôi đã hiểu: quá {CASH_REFUND_DAYS} ngày không đến nhận, tôi mất khoản hoàn</span></label>
        </div>}
  </div>;
}
