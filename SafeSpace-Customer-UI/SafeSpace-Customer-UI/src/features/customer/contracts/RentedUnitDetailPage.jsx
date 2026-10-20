import React, { useState } from "react";
import { Button, LinkButton, Notice, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel, money, rangeLabel } from "../../../shared/utils/format.js";
import { CONTRACT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { contractOf, contractStatus, facilityOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { AccessQrModal } from "../access/AccessQrModal.jsx";

export function RentedUnitDetailPage({ id }) {
  const { data, dispatch, notify } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const c = contractOf(data, id);
  if (!c) return <NotFound />;
  const f = facilityOf(data, c.facility_id, c.facility_name);
  const renewal = pendingRenewal(data, id);
  const ret = pendingReturn(data, id);
  const rent = [...data.ledger].reverse().find((l) => l.contract_id === id && (l.kind === "RENT" || /-RENT$/.test(l.ref)));
  const pickup = data.appointments.find((a) => a.kind === "CHECK_IN" && (a.contract_id === id || (c.reservation_id && a.reservation_id === c.reservation_id)) && a.status !== "CANCELLED");
  const confirmHandover = async () => {
    setConfirming(true);
    const res = await dispatch("CONFIRM_HANDOVER", { contract_id: id });
    setConfirming(false);
    notify(res.ok ? "Đã xác nhận nhận bàn giao kho." : res.error, res.ok ? "success" : "error");
  };
  const status = contractStatus(c);
  const ended = status === "ENDED";
  const handed = c.handed_over;
  const busy = Boolean(renewal || ret);
  const pickupText = pickup ? `${dateLabel(pickup.date)} · ${pickup.slot}` : null;
  return (
    <main className="container page">
      <PageHeader title={`Kho ${c.unit_number} · Hợp đồng thuê`} description={`${c.contract_id} · ${f.name}`} />
      {!handed && !ended && (
        <div className="unit-notice">
          <Notice>
            <span>
              <strong>Chưa nhận kho{pickupText ? ` · Lịch nhận ${pickupText}` : ""}</strong>
              <br />
              Mang giấy tờ đã đăng ký{c.reservation_id ? ` và mã đặt chỗ ${c.reservation_id}` : ""} đến {f.name}. Gia hạn, trả kho và mở cửa kho dùng được sau khi nhân viên bàn giao.
            </span>
          </Notice>
        </div>
      )}
      <div className="detail-grid detail-grid--even">
        <section className="panel info-card">
          {handed || ended ? <StatusTag map={CONTRACT_STATUS} status={status} square /> : <Tag tone="blue" square>Chờ nhận kho</Tag>}
          <h2 className="h-sub">{typeLabel(c.type)}{c.size_m2 ? ` · ${c.size_m2} m²` : ""}</h2>
          <p className="muted">
            {c.location ? `${c.location} · ` : ""}Kho {c.unit_number}
            <br />
            Kỳ thuê: {rangeLabel(c.start_date, c.end_date)}
            <br />
            Khách hàng: {data.user.full_name}
          </p>
          <table className="table table--inner">
            <thead>
              <tr><th>Khoản mục</th><th>Giá trị</th></tr>
            </thead>
            <tbody>
              <tr><td>Tiền thuê mỗi tháng</td><td>{money(c.monthly_rate)}</td></tr>
              <tr><td>Tiền cọc đang giữ</td><td>{money(c.deposit)}</td></tr>
              <tr><td>Thanh toán kỳ này</td><td>{rent ? LEDGER_STATUS[rent.status][0] : "—"}</td></tr>
            </tbody>
          </table>
          {c.handover_pending_customer && (
            <Notice>
              Cơ sở đã bàn giao kho. Vui lòng kiểm tra và xác nhận đã nhận kho.{" "}
              <button type="button" className="link-btn" onClick={confirmHandover} disabled={confirming}>
                {confirming ? "Đang xác nhận…" : "Xác nhận đã nhận kho"}
              </button>
            </Notice>
          )}
          <h3>Thông tin ra vào</h3>
          <p className="muted">
            {ended
              ? "Hợp đồng đã kết thúc, mã mở cửa không còn hiệu lực."
              : handed
                ? "Mở cửa bằng QR: bấm \"Mở cửa kho\" rồi đưa mã vào máy quét ở cửa. QR chỉ dùng được khi hợp đồng còn hiệu lực và hết hiệu lực khi trả kho."
                : `Khóa và mã truy cập được bàn giao khi nhận kho${pickupText ? ` ngày ${pickupText}` : " theo lịch hẹn"}.`}
          </p>
        </section>
        <aside className="panel booking">
          <h2>Bạn cần làm gì?</h2>
          {renewal && <Notice>Yêu cầu gia hạn thêm {renewal.months} tháng đang chờ cơ sở duyệt.</Notice>}
          {ret && <Notice>Yêu cầu trả kho ngày {dateLabel(ret.date)} đang chờ cơ sở xác nhận.</Notice>}
          {handed && !ended ? (
            <>
              <div className="stack stack--col">
                <Button onClick={() => setQrOpen(true)}>Mở cửa kho</Button>
                {busy ? (
                  <>
                    <Button variant="outline" disabled>Yêu cầu gia hạn</Button>
                    <Button variant="outline" disabled>Đăng ký trả kho</Button>
                  </>
                ) : (
                  <>
                    <LinkButton to={`units/${id}/renew`} variant="outline">Yêu cầu gia hạn</LinkButton>
                    <LinkButton to={`units/${id}/return`} variant="outline">Đăng ký trả kho</LinkButton>
                  </>
                )}
                <LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Gửi yêu cầu hỗ trợ</LinkButton>
              </div>
              <p className="hint">Gia hạn và trả kho cần cơ sở xác nhận. Tiền cọc được đối chiếu sau kiểm tra kho.</p>
            </>
          ) : ended ? (
            <>
              <div className="stack stack--col">
                <LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Gửi yêu cầu hỗ trợ</LinkButton>
                <LinkButton to="find">Thuê kho mới</LinkButton>
              </div>
              <p className="hint">Hợp đồng đã kết thúc. Tiền cọc được hoàn theo biên bản trả kho.</p>
            </>
          ) : (
            <>
              <div className="stack stack--col">
                <LinkButton to="payments">Xem lịch nhận kho</LinkButton>
                <LinkButton to={`support?contract=${encodeURIComponent(id)}&topic=SCHEDULE`} variant="outline">Đổi lịch nhận kho</LinkButton>
                <LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Gửi yêu cầu hỗ trợ</LinkButton>
              </div>
              <p className="booking__label">Dùng được sau khi nhận kho</p>
              <div className="stack stack--col">
                <Button variant="outline" disabled>Yêu cầu gia hạn</Button>
                <Button variant="outline" disabled>Đăng ký trả kho</Button>
                <Button variant="outline" disabled>Mở cửa kho (QR)</Button>
              </div>
              <p className="hint">Có thể đổi lịch nhận kho trước giờ hẹn. Cần hỗ trợ thì gửi yêu cầu, cơ sở sẽ phản hồi trong tài khoản.</p>
            </>
          )}
        </aside>
      </div>
      {qrOpen && <AccessQrModal c={c} facility={f} onClose={() => setQrOpen(false)} />}
    </main>
  );
}
