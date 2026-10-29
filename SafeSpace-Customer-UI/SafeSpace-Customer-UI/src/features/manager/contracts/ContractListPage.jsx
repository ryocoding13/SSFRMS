import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, daysBetween, money, today } from "../../../shared/utils/format.js";
import { go, qs } from "../../../app/router.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";
import { PageHeaderBlock } from "../components/PageHeaderBlock.jsx";
import { supportsReturnPolicy, RETURN_POLICY_PENDING } from "../../../shared/utils/returnPolicy.js";

export const CONTRACT_STATE = (c) =>
  c.state === "OVERDUE"
    ? [`Quá hạn ${Math.max(1, daysBetween(c.end, today()))} ngày`, "red"]
    : c.state === "RENEWAL"
      ? ["Cần duyệt", "amber"]
      : c.state === "RETURNED"
        ? ["Chờ xác nhận trả kho", "amber"]
        : ["Đã xử lý", "green"];

// M07: chốt số tiền, không xác nhận đã chuyển hoàn.
function ReturnConfirmDialog({ contract, ret, onClose, onConfirm }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Xác nhận trả kho · ${contract.id}`} size="md" onClose={busy ? undefined : onClose}>
      <p className="modal__text modal__text--sub">{[contract.customer, `Kho ${contract.unit}`, ret?.appointment ? `trả kho ${dateLabel(ret.appointment)}` : null].filter(Boolean).join(" · ")}</p>
      <div className="refund-box">
        <dl className="pay-rows">
          <div><dt>Tiền cọc đang giữ</dt><dd>{money(ret?.deposit)}</dd></div>
          <div><dt>Khấu trừ tối đa</dt><dd>100% tiền cọc</dd></div>
          <div><dt>Số tiền hoàn chính thức</dt><dd>Máy chủ tính khi chốt</dd></div>
        </dl>
      </div>
      <Field label="Ghi chú (không bắt buộc)">
        <input maxLength={255} value={note} placeholder="Ví dụ: Đã đối chiếu tình trạng kho và thông tin hoàn tiền" onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="hint">Chốt trả kho tạo khoản chờ hoàn. Tổng khấu trừ không vượt cọc; không thu thêm. Hoàn tiền bằng chuyển khoản trong 3–5 ngày làm việc. Kho cần vệ sinh hoặc sửa tiếp tục bảo trì.</p>
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" disabled={busy} onClick={onClose}>Huỷ</Button>
        <Button disabled={busy} onClick={async () => { setBusy(true); const ok = await onConfirm(note.trim()); if (!ok) setBusy(false); }}>{busy ? "Đang lưu…" : "Xác nhận trả kho"}</Button>
      </div>
    </Modal>
  );
}

export function ContractListPage({ query }) {
  const { ops, run, source } = useOps();
  const settlementReady = source === "local" || supportsReturnPolicy(ops);
  const [returning, setReturning] = useState(false);
  const sel = ops.contracts.find((c) => c.id === query.get("id")) || ops.contracts.find((c) => c.state === "RETURNED") || ops.contracts[0];
  const [note, setNote] = useState("");
  const mismatch = ops.payments.filter((p) => p.status === "MISMATCH");
  return (
    <main className="container page">
      <PageHeaderBlock title="Hợp đồng & xử lý quá hạn" text="Theo dõi hạn thuê, khoản chưa thanh toán và lịch sử nhắc tại cơ sở." />
      <div className="workflow-links"><LinkButton to="manager/damage-responses" variant="outline">Phản hồi hư hỏng</LinkButton><LinkButton to="manager/damage-inspections" variant="outline">Kiểm tra khắc phục</LinkButton></div>
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
                  <td>{["RETURNED", "CLOSED"].includes(c.state) ? "Đối chiếu biên bản và khoản hoàn" : c.due}</td>
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
              <p className="muted">Biên bản trả kho {sel.unit} đã được gửi. Đối chiếu khấu trừ cọc và chốt khoản chờ hoàn.</p>
              {!settlementReady && <Notice>{RETURN_POLICY_PENDING}</Notice>}
              <Button disabled={!settlementReady} onClick={() => setReturning(true)}>Xác nhận trả kho</Button>
            </>
          ) : sel.state === "RENEWAL" ? (
            <>
              <p className="muted">Khách đã gửi yêu cầu gia hạn. Duyệt hoặc từ chối trong vòng 24 giờ.</p>
              <LinkButton to="manager/renewals">Xem yêu cầu gia hạn</LinkButton>
            </>
          ) : sel.state === "CLOSED" || sel.state === "RESOLVED" ? (
            <Notice>Đã xử lý hợp đồng. Kiểm tra trạng thái chuyển tiền tại mục hoàn cọc.</Notice>
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
          <LinkButton to="manager/deposit-refunds" variant="outline">Hoàn cọc sau trả kho</LinkButton>
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
