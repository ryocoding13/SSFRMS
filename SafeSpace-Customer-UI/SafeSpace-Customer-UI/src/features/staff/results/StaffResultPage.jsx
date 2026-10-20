import React from "react";
import { Icon, LinkButton, Tag } from "../../../shared/components/UI.jsx";

export const DONE_TEXT = {
  payment: ["Đã xác nhận thu tiền", "Đơn chuyển sang bước phân bổ / bàn giao kho. Khách hàng nhận thông báo thanh toán thành công."],
  mismatch: ["Đã gửi báo sai lệch", "Quản lý cơ sở sẽ liên hệ khách để đối chiếu lại giao dịch."],
  handover: ["Đã bàn giao kho", "Kho chuyển sang trạng thái \"Đang hoạt động\" và khách hàng có thể sử dụng ngay."],
  return: ["Đã gửi biên bản trả kho", "Biên bản đã được chuyển đến quản lý cơ sở để xác nhận hoàn cọc."],
  support: ["Đã ghi nhận xử lý", "Phản hồi đã được chuyển đến khách hàng và quản lý cơ sở."],
};

export function StaffResultPage({ query }) {
  const [title, text] = DONE_TEXT[query.get("kind")] || ["Đã lưu thông tin xử lý", "Biên bản và phản hồi đã được chuyển đến người phụ trách."];
  return (
    <main className="container page page--narrow">
      <section className="panel ops-card ops-done">
        <span className="result__icon"><Icon name="check" size={30} /></span>
        <h1>{title}</h1>
        <p className="muted">{text}</p>
        <Tag tone="green">Đã ghi nhận</Tag>
        <div className="note-box">
          <strong>Lưu ý vận hành</strong>
          <p className="muted">Kho trả lại vẫn chờ kiểm tra/vệ sinh. Yêu cầu hỗ trợ chỉ đóng sau khi kết quả xử lý được xác nhận.</p>
        </div>
        <LinkButton to="staff" block>Về công việc trong ngày</LinkButton>
      </section>
    </main>
  );
}
