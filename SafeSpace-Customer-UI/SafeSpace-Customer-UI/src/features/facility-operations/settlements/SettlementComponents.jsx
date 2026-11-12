import React from "react";
import { DetailList, Notice, Tag } from "../../../shared/components/UI.jsx";
import { amountLabel, DamagePhotos, timeLabel } from "../damage/DamageComponents.jsx";
import "./settlements.css";
// D49: trả sớm sau StartDate hoàn 100% cọc nếu đạt chuẩn, khấu trừ vệ sinh/hư hỏng/quá hạn vào cọc như trả đúng hạn; hoàn thêm tiền thuê tháng chưa bắt đầu khi BE chốt.
export function SettlementSummary({deposit,damage,cleaning,overdue,amount,official=false,keep}) {
 const hasKeep=typeof keep==="number"&&keep>0,known=[deposit,damage,cleaning,overdue].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0),deduction=known?Math.min(deposit,damage+cleaning+overdue+(hasKeep?keep:0)):undefined;
 return <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Đối chiếu khấu trừ từ cọc</h2><DetailList items={[["Cọc ban đầu",amountLabel(deposit)],...(hasKeep?[["Giữ cọc",amountLabel(keep)]]:[]),["Quá hạn",amountLabel(overdue)],["Vệ sinh",amountLabel(cleaning)],["Hư hỏng",amountLabel(damage)],["Tổng khấu trừ",amountLabel(deduction)],["Dự kiến hoàn cọc",amountLabel(official?amount:(amount ?? (known?Math.max(0,deposit-deduction):undefined)))]]}/><p className="hint">{typeof keep==="number"?"Khách trả trước ngày hết hạn: hoàn 100% cọc (trừ vệ sinh/hư hỏng/quá hạn nếu có) và tiền thuê các tháng nguyên chưa bắt đầu khi quản lý chốt. ":""}Khấu trừ tối đa bằng cọc, không tạo nợ vượt cọc. Đây là bản đối chiếu; tiền hoàn chính thức do máy chủ chốt.</p></aside>;
}
export function OpsDemo({source}) {return source==="local"?<Notice>Chế độ mô phỏng FE: thao tác lưu trên trình duyệt, không chuyển tiền hoặc thay đổi quyền mở kho thật.</Notice>:null;}

// #17 · Figma M-ĐS: tách kiểm kê, hư hỏng & khấu trừ, ảnh hiện trạng; nhãn và giá trị thẳng hàng, không khối lồng.
export function InspectionReview({ret}) {
 const r=ret?.report;
 if(!r) return <section className="panel customer-detail__card"><h2>Biên bản kiểm tra</h2><Notice>Chưa có biên bản và ảnh hiện trạng của nhân viên.</Notice></section>;
 return <>
  <section className="panel customer-detail__card"><h2>Kiểm kê</h2><DetailList items={[["Đồ còn lại",r.items||"Chưa có dữ liệu"],["Tường, sàn, cửa",r.walls||"Chưa có dữ liệu"],["Chìa khóa",r.keys||"Chưa có dữ liệu"],["Trạng thái ô đề xuất",r.proposal||"Chưa có dữ liệu"],["Nhân viên gửi",ret?.submitted_at?timeLabel(ret.submitted_at):"Chưa có thông tin"]]}/></section>
  <section className="panel customer-detail__card"><h2>Hư hỏng &amp; khấu trừ</h2><DetailList items={[["Vệ sinh",r.cleaning_required?`Chưa đạt · 10% cọc · ${amountLabel(r.cleaning_fee)}`:"Đạt"],["Hạng mục hư hỏng",r.damage_item||"Không có"],["Khấu trừ hư hỏng",amountLabel(Number(r.damage_fee)||0)],["Lý do / ghi chú",r.fee_reason||"Không có nội dung bổ sung"],["Khách phản hồi",DEDUCTION_LABEL[ret?.deduction_status]||"Chưa có dữ liệu"]]}/></section>
  <section className="panel customer-detail__card"><h2>Ảnh hiện trạng</h2><p className="hint">Bấm vào ảnh để xem lớn.</p><DamagePhotos photos={r.photos} emptyText="Chưa có ảnh hiện trạng."/>{r.photo_files?.length>0&&<p className="hint">Tệp mô phỏng: {r.photo_files.map(f=>f.fileName).join(", ")}</p>}</section>
 </>;
}
const DEDUCTION_LABEL={NONE:"Không có khoản khấu trừ",WAITING:"Đang chờ khách phản hồi",AGREED:"Khách đồng ý",AUTO_AGREED:"Hết 48 giờ · áp dụng theo biên bản",SELF_CLEAN:"Khách tự dọn · chờ kiểm tra lại",SELF_REPLACE:"Khách tự thay · chờ kiểm tra lại",SELF_REMEDY:"Khách tự khắc phục · chờ kiểm tra lại",DISPUTE:"Khách khiếu nại · chờ xử lý",RECHECKED:"Đã kiểm tra lại"};

