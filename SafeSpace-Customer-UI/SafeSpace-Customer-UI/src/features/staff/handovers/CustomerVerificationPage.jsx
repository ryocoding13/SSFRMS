import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Empty, Field, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { Facts, slotLabel } from "../../facility-operations/components/FacilityOperationsComponents.jsx";

export const DOC_TYPES = ["Căn cước công dân", "Chứng minh nhân dân", "Hộ chiếu"];

export function CustomerVerificationPage({ query }) {
  const { ops, run } = useOps();
  const todo = ops.verifications.filter((v) => v.status === "TODO");
  const v = query.get("id") ? ops.verifications.find((x) => x.id === query.get("id")) : todo[0];
  const [form, setForm] = useState({ doc_type: DOC_TYPES[0], doc_no: "", photo_ok: false, info_ok: false });
  const [err, setErr] = useState("");
  if (!v)
    return (
      <main className="container page">
        <Empty title="Không có khách cần xác minh" text="Khách đến nhận kho theo lịch hẹn sẽ hiện ở đây.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const set = (k, val) => {
    setForm({ ...form, [k]: val });
    setErr("");
  };
  const submit = async (e) => {
    e.preventDefault();
    const r = await run("VERIFY_CUSTOMER", { id: v.id, ...form }, `Đã xác minh ${v.customer}`);
    if (!r.ok) return setErr(r.shown || r.cancelled ? "" : r.error);
    const h = ops.handovers.find((x) => x.verification_id === v.id);
    go(h ? `staff/keys?id=${h.id}` : "staff");
  };
  const handover = ops.handovers.find((x) => x.verification_id === v.id);
  return (
    <main className="container page page--narrow">
      <a className="back-link" href={href("staff/verify")}>← Danh sách xác minh</a>
      <form className="panel ops-card" onSubmit={submit} noValidate>
        <h1>Xác minh khách hàng</h1>
        <p className="muted">Kiểm tra giấy tờ tuỳ thân trùng khớp với thông tin đặt chỗ khi khách nhận chìa khóa tại quầy.</p>
        <Facts rows={[["Họ và tên khách hàng", v.customer], ["Mã đặt chỗ", `#${v.reservation_id}`], ["Kho nhận", `#${v.unit} · Hẹn ${slotLabel(v.appointment)}`]]} />
        {v.status === "DONE" ? (
          <>
            <Notice tone="success">Đã xác minh bằng {v.doc_type} (…{v.doc_last4}) lúc {dateTimeLabel(v.verified_at)}.</Notice>
            {handover && handover.status !== "DONE" && <LinkButton to={`staff/keys?id=${handover.id}`}>Tiếp tục nhận chìa khóa</LinkButton>}
          </>
        ) : (
          <>
            <Field label="Loại giấy tờ">
              <Select value={form.doc_type} onChange={(e) => set("doc_type", e.target.value)}>
                {DOC_TYPES.map((d) => <option key={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Số giấy tờ" hint="Chỉ lưu 4 số cuối để đối chiếu.">
              <input inputMode="text" autoComplete="off" placeholder="Nhập số giấy tờ để đối chiếu" value={form.doc_no} onChange={(e) => set("doc_no", e.target.value)} />
            </Field>
            <label className="check-row">
              <span className="check"><input type="checkbox" checked={form.photo_ok} onChange={(e) => set("photo_ok", e.target.checked)} /><span /></span>
              Ảnh trên giấy tờ khớp với người đến nhận kho
            </label>
            <label className="check-row">
              <span className="check"><input type="checkbox" checked={form.info_ok} onChange={(e) => set("info_ok", e.target.checked)} /><span /></span>
              Thông tin giấy tờ trùng khớp với đơn đặt chỗ
            </label>
            {err && <Notice tone="error">{err}</Notice>}
            <Button type="submit" block>Xác nhận giấy tờ</Button>
          </>
        )}
      </form>
    </main>
  );
}
