import React from "react";
import { EmptyInline } from "../../../shared/components/Inline.jsx";
import { PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel } from "../../../shared/utils/format.js";
import { siteLabel } from "../../../shared/hooks/useBrowserEvents.js";
import { href } from "../../../app/router.js";
import { CONTRACT_STATUS } from "../../../shared/utils/status.js";
import { contractStatus, facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

export function RentedUnitListPage() {
  const { data } = useApp();
  return (
    <main className="container page">
      <PageHeader title="Kho của tôi" description="Theo dõi kho đang thuê, hợp đồng và các mốc cần xử lý." />
      {data.contracts.length === 0 ? (
        <EmptyInline text="Bạn chưa thuê kho nào. Kho sẽ hiện ở đây sau khi cơ sở xác nhận đơn đặt chỗ của bạn." cta="Tìm & đặt kho" to="find" />
      ) : (
        <div className="grid grid--2">
          {data.contracts.map((c) => {
            const f = facilityOf(data, c.facility_id, c.facility_name);
            return (
              <article className="panel unit-card" key={c.contract_id}>
                <StatusTag map={CONTRACT_STATUS} status={contractStatus(c)} square />
                <h2>{c.unit_number} · {typeLabel(c.type)}</h2>
                <p className="muted">{siteLabel(f)}{c.size_m2 ? ` · ${c.size_m2} m²` : ""}</p>
                <h3>Thời hạn hợp đồng</h3>
                <p className="muted">
                  Ngày kết thúc: {dateLabel(c.end_date)}
                  <br />
                  {c.handed_over ? "Đã bàn giao" : "Chờ bàn giao"} · Ra vào {f.hours}
                </p>
                <a className="btn btn--primary" href={href(`units/${c.contract_id}`)}>Xem hợp đồng & quản lý</a>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
