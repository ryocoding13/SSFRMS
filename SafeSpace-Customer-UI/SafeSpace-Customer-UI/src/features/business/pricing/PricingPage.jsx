import React from "react";
import { businessApi } from "../api/businessApi.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { Empty, LinkButton, PageHeader } from "../../../shared/components/UI.jsx";
import { Photo } from "../../../shared/components/Photo.jsx";
import { LoadState } from "../components/BusinessComponents.jsx";
import { shortFacility } from "../utils/businessFormat.js";
import "./pricing.css";

// B03 · Chọn cơ sở trước khi xem/sửa giá; B02 quản lý chính sách và phí.
export default function PricingPage() {
  const { onApiError } = useApp();
  const load = useLoad(() => businessApi.facilities(), [], onApiError);
  return <main className="container page facility-pricing">
    <p className="facility-pricing__breadcrumb">SafeSpace / Vận hành kinh doanh / Giá &amp; phí</p>
    <PageHeader title="Giá & phí theo cơ sở" description="Chọn cơ sở để xem bảng giá và điều chỉnh giá thuê cho từng loại kho." />
    <LoadState load={load}>{facilities => facilities.length ? <div className="facility-pricing__facilities">
      {facilities.map(f => <article className="panel facility-pricing__facility" key={f.facilityId}>
        <Photo facility={{ ...f, facility_id: f.facilityId }} className="facility-pricing__photo" />
        <h2>{shortFacility(f.name)}</h2>
        <p className="muted">Kho thường &amp; kho lạnh · 15 m² / 30 m²</p>
        <div className="facility-pricing__actions"><LinkButton to={`business/rates?facility=${encodeURIComponent(f.facilityId)}`} aria-label={`Xem bảng giá ${shortFacility(f.name)}`}>Xem bảng giá</LinkButton></div>
      </article>)}
    </div> : <Empty title="Chưa có cơ sở" text="Thêm cơ sở để quản lý bảng giá thuê."><LinkButton to="business/facilities">Quản lý cơ sở</LinkButton></Empty>}</LoadState>
  </main>;
}
