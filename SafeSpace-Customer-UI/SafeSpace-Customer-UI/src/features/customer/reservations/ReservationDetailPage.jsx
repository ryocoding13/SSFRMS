import React from "react";
import { DetailList, Icon, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { bandLabel, typeLabel } from "../../../shared/utils/catalog.js";
import { money, rangeLabel } from "../../../shared/utils/format.js";
import { useNow, shortName } from "../../../shared/hooks/useBrowserEvents.js";
import { RESERVATION_STATUS } from "../../../shared/utils/status.js";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ReservationNotFound.jsx";

export function ReservationDetailPage({ id, mode = "confirmation" }) {
  const { data } = useApp();
  const now = useNow(1000);
  const r = data.reservations.find((x) => x.reservation_id === id);
  if (!r) return <NotFound />;
  const facility = facilityOf(data, r.facility_id, r.facility_name);
  const isDetail = mode === "detail";
  const waiting = r.status === "PENDING_PAYMENT" && r.expires_at && new Date(r.expires_at) > now;
  const contract = data.contracts.find(c => c.reservation_id === r.reservation_id);
  const paid = ["CONFIRMED", "CHECKED_IN"].includes(r.status);
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
        <h1>{isDetail ? titles[r.status] : atStore ? "Đã giữ chỗ cho bạn" : paid ? "Thanh toán thành công" : "Đã nhận thông tin đặt chỗ"}</h1>
        <p className="result__code">Mã đặt chỗ #{r.reservation_id}</p>
        <DetailList items={rows} />
        {atStore && (
          <Notice>Vui lòng đến cơ sở và thanh toán bằng tiền mặt hoặc thẻ tại quầy trong thời gian giữ chỗ. Quá hạn, đơn đặt chỗ sẽ tự huỷ.</Notice>
        )}
        {paid && <Notice tone={contract ? "success" : "info"}>{contract ? "Hợp đồng và QR/PIN đã được cấp. Mã chỉ mở được trong kỳ thuê; chìa khóa vật lý nhận tại quầy." : "Đã ghi nhận thanh toán. Cơ sở đang xử lý phân bổ ô kho; hợp đồng và mã ra vào sẽ hiển thị khi hoàn tất."}</Notice>}
        {contract && <LinkButton to={`units/${contract.contract_id}`} block>Xem hợp đồng & mã mở kho</LinkButton>}
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
