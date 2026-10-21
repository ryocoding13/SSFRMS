import React, { useState } from "react";
import { Button, Empty, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { UNLOCK_METHODS } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { Facts } from "../../facility-operations/components/FacilityOperationsComponents.jsx";

export function HandoverPage({ query }) {
  const { ops, run } = useOps();
  const waiting = ops.handovers.filter((h) => h.status === "WAITING");
  const h = ops.handovers.find((x) => x.id === query.get("id")) || waiting.find((x) => ops.verifications.find((v) => v.id === x.verification_id)?.status === "DONE") || waiting[0];
  const [method, setMethod] = useState("CARD");
  if (!h)
    return (
      <main className="container page">
        <Empty title="Không có kho chờ bàn giao" text="Kho được quản lý phân bổ sẽ hiện ở đây sau khi khách được xác minh.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const unit = ops.units.find((u) => u.code === h.unit);
  const verification = ops.verifications.find((v) => v.id === h.verification_id);
  const ready = !verification || verification.status === "DONE";
  const submit = async () => {
    const r = await run("HANDOVER", { id: h.id, method }, `Kho ${h.unit} đã được kích hoạt`);
    if (r.ok) go("staff/done?kind=handover");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/handover")}>← Danh sách bàn giao</a>
      <section className="panel ops-card">
        <h1>Bàn giao kho #{h.unit}</h1>
        <Facts
          rows={[
            ["Khách hàng", h.customer],
            ["Cơ sở", ops.facility.name],
            ["Loại kho", typeLabel(unit?.type)],
            ["Diện tích", unit ? `${unit.area} m²` : "—"],
          ]}
        />
        {h.status === "DONE" ? (
          <Notice tone="success">Đã bàn giao lúc {dateTimeLabel(h.done_at)} · {UNLOCK_METHODS.find(([k]) => k === h.method)?.[1]}.</Notice>
        ) : (
          <>
            <div className="field">
              <span className="field__label" id="unlock-label">Phương thức mở khoá</span>
              <div className="seg" role="group" aria-labelledby="unlock-label">
                {UNLOCK_METHODS.map(([k, label]) => (
                  <button type="button" key={k} className={method === k ? "is-on" : ""} aria-pressed={method === k} onClick={() => setMethod(k)}>{label}</button>
                ))}
              </div>
            </div>
            {!ready && (
              <Notice tone="error">
                Khách chưa được xác minh. <a href={href(`staff/verify?id=${verification.id}`)}>Xác minh khách trước</a>.
              </Notice>
            )}
            <Button block onClick={submit} disabled={!ready}>Xác nhận bàn giao — Kích hoạt kho</Button>
            <Notice tone="success">Sau khi bàn giao, kho chuyển sang trạng thái "Đang hoạt động" và khách hàng có thể sử dụng ngay.</Notice>
          </>
        )}
        <LinkButton to="staff" variant="outline" block>Về danh sách công việc</LinkButton>
      </section>
    </main>
  );
}
