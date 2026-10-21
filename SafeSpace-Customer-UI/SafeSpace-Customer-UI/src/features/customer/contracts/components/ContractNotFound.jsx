import React from "react";
import { Empty, LinkButton } from "../../../../shared/components/UI.jsx";

export function NotFound() {
  return (
    <main className="container page">
      <Empty title="Không tìm thấy hợp đồng" text="Hợp đồng này không tồn tại hoặc không thuộc tài khoản của bạn.">
        <LinkButton to="units">Về kho của tôi</LinkButton>
      </Empty>
    </main>
  );
}
