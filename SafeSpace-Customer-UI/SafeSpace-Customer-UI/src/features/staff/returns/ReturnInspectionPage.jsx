import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Empty, Field, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";

const FEES = [["damage_fee", "Phí hư hỏng"], ["cleaning_fee", "Phí vệ sinh"], ["overdue_fee", "Phí quá hạn"]];
const toNumber = (v) => Number(String(v ?? "").replace(/[^\d-]/g, "") || 0);

export const PROPOSALS = ["Chờ vệ sinh / kiểm tra trước khi cho thuê lại", "Sẵn sàng cho thuê lại", "Cần bảo trì trước khi cho thuê lại"];

export function ReturnInspectionPage({ query }) {
  const { ops, run } = useOps();
  const list = ops.returns.filter((r) => r.status === "SCHEDULED");
  const r = query.get("id") ? ops.returns.find((x) => x.id === query.get("id")) : list[0] || ops.returns[0];
  const [form, setForm] = useState({ items: "Đã chuyển hết đồ khỏi kho", walls: "Không ghi nhận hư hỏng mới", keys: "Đã nhận lại 01 chìa khóa", proposal: PROPOSALS[0], damage_fee: "0", cleaning_fee: "0", overdue_fee: "0", fee_reason: "" });
  const [err, setErr] = useState("");
  if (!r)
    return (
      <main className="container page">
        <Empty title="Không có lịch trả kho" text="Khách đăng ký trả kho sẽ hiện ở đây theo lịch hẹn.">
          <LinkButton to="staff">Về công việc trong ngày</LinkButton>
        </Empty>
      </main>
    );
  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErr("");
  };
  const submit = async (e) => {
    e.preventDefault();
    const fees = Object.fromEntries(FEES.map(([k]) => [k, toNumber(form[k])]));
    if (Object.values(fees).some((v) => !Number.isFinite(v) || v < 0)) return setErr("Phí phát sinh phải là số tiền không âm.");
    if (Object.values(fees).some((v) => v > 0) && !form.fee_reason.trim()) return setErr("Nhập lý do thu phí.");
    const out = await run("SUBMIT_RETURN", { id: r.id, report: { ...form, ...fees, fee_reason: form.fee_reason.trim() } }, "Đã gửi biên bản trả kho cho quản lý");
    if (!out.ok) return setErr(out.shown || out.cancelled ? "" : out.error);
    go("staff/return");
  };
  const submitted = r.status === "SUBMITTED";
  const report = submitted ? { ...form, ...r.report } : form;
  const feeTotal = FEES.reduce((sum, [k]) => sum + (toNumber(report[k]) || 0), 0);
  return (
    <main className="container page">
      <a className="back-link" href={href("staff/return")}>← Danh sách trả kho</a>
      <header className="page-header page-header--tight">
        <div>
          <h1>Kiểm tra & tiếp nhận trả kho</h1>
          <p>{r.unit} · {r.customer} · Lịch hẹn {dateTimeLabel(r.appointment)}</p>
        </div>
      </header>
      <div className="detail-grid">
        <form className="panel form-card" onSubmit={submit} noValidate>
          <Field label="Đồ lưu trữ"><input value={report.items} disabled={submitted} onChange={(e) => set("items", e.target.value)} /></Field>
          <Field label="Tường, sàn & cửa kho"><input value={report.walls} disabled={submitted} onChange={(e) => set("walls", e.target.value)} /></Field>
          <Field label="Chìa khóa vật lý"><input value={report.keys} disabled={submitted} onChange={(e) => set("keys", e.target.value)} /></Field>
          <Field label="Đề xuất trạng thái kho">
            <Select value={report.proposal} disabled={submitted} onChange={(e) => set("proposal", e.target.value)}>
              {PROPOSALS.map((p) => <option key={p}>{p}</option>)}
            </Select>
          </Field>
          {/* Figma S04 (629:9139): phí phát sinh khi trả kho */}
          <h3 className="form-card__sub">Phí phát sinh khi trả kho</h3>
          <div className="form-pair form-pair--3">
            {FEES.map(([k, label]) => (
              <Field key={k} label={label}>
                <input inputMode="numeric" value={submitted ? money(toNumber(report[k]) || 0) : report[k]} disabled={submitted} onChange={(e) => set(k, e.target.value)} />
              </Field>
            ))}
          </div>
          <Field label="Lý do thu phí">
            <input maxLength={255} value={report.fee_reason || ""} disabled={submitted} placeholder="Ví dụ: Còn rác và vết sơn trên sàn, cần vệ sinh trước khi cho thuê lại." onChange={(e) => set("fee_reason", e.target.value)} />
          </Field>
          {err && <Notice tone="error">{err}</Notice>}
          {submitted ? <Notice tone="success">Đã gửi biên bản lúc {dateTimeLabel(r.submitted_at)}. Chờ quản lý xác nhận trả kho.</Notice> : <Button type="submit">Gửi biên bản và phí cho quản lý</Button>}
        </form>
        <aside className="panel booking">
          <h2>Khoản phải thu khi trả kho</h2>
          <p className="muted">
            Khoản chưa thanh toán: {money(r.unpaid)}
            {FEES.filter(([k]) => toNumber(report[k]) > 0).map(([k, label]) => (
              <React.Fragment key={k}><br />{label} đề xuất: {money(toNumber(report[k]))}</React.Fragment>
            ))}
          </p>
          <p className="tone-amber"><strong>Tổng khoản phải thu: {money(r.unpaid + feeTotal)}</strong></p>
          <p className="muted">Nhân viên ghi nhận tình trạng và phí. Quản lý xác nhận trả kho tại M07; khoản chưa thanh toán tiếp tục được theo dõi.</p>
        </aside>
      </div>
    </main>
  );
}
