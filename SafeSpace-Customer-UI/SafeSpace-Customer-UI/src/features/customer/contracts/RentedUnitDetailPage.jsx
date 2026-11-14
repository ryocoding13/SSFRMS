/**
 * RENTED UNIT DETAIL PAGE - CHI TIẾT Ô KHO ĐANG THUÊ (C07 / UC05)
 *
 * Thông tin tổng hợp:
 * - Tên cơ sở, mã số ô kho, gói kho, diện tích và thời hạn hợp đồng.
 * - Mã truy cập QR Code / PIN mở cửa kho (D22).
 * - Nút chức năng: Gia hạn hợp đồng, Đăng ký trả kho, Báo cáo sự cố / Yêu cầu hỗ trợ.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Button, DetailList, LinkButton, Notice, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel, dateTimeLabel, daysBetween, money, rangeLabel, today } from "../../../shared/utils/format.js";
import { CONTRACT_STATUS, LEDGER_STATUS } from "../../../shared/utils/status.js";
import { contractOf, contractStatus, facilityOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";
import { AccessQrModal } from "../access/AccessQrModal.jsx";
import { DoorCloseButton } from "../access/DoorCloseButton.jsx";
import { usableFromText } from "../../../shared/utils/access.js";
import { canCancel } from "../reservations/ReservationListPage.jsx";
import { UnitMoveCard } from "./components/UnitMoveCard.jsx";
import { CancelRenewalButton } from "./components/CancelRenewalButton.jsx";
import { renewalView } from "./renewalStatusModel.js";

import "../../../shared/styles/customer-detail.css";

/**
 * Màn hình trung tâm quản lý chi tiết hợp đồng thuê kho của khách hàng.
 * @param {{ id: string|number }} props
 */
