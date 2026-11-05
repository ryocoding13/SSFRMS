import React, { useEffect, useRef, useState } from "react";
import { Photo } from "../../../shared/components/Photo.jsx";
import { Button, DetailList, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { typeLabel, bandLabel } from "../../../shared/utils/catalog.js";
import { policyVersionLabel } from "../../../shared/utils/rentalPolicy.js";
import { useRentalPolicy } from "../../../shared/hooks/useRentalPolicy.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useNow } from "../../../shared/hooks/useBrowserEvents.js";
import { go } from "../../../app/router.js";
import { NotFound } from "../reservations/components/ReservationNotFound.jsx";
import "../../../shared/styles/rental-policy.css";

export function ReservationReviewPage({ id }) {
  const { data, dispatch, mode } = useApp();
  const reservation = data.reservations.find(r => r.reservation_id === id);
  const policy = useRentalPolicy();
  const now = useNow(1000);
  const [acceptedVersion, setAcceptedVersion] = useState(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), guard = useRef(false), generation = useRef(0);
  useEffect(() => { generation.current++; setAcceptedVersion(null); setError(""); return () => { generation.current++; }; }, [id]);
  if (!reservation) return <NotFound />;
  const facility = facilityOf(data, reservation.facility_id, reservation.facility_name);
  const ready = !policy.loading && !policy.error && policy.data;
  const accepted = Boolean(ready && acceptedVersion === policy.data.version);
  const pending = ["PENDING_PAYMENT", "PENDING_VERIFICATION"].includes(reservation.status);
  const expired = reservation.expires_at && Date.parse(reservation.expires_at) <= Number(now);
  const submit = async e => {
    e.preventDefault();
    if (guard.current || !pending || expired) return;
    if (!accepted) return setError("Vui lòng đọc và đồng ý với Chính sách thuê kho trước khi tiếp tục.");
    const seq = generation.current;
    guard.current = true; setBusy(true); setError("");
    try {
      const out = await dispatch("ACCEPT_RESERVATION_POLICY", { reservation_id: id, policy_version: policy.data.version, accepted: true });
      if (seq !== generation.current) return;
      if (!out.ok) { setAcceptedVersion(null); setError(out.error); await policy.reload(); return; }
      go(reservation.status === "PENDING_VERIFICATION" ? `confirmation/${id}` : `checkout/${id}`, { replace: true });
    } catch { if (seq === generation.current) setError("Chưa lưu được xác nhận. Dữ liệu vẫn được giữ; vui lòng thử lại."); }
    finally { guard.current = false; if (seq === generation.current) setBusy(false); }
  };
  return <main className="container page policy-review">
    <PageHeader title={facility.name} description={[facility.district, facility.city].filter(Boolean).join(", ") || facility.address}><Tag tone="blue">Bước 2/3 · Xác nhận &amp; chính sách</Tag></PageHeader>
    <div className="policy-review__grid">
      <div className="policy-review__gallery">
        <Photo facility={facility} index={0} className="policy-review__cover" eager />
        <div className="policy-review__thumbs">{[0, 2, 3].map(index => <Photo key={index} facility={facility} index={index} />)}</div>
        <section className="panel policy-review__card"><h2>Không gian phù hợp cho đồ dùng cá nhân và hàng hóa</h2><p className="muted">Camera 24/7 · Lối đi rộng · Khu vực xe đẩy · Ra vào {facility.hours}</p><h3>Kiểm tra trước khi đặt</h3><p className="muted">Không lưu trữ vật liệu dễ cháy, hàng cấm hoặc thực phẩm dễ hỏng. Hệ thống chọn ô phù hợp và cấp hợp đồng sau khi thanh toán được xác nhận.</p></section>
      </div>
      <form className="panel policy-review__card policy-review__summary" onSubmit={submit} noValidate>
        <h2>Tóm tắt đơn {id}</h2>
        <DetailList items={[["Cơ sở", facility.name], ["Kho", `${typeLabel(reservation.type)} · ${reservation.size_label || bandLabel(reservation.band)}`], ["Bắt đầu", dateLabel(reservation.start_date)], ["Dùng đến hết", `${dateLabel(reservation.end_date)} · 23:59`], [`Tiền thuê ${reservation.months} tháng`, money(reservation.rent_total)], ["Cọc 1 tháng", money(reservation.deposit)], ["Tổng thanh toán", <strong className="policy-review__total">{money(reservation.initial_total)}</strong>]]} />
        <a className="policy-review__read" href="#/policies" target="_blank" rel="noreferrer">Đọc chính sách thuê kho →</a>
        {policy.loading && <p role="status">Đang tải chính sách hiện hành…</p>}
        {policy.error && <Notice tone="error">{policy.error}<Button variant="outline" onClick={() => { setAcceptedVersion(null); policy.reload(); }}>Thử lại</Button></Notice>}
        {ready && <p className="hint">Bản hiện hành: {policyVersionLabel(policy.data)}</p>}
        <label className="policy-review__consent"><input type="checkbox" checked={accepted} disabled={!ready || busy || !pending || Boolean(expired)} onChange={e => { setAcceptedVersion(e.target.checked ? policy.data.version : null); setError(""); }} /><span>Tôi đã đọc và đồng ý với Chính sách thuê kho</span></label>
        {mode === "local" && <Notice>Chế độ mô phỏng: xác nhận chỉ lưu trên trình duyệt này.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        {(!pending || expired) && <Notice>Đơn không còn chờ thanh toán hoặc đã hết hạn giữ chỗ. Vui lòng kiểm tra trạng thái đơn.</Notice>}
        <Button type="submit" block disabled={!accepted || busy || !pending || Boolean(expired)}>{busy ? "Đang lưu xác nhận…" : "Tiếp tục thanh toán"}</Button>
        <p className="hint">Sự đồng ý được lưu cùng đơn, phiên bản chính sách và thời điểm xác nhận. Nhân viên không xác nhận thay bạn.</p>
        <LinkButton to={`reservations/${encodeURIComponent(id)}`} variant="outline">Xem đơn đặt chỗ</LinkButton>
      </form>
    </div>
  </main>;
}
