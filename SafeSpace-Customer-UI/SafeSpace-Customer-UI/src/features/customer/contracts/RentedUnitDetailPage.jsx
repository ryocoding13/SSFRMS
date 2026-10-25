import React, { useState } from "react";
import { Button, LinkButton, Notice, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel, money, rangeLabel, today } from "../../../shared/utils/format.js";
import { CONTRACT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { contractOf, contractStatus, facilityOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { AccessQrModal } from "../access/AccessQrModal.jsx";

export function RentedUnitDetailPage({ id }) {
  const { data } = useApp();
  const [qrOpen, setQrOpen] = useState(false);
  const c = contractOf(data, id);
  if (!c) return <NotFound />;
  const f = facilityOf(data, c.facility_id, c.facility_name);
  const renewal = pendingRenewal(data, id);
  const ret = pendingReturn(data, id);
  const rent = [...data.ledger].reverse().find((l) => l.contract_id === id && (l.kind === "RENT" || /-RENT$/.test(l.ref)));
  const pickup = data.appointments.find((a) => a.kind === "CHECK_IN" && (a.contract_id === id || (c.reservation_id && a.reservation_id === c.reservation_id)) && a.status !== "CANCELLED");
  const status = contractStatus(c);
  const ended = status === "ENDED";
  const issued = c.access_issued ?? c.status !== "DRAFT";
  const prestart = c.start_date > today();
  const busy = Boolean(renewal || ret);
  const pickupText = pickup ? `${dateLabel(pickup.date)} · ${pickup.slot}` : null;
  return (
    <main className="container page">
      <PageHeader title={`Kho ${c.unit_number} · Hợp đồng thuê`} description={`${c.contract_id} · ${f.name}`} />
      {!ended && <div className="unit-notice"><Notice tone={issued ? "success" : "info"}>
        <strong>{issued ? "Hợp đồng và mã ra vào đã được cấp" : "Hợp đồng đang chờ xử lý"}</strong><br />
        {issued ? <>QR và PIN chỉ mở được từ ngày {dateLabel(c.start_date)} đến trước ngày {dateLabel(c.end_date)}. Chìa khóa vật lý nhận tại quầy {f.name}{pickupText ? ` · ${pickupText}` : ""}.</> : "Cơ sở đang kiểm tra phân bổ ô kho và khoản thanh toán của bạn."}
      </Notice></div>}
      <div className="detail-grid detail-grid--even">
        <section className="panel info-card">
          {prestart && !ended ? <Tag tone="blue" square>Chưa đến ngày sử dụng</Tag> : <StatusTag map={CONTRACT_STATUS} status={status} square />}
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
          <h3>Thông tin ra vào</h3>
          <p className="muted">{ended ? "Hợp đồng đã kết thúc, mã mở cửa không còn hiệu lực." : "Quét QR hoặc nhập PIN 6 số tại cửa kho. Chìa khóa vật lý nhận tại quầy. Chỉ mở được trong thời gian hiệu lực hợp đồng."}</p>
          <p className="muted">Chìa khóa vật lý: {c.handed_over ? "Đã nhận tại quầy" : "Nhận tại quầy cơ sở"}.</p>
        </section>
        <aside className="panel booking">
          <h2>Bạn cần làm gì?</h2>
          {renewal && <Notice>Yêu cầu gia hạn thêm {renewal.months} tháng đang chờ cơ sở duyệt.</Notice>}
          {ret && <Notice>Yêu cầu trả kho ngày {dateLabel(ret.date)} đang chờ cơ sở xác nhận.</Notice>}
          {issued && !ended ? (
            <>
              <div className="stack stack--col">
                <Button disabled={Boolean(ret) || c.end_date <= today()} onClick={() => setQrOpen(true)}>{ret || c.end_date <= today() ? "QR đã hết hiệu lực" : "Xem QR & PIN 6 số"}</Button>
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
                <LinkButton to="payments">Xem lịch nhận chìa khóa</LinkButton>
                <LinkButton to={`support?contract=${encodeURIComponent(id)}&topic=SCHEDULE`} variant="outline">Đổi lịch nhận chìa khóa</LinkButton>
                <LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Gửi yêu cầu hỗ trợ</LinkButton>
              </div>
              <p className="hint">Mã ra vào hiển thị sau khi hệ thống cấp hợp đồng. Nhận chìa khóa không kích hoạt hợp đồng.</p>
            </>
          )}
        </aside>
      </div>
      <div className="workflow-links"><LinkButton to={`units/${encodeURIComponent(id)}/renewal-status`} variant="outline">Theo dõi gia hạn</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/deposit`} variant="outline">Lịch khấu trừ cọc</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/progress`} variant="outline">Tiến độ trả kho / hoàn cọc</LinkButton><LinkButton to="payments/history" variant="outline">Lịch sử thanh toán</LinkButton><LinkButton to="policies" variant="outline">Chính sách cho thuê</LinkButton></div>
      {qrOpen && <AccessQrModal c={c} facility={f} onClose={() => setQrOpen(false)} />}
    </main>
  );
}
