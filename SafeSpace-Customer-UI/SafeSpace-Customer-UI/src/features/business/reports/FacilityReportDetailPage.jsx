import React from "react";
import { businessApi } from "../api/businessApi.js";
import { Button, Empty, Field, LinkButton, Tag } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { go, qs } from "../../../app/router.js";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { CONTRACT_STATUS_LABELS } from "../utils/businessFormat.js";
import { CONTRACT_TONES, contractCodeOf, facilityContractLine, summarizeFacilityContracts } from "./facilityReportModel.js";
import "../../../shared/styles/customer-detail.css";

// 3.5 · Figma B04a: chi tiết một cơ sở từ Báo cáo toàn hệ thống (#/business/facility-report?id=…).
// Dữ liệu: GET /api/operations/reports/facilities/{id}/contracts?status=&unitTypeId= (OPERATIONS/ADMIN).
const STATUS_OPTIONS = ["", "ACTIVE", "EXPIRING", "OVERDUE", "RETURN_PENDING", "COMPLETED", "TERMINATED", "CANCELLED"];

export function FacilityReportDetailPage({ query }) {
  const { onApiError } = useApp();
  const id = Number(query?.get("id"));
  const status = query?.get("status") || "";
  const unitType = query?.get("unitType") || "";
  const valid = Number.isSafeInteger(id) && id > 0;
  const set = (patch) => go(`business/facility-report${qs({ id, status, unitType, ...patch })}`);

  const load = useLoad(async () => {
    if (!valid) return null;
    const [facilities, unitTypes, rows] = await Promise.all([
      businessApi.facilities({}).catch(() => []),
      businessApi.unitTypes().catch(() => []),
      businessApi.facilityContracts(id, { status: status || undefined, unitTypeId: unitType || undefined }),
    ]);
    return { facility: (Array.isArray(facilities) ? facilities : []).find((f) => f.facilityId === id) || null, unitTypes: Array.isArray(unitTypes) ? unitTypes : [], rows: Array.isArray(rows) ? rows : [] };
  }, [id, status, unitType], onApiError);

  if (!valid) return <main className="container page"><Empty title="Không tìm thấy cơ sở" text="Mở chi tiết từ bảng Báo cáo toàn hệ thống."><LinkButton to="business/reports">Về báo cáo</LinkButton></Empty></main>;

  const data = load.data;
  const name = data?.facility?.name || `Cơ sở #${id}`;
  const sum = summarizeFacilityContracts(data?.rows);
  const filtered = Boolean(status || unitType);
  return (
    <main className="container page business-reports facility-report-detail">
      <p className="customer-records__breadcrumb">Vận hành kinh doanh / Báo cáo / {name}</p>
      <header className="page-header page-header--tight">
        <div>
          <h1>Chi tiết cơ sở · {name}</h1>
          <p>Hợp đồng theo trạng thái, khoản chờ thu và hồ sơ quá hạn đang mở của cơ sở.</p>
        </div>
      </header>
      {load.error ? (
        <Empty title="Chưa tải được chi tiết cơ sở" text="Kiểm tra kết nối rồi thử lại. Bộ lọc bạn chọn vẫn được giữ."><Button onClick={load.reload}>Thử lại</Button></Empty>
      ) : load.loading && !data ? (
        <p role="status" className="muted">Đang tải chi tiết cơ sở…</p>
      ) : (
        <>
          <div className="stats stats--4">
            <div className="stat"><strong>{sum.active}</strong><span>Hợp đồng hiệu lực</span></div>
            <div className="stat"><strong className="danger">{sum.overdue}</strong><span>Hợp đồng quá hạn</span></div>
            <div className="stat"><strong className="tone-blue">{money(sum.pending)}</strong><span>Khoản chờ thu</span></div>
            <div className="stat"><strong className="danger">{sum.openCases}</strong><span>Hồ sơ quá hạn đang mở</span></div>
          </div>
          <div className="facility-report-detail__filters">
            <Field label="Trạng thái hợp đồng"><select value={status} disabled={load.loading} onChange={(e) => set({ status: e.target.value })}>
              {STATUS_OPTIONS.map((s) => <option key={s || "all"} value={s}>{s ? CONTRACT_STATUS_LABELS[s] || s : "Tất cả trạng thái"}</option>)}
            </select></Field>
            <Field label="Loại kho"><select value={unitType} disabled={load.loading} onChange={(e) => set({ unitType: e.target.value })}>
              <option value="">Tất cả loại kho</option>
              {data.unitTypes.map((t) => <option key={t.unitTypeId} value={t.unitTypeId}>{t.typeName}</option>)}
            </select></Field>
          </div>
          {data.rows.length === 0 ? (
            <Empty title={filtered ? "Không có hợp đồng phù hợp bộ lọc" : "Cơ sở chưa có hợp đồng"} text={filtered ? "Đổi trạng thái hợp đồng hoặc loại kho để xem dữ liệu của cơ sở." : "Khi có hợp đồng thuê, danh sách sẽ hiện ở đây."}>
              {filtered && <Button variant="outline" onClick={() => set({ status: "", unitType: "" })}>Bỏ bộ lọc</Button>}
            </Empty>
          ) : (
            <div className="facility-report-detail__list">
              {data.rows.map((r) => (
                <article key={r.contractId} className="panel facility-report-detail__item">
                  <div>
                    <h3>{contractCodeOf(r)} · {r.customerName}</h3>
                    <p>{r.unitNumber}{r.unitTypeName ? ` · ${r.unitTypeName}` : ""} · {dateLabel(r.startDate)} – {dateLabel(r.endDate)}</p>
                    <p>{facilityContractLine(r, money)}</p>
                  </div>
                  <Tag tone={CONTRACT_TONES[r.status] || "gray"}>{CONTRACT_STATUS_LABELS[r.status] || r.status}</Tag>
                </article>
              ))}
            </div>
          )}
          <p className="hint">Khoản chờ thu là khoản chưa thanh toán còn hiệu lực (tiền thuê, gia hạn đã duyệt). Không có công nợ ngoài cọc (D32).</p>
        </>
      )}
      <div className="ops-actions"><LinkButton to="business/reports" variant="outline">Về báo cáo</LinkButton></div>
    </main>
  );
}
