import React from "react";
import { DetailList, Tag } from "./UI.jsx";
import { money } from "../utils/format.js";
const isCash = r => r?.method === "CASH" || r?.bankName === "CASH";
// D68: ghi rõ tiền hoàn đi đâu — đã chuyển khoản, hay đã về quầy cơ sở chờ khách đến nhận
export const refundStatus = r => r.amount != null && Number.isFinite(Number(r.amount)) && Number(r.amount) <= 0 ? "Không còn cọc hoàn"
  : r.status === "PAID" ? (isCash(r) ? "Tiền đã về quầy · mời đến nhận" : "Đã chuyển khoản")
  : r.status === "PENDING" ? (isCash(r) ? "Chờ chuyển tiền về quầy" : "Chờ chuyển khoản") : "Đang xử lý";
const stampVn = v => v && Number.isFinite(Date.parse(v)) ? new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v)) : "";
export function refundWhere(r, facilityName) {
  if (!r || !(Number(r.amount) > 0)) return "";
  if (isCash(r)) return r.status === "PAID"
    ? `${money(r.amount)} đã chuyển về quầy SafeSpace${facilityName ? ` ${facilityName}` : ""}${r.paidAt ? ` lúc ${stampVn(r.paidAt)}` : ""}. Mời bạn đến quầy nhận tiền mặt.`
    : `Cơ sở sẽ chuyển ${money(r.amount)} về quầy${facilityName ? ` ${facilityName}` : ""}; bạn nhận tiền mặt tại quầy sau khi có thông báo.`;
  // Chỉ hiện 4 số cuối tài khoản
  const tail = String(r.accountNumber || "").replace(/\s/g, "").slice(-4);
  const acct = [r.bankName, tail && `tài khoản ••••${tail}`].filter(Boolean).join(" · ") || "tài khoản đã khai báo";
  return r.status === "PAID"
    ? `Đã chuyển khoản ${money(r.amount)} vào ${acct}${r.paidAt ? ` lúc ${stampVn(r.paidAt)}` : ""}.`
    : `Cơ sở sẽ chuyển khoản ${money(r.amount)} vào ${acct}.`;
}
export const refundMoney = n => n == null || n === "" || !Number.isFinite(Number(n)) ? "Chưa có dữ liệu" : money(n);
export default function RefundSummary({ refund, facilityName }) {
  const r = refund;
  const where = refundWhere(r, facilityName);
  return <><div className="customer-detail__actions"><Tag tone={r.status === "PAID" ? "green" : "amber"}>{refundStatus(r)}</Tag></div>{where && <p className="refund-where">{where}</p>}<DetailList items={[["Số tiền hoàn", refundMoney(r.amount)], ["Cọc ban đầu", refundMoney(r.deposit)], ["Phí quá hạn", refundMoney(r.overdue)], ["Phí vệ sinh", refundMoney(r.cleaning)], ["Phí hư hỏng", refundMoney(r.damage)], ...(r.unpaid > 0 ? [["Khấu trừ khác (dữ liệu cũ)", refundMoney(r.unpaid)]] : [])]} /><p className="hint">Số tiền do cơ sở đối soát. Tổng khấu trừ tối đa bằng cọc; không phát sinh khoản phải trả thêm ngoài cọc.</p></>;
}
