import React from "react";
import { DetailList, Notice } from "../../../shared/components/UI.jsx";
import { amountLabel, DamagePhotos } from "../damage/DamageComponents.jsx";
export function SettlementSummary({deposit,damage,cleaning,overdue,amount,official=false}) {
 const known=[deposit,damage,cleaning,overdue].every(v=>typeof v==="number"&&Number.isFinite(v)&&v>=0),deduction=known?Math.min(deposit,damage+cleaning+overdue):undefined;
 return <aside className="panel customer-detail__card customer-detail__sidebar"><h2>Đối chiếu khấu trừ từ cọc</h2><DetailList items={[["Cọc ban đầu",amountLabel(deposit)],["Quá hạn",amountLabel(overdue)],["Vệ sinh",amountLabel(cleaning)],["Hư hỏng",amountLabel(damage)],["Tổng khấu trừ",amountLabel(deduction)],["Dự kiến hoàn cọc",amountLabel(official?amount:(amount ?? (known?Math.max(0,deposit-deduction):undefined)))]]}/><p className="hint">Khấu trừ tối đa bằng cọc, không tạo nợ vượt cọc. Đây là bản đối chiếu; tiền hoàn chính thức do máy chủ chốt.</p></aside>;
}
export function OpsDemo({source}) {return source==="local"?<Notice>Chế độ mô phỏng FE: thao tác lưu trên trình duyệt, không chuyển tiền hoặc thay đổi quyền mở kho thật.</Notice>:null;}

export function InspectionReview({ret}) {return <section className="panel customer-detail__card"><h2>Biên bản kiểm kê &amp; ảnh</h2><DetailList items={[["Đồ còn lại",ret?.report?.items||"Chưa có dữ liệu"],["Tường, sàn, cửa",ret?.report?.walls||"Chưa có dữ liệu"],["Chìa khóa",ret?.report?.keys||"Chưa có dữ liệu"],["Hạng mục hư hỏng",ret?.report?.damage_item||"Chưa có dữ liệu"],["Lý do khấu trừ",ret?.report?.fee_reason||"Không có nội dung bổ sung"],["Trạng thái đề xuất",ret?.report?.proposal||"Chưa có dữ liệu"]]}/><DamagePhotos photos={ret?.report?.photos}/>{ret?.report?.photo_files?.length>0&&<p className="hint">Tệp mô phỏng: {ret.report.photo_files.map(f=>f.fileName).join(", ")}</p>}</section>;}
