import React, { useEffect, useMemo, useRef, useState } from "react";
import { Photo } from "../../../shared/components/Photo.jsx";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, money, today } from "../../../shared/utils/format.js";
import { typeLabel, bandLabel, isValidMonths, offerByKey, quote } from "../../../shared/utils/catalog.js";
import { policyVersionLabel } from "../../../shared/utils/rentalPolicy.js";
import { useRentalPolicy } from "../../../shared/hooks/useRentalPolicy.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useNow } from "../../../shared/hooks/useBrowserEvents.js";
import { go, qs } from "../../../app/router.js";
import { NotFound } from "../reservations/components/ReservationNotFound.jsx";
import { PAY_METHODS } from "./CheckoutPage.jsx";
import "../../../shared/styles/rental-policy.css";

// D69: đơn nháp từ trang đặt kho — chưa tạo đơn, chưa giữ ô cho tới khi khách đồng ý chính sách và chọn cách thanh toán
export function draftReservation(data, query) {
  const facility = data.facilities.find(f => f.facility_id === Number(query?.get("facility")));
  const offer = offerByKey(facility, query?.get("offer"));
  const months = query?.get("months"), start = query?.get("start");
  if (!facility || !offer || !isValidMonths(months) || !/^\d{4}-\d{2}-\d{2}$/.test(start || "") || start < today()) return null;
  const q = quote({ offer, months: Number(months), start_date: start });
  const unitCode = query.get("unit") || null, unitId = query.get("unit_id") || null;
  return {
    draft: true, facility_id: facility.facility_id, facility_name: facility.name, offer_key: offer.key,
    type: offer.type, band: offer.band, size_label: offer.size_label,
    unit_code: unitCode, selected_unit_id: unitId && /^\d+$/.test(unitId) ? Number(unitId) : unitId,
    allocation_mode: unitCode ? "EXACT" : "AUTO", months: Number(months), start_date: start, end_date: q.end_date,
    rent_total: q.rent_total, deposit: q.deposit, initial_total: q.initial_total, status: "PENDING_PAYMENT",
  };
}