export function RentedUnitDetailPage({ id }) {
  const { data, retry, services } = useApp();
  const [qrOpen, setQrOpen] = useState(false);
  const c = contractOf(data, id);
  const door = useDoorState(services, c, Boolean(pendingReturn(data, id)));
  if (!c) return <NotFound />;
  const f = facilityOf(data, c.facility_id, c.facility_name);
  const renewal = pendingRenewal(data, id);
  const renewalPayment = renewal ? renewalView(data, renewal) : null;
  const ret = pendingReturn(data, id);
  const rent = [...data.ledger].reverse().find((l) => l.contract_id === id && (l.kind === "RENT" || /-RENT$/.test(l.ref)));
  const pickup = data.appointments.find((a) => a.kind === "CHECK_IN" && (a.contract_id === id || (c.reservation_id && a.reservation_id === c.reservation_id)) && a.status !== "CANCELLED");
  const status = contractStatus(c);
  const ended = status === "ENDED";
  const issued = c.access_issued ?? c.status !== "DRAFT";
  const prestart = c.start_date > today();
  const busy = Boolean(renewal || ret);
  // D41: ô đã có khách mới đặt từ ngày hết hạn → khoá gia hạn ô này
  const bookedFrom = c.next_booking_from && !ended ? c.next_booking_from : null;
  // D49: trước StartDate, khách huỷ đơn và được hoàn toàn bộ tiền thuê và cọc đã thanh toán.
  const reservation = c.reservation_id ? data.reservations.find((x) => x.reservation_id === c.reservation_id) : null;
  const cancellable = prestart && !ended && reservation && canCancel(data, reservation);
  const pickupText = pickup ? `${dateLabel(pickup.date)} · ${pickup.slot}` : null;
  return (
    <main className="container page customer-records customer-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id}</p>
      <PageHeader title={`Kho ${c.unit_number} · Hợp đồng thuê`} description={`${c.contract_id} · ${f.name}`}>{prestart && !ended ? <Tag tone="blue">Chưa đến ngày sử dụng</Tag> : status === "EXPIRING" && !ret ? <Tag tone="amber">Sắp hết hạn · còn {daysBetween(today(), c.end_date)} ngày</Tag> : <StatusTag map={CONTRACT_STATUS} status={ret && !ended ? "RETURN_PENDING" : status} />}</PageHeader>
      <div className="customer-detail__grid">
        <div className="customer-detail__column">
          {/* D46 · Figma C07b-D46: đang chuyển sang ô mới sau gia hạn sang ô khác */}
          {c.api_id && !ended && <UnitMoveCard contractApiId={c.api_id} onMoved={retry} />}
          <section className="panel customer-detail__card">
            <h2>Thông tin hợp đồng</h2>
            <DetailList items={[
              ["Hợp đồng", c.contract_id],
              ["Kho", `${c.unit_number} · ${typeLabel(c.type)}${c.size_m2 ? ` ${c.size_m2} m²` : ""}${c.location ? ` · ${c.location}` : ""}`],
              ["Kỳ thuê", rangeLabel(c.start_date, c.end_date)],
              ["Khách hàng", data.user.full_name],
              ["Tiền thuê", `${money(c.monthly_rate)} / tháng`],
              [ended || ret || c.status === "RETURN_PENDING" ? "Cọc ban đầu" : "Cọc đang giữ", money(c.deposit)],
              ["Thanh toán", rent ? <StatusTag map={LEDGER_STATUS} status={rent.status} /> : "Chưa có dữ liệu"],
            ]} />
            {/* Figma C07b · D58: mở hợp đồng giấy (bản in, cùng mẫu tệp gửi qua email) */}
            {issued && <div className="customer-detail__actions">
              <LinkButton to={`units/${encodeURIComponent(id)}/contract`} variant="outline">Xem hợp đồng giấy</LinkButton>
            </div>}
          </section>
          <section className="panel customer-detail__card">
            <h2>QR, PIN & chìa khóa</h2>
            <DetailList items={[
              ["QR & PIN 6 số", ended || ret || c.end_date <= today() ? "Đã hết hiệu lực" : issued ? (prestart ? `Đã cấp · ${usableFromText(c.start_date).replace("Có thể mở cửa", "mở cửa")}` : `Đã cấp · hiệu lực từ ${dateLabel(c.start_date)}`) : "Chưa được cấp"],
              ...(door.visible ? [["Trạng thái cửa", <DoorStatus door={door} />]] : []),
              ["Chìa khóa vật lý", c.handed_over ? "Đã nhận tại quầy" : "Gửi yêu cầu “Nhận chìa khóa” để cơ sở xếp lịch"],
              ...(pickupText ? [["Lịch nhận chìa khóa", pickupText]] : []),
            ]} />
            <p className="hint">{issued && !ended ? "Hợp đồng và mã ra vào đã được cấp. " : ""}QR và PIN chỉ mở được cửa trong kỳ thuê; mã tự hết hiệu lực khi hết hạn hoặc gửi trả kho thành công.</p>
            {/* D35–D36 · L13: trước ngày thuê không mở QR/PIN */}
            {issued && !ended && <div className="customer-detail__actions"><Button disabled={Boolean(ret) || c.end_date <= today()} onClick={() => setQrOpen(true)}>{ret || c.end_date <= today() ? "QR đã hết hiệu lực" : "Mã QR mở cửa"}</Button>{door.visible && <DoorCloseButton c={c} disabled={door.state?.door === "LOCKED"} onClosed={door.update} />}{prestart && <p className="hint">{usableFromText(c.start_date)}.</p>}</div>}
          </section>
          <section className="panel customer-detail__card">
            <h2>Chính sách áp dụng</h2>
            <p className="hint">Xem phiên bản và bằng chứng đồng ý theo hợp đồng hoặc từng yêu cầu gia hạn. Hồ sơ chưa có dữ liệu sẽ được thông báo rõ.</p>
            <div className="customer-detail__actions"><LinkButton to={`policies?tab=contract&contract=${encodeURIComponent(id)}`} variant="outline">Xem chính sách đã đồng ý</LinkButton></div>
          </section>
        </div>
        <aside className="panel customer-detail__card customer-detail__sidebar">
          <h2>Bạn cần làm gì?</h2>
          {renewal && <Notice>{renewal.status === "PENDING" ? `Yêu cầu gia hạn thêm ${renewal.months} tháng đang được hệ thống kiểm tra.` : renewal.at_counter ? `Gia hạn thêm ${renewal.months} tháng đã xác nhận — chờ thu tại quầy.` : `Gia hạn thêm ${renewal.months} tháng đã xác nhận — chờ thanh toán.`}</Notice>}
          {c.status === "RETURN_PENDING" && <Notice>Nhân viên gửi biên bản trả kho trong 3 ngày. Khi có biên bản, bạn có 48 giờ để xác nhận khoản khấu trừ. <a href={`#/units/${encodeURIComponent(id)}/deduction`}>Xem biên bản & xác nhận</a></Notice>}
          {prestart && !ended && <Notice>Nếu kho chưa sẵn sàng 5 ngày trước ngày nhận, SafeSpace gửi đề xuất đổi kho. <a href={`#/units/${encodeURIComponent(id)}/unit-change`}>Xem đề xuất đổi kho</a></Notice>}
          {ret && <Notice>{ret.date ? `Yêu cầu trả kho ngày ${dateLabel(ret.date)} đang chờ cơ sở xác nhận.` : "Yêu cầu trả kho đã được ghi nhận; chưa có thông tin lịch kiểm tra."}</Notice>}
          <div className="customer-detail__task"><div><h3>Gia hạn</h3><p>{renewal ? (renewal.status === "PENDING" ? `${renewal.renewal_id} đang được kiểm tra · huỷ được trước khi xác nhận` : (renewal.at_counter ? `${renewal.renewal_id} chờ thu tại quầy · thanh toán trước hạn để gia hạn` : `${renewal.renewal_id} đã xác nhận · thanh toán trước hạn để gia hạn`)) : bookedFrom ? `Ô ${c.unit_number} đã có khách đặt từ ${dateLabel(bookedFrom)} · gia hạn sang ô khác còn trống.` : ret ? "Đã gửi trả kho nên không gia hạn được." : "Xác nhận gia hạn trước ngày hết hạn và thanh toán trong 24 giờ."}</p></div>
            {/* D46: ô đã có khách đặt → gia hạn sang ô khác (Figma C07b-D41 → C08-D41a). 3.2 · Figma C07b-L5c: đang chờ duyệt → xem / huỷ yêu cầu */}
            {renewal
              ? <div className="customer-detail__task-actions">{/* #25: chỉ hiện "Thanh toán" khi khoản gia hạn đã được xác nhận và đang chờ trả (không phải tại quầy) */}{renewalPayment?.ledger && !ended && !ret ? <LinkButton to={`units/${encodeURIComponent(id)}/renewal-status`}>Thanh toán</LinkButton> : <LinkButton to={`units/${encodeURIComponent(id)}/renewal-status`}>Xem yêu cầu</LinkButton>}<CancelRenewalButton renewal={renewal} contract={c} /></div>
              : issued && !ended && !busy && c.end_date > today() ? <LinkButton to={bookedFrom ? `units/${id}/renew-other` : `units/${id}/renew`} variant="outline">{bookedFrom ? "Gia hạn sang ô khác" : "Gia hạn"}</LinkButton> : <Button variant="outline" disabled>Gia hạn</Button>}
          </div>
          {prestart && !ended ? (
            <div className="customer-detail__task"><div><h3>Huỷ đơn</h3><p>Chưa đến ngày thuê: hoàn 100% tiền thuê và 100% tiền cọc (miễn phí huỷ).</p></div>
              {cancellable ? <LinkButton to={`reservations/${c.reservation_id}/cancel`} variant="outline">Huỷ đơn</LinkButton> : <Button variant="outline" disabled>Huỷ đơn</Button>}
            </div>
          ) : (
            <div className="customer-detail__task"><div><h3>Trả kho</h3><p>{renewal ? (renewal.status === "PENDING" ? "Đang có yêu cầu gia hạn · huỷ yêu cầu gia hạn để trả kho" : "Đang có gia hạn chờ thanh toán · trả kho sau khi gia hạn hết hiệu lực hoặc hoàn tất") : "Gửi yêu cầu trả kho, phí quá hạn dừng ngay."}</p></div>
              {issued && !ended && !busy ? <LinkButton to={`units/${id}/return`} variant="outline">Trả kho</LinkButton> : <Button variant="outline" disabled>Trả kho</Button>}
            </div>
          )}
          {/* D40 (thay L14): hợp đồng đã thanh toán, kể cả chưa đến ngày thuê, được gửi hỗ trợ theo kho; đã kết thúc thì dùng hỗ trợ chung */}
          {!ended
            ? <div className="customer-detail__task"><div><h3>Hỗ trợ</h3><p>{c.handed_over ? "QR, PIN, chìa khóa, thanh toán." : "Lần đầu nhận chìa khóa: gửi yêu cầu để cơ sở xếp lịch."}</p></div><LinkButton to={c.handed_over ? `support?contract=${encodeURIComponent(id)}` : `support?contract=${encodeURIComponent(id)}&topic=KEY_PICKUP`} variant="outline">{c.handed_over ? "Gửi" : "Nhận chìa khóa"}</LinkButton></div>
            : <div className="customer-detail__task"><div><h3>Hỗ trợ</h3><p>Hợp đồng đã kết thúc. Cần hỏi thêm? Gửi hỗ trợ chung.</p></div><LinkButton to="inquiries" variant="outline">Gửi hỗ trợ chung</LinkButton></div>}
          {ended && <LinkButton to="find">Thuê kho mới</LinkButton>}
          {!issued && !ended && <LinkButton to="payments" variant="outline">Xem lịch nhận chìa khóa</LinkButton>}
          <p className="hint">{ended ? "Hợp đồng đã kết thúc. Tiền cọc được hoàn theo biên bản trả kho." : "Tiền cọc được đối chiếu sau kiểm tra kho. Nhận chìa khóa không kích hoạt hợp đồng."}</p>
        </aside>
      </div>
      <div className="workflow-links"><LinkButton to={`units/${encodeURIComponent(id)}/incident`} variant="outline">Hỗ trợ do sự cố cơ sở</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/deduction`} variant="outline">Xác nhận khấu trừ trả kho</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/renewal-status`} variant="outline">Theo dõi gia hạn</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/renew-other`} variant="outline">Gia hạn sang ô khác / sau nâng cấp</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/deposit`} variant="outline">Lịch khấu trừ cọc</LinkButton><LinkButton to={`units/${encodeURIComponent(id)}/progress`} variant="outline">Tiến độ trả kho / hoàn cọc</LinkButton><LinkButton to="payments/history" variant="outline">Lịch sử thanh toán</LinkButton><LinkButton to="policies" variant="outline">Chính sách cho thuê</LinkButton></div>
      {qrOpen && <AccessQrModal c={c} facility={f} onClose={() => { setQrOpen(false); door.reload(); }} />}
    </main>
  );
}

