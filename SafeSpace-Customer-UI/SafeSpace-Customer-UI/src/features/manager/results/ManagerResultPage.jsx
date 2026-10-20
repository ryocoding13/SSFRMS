import React from "react";
import { Icon, LinkButton, Tag } from "../../../shared/components/UI.jsx";

export const DONE_TEXT = {
  allocate: "Kho đã được giữ cho đơn đặt chỗ. Nhân viên cơ sở sẽ xác minh khách và bàn giao theo lịch hẹn.",
  assign: "Nhân viên được phân công đã nhận thông báo công việc mới.",
  refund: "Hợp đồng đã đóng, kho chuyển về trạng thái trống để cho thuê lại.",
};

export function ManagerResultPage({ query }) {
  return (
    <main className="container page page--narrow">
      <section className="panel ops-card ops-done">
        <span className="result__icon"><Icon name="check" size={30} /></span>
        <h1>Đã ghi nhận cập nhật</h1>
        <p className="muted">{DONE_TEXT[query.get("kind")] || "Thông tin công việc đã được lưu vào luồng vận hành của cơ sở."}</p>
        <Tag tone="green">Cập nhật thành công</Tag>
        <div className="note-box">
          <strong>Theo dõi bước tiếp theo</strong>
          <p className="muted">Kiểm tra danh sách kho, lịch phân công và công việc đang chờ nhân viên thực hiện.</p>
        </div>
        <div className="ops-actions">
          <LinkButton to="manager">Về tổng quan cơ sở</LinkButton>
          <LinkButton to="manager/assign" variant="outline">Xem lịch phân công</LinkButton>
        </div>
      </section>
    </main>
  );
}
