import React from "react";
import { Empty, LinkButton } from "../../../../shared/components/UI.jsx";

export function NotFound() {
  return (
    <main className="container page">
      <Empty title="Không tìm thấy đơn đặt chỗ" text="Đơn này không tồn tại hoặc không thuộc tài khoản của bạn.">
        <LinkButton to="reservations">Xem đơn đặt chỗ của tôi</LinkButton>
      </Empty>
    </main>
  );
}
