import React, { useEffect, useState } from "react";
import { Photo } from "../components/Photo";
import { Button, DetailList, Empty, Icon, LinkButton, Notice } from "../components/UI";
import PaymentQr from "../components/PaymentQr";
import { bandLabel, typeLabel } from "../lib/catalog";
import { distanceLabel } from "../lib/format";
import { dateLabel, formatCountdown, money, rangeLabel } from "../lib/format";
import { useNow, shortName } from "../lib/hooks";
import { go } from "../lib/router";
import { RESERVATION_STATUS } from "../lib/status";
import { facilityOf } from "../state/selectors";
import { useApp } from "../state/store";

function NotFound() {
  return (
    <main className="container page">
      <Empty title="Không tìm thấy đơn đặt chỗ" text="Đơn này không tồn tại hoặc không thuộc tài khoản của bạn.">
        <LinkButton to="reservations">Xem đơn đặt chỗ của tôi</LinkButton>
      </Empty>
    </main>
  );
}

// C04 — Đặt chỗ & Thanh toán chuyển khoản, đếm ngược giữ chỗ
export function Checkout({ id }) {
  const { data, dispatch, timeoutSeconds } = useApp();
  const r = data.reservations.find((x) => x.reservation_id === id);
  const facility = r && facilityOf(data, r.facility_id, r.facility_name);
  const now = useNow(250);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = r?.timeout_seconds || timeoutSeconds;
  const remaining = r?.expires_at ? (new Date(r.expires_at) - now) / 1000 : 0;

  useEffect(() => {
    if (!r) return;
    if (r.status === "CANCELLED") go(`checkout/${id}/failed`, { replace: true });
    else if (r.status !== "PENDING_PAYMENT") go(`confirmation/${id}`, { replace: true });
  }, [r?.status, id]);

  useEffect(() => {
    if (r?.status === "PENDING_PAYMENT" && remaining <= 0) {
      dispatch("EXPIRE_RESERVATION", { reservation_id: id }).then(() => go(`checkout/${id}/failed`, { replace: true }));
    }
  }, [remaining <= 0, r?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <NotFound />;

  const confirm = async () => {
    setBusy(true);
    setError("");
    const res = await dispatch("CONFIRM_TRANSFER", { reservation_id: id });
    if (res.ok) return go(`confirmation/${id}`);
    setBusy(false);
    if (res.code === "EXPIRED") return go(`checkout/${id}/failed`, { replace: true });
    setError(res.error);
  };

  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>{facility.name}</h1>
          <p>
            {[facility.district, facility.city].filter(Boolean).join(", ") || facility.address}
            {facility.distance_km != null && ` · Cách bạn ${distanceLabel(facility.distance_km)}`}
          </p>
        </div>
      </header>
      <div className="detail-grid">
        <div>
          <Photo facility={facility} index={0} className="photo--lg" />
          <div className="thumbs">
            {[1, 2, 3].map((i) => (
              <Photo key={i} facility={facility} index={i} />
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
          <h2>Thanh toán chuyển khoản</h2>
          <p className="hint">Quét mã QR bằng ứng dụng ngân hàng để thanh toán đơn đặt chỗ.</p>
          <PaymentQr amount={r.initial_total} content={r.reservation_id} />
          <dl className="pay-rows">
            <div><dt>Số tiền cần chuyển</dt><dd className="pay-rows__amount">{money(r.initial_total)}</dd></div>
            <div><dt>Nội dung chuyển khoản</dt><dd>{r.reservation_id}</dd></div>
          </dl>
          <div className="countdown" role="timer" aria-label="Thời gian còn lại để xác nhận">
            <div className="countdown__row">
              <span>Thời gian còn lại để xác nhận</span>
              <strong>{formatCountdown(remaining)}</strong>
            </div>
            <div className="countdown__bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(Math.max(0, remaining))}>
              <span style={{ width: `${pct}%` }} />
            </div>
            <p>Đơn đặt chỗ sẽ tự huỷ nếu hết thời gian mà chưa xác nhận chuyển khoản.</p>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button block onClick={confirm} disabled={busy}>Tôi đã chuyển khoản</Button>
        </aside>
      </div>
    </main>
  );
}

// C04b — Đặt chỗ không thành công
export function CheckoutFailed({ id }) {
  const { data } = useApp();
  const r = data.reservations.find((x) => x.reservation_id === id);
  useEffect(() => {
    if (r && r.status !== "CANCELLED") go(r.status === "PENDING_PAYMENT" ? `checkout/${id}` : `confirmation/${id}`, { replace: true });
  }, [r?.status, id]);
  if (!r) return <NotFound />;
  return (
    <main className="result">
      <section className="panel result__card">
        <span className="result__icon result__icon--fail"><Icon name="close" size={26} /></span>
        <h1>Đặt chỗ không thành công</h1>
        <p className="lead">Chúng tôi chưa nhận được xác nhận chuyển khoản trong thời gian quy định, nên đơn đặt chỗ đã được huỷ.</p>
        <DetailList items={[["Lý do", r.cancel_reason || "Khách hàng huỷ đặt chỗ"], ["Trạng thái", "Đã huỷ đặt chỗ"]]} />
        <LinkButton to="home" block>Về trang chủ</LinkButton>
        <LinkButton to="find" variant="outline" block>Xem cơ sở khác</LinkButton>
      </section>
    </main>
  );
}

// C05 (sau khi xác nhận chuyển khoản) và chi tiết đơn từ Đặt chỗ của tôi
export function ReservationSummary({ id, mode = "confirmation" }) {
  const { data } = useApp();
  const now = useNow(1000);
  const r = data.reservations.find((x) => x.reservation_id === id);
  if (!r) return <NotFound />;
  const facility = facilityOf(data, r.facility_id, r.facility_name);
  const isDetail = mode === "detail";
  const waiting = r.status === "PENDING_PAYMENT" && r.expires_at && new Date(r.expires_at) > now;
  const statusText = !isDetail && r.status === "PENDING_VERIFICATION" ? "Chờ đối soát thanh toán" : RESERVATION_STATUS[r.status][0];
  const titles = {
    PENDING_PAYMENT: "Đơn đang chờ chuyển khoản",
    PENDING_VERIFICATION: "Đã nhận thông tin đặt chỗ",
    CONFIRMED: "Đơn đặt chỗ đã được xác nhận",
    CHECKED_IN: "Bạn đã nhận kho",
    CANCELLED: "Đơn đặt chỗ đã huỷ",
  };
  const rows = [
    ["Cơ sở", facility.district && /^SafeSpace/.test(facility.name) ? `SafeSpace ${facility.district} — ${shortName(facility)}` : facility.name],
    ["Kỳ thuê", `${rangeLabel(r.start_date, r.end_date)} · ${r.months} tháng`],
  ];
  if (isDetail) {
    rows.push(["Loại kho", `${typeLabel(r.type)} · ${r.size_label || bandLabel(r.band)}`], ["Tổng ban đầu", money(r.initial_total)]);
    if (r.cancel_reason) rows.push(["Lý do huỷ", r.cancel_reason]);
  }
  rows.push(["Trạng thái", statusText]);

  return (
    <main className="result">
      <section className="panel result__card">
        <span className={`result__icon${r.status === "CANCELLED" ? " result__icon--fail" : ""}`}>
          <Icon name={r.status === "CANCELLED" ? "close" : "check"} size={24} />
        </span>
        <h1>{isDetail ? titles[r.status] : "Đã nhận thông tin đặt chỗ"}</h1>
        <p className="result__code">Mã đặt chỗ #{r.reservation_id}</p>
        <DetailList items={rows} />
        {waiting && <LinkButton to={`checkout/${r.reservation_id}`} block>Tiếp tục thanh toán</LinkButton>}
        {isDetail ? (
          <>
            {r.status === "CONFIRMED" && <LinkButton to="payments" block>Xem lịch nhận kho</LinkButton>}
            <LinkButton to="reservations" variant={waiting || r.status === "CONFIRMED" ? "outline" : "primary"} block>Về đơn đặt chỗ</LinkButton>
          </>
        ) : (
          <LinkButton to="overview" block>Về Dashboard</LinkButton>
        )}
      </section>
    </main>
  );
}