/**
 * #16 (Lượt 2) · Figma M-ĐS: bảng đối soát một nguồn số liệu. Hiện cọc, từng khoản khấu trừ (lý do, tỷ lệ, số tiền),
 * tổng khấu trừ, cọc còn hoàn, tiền thuê được hoàn, tổng tiền hoàn; ghi rõ Dự kiến / Chính thức.
 * settlement: kết quả settlementOf / settlementFromRefund / depositSidePreview. report: biên bản (lý do khấu trừ).
 */
export function SettlementTable({settlement:s,report,title="Bảng đối soát",aside=true}) {
 const Box=aside?"aside":"section";
 if(!s) return <Box className="panel customer-detail__card customer-detail__sidebar settlement-table"><h2>{title}</h2><Notice>Chưa có bảng đối soát: cần biên bản kiểm tra và ảnh hiện trạng của nhân viên.</Notice></Box>;
 const items=[
  ["Phí vệ sinh",`10% cọc${report?.fee_reason?` · ${report.fee_reason}`:""}`,s.cleaning],
  ["Hư hỏng",`Theo biên bản${report?.damage_item?` · ${report.damage_item}`:""}`,s.damage],
  ["Phí quá hạn","Tính đến lúc khách gửi trả kho",s.overdue],
 ].filter(([,,v])=>v>0);
 const early=s.scenario==="EarlyStop",months=Number.isInteger(s.monthsTotal)&&Number.isInteger(s.monthsCharged);
 return <Box className="panel customer-detail__card customer-detail__sidebar settlement-table">
  <div className="settlement-table__head"><h2>{title}</h2><Tag tone={s.official?"green":"blue"}>{s.official?"Chính thức":"Dự kiến"}</Tag></div>
  <div className="settlement-table__row"><span>Tiền cọc</span><strong>{amountLabel(s.deposit)}</strong></div>
  <p className="settlement-table__label">Khấu trừ</p>
  {items.length?items.map(([k,why,v])=><div className="settlement-table__row" key={k}><span>{k}<small>{why}</small></span><strong className="settlement-table__minus">− {amountLabel(v)}</strong></div>)
   :<p className="hint">Không có khoản khấu trừ.</p>}
  <hr/>
  <div className="settlement-table__row"><span>Tổng khấu trừ</span><strong>{amountLabel(s.totalDeduction)}</strong></div>
  <div className="settlement-table__row"><span>Cọc còn hoàn</span><strong>{amountLabel(s.depositRefund)}</strong></div>
  <div className="settlement-table__row"><span>Tiền thuê được hoàn</span><strong>{s.partial?"Hiện sau khi gửi biên bản":amountLabel(s.rentRefund)}</strong></div>
  {!s.partial&&s.scenario&&<p className="hint">{early&&months?`Đã bắt đầu ${s.monthsCharged}/${s.monthsTotal} tháng (tính từ 00:00 ngày nhận kho) → tính tiền ${s.monthsCharged} tháng, hoàn ${s.monthsTotal-s.monthsCharged} tháng chưa bắt đầu.`:early?"Hoàn tiền thuê các tháng chưa bắt đầu sử dụng.":"Trả kho khi hết hạn: không có tháng thuê chưa sử dụng."}</p>}
  {!s.partial&&<div className="settlement-table__total"><span>Tổng tiền hoàn</span><strong>{amountLabel(s.total)}</strong></div>}
  <p className="hint">Không giữ 30% cọc. Khấu trừ tối đa bằng cọc, không phát sinh khoản phải trả thêm.{s.official?"":" Số dự kiến trở thành chính thức khi quản lý chốt đối soát."}</p>
 </Box>;
}
