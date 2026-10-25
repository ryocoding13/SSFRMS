import React, { useState } from "react";
import { DatePicker, Select } from "../../../shared/components/Pickers.jsx";
import { Button, Field, LinkButton, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { addDays, money, today } from "../../../shared/utils/format.js";
import { go } from "../../../app/router.js";
import { contractOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";

export const RETURN_SLOTS = ["09:00–09:30", "10:00–10:30", "14:00–14:30", "15:30–16:00"];

export function ReturnRequestPage({ id }) {
  const { data, dispatch } = useApp();
  const c = contractOf(data, id);
  const [date, setDate] = useState(() => (c && c.end_date >= today() ? c.end_date : addDays(today(), 1)));
  const [slot, setSlot] = useState(RETURN_SLOTS[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false);
  if (!c) return <NotFound />;
  const submit = async (e) => {
    e.preventDefault();
    setConfirm(true);
  };
  const send = async () => {
    if (busy) return;
    setBusy(true);
    const res = await dispatch("REQUEST_RETURN", { contract_id: id, date, slot, notes });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    go(`sent?type=return&contract=${encodeURIComponent(id)}`);
  };
  return (
    <main className="container page">
      <PageHeader title={`Đăng ký trả kho ${c.unit_number}`} description="Chọn lịch hẹn để cơ sở kiểm tra tình trạng kho và đối chiếu tiền cọc." />
      <form className="panel form-card" onSubmit={submit}>
        <div className="form-row">
          <DatePicker label="Ngày mong muốn" value={date} min={today()} onChange={(v) => { setDate(v); setError(""); }} />
          <Field label="Giờ mong muốn">
            <Select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {RETURN_SLOTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Ghi chú">
          <input maxLength={300} placeholder="Ví dụ: Đã lên kế hoạch chuyển hết đồ trước giờ hẹn." value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        <h3>Trước khi trả kho</h3>
        <p className="muted">Dọn hết đồ · Trả thẻ/chìa khóa · Có mặt để kiểm tra cùng nhân viên.</p>
        <h3>Đối chiếu tiền cọc</h3>
        <p className="muted">
          Cọc đang giữ: {money(c.deposit)}. Khoản hoàn thực tế được xác nhận sau kiểm tra và trừ các khoản còn phải trả theo chính sách.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="stack">
          <Button type="submit">Gửi lịch trả kho</Button>
          <LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton>
        </div>
      </form>
      {confirm && <Modal title="Xác nhận gửi trả kho?" size="confirm" onClose={busy ? undefined : () => setConfirm(false)}><Notice>QR mở cửa hết hiệu lực ngay khi yêu cầu được ghi nhận thành công. Hãy chuyển hết đồ trước khi xác nhận.</Notice><p>Kho {c.unit_number} · {date} · {slot}</p>{error && <Notice tone="error">{error}</Notice>}<div className="modal__actions"><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</Button><Button disabled={busy} onClick={send}>{busy ? "Đang gửi…" : "Xác nhận trả kho"}</Button></div></Modal>}
    </main>
  );
}
