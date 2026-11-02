import React, { useState } from "react";
import { Button, DetailList, LinkButton, Notice, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel, money, rangeLabel, today } from "../../../shared/utils/format.js";
import { CONTRACT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { contractOf, contractStatus, facilityOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { AccessQrModal } from "../access/AccessQrModal.jsx";

import "../../../shared/styles/customer-detail.css";

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
    <main className="container page customer-records customer-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id}</p>
      <PageHeader title={`Kho ${c.unit_number} · Hợp đồng thuê`} description={`${c.contract_id} · ${f.name}`}>{prestart && !ended ? <Tag tone="blue">Chưa đến ngày sử dụng</Tag> : <StatusTag map={CONTRACT_STATUS} status={status} />}</PageHeader>
      <div className="customer-detail__grid">
        <div className="customer-detail__column">
          <section className="panel customer-detail__card">
            <h2>Thông tin hợp đồng</h2>
            <DetailList items={[
              ["Hợp đồng", c.contract_id],
              ["Kho", `${c.unit_number} · ${typeLabel(c.type)}${c.size_m2 ? ` ${c.size_m2} m²` : ""}${c.location ? ` · ${c.location}` : ""}`],
              ["Kỳ thuê", rangeLabel(c.start_date, c.end_date)],
              ["Khách hàng", data.user.full_name],
              ["Tiền thuê", `${money(c.monthly_rate)} / tháng`],
              ["Cọc đang giữ", money(c.deposit)],
              ["Thanh toán", rent ? <StatusTag map={LEDGER_STATUS} status={rent.status} /> : "Chưa có dữ liệu"],
            ]} />
          </section>
          <section className="panel customer-detail__card">
            <h2>QR, PIN & chìa khóa</h2>
            <DetailList items={[
              ["QR & PIN 6 số", ended || ret || c.end_date <= today() ? "Đã hết hiệu lực" : issued ? `Đã cấp · hiệu lực từ ${dateLabel(c.start_date)}` : "Chưa được cấp"],
              ["Chìa khóa vật lý", c.handed_over ? "Đã nhận tại quầy" : "Nhận tại quầy cơ sở"],
              ...(pickupText ? [["Lịch nhận chìa khóa", pickupText]] : []),
            ]} />
            <p className="hint">{issued && !ended ? "Hợp đồng và mã ra vào đã được cấp. " : ""}QR và PIN chỉ mở được cửa trong kỳ thuê; mã tự hết hiệu lực khi hết hạn hoặc gửi trả kho thành công.</p>
            {issued && !ended && <div className="customer-detail__actions"><Button disabled={Boolean(ret) || c.end_date <= today()} onClick={() => setQrOpen(true)}>{ret || c.end_date <= today() ? "QR đã hết hiệu lực" : "Xem QR & PIN 6 số"}</Button></div>}
          </section>
          <section className="panel customer-detail__card">
            <h2>Chính sách áp dụng</h2>
            <p className="hint">Xem phiên bản và bằng chứng đồng ý theo hợp đồng hoặc từng yêu cầu gia hạn. Hồ sơ chưa có dữ liệu sẽ được thông báo rõ.</p>
            <div className="customer-detail__actions"><LinkButton to={`policies?tab=contract&contract=${encodeURIComponent(id)}`} variant="outline">Xem chính sách đã đồng ý</LinkButton></div>
          </section>
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar">
          <h2>Bạn cần làm gì?</h2>
          {renewal && <Notice>Yêu cầu gia hạn thêm {renewal.months} tháng đang chờ cơ sở duyệt.</Notice>}
          {ret && <Notice>{ret.date ? `Yêu cầu trả kho ngày ${dateLabel(ret.date)} đang chờ cơ sở xác nhận.` : "Yêu cầu trả kho đã được ghi nhận; chưa có thông tin lịch kiểm tra."}</Notice>}
          <div className="customer-detail__task"><div><h3>Gia hạn</h3><p>Gửi trước ngày hết hạn, thanh toán sau khi được duyệt.</p></div>
            {issued && !ended && !busy && c.end_date > today() ? <LinkButton to={`units/${id}/renew`} variant="outline">Yêu cầu gia hạn</LinkButton> : <Button variant="outline" disabled>Yêu cầu gia hạn</Button>}
          </div>
          <div className="customer-detail__task"><div><h3>Trả kho</h3><p>Đăng ký lịch kiểm tra và xử lý hoàn cọc.</p></div>
            {issued && !ended && !busy ? <LinkButton to={`units/${id}/return`} variant="outline">Đăng ký trả kho</LinkButton> : <Button variant="outline" disabled>Đăng ký trả kho</Button>}
          </div>
          <div className="customer-detail__task"><div><h3>Hỗ trợ</h3><p>QR, PIN, chìa khóa, thanh toán.</p></div><LinkButton to={`support?contract=${encodeURIComponent(id)}`} variant="outline">Gửi yêu cầu hỗ trợ</LinkButton></div>
          {ended && <LinkButton to="find">Thuê kho mới</LinkButton>}
          {!issued && !ended && <LinkButton to="payments" variant="outline">Xem lịch nhận chìa khóa</LinkButton>}
          <p className="hint">{ended ? "Hợp đồng đã kết thúc. Tiền cọc được hoàn theo biên bản trả kho." : "Tiền cọc được đối chiếu sau kiểm tra kho. Nhận chìa khóa không kích hoạt hợp đồng."}</p>
        </aside>
      </div>
      <div className="workflow-links"><LinkButton to={`units/${encodeURIComponent(id)}/incident`} variant="outline">Hỗ trợ do sự cố cơ sở</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/damage`} variant="outline">Đối chiếu hư hỏng</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/renewal-status`} variant="outline">Theo dõi gia hạn</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/deposit`} variant="outline">Lịch khấu trừ cọc</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/progress`} variant="outline">Tiến độ trả kho / hoàn cọc</LinkButton><LinkButton to="payments/history" variant="outline">Lịch sử thanh toán</LinkButton><LinkButton to="policies" variant="outline">Chính sách cho thuê</LinkButton></div>
      {qrOpen && <AccessQrModal c={c} facility={f} onClose={() => setQrOpen(false)} />}
    </main>
  );
}
