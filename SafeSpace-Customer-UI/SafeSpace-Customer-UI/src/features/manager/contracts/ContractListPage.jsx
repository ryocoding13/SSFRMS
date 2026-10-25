import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, daysBetween, money, today } from "../../../shared/utils/format.js";
import { go, qs } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";
import { settleReturn } from "../../facility-operations/utils/opsConfirmation.js";

export const CONTRACT_STATE = (c) =>
  c.state === "OVERDUE"
    ? [`Quá hạn ${Math.max(1, daysBetween(c.end, today()))} ngày`, "red"]
    : c.state === "RENEWAL"
      ? ["Cần duyệt", "amber"]
      : c.state === "RETURNED"
        ? ["Chờ xác nhận trả kho", "amber"]
        : ["Đã xử lý", "green"];

// M07a · Xác nhận trả kho (Figma 629:9147): khoản chưa thanh toán + phí theo biên bản S04 vẫn được giữ làm công nợ
function ReturnConfirmDialog({ contract, ret, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const unpaid = Number(ret?.unpaid ?? contract.amount ?? 0);
  // Ước tính khấu trừ cọc (D27); số chính thức do backend tính khi xác nhận (gồm phí quá hạn tự tính, trả sớm…)
  const { owed, refund, debt } = settleReturn(ret, contract);
  const deposit = Number(ret?.deposit || 0);
  return (
    <Modal title={`Xác nhận trả kho · ${contract.id}`} size="md" onClose={busy ? undefined : onClose}>
      <p className="modal__text modal__text--sub">{[contract.customer, `Kho ${contract.unit}`, ret?.appointment ? `trả kho ${dateLabel(ret.appointment)}` : null].filter(Boolean).join(" · ")}</p>
      <div className="refund-box">
        <dl className="pay-rows">
          <div><dt>Khoản chưa thanh toán</dt><dd className="tone-red">{money(unpaid)}</dd></div>
          {[["damage_fee", "Phí hư hỏng"], ["cleaning_fee", "Phí vệ sinh"], ["overdue_fee", "Phí quá hạn"]].filter(([k]) => Number(ret?.report?.[k]) > 0).map(([k, label]) => (
            <div key={k}><dt>{label} (biên bản S04)</dt><dd className="tone-red">{money(Number(ret.report[k]))}</dd></div>
          ))}
          <div className="pay-rows__total"><dt>Tổng còn phải thu</dt><dd className="tone-amber">{money(owed)}</dd></div>
          {deposit > 0 && (
            <>
              <div><dt>Tiền cọc đang giữ</dt><dd>{money(deposit)}</dd></div>
              <div><dt>Trừ vào cọc (dự kiến)</dt><dd className="tone-red">− {money(Math.min(deposit, owed))}</dd></div>
              <div className="pay-rows__total">
                <dt>{debt > 0 ? "Còn nợ sau khi trừ cọc (dự kiến)" : "Hoàn cọc cho khách (dự kiến)"}</dt>
                <dd className={`pay-rows__amount ${debt > 0 ? "tone-red" : "tone-green"}`}>{money(debt > 0 ? debt : refund)}</dd>
              </div>
            </>
          )}
        </dl>
      </div>
      <Field label="Ghi chú (không bắt buộc)">
        <input maxLength={255} value={note} placeholder="Ví dụ: Đã thông báo khoản còn phải thu cho khách" onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="hint">Xác nhận trả kho sẽ kết thúc hợp đồng. Số hoàn cọc chính thức do hệ thống tính theo chính sách (gồm phí quá hạn theo số ngày trễ); khoản còn nợ vẫn được giữ để tiếp tục thu hồi.</p>
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" disabled={busy} onClick={onClose}>Huỷ</Button>
        <Button disabled={busy} onClick={async () => { setBusy(true); const ok = await onConfirm(note.trim()); if (!ok) setBusy(false); }}>{busy ? "Đang lưu…" : "Xác nhận trả kho"}</Button>
      </div>
    </Modal>
  );
}

export function ContractListPage({ query }) {
  const { ops, run } = useOps();
  const [returning, setReturning] = useState(false);
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
              <p className="muted">Biên bản trả kho {sel.unit} đã được gửi. Đối chiếu khoản phải thu và xác nhận trả kho; công nợ còn lại tiếp tục được theo dõi.</p>
              <Button onClick={() => setReturning(true)}>Xác nhận trả kho</Button>
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
          {returning && sel.state === "RETURNED" && (
            <ReturnConfirmDialog
              contract={sel}
              ret={ops.returns.find((x) => x.contract === sel.id)}
              onClose={() => setReturning(false)}
              onConfirm={async (note) => {
                // Giữ hộp thoại (và ghi chú) khi lưu thất bại để quản lý kiểm tra rồi thử lại
                const res = await run("CONFIRM_REFUND", { id: sel.id, note }, "Đã xác nhận trả kho");
                if (res.ok) setReturning(false);
                return res.ok;
              }}
            />
          )}
          {/* Figma M07: lối vào M08 hoàn tiền đơn huỷ */}
          <LinkButton to="manager/refunds" className="btn--fit">Hoàn tiền đơn huỷ{(ops.refunds || []).some((r) => r.status === "PENDING") ? ` (${ops.refunds.filter((r) => r.status === "PENDING").length})` : ""}</LinkButton>
          {(sel.reminders || []).length > 0 && (
            <ul className="ops-notes">
              {sel.reminders.map((r, i) => <li key={i}><small>{dateTimeLabel(r.at)}</small>{r.text}</li>)}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
