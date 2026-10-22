import React, { useState } from "react";
import { Photo } from "../../../shared/components/Photo.jsx";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Icon, LinkButton } from "../../../shared/components/UI.jsx";
import { SIZE_BANDS, UNIT_TYPES, areaLabel, listAreas, minRate } from "../../../shared/utils/catalog.js";
import { money } from "../../../shared/utils/format.js";
import { go, href, qs } from "../../../app/router.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

// Trang chủ theo Figma "START · SafeSpace / Trang chủ" (14/10):
// hero ảnh + tìm kho theo khu vực → số liệu → 4 loại kho → 3 bước → cơ sở theo khu vực → kêu gọi → footer.
// Gợi ý theo khu vực khách chọn, không theo vị trí người dùng.

const UNITS_PER_FACILITY = 12; // 8 kho thường (4 M + 4 L) + 4 kho lạnh (2 M + 2 L)
const CARDS_SHOWN = 6;

const KINDS = [
  { type: "normal", band: "M", note: "Đồ đạc một phòng, hàng shop online, hồ sơ giấy tờ." },
  { type: "normal", band: "L", note: "Đồ chuyển nhà 2–3 phòng ngủ, hàng tồn kho số lượng lớn." },
  { type: "climate", band: "M", note: "Thiết bị điện tử, tài liệu, đồ gỗ cần tránh ẩm." },
  { type: "climate", band: "L", note: "Hàng hoá cần giữ nhiệt độ ổn định, kho hàng cho cửa hàng." },
];

const STEPS = [
  ["Chọn khu vực", "Chọn quận bạn muốn gửi đồ, SafeSpace gợi ý các cơ sở trong khu vực đó."],
  ["Chọn loại và cỡ kho", "Kho thường hoặc kho lạnh, cỡ M hay L. Giá hiện rõ theo tháng."],
  ["Xem ô trống và đặt chỗ", "Xem sơ đồ từng ô, tiền thuê, tiền cọc và thanh toán bằng QR."],
];

const districtOf = (area) => area.split(",")[0].trim();
const lowest = (facilities, filter) => {
  const rates = facilities.map((f) => minRate(f, filter)).filter((x) => x != null);
  return rates.length ? Math.min(...rates) : null;
};

