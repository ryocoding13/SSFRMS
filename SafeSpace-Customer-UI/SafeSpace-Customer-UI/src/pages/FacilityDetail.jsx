import React, { useState } from "react";
import { Lightbox, Photo } from "../components/Photo";
import { DatePicker, Select } from "../components/Pickers";
import { Button, Empty, Field, LinkButton, Notice } from "../components/UI";
import { RENTAL_PLANS, SIZE_BANDS, UNIT_TYPES, quote, rateFor } from "../lib/catalog";
import { dateLabel, distanceLabel, money, today } from "../lib/format";
import { go, href, qs } from "../lib/router";
import { facilityOf } from "../state/selectors";
import { useApp } from "../state/store";

export default function FacilityDetail({ id, query }) {
  const { data, authed, dispatch } = useApp();
  const facility = facilityOf(data, id);
  const startQuery = query.get("start");
  const [type, setType] = useState(query.get("type") === "climate" && facility?.has_climate ? "climate" : "normal");
  const [band, setBand] = useState(SIZE_BANDS.some((b) => b.id === query.get("band")) ? query.get("band") : "M");
  const [months, setMonths] = useState(RENTAL_PLANS.includes(Number(query.get("months"))) ? Number(query.get("months")) : 3);
  const [start, setStart] = useState(startQuery && startQuery >= today() ? startQuery : today());
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(null);

  if (!facility)
    return (
      <main className="container page">
        <Empty title="Không tìm thấy cơ sở" text="Cơ sở này không tồn tại hoặc đã ngừng hoạt động.">
          <LinkButton to="find">Xem tất cả cơ sở</LinkButton>
        </Empty>
      </main>
    );

  const q = quote({ facility, type, band, months, start_date: start });
  const selection = { type, band, months, start };

  const proceed = () => {
    setError("");
    if (!authed) return go(`login?next=${encodeURIComponent(`find/${facility.facility_id}${qs(selection)}`)}`);
    const res = dispatch("CREATE_RESERVATION", { facility_id: facility.facility_id, type, band, months, start_date: start });
    if (!res.ok) return setError(res.error);
    go(`checkout/${res.reservation_id}`);
  };

  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>{facility.name}</h1>
          <p>
            {facility.district}, {facility.city} · Cách bạn {distanceLabel(facility.distance_km)} · Còn kho phù hợp trong kỳ thuê
          </p>
        </div>
      </header>

      <div className="detail-grid">
        <div>
          <button type="button" className="photo-button" onClick={() => setPhoto(0)} aria-label="Xem thư viện ảnh cơ sở">
            <Photo facility={facility} index={0} className="photo--lg" />
          </button>
          <div className="thumbs">
            {[1, 2, 3].map((i) => (
              <button type="button" key={i} onClick={() => setPhoto(i)} aria-label={`Xem ảnh ${i + 1} trên 4`}>
                <Photo facility={facility} index={i} />
              </button>
            ))}
          </div>
          <section className="panel info-card">
            <h3>Không gian phù hợp cho đồ dùng cá nhân và hàng hóa</h3>
            <p className="muted">Camera 24/7 · Lối đi rộng · Khu vực xe đẩy · Ra vào {facility.hours}</p>
            <h4>Kiểm tra trước khi đặt</h4>
            <p className="muted">
              Không lưu trữ vật liệu dễ cháy, hàng cấm hoặc thực phẩm dễ hỏng. Kho cụ thể sẽ được quản lý phân bổ theo nhu cầu đã xác nhận.
            </p>
          </section>
        </div>

        <aside className="panel booking">
          <p className="price price--xl">{money(q.monthly_rate)} / tháng</p>
          <p className="hint">Giá thay đổi theo loại kho, diện tích và gói thuê bạn chọn.</p>
          <Field label="Loại kho">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {UNIT_TYPES.filter((t) => t.id === "normal" || facility.has_climate).map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Diện tích">
            <Select value={band} onChange={(e) => setBand(e.target.value)}>
              {SIZE_BANDS.map((b) => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </Select>
          </Field>
          <div className="field">
            <span className="field__label" id="plan-label">Gói thuê</span>
            <div className="plans" role="group" aria-labelledby="plan-label">
              {RENTAL_PLANS.map((m) => (
                <button type="button" key={m} className={m === months ? "is-on" : ""} aria-pressed={m === months} onClick={() => setMonths(m)}>
                  {m} tháng
                </button>
              ))}
            </div>
          </div>
          <DatePicker label="Ngày bắt đầu" value={start} min={today()} onChange={setStart} />
          <p className="hint hint--tight">Kết thúc dự kiến: {dateLabel(q.end_date)}</p>
          <h4>Chi phí dự kiến</h4>
          <dl className="cost">
            <div><dt>Tiền thuê {months} tháng</dt><dd>{money(q.rent_total)}</dd></div>
            <div><dt>Tiền cọc</dt><dd>{money(q.deposit)}</dd></div>
            <div className="cost__total"><dt>Tổng ban đầu</dt><dd>{money(q.initial_total)}</dd></div>
          </dl>
          <p className="hint">Cọc được xử lý khi kết thúc hợp đồng theo tình trạng kho và chính sách đã công bố.</p>
          {error && <Notice tone="error">{error}</Notice>}
          <div className="booking__actions">
            <Button onClick={proceed}>Tiếp tục đặt chỗ</Button>
            <a className="btn btn--outline" href={href(`find${qs({ type: query.get("type"), band: query.get("band") })}`)}>Chọn cơ sở khác</a>
          </div>
        </aside>
      </div>

      {photo !== null && <Lightbox facility={facility} index={photo} onIndex={setPhoto} onClose={() => setPhoto(null)} />}
    </main>
  );
}
