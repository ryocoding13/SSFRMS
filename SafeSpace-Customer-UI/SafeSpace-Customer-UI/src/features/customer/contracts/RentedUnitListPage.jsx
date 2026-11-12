/**
 * RENTED UNIT LIST PAGE - DANH SÁCH CÁC KHO ĐANG THUÊ CỦA TÀI KHOẢN (C06 / UC05)
 *
 * Liệt kê toàn bộ các kho thuộc sở hữu của khách:
 * - Hợp đồng đang hiệu lực (ACTIVE), sắp hết hạn (EXPIRING), quá hạn (OVERDUE).
 * - Trực quan hóa số ngày còn lại đến hạn kết thúc hợp đồng.
 */
import React, { useState } from "react";
import { EmptyInline } from "../../../shared/components/Inline.jsx";
import { Button, LinkButton, PageHeader, StatusTag, Tag } from "../../../shared/components/UI.jsx";
import RecordSummaryCard from "../../../shared/components/RecordSummaryCard.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel, today } from "../../../shared/utils/format.js";
import { siteLabel } from "../../../shared/hooks/useBrowserEvents.js";
import { CONTRACT_STATUS } from "../../../shared/utils/status.js";
import { contractStatus, facilityOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { AccessQrModal } from "../access/AccessQrModal.jsx";
import { DoorCloseButton } from "../access/DoorCloseButton.jsx";

/**
 * Màn hình danh sách các ô kho lưu trữ khách hàng đang thuê trong hệ thống.
 */
export function RentedUnitListPage() {
  const { data } = useApp();
  const [qrContract, setQrContract] = useState(null);
  const now = today();
  const activeCount = data.contracts.filter((c) => contractStatus(c) !== "ENDED").length;
  return (
    <main className="container page customer-records customer-records--units">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi</p>
      <PageHeader title="Kho của tôi" description="Theo dõi kho đang thuê, hợp đồng và các mốc cần xử lý.">
        <Tag tone="blue">{activeCount} kho đang thuê</Tag>
      </PageHeader>
      {data.contracts.length === 0 ? (
        <EmptyInline text="Bạn chưa thuê kho nào. Kho sẽ hiện ở đây sau khi cơ sở xác nhận đơn đặt chỗ của bạn." cta="Tìm & đặt kho" to="find" />
      ) : (
        <div className="customer-records__list">
          {data.contracts.map((c) => {
            const f = facilityOf(data, c.facility_id, c.facility_name);
            const status = contractStatus(c);
            const ended = status === "ENDED";
            const prestart = c.start_date > now && !ended;
            const issued = c.access_issued ?? c.status !== "DRAFT";
            const busy = Boolean(pendingRenewal(data, c.contract_id) || pendingReturn(data, c.contract_id));
            const pickup = data.appointments.find((a) => a.kind === "CHECK_IN" && a.status !== "CANCELLED" &&
              (a.contract_id === c.contract_id || (c.reservation_id && a.reservation_id === c.reservation_id)));
            return (
              <RecordSummaryCard key={c.contract_id} title={`${c.unit_number} · ${typeLabel(c.type)}`}
                status={prestart ? <Tag tone="blue">Chưa đến ngày sử dụng</Tag> : <StatusTag map={CONTRACT_STATUS} status={status} />}
                actions={<>
                  {/* #25: khoản gia hạn đã xác nhận, chưa trả (không chọn tại quầy) → nút "Thanh toán"; còn lại vẫn là "Gia hạn" */}
                  {(() => { const r = pendingRenewal(data, c.contract_id); return r && r.status === "APPROVED" && !r.at_counter ? <LinkButton to={`units/${c.contract_id}/renewal-status`}>Thanh toán</LinkButton> : null; })()}
                  {issued && !ended && (status === "EXPIRING" && c.end_date > now && !busy
                    ? <LinkButton to={`units/${c.contract_id}/renew`} variant="outline">Gia hạn</LinkButton>
                    : <>
                      {/* #59: xem mã được cả trước ngày thuê (chỉ mở cửa từ 00:00 ngày bắt đầu) */}
                      <Button variant="outline" disabled={Boolean(pendingReturn(data, c.contract_id)) || c.end_date <= now} onClick={() => setQrContract(c)}>Mã QR mở cửa</Button>
                      {!prestart && <DoorCloseButton c={c} disabled={Boolean(pendingReturn(data, c.contract_id)) || c.end_date <= now} />}
                    </>)}
                  <LinkButton to={`units/${c.contract_id}`}>Xem hợp đồng</LinkButton>
                </>}>
                <p>{siteLabel(f)}{c.size_m2 ? ` · ${c.size_m2} m²` : ""} · {c.contract_id}</p>
                <p>{pickup ? `Nhận kho ${dateLabel(pickup.date)} · ${pickup.slot} · ` : ""}Kết thúc {dateLabel(c.end_date)}{!pickup ? ` · Ra vào ${f.hours}` : ""}</p>
              </RecordSummaryCard>
            );
          })}
        </div>
      )}
      {qrContract && <AccessQrModal c={qrContract} facility={facilityOf(data, qrContract.facility_id, qrContract.facility_name)} onClose={() => setQrContract(null)} />}
    </main>
  );
}
