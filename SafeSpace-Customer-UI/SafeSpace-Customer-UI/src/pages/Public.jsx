import React, { useState } from "react";
import { Icon, LinkButton, PageHeader } from "../components/UI";
import { SIZE_BANDS, minRate } from "../lib/catalog";
import { money } from "../lib/format";
import { useApp } from "../state/store";

export function Pricing() {
  const { data } = useApp();
  return (
    <main className="container page">
      <PageHeader title="Chi phí rõ ràng, dễ lựa chọn" description="Giá tham khảo theo diện tích. Giá chính xác phụ thuộc cơ sở, loại kho và kỳ thuê." />
      <div className="grid grid--3">
        {SIZE_BANDS.map((b) => {
          const rates = data.facilities.map((f) => minRate(f, { band: b.id })).filter((x) => x != null);
          const min = rates.length ? Math.min(...rates) : null;
          return (
            <article className="panel price-card" key={b.id}>
              <h2>{b.name}</h2>
              <span className="tag tag--soft">{b.label.replaceAll(" – ", "–")}</span>
              <p className="price price--lg">{min == null || b.id === "L" ? "Xem giá theo cơ sở" : `Từ ${money(min)} / tháng`}</p>
              <p className="muted">{b.note}</p>
              <LinkButton to={`find?band=${b.id}`}>Tìm kho phù hợp</LinkButton>
            </article>
          );
        })}
      </div>
      <section className="panel note-card">
        <h3>Tiền thuê, tiền cọc và phí phát sinh</h3>
        <p className="muted">
          Bảng tổng hợp trước thanh toán hiển thị tiền thuê theo kỳ, cọc và phí áp dụng. Tiền cọc được đối chiếu khi trả kho; phí gia hạn, huỷ hoặc quá hạn áp dụng theo chính sách hợp đồng.
        </p>
      </section>
    </main>
  );
}

const FAQ = [
  {
    q: "Tôi chọn kho như thế nào?",
    a: "Chọn loại kho, diện tích và khu vực để tìm cơ sở phù hợp. Gói thuê (1, 3 hoặc 6 tháng) và ngày bắt đầu được chọn ở trang chi tiết cơ sở.",
    steps: ["Vào Tìm & đặt kho, chọn loại kho, diện tích và khu vực.", "Mở chi tiết cơ sở để xem ảnh, sơ đồ và giá theo gói thuê.", "Chọn ngày bắt đầu rồi bấm Tiếp tục đặt chỗ."],
  },
  {
    q: "Khi nào tôi nhận được mã kho?",
    a: "Sau khi đơn được xác nhận, quản lý phân bổ kho. Bạn đến theo lịch hẹn để nhân viên xác minh và bàn giao.",
    steps: ["Theo dõi trạng thái tại mục Đặt chỗ.", "Cơ sở kiểm tra và phân bổ kho phù hợp với nhu cầu của bạn.", "Mang giấy đăng ký và mã đặt chỗ đến đúng giờ hẹn."],
  },
  {
    q: "Chuyển khoản xong đã hoàn tất chưa?",
    a: "Đơn chuyển sang chờ đối soát. Nhân viên kiểm tra giao dịch trước khi xác nhận đã thanh toán.",
    steps: ["Quét mã QR và giữ nguyên nội dung chuyển khoản.", "Bấm Tôi đã chuyển khoản trước khi hết thời gian giữ chỗ.", "Theo dõi kết quả đối soát tại Thanh toán & lịch hẹn."],
  },
  {
    q: "Tôi muốn gia hạn hoặc trả kho?",
    a: "Mở Kho của tôi → Hợp đồng và gửi yêu cầu. Cơ sở phản hồi qua thông báo trong tài khoản.",
    steps: ["Chọn kho đang thuê và xem ngày kết thúc hợp đồng.", "Gửi yêu cầu gia hạn, hoặc đăng ký lịch trả kho để cơ sở kiểm tra.", "Tiền cọc được đối chiếu sau khi nhân viên kiểm tra kho."],
  },
];

export function Guide() {
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