/**
 * Mục 61 (14/11): trạng thái cửa (Đang mở / Đã đóng) hiện trong khối "QR, PIN & chìa khóa".
 * Đọc từ máy chủ khi mở trang, mỗi 15 giây và khi quay lại tab; cửa đã đóng thì nút "Đóng cửa" bị khoá.
 */
function useDoorState(services, c, returning) {
  const visible = Boolean(c && (c.access_issued ?? c.status !== "DRAFT") && contractStatus(c) !== "ENDED"
    && c.start_date <= today() && c.end_date > today() && !returning);
  const [state, setState] = useState(null);
  const load = useCallback(async () => {
    if (!visible || !services?.doorState) return;
    try { const out = await services.doorState(c); if (out?.ok && out.door) setState(out.door); } catch { /* giữ trạng thái cũ */ }
  }, [visible, services, c?.contract_id, c?.api_id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!visible) return undefined;
    load();
    const timer = setInterval(load, 15000);
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [visible, load]);
  return { visible, state, reload: load, update: (d) => setState((old) => ({ ...(old || {}), ...(d || {}), door: "LOCKED" })) };
}

function DoorStatus({ door }) {
  if (!door.state) return <span className="hint">Đang kiểm tra…</span>;
  const open = door.state.door === "OPEN";
  return <span className="customer-detail__door"><Tag tone={open ? "amber" : "green"}>{open ? "Đang mở" : "Đã đóng"}</Tag>
    {door.state.at && <span className="hint"> · cập nhật {dateTimeLabel(door.state.at)}</span>}</span>;
}
