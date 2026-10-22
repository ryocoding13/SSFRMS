import React, { useState } from "react";
import { Icon, LinkButton, PageHeader } from "../../../shared/components/UI.jsx";

export const FAQ = [
  {
    q: "Tôi chọn kho như thế nào?",
    a: "Chọn loại kho, diện tích và khu vực để tìm cơ sở phù hợp. Gói thuê (1, 3 hoặc 6 tháng) và ngày bắt đầu được chọn ở trang chi tiết cơ sở.",
    steps: ["Vào Tìm & đặt kho, chọn loại kho, diện tích và khu vực.", "Mở chi tiết cơ sở để xem ảnh, sơ đồ và giá theo gói thuê.", "Chọn ngày bắt đầu rồi bấm Tiếp tục đặt chỗ."],
  },
  {
    q: "Khi nào tôi nhận được mã kho?",
    a: "Sau khi thanh toán được xác nhận, hệ thống tự chọn ô phù hợp và cấp hợp đồng cùng QR/PIN. Chìa khóa vật lý nhận tại quầy. Mã chỉ mở kho trong kỳ thuê.",
    steps: ["Theo dõi trạng thái tại mục Đặt chỗ.", "Cơ sở kiểm tra và phân bổ kho phù hợp với nhu cầu của bạn.", "Mang giấy đăng ký và mã đặt chỗ đến đúng giờ hẹn."],
  },
  {
    q: "Thanh toán xong đã hoàn tất chưa?",
    a: "Khi thanh toán bằng mã QR, đơn tự xác nhận ngay sau khi giao dịch thành công. Chọn thanh toán tại cửa hàng thì cơ sở giữ chỗ 24 giờ và xác nhận khi bạn trả tiền tại quầy.",
    steps: ["Quét mã QR bằng ứng dụng ngân hàng trước khi hết thời gian giữ chỗ.", "Trang tự chuyển sang xác nhận khi thanh toán thành công, không cần bấm thêm.", "Theo dõi khoản thu tại Thanh toán & lịch hẹn."],
  },
  {
    q: "Tôi muốn gia hạn hoặc trả kho?",
    a: "Mở Kho của tôi → Hợp đồng và gửi yêu cầu. Cơ sở phản hồi qua thông báo trong tài khoản.",
    steps: ["Chọn kho đang thuê và xem ngày kết thúc hợp đồng.", "Gửi yêu cầu gia hạn, hoặc đăng ký lịch trả kho để cơ sở kiểm tra.", "Tiền cọc được đối chiếu sau khi nhân viên kiểm tra kho."],
  },
];

export function HelpPage() {
  const [open, setOpen] = useState(null);
  return (
    <main className="container page">
      <PageHeader title="Thuê kho dễ hơn với SafeSpace" description="Tìm câu trả lời nhanh trước khi bắt đầu." />
      <div className="faq">
        {FAQ.map((item, i) => {
          const isOpen = open === i;
          return (
            <article className="panel faq__item" key={item.q}>
              <button type="button" className="faq__head" aria-expanded={isOpen} aria-controls={`faq-${i}`} onClick={() => setOpen(isOpen ? null : i)}>
                <span>
                  <strong>{item.q}</strong>
                  <span className="muted">{item.a}</span>
                </span>
                <Icon name={isOpen ? "minus" : "plus"} size={18} />
              </button>
              {isOpen && (
                <ol className="faq__steps" id={`faq-${i}`}>
                  {item.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              )}
            </article>
          );
        })}
      </div>
      <LinkButton to="support">Gửi yêu cầu hỗ trợ</LinkButton>
    </main>
  );
}
