import React, { useState } from "react";
import { Button, Field, LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, daysBetween, today } from "../../../shared/utils/format.js";
import { go, qs } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";

export const CONTRACT_STATE = (c) =>
  c.state === "OVERDUE"
    ? [`Quá hạn ${Math.max(1, daysBetween(c.end, today()))} ngày`, "red"]
    : c.state === "RENEWAL"
      ? ["Cần duyệt", "amber"]
      : c.state === "RETURNED"
        ? ["Chờ hoàn cọc", "blue"]
        : ["Đã xử lý", "green"];

export function ContractListPage({ query }) {
  const { ops, run } = useOps();
  const sel = ops.contracts.find((c) => c.id === query.get("id")) || ops.contracts.find((c) => c.state === "RETURNED") || ops.contracts[0];
  const [note, setNote] = useState("");
  const mismatch = ops.payments.filter((p) => p.status === "MISMATCH");
  return (
    <main className="container page">
      <PageHeaderBlock title="Hợp đồng & xử lý quá hạn" text="Theo dõi hạn thuê, khoản chưa thanh toán và lịch sử nhắc tại cơ sở." />
      {mismatch.map((p) => (
        <Notice tone="error" key={p.id}>Nhân viên báo sai lệch thanh toán đơn {p.id} ({p.customer}): {p.note}</Notice>
      ))}
      <div className="panel table-wrap">
        <table className="table table--hover">
          <thead><tr><th>Hợp đồng / khách</th><th>Kho / ngày hết hạn</th><th>Khoản cần xử lý</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {ops.contracts.map((c) => {
              const [label, tone] = CONTRACT_STATE(c);
              return (
                <tr key={c.id} className={sel?.id === c.id ? "is-picked" : ""} onClick={() => go(`manager/contracts${qs({ id: c.id })}`, { replace: true })}>
                  <td className="cell-strong">{c.id} · {c.customer}</td>
                  <td>{c.unit} · {dateLabel(c.end)}</td>
                  <td>{c.due}</td>
                  <td><Tag tone={tone}>{label}</Tag></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {sel && (
        <section className="panel form-card">
          <h2>{sel.id} · Bước tiếp theo</h2>
          {sel.state === "RETURNED" ? (
            <>
              <p className="muted">Nhân viên đã gửi biên bản trả kho {sel.unit}. Đối chiếu khoản còn nợ rồi xác nhận số tiền hoàn cọc.</p>
              <Button onClick={async () => (await run("CONFIRM_REFUND", { id: sel.id }, "Đã xác nhận hoàn cọc")).ok && go("manager/done?kind=refund")}>Xác nhận hoàn cọc</Button>
            </>
          ) : sel.state === "RENEWAL" ? (
            <>
              <p className="muted">Khách đã gửi yêu cầu gia hạn. Duyệt hoặc từ chối trong vòng 24 giờ.</p>
              <LinkButton to="manager/renewals">Xem yêu cầu gia hạn</LinkButton>
            </>
          ) : sel.state === "CLOSED" || sel.state === "RESOLVED" ? (
            <Notice tone="success">{sel.due}</Notice>
          ) : (
            <>
              <p className="muted">Kiểm tra thanh toán và trao đổi với khách trước khi áp dụng biện pháp xử lý. Ghi nhận liên hệ, phí phát sinh và quyết định của quản lý.</p>
              <Field label="Nội dung đã trao đổi (không bắt buộc)">
                <textarea rows={2} value={note} placeholder="Ví dụ: gọi điện nhắc, khách hẹn thanh toán trước 18:00" onChange={(e) => setNote(e.target.value)} />
              </Field>
              <div className="ops-actions">
                <Button onClick={async () => { if ((await run("REMIND", { id: sel.id, note }, "Đã ghi nhận nhắc khách")).ok) setNote(""); }}>Ghi nhận đã nhắc khách</Button>
                <LinkButton to="manager/renewals" variant="outline">Xem yêu cầu gia hạn</LinkButton>
              </div>
            </>
          )}
          {sel.reminders.length > 0 && (
            <ul className="ops-notes">
              {sel.reminders.map((r, i) => <li key={i}><small>{dateTimeLabel(r.at)}</small>{r.text}</li>)}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