function HeroSearch({ facilities }) {
  const [draft, setDraft] = useState({ area: "", type: "", band: "" });
  const set = (key) => (e) => setDraft({ ...draft, [key]: e.target.value });
  return (
    <form
      className="home-search"
      aria-label="Tìm kho theo khu vực"
      onSubmit={(e) => {
        e.preventDefault();
        go(`find${qs(draft)}`);
      }}
    >
      <label className="home-search__field">
        <span>Khu vực</span>
        <Select value={draft.area} onChange={set("area")}>
          <option value="">Tất cả khu vực</option>
          {listAreas(facilities).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </label>
      <label className="home-search__field">
        <span>Loại kho</span>
        <Select value={draft.type} onChange={set("type")}>
          <option value="">Kho thường hoặc kho lạnh</option>
          {UNIT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </Select>
      </label>
      <label className="home-search__field">
        <span>Cỡ kho</span>
        <Select value={draft.band} onChange={set("band")}>
          <option value="">Cỡ M hoặc cỡ L</option>
          {SIZE_BANDS.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </Select>
      </label>
      <button type="submit" className="btn btn--primary home-search__submit">
        <Icon name="search" size={18} />
        Tìm kho trống
      </button>
    </form>
  );
}

function FacilityCard({ f }) {
  const from = minRate(f);
  const types = [...new Set(f.offers.map((o) => o.type))];
  return (
    <a className="home-facility" href={href(`find/${f.facility_id}`)} aria-label={`Xem ô trống tại ${f.name}`}>
      <Photo facility={f} />
      <div className="home-facility__body">
        <span className="home-eyebrow">{f.district || districtOf(areaLabel(f))}</span>
        <h3>{f.name}</h3>
        <ul className="home-tags" aria-label="Loại kho">
          {types.includes("normal") && <li>Kho thường</li>}
          {types.includes("climate") && <li>Kho lạnh</li>}
          <li>Cỡ M · L</li>
        </ul>
        <div className="home-facility__foot">
          <p>
            <small>Từ</small>
            <strong>{from != null ? `${money(from)} / tháng` : "Liên hệ"}</strong>
          </p>
          <span className="home-link">Xem ô trống →</span>
        </div>
      </div>
    </a>
  );
}

export default function HomePage() {
  const { data, authed } = useApp();
  const facilities = data.facilities;
  const [area, setArea] = useState("");
  const areas = listAreas(facilities);
  const inArea = area ? facilities.filter((f) => areaLabel(f) === area) : facilities;
  const shown = inArea.slice(0, CARDS_SHOWN);
  const hours = facilities[0]?.hours || "06:00–22:00";

  return (
    <>
      <section className="home-hero">
        {facilities[0] && <Photo facility={facilities[0]} className="home-hero__bg" eager />}
        <div className="home-hero__inner">
          <span className="home-hero__badge">{facilities.length} cơ sở · TP. Hồ Chí Minh</span>
          <h1>
            Kho riêng an toàn,
            <br />
            gần nơi bạn cần.
          </h1>
          <p>
            Chọn khu vực, chọn kho thường hoặc kho lạnh cỡ M hay L,{" "}
            <br />
            xem ô còn trống và chi phí trước khi đặt.
          </p>
          <HeroSearch facilities={facilities} />
        </div>
      </section>

      <section className="home-stats" aria-label="SafeSpace trong con số">
        <div className="container home-stats__grid">
          <p><strong>{facilities.length}</strong><span>cơ sở tại TP.HCM</span></p>
          <p><strong>{facilities.length * UNITS_PER_FACILITY}</strong><span>ô kho cỡ M và L</span></p>
          <p><strong>24/7</strong><span>camera giám sát</span></p>
          <p><strong>{hours}</strong><span>ra vào mỗi ngày</span></p>
        </div>
      </section>

      <section className="home-section home-section--tint">
        <div className="container">
          <header className="home-head">
            <span className="home-eyebrow">Loại kho</span>
            <h2>Hai cỡ kho, thường hoặc lạnh</h2>
            <p>Mỗi cơ sở có 8 kho thường và 4 kho lạnh, chia đều cỡ M và L.</p>
          </header>
          <div className="home-kinds">
            {KINDS.map(({ type, band, note }) => {
              const size = SIZE_BANDS.find((b) => b.id === band);
              const from = lowest(facilities, { type, band });
              return (
                <a key={`${type}-${band}`} className="home-kind" href={href(`find${qs({ type, band })}`)}>
                  <span className={`home-kind__tag${type === "climate" ? " home-kind__tag--cold" : ""}`}>{type === "climate" ? "Kho lạnh" : "Kho thường"}</span>
                  <h3>{size.label}</h3>
                  <p className="home-kind__note">{note}</p>
                  <p className="home-kind__price">
                    <small>Giá từ</small>
                    <strong>{from != null ? `${money(from)} / tháng` : "Xem giá theo cơ sở"}</strong>
                  </p>
                  <span className="home-link">Xem cơ sở còn trống →</span>
                </a>
              );
            })}
          </div>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <header className="home-head">
            <span className="home-eyebrow">Cách đặt kho</span>
            <h2>Đặt kho trong 3 bước</h2>
          </header>
          <ol className="home-steps">
            {STEPS.map(([title, text], i) => (
              <li key={title}>
                <span className="home-steps__num">{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="home-section home-section--tint">
        <div className="container">
          <header className="home-head">
            <span className="home-eyebrow">Cơ sở</span>
            <h2>Chọn khu vực, xem cơ sở gần đó</h2>
          </header>
          <div className="home-chips" role="group" aria-label="Lọc theo khu vực">
            <button type="button" className={`home-chip${area === "" ? " is-on" : ""}`} aria-pressed={area === ""} onClick={() => setArea("")}>
              Tất cả <span>{facilities.length}</span>
            </button>
            {areas.map((a) => (
              <button key={a} type="button" className={`home-chip${area === a ? " is-on" : ""}`} aria-pressed={area === a} onClick={() => setArea(a)}>
                {districtOf(a)} <span>{facilities.filter((f) => areaLabel(f) === a).length}</span>
              </button>
            ))}
          </div>
          <div className="home-facilities">
            {shown.map((f) => (
              <FacilityCard key={f.facility_id} f={f} />
            ))}
          </div>
          <LinkButton to={`find${qs({ area })}`} variant="outline" className="home-more">
            {area ? `Xem tất cả ${inArea.length} cơ sở tại ${districtOf(area)} →` : `Xem tất cả ${facilities.length} cơ sở →`}
          </LinkButton>
        </div>
      </section>

      <section className="home-section">
        <div className="container">
          <div className="home-cta">
            <div>
              <h2>{authed ? "Chào mừng bạn quay lại SafeSpace" : "Quản lý mọi kho thuê trong một tài khoản"}</h2>
              <p>Theo dõi đặt chỗ, hợp đồng, thanh toán, gia hạn và yêu cầu hỗ trợ.</p>
            </div>
            <div className="home-cta__actions">
              {authed ? (
                <>
                  <LinkButton to="overview" variant="light">Xem tổng quan</LinkButton>
                  <LinkButton to="find" variant="ghost-dark">Tìm kho mới</LinkButton>
                </>
              ) : (
                <>
                  <LinkButton to="register" variant="light">Tạo tài khoản</LinkButton>
                  <LinkButton to="login" variant="ghost-dark">Đăng nhập</LinkButton>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <footer className="home-footer">
        <div className="container">
          <div className="home-footer__cols">
            <div>
              <strong className="home-footer__brand">SafeSpace</strong>
              <p>Kho tự phục vụ tại TP. Hồ Chí Minh.</p>
              <p>Ra vào {hours} · Camera 24/7</p>
            </div>
            <nav aria-label="Khám phá">
              <strong>Khám phá</strong>
              <a href={href("find")}>Tìm kho theo khu vực</a>
              <a href={href("pricing")}>Bảng giá</a>
              <a href={href("guide")}>Hướng dẫn đặt kho</a>
            </nav>
            <nav aria-label="Hỗ trợ">
              <strong>Hỗ trợ</strong>
              <a href={href("guide")}>Câu hỏi thường gặp</a>
              <a href={href("support")}>Gửi yêu cầu hỗ trợ</a>
            </nav>
            <div>
              <strong>Liên hệ</strong>
              <p>028 3700 1012</p>
              <p>{facilities[0]?.address || "TP. Hồ Chí Minh"}</p>
            </div>
          </div>
          <p className="home-footer__copy">© {new Date().getFullYear()} SafeSpace. Hệ thống quản lý và cho thuê kho tự phục vụ.</p>
        </div>
      </footer>
    </>
  );
}