export function ReservationReviewPage({ id, query }) {
  const { data, dispatch } = useApp();
  const isDraft = id === "new";
  const draft = useMemo(() => (isDraft ? draftReservation(data, query) : null), [isDraft, data.facilities, query?.toString()]); // eslint-disable-line react-hooks/exhaustive-deps
  const reservation = isDraft ? draft : data.reservations.find(r => r.reservation_id === id);
  const policy = useRentalPolicy();
  const now = useNow(1000);
  const [acceptedVersion, setAcceptedVersion] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), guard = useRef(false), generation = useRef(0);
  // D68: khách chọn cách thanh toán ngay khi đồng ý chính sách (QR → trang mã QR 15 phút; tại cửa hàng → giữ 24 giờ, xong luôn)
  const [method, setMethod] = useState(null);
  const [taken, setTaken] = useState(false);
  useEffect(() => { generation.current++; setAcceptedVersion(null); setMethod(null); setError(""); return () => { generation.current++; }; }, [id]);
  if (!reservation && isDraft) return <main className="container page"><Empty title="Thông tin đặt chỗ chưa đủ" text="Ngày bắt đầu, số tháng hoặc loại kho không còn hợp lệ. Vui lòng chọn lại."><LinkButton to="find">Chọn kho</LinkButton></Empty></main>;
  if (!reservation) return <NotFound />;
  const backToBooking = `find/${reservation.facility_id}${qs({ offer: reservation.offer_key, months: reservation.months, start: reservation.start_date, view: reservation.unit_code ? "map" : "", unit: reservation.unit_code })}`;
  const facility = facilityOf(data, reservation.facility_id, reservation.facility_name);
  const ready = !policy.loading && !policy.error && policy.data;
  const accepted = Boolean(ready && acceptedVersion === policy.data.version);
  const pending = ["PENDING_PAYMENT", "PENDING_VERIFICATION"].includes(reservation.status);
  const expired = reservation.expires_at && Date.parse(reservation.expires_at) <= Number(now);
  const submit = async e => {
    e.preventDefault();
    if (guard.current || !pending || expired) return;
    if (!accepted) return setError("Vui lòng đọc và đồng ý với Chính sách thuê kho trước khi tiếp tục.");
    if (reservation.status === "PENDING_PAYMENT" && !method) return setError("Vui lòng chọn cách thanh toán.");
    const seq = generation.current;
    guard.current = true; setBusy(true); setError(""); setTaken(false);
    try {
      if (isDraft) {
        // D69: lúc này mới tạo đơn và bắt đầu giữ chỗ (QR 15 phút · tại cửa hàng 24 giờ)
        const out = await dispatch("BOOK_RESERVATION", {
          facility_id: reservation.facility_id, offer_key: reservation.offer_key, months: reservation.months, start_date: reservation.start_date,
          selected_unit_id: reservation.selected_unit_id, unit_code: reservation.unit_code, policy_version: policy.data.version, method,
        });
        if (seq !== generation.current) return;
        if (out.ok) return go(method === "store" ? `confirmation/${out.reservation_id}` : `checkout/${out.reservation_id}`, { replace: true });
        if (out.created && out.reservation_id) return go(`checkout/${out.reservation_id}/confirm`, { replace: true });
        setTaken(true);
        return setError(out.error || "Chưa giữ được chỗ. Vui lòng thử lại.");
      }
      const out = await dispatch("ACCEPT_RESERVATION_POLICY", { reservation_id: id, policy_version: policy.data.version, accepted: true });
      if (seq !== generation.current) return;
      if (!out.ok) { setAcceptedVersion(null); setError(out.error); await policy.reload(); return; }
      if (reservation.status === "PENDING_VERIFICATION") return go(`confirmation/${id}`, { replace: true });
      if (method === "store") {
        const paid = await dispatch("PAY_AT_FACILITY", { reservation_id: id });
        if (seq !== generation.current) return;
        if (!paid.ok) {
          if (paid.code === "EXPIRED") return go(`checkout/${id}/failed`, { replace: true });
          return setError(paid.error || "Chưa chuyển được sang thanh toán tại cửa hàng. Vui lòng thử lại.");
        }
        return go(`confirmation/${id}`, { replace: true });
      }
      go(`checkout/${id}`, { replace: true });
    } catch { if (seq === generation.current) setError("Chưa lưu được xác nhận. Dữ liệu vẫn được giữ; vui lòng thử lại."); }
    finally { guard.current = false; if (seq === generation.current) setBusy(false); }
  };
  return <main className="container page policy-review">
    <PageHeader title={facility.name} description={[facility.district, facility.city].filter(Boolean).join(", ") || facility.address}><Tag tone="blue">Bước 2/3 · Xác nhận &amp; chính sách</Tag></PageHeader>
    <div className="policy-review__grid">
      <div className="policy-review__gallery">
        {/* #2 & D56: ô khách chọn hoặc hệ thống bố trí hiện rõ trước khi khách xác nhận */}
        <section className="panel policy-review__card policy-review__unit" aria-live="polite">
          <div className="policy-review__unit-head">
            <h2>{reservation.allocation_mode === "EXACT" ? "Ô bạn đã chọn" : "Ô hệ thống bố trí cho bạn"}</h2>
            {reservation.unit_code && !isDraft && <Tag tone="green">Khả dụng cả kỳ</Tag>}
          </div>
          {reservation.unit_code ? <>
            <p className="policy-review__unit-code">{reservation.unit_code}</p>
            <p className="muted">{typeLabel(reservation.type)} · {reservation.size_label || bandLabel(reservation.band)} · {facility.name}</p>
            <p className="hint">
              {isDraft
                ? `Ô ${reservation.unit_code} chưa được giữ. Hệ thống giữ chính xác ô này cho kỳ ${dateLabel(reservation.start_date)} – ${dateLabel(reservation.end_date)} khi bạn bấm xác nhận.`
                : reservation.allocation_mode === "EXACT"
                ? `Hệ thống giữ chính xác ô ${reservation.unit_code} cho bạn trong toàn bộ kỳ ${dateLabel(reservation.start_date)} – ${dateLabel(reservation.end_date)}.`
                : `Trống trong toàn bộ kỳ ${dateLabel(reservation.start_date)} – ${dateLabel(reservation.end_date)}.`}
            </p>
            <a className="policy-review__read" href={`#/find/${reservation.facility_id}?view=map&unit=${encodeURIComponent(reservation.unit_code)}&offer=${encodeURIComponent(reservation.offer_key || "")}`}>Xem vị trí ô trên sơ đồ →</a>
          </> : <p className="muted">{isDraft ? "Khi bạn bấm xác nhận, hệ thống bố trí một ô trống cả kỳ theo loại kho và diện tích bạn chọn; mã ô hiện trên đơn." : "Hệ thống bố trí ô trống cả kỳ theo loại kho và diện tích bạn chọn; mã ô hiện ở đây ngay khi có."}</p>}
        </section>
        <Photo facility={facility} index={0} className="policy-review__cover" eager />
        <div className="policy-review__thumbs">{[0, 2, 3].map(index => <Photo key={index} facility={facility} index={index} />)}</div>
        <section className="panel policy-review__card"><h2>Không gian phù hợp cho đồ dùng cá nhân và hàng hóa</h2><p className="muted">Camera 24/7 · Lối đi rộng · Khu vực xe đẩy · Ra vào {facility.hours}</p><h3>Kiểm tra trước khi đặt</h3><p className="muted">Không lưu trữ vật liệu dễ cháy, hàng cấm hoặc thực phẩm dễ hỏng. Hợp đồng cấp cho đúng ô đã bố trí sau khi thanh toán được xác nhận; nếu ô vừa có người đặt, hệ thống báo và bố trí ô tương đương.</p></section>
      </div>
      <form className="panel policy-review__card policy-review__summary" onSubmit={submit} noValidate>
        <h2>{isDraft ? "Tóm tắt đặt chỗ" : `Tóm tắt đơn ${id}`}</h2>
        {isDraft && <p className="hint">Chưa giữ chỗ. Mã đơn và thời gian giữ chỗ bắt đầu khi bạn bấm xác nhận.</p>}
        <DetailList items={[["Cơ sở", facility.name], ...(reservation.unit_code ? [["Ô kho", reservation.unit_code]] : []), ["Kho", `${typeLabel(reservation.type)} · ${reservation.size_label || bandLabel(reservation.band)}`], ["Bắt đầu", dateLabel(reservation.start_date)], ["Dùng đến hết", `${dateLabel(reservation.end_date)} · 23:59`], [`Tiền thuê ${reservation.months} tháng`, money(reservation.rent_total)], ["Cọc 1 tháng", money(reservation.deposit)], ["Tổng thanh toán", <strong className="policy-review__total">{money(reservation.initial_total)}</strong>]]} />
        <a className="policy-review__read" href="#/policies" target="_blank" rel="noreferrer">Đọc chính sách thuê kho →</a>
        {policy.loading && <p role="status">Đang tải chính sách hiện hành…</p>}
        {policy.error && <Notice tone="error">{policy.error}<Button variant="outline" onClick={() => { setAcceptedVersion(null); policy.reload(); }}>Thử lại</Button></Notice>}
        {ready && <p className="hint">Bản hiện hành: {policyVersionLabel(policy.data)}</p>}
        <label className="policy-review__consent"><input type="checkbox" checked={accepted} disabled={!ready || busy || !pending || Boolean(expired)} onChange={e => { setAcceptedVersion(e.target.checked ? policy.data.version : null); setError(""); }} /><span>Tôi đã đọc và đồng ý với Chính sách thuê kho</span></label>
        {reservation.status === "PENDING_PAYMENT" && (
          <fieldset className="policy-review__pay" disabled={busy || !pending || Boolean(expired)}>
            <legend>Cách thanh toán *</legend>
            <div className="pay-method" role="radiogroup" aria-label="Cách thanh toán">
              {PAY_METHODS.map(([k, title, sub]) => (
                <button type="button" role="radio" key={k} aria-checked={method === k} className={`pay-method__opt${method === k ? " is-on" : ""}`} onClick={() => { setMethod(k); setError(""); }}>
                  <span className="pay-method__dot" aria-hidden="true" />
                  <span><strong>{title}</strong><small>{sub}</small></span>
                </button>
              ))}
            </div>
            <p className="hint">{method === "store"
              ? `Ô được giữ 24 giờ kể từ lúc bạn bấm xác nhận. Đến ${facility.name} thanh toán tiền mặt hoặc thẻ trong thời gian này; quá hạn đơn tự huỷ.`
              : method === "qr" ? "Mã QR giữ chỗ 15 phút kể từ lúc tạo; hết giờ chưa thanh toán thì đơn tự huỷ và ô được trả lại." : "Thanh toán QR: giữ chỗ 15 phút · Tại cửa hàng: giữ chỗ 24 giờ."}</p>
          </fieldset>
        )}
        {error && <Notice tone="error">{error}{taken && <> <a href={`#/${backToBooking}`}>Chọn ô hoặc ngày khác →</a></>}</Notice>}
        {(!pending || expired) && <Notice>Đơn không còn chờ thanh toán hoặc đã hết hạn giữ chỗ. Vui lòng kiểm tra trạng thái đơn.</Notice>}
        <Button type="submit" block disabled={!accepted || busy || !pending || Boolean(expired)}>{busy ? (isDraft ? "Đang giữ chỗ…" : "Đang lưu xác nhận…") : method === "store" ? "Xác nhận đặt chỗ · trả tại cửa hàng" : isDraft && method === "qr" ? "Xác nhận & lấy mã QR" : "Tiếp tục thanh toán"}</Button>
        <p className="hint">Bạn có thể xem lại chính sách đã đồng ý trong mục Chính sách.</p>
        {isDraft
          ? <LinkButton to={backToBooking} variant="outline">← Quay lại chọn kho</LinkButton>
          : <LinkButton to={`reservations/${encodeURIComponent(id)}`} variant="outline">Xem đơn đặt chỗ</LinkButton>}
      </form>
    </div>
  </main>;
}
