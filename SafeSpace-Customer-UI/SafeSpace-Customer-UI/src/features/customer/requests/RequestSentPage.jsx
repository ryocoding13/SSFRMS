import React from "react";
import { LinkButton, PageHeader, Tag } from "../../../shared/components/UI.jsx";

export function RequestSentPage({ query }) {
  const contract = query.get("contract");
  const isReturn = query.get("type") === "return";
  return (
    <main className="container page">
      <PageHeader title="Đã gửi yêu cầu đến cơ sở" description="Yêu cầu đã được ghi nhận. Bạn sẽ nhận thông báo khi có kết quả." />
      <section className="panel form-card">
        <Tag tone="amber" square>Chờ cơ sở xác nhận</Tag>
        <h3>Tiếp theo</h3>
        {/* D40 · D30-03: sau khi gửi trả kho, nhắc khách theo dõi biên bản và xác nhận trong 48 giờ */}
        {isReturn ? <p className="muted">
          Trong <strong>3 ngày</strong>, nhân viên gửi biên bản kiểm tra và số tiền hoàn dự kiến. Theo dõi chuông và email: bạn có <strong>48 giờ</strong> để xác nhận khấu trừ; quá hạn, hệ thống tự hoàn theo biên bản.
        </p> : <p className="muted">
          Nhân viên hoặc quản lý kiểm tra thông tin và phản hồi qua thông báo. Trạng thái thuê kho hiện tại vẫn được giữ cho đến khi yêu cầu được xử lý.
        </p>}
        <div className="stack stack--col">
          <LinkButton to="units">Về kho của tôi</LinkButton>
          {contract && <LinkButton to={`units/${encodeURIComponent(contract)}`} variant="outline">Xem hợp đồng</LinkButton>}
          {contract && isReturn && <LinkButton to={`units/${encodeURIComponent(contract)}/deduction`} variant="outline">Xem biên bản & xác nhận khấu trừ</LinkButton>}
        </div>
      </section>
    </main>
  );
}
