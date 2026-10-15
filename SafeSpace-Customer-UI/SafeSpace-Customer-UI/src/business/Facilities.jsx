import React from "react";
import { businessApi } from "../api/business";
import { Button } from "../components/UI";
import { useLoad } from "../admin/util";
import { go, href, qs } from "../lib/router";
import { useApp } from "../state/store";
import { FACILITY_STATUS, areaOf, rateLabel, shortFacility } from "./format";
import { LoadState } from "./parts";

// B05: select a facility and open its business report; no unrelated CRUD controls.
export default function BusinessFacilities({ query }) {
  const { onApiError } = useApp();
  const load = useLoad(async () => {
    const [facilities, rates] = await Promise.all([businessApi.facilities(), businessApi.rates()]);
    return { facilities, rates };
  }, [], onApiError);
  const selectedId = Number(query.get("id"));
  return <main className="container page business-facilities">
    <header className="page-header page-header--tight"><div>
      <h1>Mạng lưới cơ sở</h1>
      <p>Theo dõi trạng thái hoạt động, sức chứa và người phụ trách toàn hệ thống.</p>
    </div></header>
    <LoadState load={load}>{({ facilities, rates }) => {
      const current = facilities.find(f => f.facilityId === selectedId) || facilities[0];
      const typeNames = [...new Set(rates.filter(r => r.facilityId === current?.facilityId && r.isCurrent).map(r => r.unitTypeName).filter(Boolean))];
      return <>
        <div className="table-wrap"><table className="table table--hover">
          <colgroup><col style={{ width: '35.7%' }}/><col style={{ width: '21.4%' }}/><col style={{ width: '25.4%' }}/><col/></colgroup>
          <thead><tr><th>Cơ sở</th><th>Quản lý</th><th>Số kho / tỷ lệ thuê</th><th>Trạng thái</th></tr></thead>
          <tbody>{facilities.map(f => <tr key={f.facilityId} onClick={() => go(`business/facilities${qs({ id: f.facilityId })}`, { replace: true })}>
            <td><a className="biz-link" href={href(`business/facilities${qs({ id: f.facilityId })}`)} aria-current={current?.facilityId === f.facilityId ? 'true' : undefined}>{[areaOf(f.address).district, shortFacility(f.name)].filter(Boolean).join(' · ')}</a></td>
            <td>{f.managerName || ('managerName' in f ? 'Chưa phân công' : 'Chưa có thông tin')}</td><td>{f.totalUnits} kho · {rateLabel(f.occupancyRate)}</td><td>{FACILITY_STATUS[f.status]?.[0] || f.status}</td>
          </tr>)}{!facilities.length && <tr><td colSpan={4}>Chưa có cơ sở nào.</td></tr>}</tbody>
        </table></div>
        {current && <section className="panel biz-detail" aria-label={`Chi tiết ${current.name}`}>
          <h2>{current.name}</h2>
          <div className="muted"><p>{[areaOf(current.address).district, areaOf(current.address).city].filter(Boolean).join(', ')}{current.openingTime && ` · Giờ ra vào ${current.openingTime}–${current.closingTime}`}</p>
          <p>{typeNames.length ? `${typeNames.join(' & ')} · ` : ''}Quản lý: {current.managerName || ('managerName' in current ? 'Chưa phân công' : 'Chưa có thông tin')}</p></div>
          <div className="ops-actions"><Button onClick={() => go(`business/reports${qs({ facility: current.facilityId })}`)}>Xem hiệu quả kinh doanh</Button></div>
        </section>}
      </>;
    }}</LoadState>
  </main>;
}
