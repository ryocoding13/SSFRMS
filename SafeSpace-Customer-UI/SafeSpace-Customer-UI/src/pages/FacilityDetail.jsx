import React, { useEffect, useMemo, useState } from "react";
import { Lightbox, Photo } from "../components/Photo";
import { GALLERY } from "../config/media";
import { DatePicker, Select } from "../components/Pickers";
import { Button, Empty, Field, LinkButton, Notice } from "../components/UI";
import UnitMap from "../components/UnitMap";
import { RENTAL_PLANS, UNIT_TYPES, offerTypes, pickOffer, quote } from "../lib/catalog";
import { UNIT_STATUS, unitsFor } from "../lib/units";
import { dateLabel, distanceLabel, money, today } from "../lib/format";
import { go, href, qs } from "../lib/router";
import { useApp } from "../state/store";

export default function FacilityDetail({ id, query }) {
  const { data, authed, dispatch, checkAvailability } = useApp();
  const facility = data.facilities.find((f) => f.facility_id === Number(id));
  const startQuery = query.get("start");
  const [offerKey, setOfferKey] = useState(
    () => pickOffer(facility, { key: query.get("offer"), type: query.get("type"), band: query.get("band") })?.key || null,
  );
  const [months, setMonths] = useState(RENTAL_PLANS.includes(Number(query.get("months"))) ? Number(query.get("months")) : 3);
  const [start, setStart] = useState(startQuery && startQuery >= today() ? startQuery : today());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [stock, setStock] = useState(null);
  // Figma C03b ↔ C03b-sđ: nút ở góc trên đổi cột trái giữa "ảnh & tiện ích" và "sơ đồ tình trạng kho"
  const [view, setView] = useState(query.get("view") === "map" ? "map" : "photos");
  // Số ô trống thật theo từng loại kho (POST /api/availability/check) cho sơ đồ, chỉ khi nối backend
  const [unitStock, setUnitStock] = useState(null);
  const units = useMemo(() => unitsFor(facility, unitStock), [facility, unitStock]);
  const [unitCode, setUnitCode] = useState(() => {
    const want = query.get("unit");
    return (units.find((u) => u.code === want) || units.find((u) => u.status === "FREE") || units[0])?.code || null;
  });
  const unit = view === "map" ? units.find((u) => u.code === unitCode) || null : null;

  // Giữ trạng thái xem trên URL (không cuộn lên đầu trang như khi đổi hash)
  useEffect(() => {
    if (!facility || typeof window === "undefined" || !window.history?.replaceState) return;
    const params = new URLSearchParams(window.location.hash.split("?")[1] || "");
    if (view === "map") {
      params.set("view", "map");
      if (unitCode) params.set("unit", unitCode);
    } else {
      params.delete("view");
      params.delete("unit");
    }
    const q = params.toString();
    window.history.replaceState(null, "", `#/find/${facility.facility_id}${q ? `?${q}` : ""}`);
  }, [view, unitCode, facility?.facility_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectUnit = (code) => {
    setUnitCode(code);
    const u = units.find((x) => x.code === code);
    if (u?.offer_key) setOfferKey(u.offer_key);
    setError("");
  };
  const toggleView = () => {
    const next = view === "map" ? "photos" : "map";
    setView(next);
    if (next === "map" && unitCode) selectUnit(unitCode);
    setError("");
  };

  // Mở thẳng chế độ sơ đồ (?view=map&unit=K03), kể cả khi bấm liên kết khi đang ở trang này
  const viewQuery = query.get("view");
  const unitQuery = query.get("unit");
  useEffect(() => {
    const nextView = viewQuery === "map" ? "map" : "photos";
    setView(nextView);
    if (nextView === "map") {
      const want = units.find((u) => u.code === unitQuery) || units.find((u) => u.code === unitCode);
      if (want) selectUnit(want.code);
    }
  }, [viewQuery, unitQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const offer = facility?.offers.find((o) => o.key === offerKey) || pickOffer(facility);

  useEffect(() => {
    if (!checkAvailability || !facility || view !== "map") return undefined;
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        facility.offers.map(async (o) => [o.key, (await checkAvailability({ facility_id: facility.facility_id, offer: o, start_date: start, months }))?.count]),
      );
      if (alive) setUnitStock(Object.fromEntries(entries.filter(([, n]) => typeof n === "number")));
    })();
    return () => {
      alive = false;
    };
  }, [checkAvailability, facility?.facility_id, view, start, months]); // eslint-disable-line react-hooks/exhaustive-deps

  // Kiểm tra còn kho trống theo lựa chọn (chỉ khi nối backend)
  useEffect(() => {
    if (!checkAvailability || !facility || !offer) return undefined;
    let alive = true;
    setStock(null);
    const t = setTimeout(async () => {
      const r = await checkAvailability({ facility_id: facility.facility_id, offer, start_date: start, months });
      if (alive) setStock(r);
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [checkAvailability, facility?.facility_id, offer?.key, start, months]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!facility)
    return (
      <main className="container page">
        <Empty title="Không tìm thấy cơ sở" text="Cơ sở này không tồn tại hoặc đã ngừng hoạt động.">
          <LinkButton to="find">Xem tất cả cơ sở</LinkButton>
        </Empty>
      </main>
    );

  const types = offerTypes(facility);
  const sizes = facility.offers.filter((o) => o.type === offer?.type);
  const q = quote({ offer, months, start_date: start });
  const unitBlocked = Boolean(unit && unit.status !== "FREE");
  const soldOut = stock && !stock.available;

  // Ở chế độ sơ đồ, đổi loại kho / diện tích sẽ chọn ô còn trống khớp lựa chọn (nếu có)
  const pickUnitFor = (key) => {
    if (view !== "map") return;
    const hit = units.find((u) => u.offer_key === key && u.status === "FREE");
    if (hit) setUnitCode(hit.code);
  };
  const changeType = (type) => {
    const same = facility.offers.find((o) => o.type === type && o.band === offer?.band);
    const key = (same || facility.offers.find((o) => o.type === type))?.key;
    setOfferKey(key);
    pickUnitFor(key);
    setError("");
  };

  const proceed = async () => {
    setError("");
    if (!offer) return setError("Cơ sở này chưa có loại kho phù hợp.");
    if (unitBlocked) return setError("Ô này hiện không khả dụng. Vui lòng chọn một ô còn trống (màu xanh) trên sơ đồ.");
    if (!authed)
      return go(`login?next=${encodeURIComponent(`find/${facility.facility_id}${qs({ offer: offer.key, months, start, view: unit ? "map" : "", unit: unit?.code })}`)}`);
    setBusy(true);
    const res = await dispatch("CREATE_RESERVATION", { facility_id: facility.facility_id, offer_key: offer.key, months, start_date: start, unit_code: unit?.code });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    go(`checkout/${res.reservation_id}`);
  };

  const place = [facility.district, facility.city].filter(Boolean).join(", ") || facility.address;
  const stockText = !checkAvailability
    ? "Còn kho phù hợp trong kỳ thuê"
    : stock === null
      ? "Đang kiểm tra kho trống…"
      : stock.available
        ? `Còn ${stock.count} kho trống trong kỳ thuê`
        : "Hết kho trống cho lựa chọn này";

  return (
    <main className="container page">
      <header className="page-header page-header--tight detail-head">
        <div>
          <h1>{facility.name}</h1>
          <p>
            {place}
            {facility.distance_km != null && ` · Cách bạn ${distanceLabel(facility.distance_km)}`} · {stockText}
          </p>
        </div>
        <button type="button" className="btn btn--soft detail-head__toggle" onClick={toggleView} aria-pressed={view === "map"}>
          {view === "map" ? "← Xem ảnh & tiện ích" : "Xem sơ đồ & tình trạng kho"}
        </button>
      </header>

      <div className="detail-grid">
        {view === "map" ? (
          <UnitMap units={units} selected={unitCode} onSelect={selectUnit} />
        ) : (
        <div>
          <button type="button" className="photo-button" onClick={() => setPhoto(0)} aria-label="Xem thư viện ảnh cơ sở">
            <Photo facility={facility} index={0} className="photo--lg" eager />
          </button>
          <div className="thumbs">
            {[1, 2, 3].map((i) => (
              <button type="button" key={i} onClick={() => setPhoto(i)} aria-label={`Xem ảnh ${i + 1} trên ${GALLERY.length}`}>
                <Photo facility={facility} index={i} />
              </button>
            ))}
          </div>
          <section className="panel info-card">
            <h3>Không gian phù hợp cho đồ dùng cá nhân và hàng hóa</h3>
            <p className="muted">Camera 24/7 · Lối đi rộng · Khu vực xe đẩy · Ra vào {facility.hours}</p>
            {offer?.description && <p className="muted">{offer.description}</p>}
            <h4>Kiểm tra trước khi đặt</h4>
            <p className="muted">
              Không lưu trữ vật liệu dễ cháy, hàng cấm hoặc thực phẩm dễ hỏng. Kho cụ thể sẽ được quản lý phân bổ theo nhu cầu đã xác nhận.
            </p>
          </section>
        </div>
        )}

        <aside className="panel booking">
          {unit && (
            <div className="booking__unit">
              <p className="booking__eyebrow">Ô ĐANG CHỌN</p>
              <h2>Ô kho {unit.code} · {unit.position}</h2>
              <p className={`unit-badge unit-badge--${UNIT_STATUS[unit.status].tone}`}>{UNIT_STATUS[unit.status].label}</p>
            </div>
          )}
          {offer ? (
            <>
              <p className="price price--xl">{money(q.monthly_rate)} / tháng</p>
              <p className="hint">
                {unit ? `Giá của ô ${unit.code}. Chọn ô khác trên sơ đồ để xem giá tương ứng.` : "Giá thay đổi theo loại kho, diện tích và gói thuê bạn chọn."}
              </p>
              <Field label="Loại kho">
                <Select value={offer.type} onChange={(e) => changeType(e.target.value)}>
                  {UNIT_TYPES.filter((t) => types.includes(t.id)).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Diện tích">
                <Select value={offer.key} onChange={(e) => { setOfferKey(e.target.value); pickUnitFor(e.target.value); setError(""); }}>
                  {sizes.map((o) => (
                    <option key={o.key} value={o.key}>{o.size_label}</option>
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
              {unitBlocked ? (
                <p className="muted">Chọn một ô còn trống (màu xanh) trên sơ đồ để xem chi phí dự kiến.</p>
              ) : (
                <dl className="cost">
                  <div><dt>Tiền thuê {months} tháng</dt><dd>{money(q.rent_total)}</dd></div>
                  <div><dt>Tiền cọc</dt><dd>{money(q.deposit)}</dd></div>
                  <div className="cost__total"><dt>Tổng ban đầu</dt><dd>{money(q.initial_total)}</dd></div>
                </dl>
              )}
              <p className="hint">Cọc được xử lý khi kết thúc hợp đồng theo tình trạng kho và chính sách đã công bố.</p>
              {soldOut && <Notice tone="error">Loại kho này đã hết chỗ trong kỳ thuê bạn chọn. Hãy đổi diện tích, ngày bắt đầu hoặc cơ sở khác.</Notice>}
              {error && <Notice tone="error">{error}</Notice>}
            </>
          ) : (
            <Notice>Cơ sở này chưa mở đặt chỗ trực tuyến. Vui lòng chọn cơ sở khác.</Notice>
          )}
          <div className="booking__actions">
            {offer && (
              <Button onClick={proceed} disabled={busy || soldOut || unitBlocked} className={unitBlocked ? "btn--muted" : ""}>
                {unitBlocked ? "Ô này hiện không khả dụng" : busy ? "Đang tạo đơn…" : "Tiếp tục đặt chỗ"}
              </Button>
            )}
            <a className="btn btn--outline" href={href(`find${qs({ type: query.get("type"), band: query.get("band") })}`)}>Chọn cơ sở khác</a>
          </div>
        </aside>
      </div>

      {photo !== null && <Lightbox facility={facility} index={photo} onIndex={setPhoto} onClose={() => setPhoto(null)} />}
    </main>
  );
}
