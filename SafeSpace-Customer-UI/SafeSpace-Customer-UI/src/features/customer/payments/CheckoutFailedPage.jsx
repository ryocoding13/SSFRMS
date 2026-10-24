import React, { useEffect } from "react";
import { DetailList, Icon, LinkButton } from "../../../shared/components/UI.jsx";
import { go } from "../../../app/router.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "../reservations/components/ReservationNotFound.jsx";

export function CheckoutFailedPage({ id }) {
  const { data } = useApp();
  const r = data.reservations.find((x) => x.reservation_id === id);

  // Nếu đơn chưa bị hủy, chuyển về trang phù hợp với trạng thái hiện tại.
  useEffect(() => {
    if (r && r.status !== "CANCELLED") go(r.status === "PENDING_PAYMENT" ? `checkout/${id}` : `confirmation/${id}`, { replace: true });
  }, [r?.status, id]);

  // Hiển thị trang không tìm thấy khi ID không khớp với đơn đặt chỗ nào.
  if (!r) return <NotFound />;

  return (
    <main className="result">
      <section className="panel result__card">
        <span className="result__icon result__icon--fail"><Icon name="close" size={26} /></span>
        <h1>Đặt chỗ không thành công</h1>
        <p className="lead">Chúng tôi chưa nhận được thanh toán trong thời gian giữ chỗ, nên đơn đặt chỗ đã được huỷ.</p>

        {/* Dùng lý do hủy mặc định nếu đơn không có cancel_reason. */}
        <DetailList items={[["Lý do", r.cancel_reason || "Khách hàng huỷ đặt chỗ"], ["Trạng thái", "Đã huỷ đặt chỗ"]]} />

        <LinkButton to="home" block>Về trang chủ</LinkButton>
        <LinkButton to="find" variant="outline" block>Xem cơ sở khác</LinkButton>
      </section>
    </main>
  );
}
