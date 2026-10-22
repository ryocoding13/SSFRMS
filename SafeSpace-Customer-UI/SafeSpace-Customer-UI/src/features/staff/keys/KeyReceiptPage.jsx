import React, { useState } from "react";
import { Button, Empty, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { Facts } from "../../facility-operations/components/FacilityOperationsComponents.jsx";

export function KeyReceiptPage({ query }) {
  const { ops, run } = useOps();
  const waiting = ops.handovers.filter((h) => h.status === "WAITING");
  const h = query.get("id") ? ops.handovers.find((x) => x.id === query.get("id")) : waiting.find((x) => ops.verifications.find((v) => v.id === x.verification_id)?.status === "DONE") || waiting[0];
  if (!h)
    return (
      <main className="container page">
        <Empty title="Không có chìa khóa chờ nhận" text="Lịch nhận chìa khóa của khách sẽ hiện ở đây sau khi hợp đồng được cấp.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const unit = ops.units.find((u) => u.code === h.unit);
  const verification = ops.verifications.find((v) => v.id === h.verification_id);
  const ready = !verification || verification.status === "DONE";
  const submit = async () => {
    const r = await run("RECORD_KEY_RECEIPT", { id: h.id }, `Đã ghi nhận khách nhận chìa khóa kho ${h.unit}`);
    if (r.ok) go("staff/done?kind=key");
  };
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/verify")}>← Danh sách xác minh</a>
      <section className="panel ops-card">
        <h1>Nhận chìa khóa · Kho {h.unit}</h1>
        <Facts
          rows={[
            ["Khách hàng", h.customer],
            ["Cơ sở", ops.facility.name],
            ["Loại kho", typeLabel(unit?.type)],
            ["Diện tích", unit ? `${unit.area} m²` : "—"],
          ]}
        />
        {h.status === "DONE" ? (
          <Notice tone="success">Đã nhận chìa khóa lúc {dateTimeLabel(h.done_at)}.</Notice>
        ) : (
          <>
            <p>Đã cấp theo hợp đồng: QR + PIN 6 số</p>
            {!ready && (
              <Notice tone="error">
                Khách chưa được xác minh. <a href={href(`staff/verify?id=${verification.id}`)}>Xác minh khách trước</a>.
              </Notice>
            )}
            <Button block onClick={submit} disabled={!ready}>Ghi nhận đã nhận chìa khóa</Button>
            <Notice tone="success">Nhận chìa khóa không kích hoạt hợp đồng. QR, PIN và quyền mở kho chỉ có hiệu lực trong kỳ thuê.</Notice>
          </>
        )}
        <LinkButton to="staff" variant="outline" block>Về danh sách công việc</LinkButton>
      </section>
    </main>
  );
}
