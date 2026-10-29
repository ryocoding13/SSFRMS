import React from "react";
import { DetailList, Tag } from "./UI.jsx";
import { money } from "../utils/format.js";
export const refundStatus = r => r.amount != null && Number.isFinite(Number(r.amount)) && Number(r.amount) <= 0 ? "Không còn cọc hoàn" : r.status === "PAID" ? "Đã hoàn" : r.status === "PENDING" ? "Chờ hoàn" : "Đang xử lý";
export const refundMoney = n => n == null || n === "" || !Number.isFinite(Number(n)) ? "Chưa có dữ liệu" : money(n);
export default function RefundSummary({ refund }) {
  const r = refund;
  return <><div className="customer-detail__actions"><Tag tone={r.status === "PAID" ? "green" : "amber"}>{refundStatus(r)}</Tag></div><DetailList items={[["Số tiền hoàn", refundMoney(r.amount)], ["Cọc ban đầu", refundMoney(r.deposit)], ["Phí quá hạn", refundMoney(r.overdue)], ["Phí vệ sinh", refundMoney(r.cleaning)], ["Phí hư hỏng", refundMoney(r.damage)], ...(r.unpaid > 0 ? [["Khấu trừ khác (dữ liệu cũ)", refundMoney(r.unpaid)]] : [])]} /><p className="hint">Số tiền do cơ sở đối soát. Tổng khấu trừ tối đa bằng cọc; không phát sinh khoản phải trả thêm ngoài cọc.</p></>;
}
