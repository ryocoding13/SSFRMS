import React from "react";
import { LinkButton, PageHeader, Tag } from "../../../shared/components/UI.jsx";

export function RequestSentPage({ query }) {
  const contract = query.get("contract");
  return (
    <main className="container page">
      <PageHeader title="Đã gửi yêu cầu đến cơ sở" description="Yêu cầu đã được ghi nhận. Bạn sẽ nhận thông báo khi có kết quả." />
      <section className="panel form-card">
        <Tag tone="amber" square>Chờ cơ sở xác nhận</Tag>
        <h3>Tiếp theo</h3>
        <p className="muted">
          Nhân viên hoặc quản lý kiểm tra thông tin và phản hồi qua thông báo. Trạng thái thuê kho hiện tại vẫn được giữ cho đến khi yêu cầu được xử lý.
        </p>
        <div className="stack stack--col">
          <LinkButton to="units">Về kho của tôi</LinkButton>
          {contract && <LinkButton to={`units/${encodeURIComponent(contract)}`} variant="outline">Xem hợp đồng</LinkButton>}
        </div>
      </section>
    </main>
  );
}
