import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Empty, Field, LinkButton, Notice } from "../../../shared/components/UI.jsx";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import { go, href } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";

export const PROPOSALS = ["Chờ vệ sinh / kiểm tra trước khi cho thuê lại", "Sẵn sàng cho thuê lại", "Cần bảo trì trước khi cho thuê lại"];

export function ReturnInspectionPage({ query }) {
  const { ops, run } = useOps();
  const list = ops.returns.filter((r) => r.status === "SCHEDULED");
  const r = query.get("id") ? ops.returns.find((x) => x.id === query.get("id")) : list[0] || ops.returns[0];
  const [form, setForm] = useState({ items: "Đã chuyển hết đồ khỏi kho", walls: "Không ghi nhận hư hỏng mới", keys: "Đã nhận lại 01 chìa khóa", proposal: PROPOSALS[0] });
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
    const out = await run("SUBMIT_RETURN", { id: r.id, report: form }, "Đã gửi biên bản trả kho cho quản lý");
    if (!out.ok) return setErr(out.error);
    go("staff/done?kind=return");
  };
  const submitted = r.status === "SUBMITTED";
  const report = submitted ? r.report : form;
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
          {err && <Notice tone="error">{err}</Notice>}
          {submitted ? <Notice tone="success">Đã gửi biên bản lúc {dateTimeLabel(r.submitted_at)}. Chờ quản lý xác nhận hoàn cọc.</Notice> : <Button type="submit">Gửi biên bản cho quản lý</Button>}
        </form>
        <aside className="panel booking">
          <h2>Cọc đang giữ: {money(r.deposit)}</h2>
          <p className="muted">
            Khoản chưa thanh toán: {money(r.unpaid)}
            <br />
            Số tiền hoàn dự kiến: chờ quản lý xác nhận
          </p>
          <p className="muted">Nhân viên ghi nhận tình trạng và đề xuất. Hoàn cọc chỉ thực hiện sau khi đối chiếu khoản còn phải trả.</p>
        </aside>
      </div>
    </main>
  );
}
