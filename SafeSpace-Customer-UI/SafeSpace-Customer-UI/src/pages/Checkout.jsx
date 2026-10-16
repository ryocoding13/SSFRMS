import React, { useCallback, useEffect, useState } from "react";
import { Photo } from "../components/Photo";
import { Button, DetailList, Empty, Icon, LinkButton, Notice } from "../components/UI";
import QrCode from "../components/QrCode";
import { bandLabel, typeLabel } from "../lib/catalog";
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

const PAY_METHODS = [
  ["qr", "Thanh toán QR", "Thanh toán ngay"],
  ["store", "Tại cửa hàng", "Trả khi nhận kho"],
];
const POLL_MS = 3000;

// C04 — Đặt chỗ & Thanh toán: QR PayOS (tự xác nhận qua webhook, trang tự chuyển) hoặc C04c — thanh toán tại cửa hàng
export function Checkout({ id }) {
  const { data, dispatch, timeoutSeconds, services } = useApp();
  const r = data.reservations.find((x) => x.reservation_id === id);
  const facility = r && facilityOf(data, r.facility_id, r.facility_name);
  const now = useNow(250);
  const [method, setMethod] = useState("qr");
  const [checkout, setCheckout] = useState(null);
  // loading | ready | unsupported | error
  const [qrState, setQrState] = useState("loading");
  const [qrError, setQrError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const total = r?.timeout_seconds || timeoutSeconds;
  const deadline = checkout?.expires_at && r?.expires_at ? Math.min(new Date(checkout.expires_at), new Date(r.expires_at)) : checkout?.expires_at || r?.expires_at;
  const remaining = deadline ? (new Date(deadline) - now) / 1000 : 0;
  const pending = r?.status === "PENDING_PAYMENT";

  useEffect(() => {
    if (!r) return;
    if (r.status === "CANCELLED") go(`checkout/${id}/failed`, { replace: true });
    else if (r.status !== "PENDING_PAYMENT") go(`confirmation/${id}`, { replace: true });
  }, [r?.status, id]);

  useEffect(() => {
    if (pending && deadline && remaining <= 0) {
      dispatch("EXPIRE_RESERVATION", { reservation_id: id }).then(() => go(`checkout/${id}/failed`, { replace: true }));
    }
  }, [remaining <= 0, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tạo (hoặc lấy lại) mã QR PayOS của đơn — gọi một lần khi mở phương thức QR
  const load = useCallback(async () => {
    if (!r || !services) return;
    setQrState("loading");
    setQrError("");
    const res = await services.startPayos({ kind: "reservation", item: r });
    if (res.ok) {
      setCheckout(res.checkout);
      setQrState("ready");
    } else if (res.unsupported) {
      setQrState("unsupported");
    } else {
      setQrError(res.error);
      setQrState("error");
    }
  }, [r?.reservation_id, services]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (method === "qr" && pending && !checkout) load();
  }, [method, pending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hỏi backend định kỳ: PayOS gọi webhook về backend → đơn đã thanh toán → sang C05
  useEffect(() => {
    if (method !== "qr" || qrState !== "ready" || !pending || !services) return undefined;
    let alive = true;
    const tick = async () => {
      const res = await services.checkPaid({ kind: "reservation", item: r });
      if (!alive || !res.ok) return;
      if (res.paid) go(`confirmation/${id}`, { replace: true });
      else if (res.cancelled) go(`checkout/${id}/failed`, { replace: true });
    };
    const timer = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [method, qrState, pending, r?.reservation_id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return <NotFound />;

  const payAtStore = async () => {
    setBusy(true);
    setError("");
    const res = await dispatch("PAY_AT_FACILITY", { reservation_id: id });
    if (res.ok) return go(`confirmation/${id}`);
    setBusy(false);
    if (res.code === "EXPIRED") return go(`checkout/${id}/failed`, { replace: true });
    setError(res.error);
  };

  const pct = Math.max(0, Math.min(100, (remaining / total) * 100));
  const amount = checkout?.amount || r.initial_total;
  const rows = (last) => (
    <dl className="pay-rows">
      <div><dt>Tiền thuê {r.months} tháng</dt><dd>{money(r.rent_total)}</dd></div>
      <div><dt>Tiền cọc (1 tháng tiền thuê)</dt><dd>{money(r.deposit)}</dd></div>
      <div><dt>{method === "qr" ? "Tổng thanh toán" : "Tổng thanh toán khi nhận kho"}</dt><dd className="pay-rows__amount">{money(method === "qr" ? amount : r.initial_total)}</dd></div>
      <div><dt>{method === "qr" ? "Mã đơn" : "Mã đơn đặt chỗ"}</dt><dd>{r.reservation_id}</dd></div>
      {last}
    </dl>
  );
  return (
    <main className="container page">
      <header className="page-header page-header--tight">
        <div>
          <h1>{facility.name}</h1>
          <p>
            {[facility.district, facility.city].filter(Boolean).join(", ") || facility.address}
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
          <h2>Thanh toán đặt chỗ</h2>
          <div className="pay-method" role="radiogroup" aria-label="Phương thức thanh toán">
            {PAY_METHODS.map(([k, title, sub]) => (
              <button
                type="button"
                role="radio"
                key={k}
                aria-checked={method === k}
                className={`pay-method__opt${method === k ? " is-on" : ""}`}
                onClick={() => { setMethod(k); setError(""); }}
              >
                <span className="pay-method__dot" aria-hidden="true" />
                <span><strong>{title}</strong><small>{sub}</small></span>
              </button>
            ))}
          </div>

          {method === "qr" ? (
            <>
              <p className="hint">Quét mã QR bằng ứng dụng ngân hàng. Đơn tự xác nhận ngay khi thanh toán thành công.</p>
              {qrState === "unsupported" ? (
                <Notice>
                  Thanh toán QR đang tạm gián đoạn. Bạn có thể chọn <strong>Tại cửa hàng</strong> để giữ chỗ và thanh toán khi nhận kho.
                </Notice>
              ) : qrState === "error" ? (
                <Notice tone="error">
                  {qrError}{" "}
                  <button type="button" className="link-btn" onClick={load}>Tạo lại mã QR</button>
                </Notice>
              ) : (
                <QrCode
                  value={checkout?.qr}
                  title={qrState === "loading" ? "Đang tạo mã QR…" : "Mã QR thanh toán"}
                  label={`Mã QR thanh toán đơn ${r.reservation_id}`}
                  caption={checkout?.url ? <a href={checkout.url} target="_blank" rel="noreferrer">Mở trang thanh toán PayOS ↗</a> : "Mã QR tạo riêng cho đơn này"}
                />
              )}
              {rows()}
              <div className="countdown" role="timer" aria-label="Thời gian giữ chỗ còn lại">
                <div className="countdown__row">
                  <span>Thời gian giữ chỗ</span>
                  <strong>{formatCountdown(remaining)}</strong>
                </div>
                <div className="countdown__bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(Math.max(0, remaining))}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="countdown__live" aria-live="polite">
                  <span className="pulse" aria-hidden="true" /> Đang chờ thanh toán… Trang tự chuyển khi thanh toán được xác nhận. Hết giờ chưa thanh toán thì đơn tự huỷ.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="hint">Thanh toán bằng tiền mặt hoặc thẻ tại quầy khi bạn đến nhận kho.</p>
              {rows(<div><dt>Thanh toán tại</dt><dd>{facility.name}</dd></div>)}
              <div className="countdown">
                <div className="countdown__row">
                  <span>Thời gian giữ chỗ</span>
                  <strong>24 giờ</strong>
                </div>
                <p>Vui lòng đến cơ sở và thanh toán trong thời gian giữ chỗ. Quá hạn, đơn đặt chỗ sẽ tự huỷ.</p>
              </div>
              {error && <Notice tone="error">{error}</Notice>}
              <Button block onClick={payAtStore} disabled={busy}>{busy ? "Đang xác nhận…" : "Xác nhận đặt chỗ"}</Button>
            </>
          )}
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
        <p className="lead">Chúng tôi chưa nhận được thanh toán trong thời gian giữ chỗ, nên đơn đặt chỗ đã được huỷ.</p>
        <DetailList items={[["Lý do", r.cancel_reason || "Khách hàng huỷ đặt chỗ"], ["Trạng thái", "Đã huỷ đặt chỗ"]]} />
        <LinkButton to="home" block>Về trang chủ</LinkButton>
        <LinkButton to="find" variant="outline" block>Xem cơ sở khác</LinkButton>
      </section>
    </main>
  );
}

// C05 (đã thanh toán QR) / C05c (giữ chỗ, thanh toán tại cửa hàng) và chi tiết đơn từ Đặt chỗ của tôi
export function ReservationSummary({ id, mode = "confirmation" }) {
  const { data } = useApp();
  const now = useNow(1000);
  const r = data.reservations.find((x) => x.reservation_id === id);
  if (!r) return <NotFound />;
  const facility = facilityOf(data, r.facility_id, r.facility_name);
  const isDetail = mode === "detail";
  const waiting = r.status === "PENDING_PAYMENT" && r.expires_at && new Date(r.expires_at) > now;
  const atStore = r.status === "PENDING_VERIFICATION";
  const statusText =
    r.status === "CANCELLED" && r.refund_status === "PENDING"
      ? "Đã huỷ · Đang hoàn tiền"
      : !isDetail && r.status === "CONFIRMED"
        ? "Đã thanh toán"
        : RESERVATION_STATUS[r.status][0];
  const titles = {
    PENDING_PAYMENT: "Đơn đang chờ thanh toán",
    PENDING_VERIFICATION: "Đã giữ chỗ cho bạn",
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
    if (r.refund_amount) rows.push(["Số tiền hoàn", money(r.refund_amount)]);
  }
  if (atStore) rows.push(["Số tiền thanh toán (thuê + cọc)", money(r.initial_total)], ["Hạn giữ chỗ", "24 giờ kể từ khi đặt"]);
  rows.push(["Trạng thái", statusText]);

  return (
    <main className="result">
      <section className="panel result__card">
        <span className={`result__icon${r.status === "CANCELLED" ? " result__icon--fail" : ""}`}>
          <Icon name={r.status === "CANCELLED" ? "close" : "check"} size={24} />
        </span>
        <h1>{isDetail ? titles[r.status] : atStore ? "Đã giữ chỗ cho bạn" : "Đã nhận thông tin đặt chỗ"}</h1>
        <p className="result__code">Mã đặt chỗ #{r.reservation_id}</p>
        <DetailList items={rows} />
        {atStore && (
          <Notice>Vui lòng đến cơ sở và thanh toán bằng tiền mặt hoặc thẻ tại quầy trong thời gian giữ chỗ. Quá hạn, đơn đặt chỗ sẽ tự huỷ.</Notice>
        )}
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
