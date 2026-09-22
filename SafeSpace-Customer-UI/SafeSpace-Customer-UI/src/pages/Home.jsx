import React, { useState } from "react";
import { Photo } from "../components/Photo";
import { Pagination } from "../components/Pickers";
import { Icon, LinkButton } from "../components/UI";
import { minRate, offerTypes, typeLabel } from "../lib/catalog";
import { money } from "../lib/format";
import { useApp } from "../state/store";

const PER_PAGE = 9;

const FEATURES = [
  ["bolt", "Tiện lợi", "Đặt kho, quản lý và gia hạn chỉ trong vài thao tác, mọi lúc mọi nơi."],
  ["shield", "An toàn", "Giám sát 24/7, kiểm soát ra vào chặt chẽ và bảo vệ tài sản của bạn."],
  ["auto", "Tự động hoá", "Theo dõi tình trạng kho, lịch hẹn và hợp đồng rõ ràng trong một tài khoản."],
];

export default function Home() {
  const { data, authed } = useApp();
  const [page, setPage] = useState(1);
  const total = data.facilities.length;
  const pages = Math.ceil(total / PER_PAGE);
  const from = (page - 1) * PER_PAGE;
  const shown = data.facilities.slice(from, from + PER_PAGE);

  return (
    <>
      <section className="hero">
        <div className="hero__inner">
          <div className="hero__copy">
            <span className="pill">HỆ THỐNG KHO BÃI TỰ ĐỘNG</span>
            <h1>
              Thêm không gian.
              <br />
              Thêm an tâm.
            </h1>
            <p>Tìm kho vừa nhu cầu, đặt chỗ rõ ràng và quản lý không gian lưu trữ của bạn ở một nơi.</p>
            <div className="hero__actions">
              <LinkButton to="find">Bắt đầu ngay</LinkButton>
              <LinkButton to="guide" variant="light">Tìm hiểu thêm</LinkButton>
            </div>
          </div>
          <Photo hero facility={data.facilities[0]} className="hero__photo" />
        </div>
      </section>

      <section className="features">
        <div className="container features__grid">
          {FEATURES.map(([icon, title, text], i) => (
            <article className="panel feature" key={title}>
              <span className={`feature__icon${i === 2 ? " feature__icon--dark" : ""}`}>
                <Icon name={icon} size={18} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container home-list">
        <h2>Một không gian phù hợp, gần bạn</h2>
        <p className="lead">Xem hình ảnh cơ sở, diện tích và giá thuê trước khi đặt chỗ.</p>
        <div className="facility-grid">
          {shown.map((f) => (
            <article className="panel facility-card facility-card--compact" key={f.facility_id}>
              <Photo facility={f} />
              <h3>{f.name}</h3>
              <p className="price">{minRate(f) != null ? `Từ ${money(minRate(f))} / tháng` : "Liên hệ để nhận giá"}</p>
              <p className="muted">{offerTypes(f).map(typeLabel).join(" · ") || "Kho thường"}</p>
              <LinkButton to={`find/${f.facility_id}`}>Khám phá cơ sở</LinkButton>
            </article>
          ))}
        </div>
        <Pagination page={page} pages={pages} total={total} from={from + 1} to={from + shown.length} onPage={setPage} />
      </section>

      <section className="cta">
        <h2>Sẵn sàng bắt đầu?</h2>
        <p>{authed ? "Chào mừng bạn quay lại SafeSpace." : "Khách hàng mới tạo tài khoản nhanh chóng chưa đầy 1 phút."}</p>
        <div className="cta__actions">
          {authed ? (
            <>
              <LinkButton to="find" variant="light">Tìm kho mới</LinkButton>
              <LinkButton to="overview" variant="ghost-dark">Xem tổng quan</LinkButton>
            </>
          ) : (
            <>
              <LinkButton to="register" variant="light">Tạo tài khoản khách hàng</LinkButton>
              <LinkButton to="login" variant="ghost-dark">Đăng nhập</LinkButton>
            </>
          )}
        </div>
      </section>
    </>
  );
}
