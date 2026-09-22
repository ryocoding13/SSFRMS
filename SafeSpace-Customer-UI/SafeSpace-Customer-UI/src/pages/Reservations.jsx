import React from "react";
import { Empty, LinkButton, PageHeader } from "../components/UI";
import { money, shortCode } from "../lib/format";
import { shortName } from "../lib/hooks";
import { href } from "../lib/router";
import { RESERVATION_STATUS } from "../lib/status";
import { facilityOf, sortedReservations } from "../state/selectors";
import { useApp } from "../state/store";

export default function Reservations() {
  const { data } = useApp();
  const list = sortedReservations(data);
  const latest = list[0];
  return (
    <main className="container page">
      <PageHeader title="Đơn đặt chỗ của tôi" description="Theo dõi thanh toán, phân bổ kho và lịch nhận theo từng đơn." />
      {list.length === 0 ? (
        <Empty title="Bạn chưa có đơn đặt chỗ" text="Tìm cơ sở phù hợp để đặt kho đầu tiên.">
          <LinkButton to="find">Tìm & đặt kho</LinkButton>
        </Empty>
      ) : (
        <>
          <div className="table-wrap panel">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã đặt chỗ</th>
                  <th>Cơ sở / kỳ thuê</th>
                  <th>Tổng ban đầu</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.reservation_id}>
                    <td>
                      <a href={href(`reservations/${r.reservation_id}`)} title={r.reservation_id}>{r.reservation_id}</a>
                    </td>
                    <td>{shortName(facilityOf(data, r.facility_id))} · {r.months} tháng</td>
                    <td>{money(r.initial_total)}</td>
                    <td>{RESERVATION_STATUS[r.status][0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="stack">
            <LinkButton to={`reservations/${latest.reservation_id}`}>Xem đơn {shortCode(latest.reservation_id)}</LinkButton>
            <LinkButton to="find" variant="outline">Đặt thêm kho</LinkButton>
          </div>
        </>
      )}
    </main>
  );
}
