/**
 * CONTRACT TOOL PAGE - CHỈNH NGÀY HỢP ĐỒNG / CHỈNH GIÁ (Lượt 6b · #45 #54 · Figma A-DEMO-NGÀY, A-DEMO-GIÁ)
 *
 * mode="dates": ngày bắt đầu, ngày hết hạn (4 kịch bản nhanh) và ngày của giao dịch đã phát sinh.
 * mode="price": giá thuê tháng (tiền cọc chỉ xem) và số tiền của giao dịch đã phát sinh.
 * Mỗi lần lưu: popup xác nhận (trước → sau) → popup kết quả; lỗi giữ nguyên dữ liệu đã nhập.
 * Máy chủ tính lại trạng thái hợp đồng, ô kho, số ngày quá hạn và ghi nhật ký kèm admin thực hiện.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button, Empty, Field, Modal, Notice, Tag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, dateTimeLabel, money, today } from "../../../shared/utils/format.js";
import { DemoHead } from "./DemoShared.jsx";
import { SCENARIOS, contractFormError, expectedState, overdueDays, overdueFee, paymentFormError } from "./demoModel.js";
import "./demo-tools.css";

const STATUS = { ACTIVE: ["Đang thuê", "green"], EXPIRING: ["Sắp hết hạn", "amber"], OVERDUE: ["Quá hạn", "red"], RETURN_PENDING: ["Chờ trả kho", "blue"], COMPLETED: ["Đã kết thúc", "gray"], TERMINATED: ["Đã kết thúc", "gray"], DRAFT: ["Chờ kích hoạt", "gray"] };
const TYPE = { RENT: "Tiền thuê", DEPOSIT: "Tiền cọc", RENEWAL: "Gia hạn", REFUND: "Hoàn tiền", CLEANING_FEE: "Phí vệ sinh", DAMAGE_FEE: "Phí hư hỏng", OVERDUE_FEE: "Phí quá hạn" };
const STATE_TEXT = { ACTIVE: "Đang thuê", EXPIRING: "Sắp hết hạn", OVERDUE: "Quá hạn", RESERVED: "Đang giữ chỗ", OCCUPIED: "Đang thuê", AVAILABLE: "Còn trống" };
const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const payCode = (id) => `TT-${String(id).padStart(4, "0")}`;
const statusOf = (s) => STATUS[s] || [s, "gray"];

/** Giá trị trước/sau từ máy chủ: ngày ISO → dd/MM/yyyy, mã trạng thái → chữ, số tiền → có dấu chấm. */
export function changeText(field, v) {
  if (v == null || v === "") return "—";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return dateTimeLabel(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dateLabel(s);
  if (STATE_TEXT[s]) return STATE_TEXT[s];
  if (/tiền|giá/i.test(field) && /^\d+(\.\d+)?$/.test(s)) return money(Number(s));
  return s;
}

function PaymentDialog({ mode, payment, busy, onSave, onClose }) {
  const [paidAt, setPaidAt] = useState(payment.paidAt ? payment.paidAt.slice(0, 16) : "");
  const [amount, setAmount] = useState(String(payment.amount ?? ""));
  const [reason, setReason] = useState(""), [error, setError] = useState("");
  const dates = mode === "dates";
  const submit = () => {
    const patch = dates ? { paidAt: paidAt && paidAt !== (payment.paidAt || "").slice(0, 16) ? paidAt : "", amount: "" }
      : { paidAt: "", amount: Number(amount) !== Number(payment.amount) ? amount : "" };
    const e = paymentFormError(patch, nowLocal());
    if (e) return setError(e.replace("Nhập ngày thanh toán hoặc số tiền cần chỉnh.", dates ? "Chọn ngày giờ thanh toán mới." : "Nhập số tiền mới."));
    onSave({ paidAt: patch.paidAt ? `${patch.paidAt}:00` : null, amount: patch.amount === "" ? null : Number(patch.amount), reason: reason.trim() || null }, setError);
  };
  return <Modal title={`${dates ? "Sửa ngày" : "Sửa số tiền"} · ${payCode(payment.paymentId)}`} size="md" onClose={busy ? undefined : onClose}>
    <p className="modal__text modal__text--sub">{TYPE[payment.paymentType] || payment.paymentType} · {money(payment.amount)}{payment.paidAt ? ` · thanh toán ${dateTimeLabel(payment.paidAt)}` : " · chưa thanh toán"}</p>
    {dates
      ? <Field label="Ngày giờ thanh toán (giờ Việt Nam)" hint={!payment.paidAt ? "Giao dịch chưa thanh toán nên chưa có ngày để sửa." : undefined}>
          <input type="datetime-local" max={nowLocal()} value={paidAt} disabled={busy || !payment.paidAt} onChange={(e) => { setPaidAt(e.target.value); setError(""); }} />
        </Field>
      : <Field label="Số tiền (đồng)"><input inputMode="numeric" value={amount} disabled={busy} onChange={(e) => { setAmount(e.target.value.replace(/[^\d]/g, "")); setError(""); }} /></Field>}
    <Field label="Lý do (không bắt buộc)"><input maxLength={200} value={reason} disabled={busy} onChange={(e) => setReason(e.target.value)} placeholder={dates ? "Ví dụ: demo thanh toán tháng trước" : "Ví dụ: demo đối soát chênh lệch"} /></Field>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="modal__actions modal__actions--end"><Button variant="outline" disabled={busy} onClick={onClose}>Huỷ</Button><Button disabled={busy || (dates && !payment.paidAt)} onClick={submit}>{busy ? "Đang lưu…" : "Lưu giao dịch"}</Button></div>
  </Modal>;
}

export default function ContractToolPage({ mode = "dates" }) {
  const { user, onApiError } = useApp();
  const dates = mode === "dates";
  const now = today();
  const [search, setSearch] = useState(""), [list, setList] = useState({ loading: true, error: "", rows: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState({ start: "", end: "", rate: "", reason: "" });
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState(null), [payment, setPayment] = useState(null), [history, setHistory] = useState([]);
  const seq = useRef(0), guard = useRef(false);

  const load = async (q = search) => {
    const n = ++seq.current;
    setList((s) => ({ ...s, loading: true, error: "" }));
    try {
      const rows = await adminApi.demoContracts(q.trim() || undefined);
      if (n !== seq.current) return;
      const safe = Array.isArray(rows) ? rows : [];
      setList({ loading: false, error: "", rows: safe });
      setSelectedId((id) => (safe.some((r) => r.contractId === id) ? id : safe[0]?.contractId ?? null));
    } catch (e) { if (n === seq.current) { setList({ loading: false, error: e.message || "Không tải được danh sách hợp đồng.", rows: [] }); onApiError?.(e); } }
  };
  useEffect(() => { const t = setTimeout(() => load(search), 250); return () => clearTimeout(t); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps
  const c = useMemo(() => list.rows.find((r) => r.contractId === selectedId) || null, [list.rows, selectedId]);
  const reset = () => c && setForm({ start: c.startDate, end: c.endDate, rate: String(c.agreedMonthlyRate), reason: "" });
  useEffect(() => { reset(); setError(""); }, [c?.contractId]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = c && (dates ? form.start !== c.startDate || form.end !== c.endDate : Number(form.rate) !== Number(c.agreedMonthlyRate));
  const ask = () => {
    const e = contractFormError(dates ? { ...form, rate: "" } : { start: c.startDate, end: c.endDate, rate: form.rate });
    if (e) return setError(`${e} Dữ liệu đã nhập vẫn được giữ.`);
    setError(""); setConfirm(true);
  };
  const stamp = () => `${dateTimeLabel(new Date().toISOString())} · ${user?.full_name || "Quản trị"}`;
  const applied = (res) => {
    setResult(res);
    setHistory((h) => [...res.changes.map((x) => ({ text: `${x.field} ${changeText(x.field, x.before)} → ${changeText(x.field, x.after)}`, at: stamp() })), ...h].slice(0, 6));
    setList((s) => ({ ...s, rows: s.rows.map((r) => (r.contractId === res.contract.contractId ? res.contract : r)) }));
  };
  const save = async () => {
    if (guard.current) return; guard.current = true; setBusy(true);
    try {
      const body = dates ? { startDate: form.start, endDate: form.end, agreedMonthlyRate: null, reason: form.reason.trim() || null }
        : { startDate: c.startDate, endDate: c.endDate, agreedMonthlyRate: Number(form.rate), reason: form.reason.trim() || null };
      const res = await adminApi.demoEditContract(c.contractId, body);
      setConfirm(false); applied(res);
    } catch (e) { setConfirm(false); setError(`${e.message || "Chưa lưu được."} Dữ liệu đã nhập vẫn được giữ.`); onApiError?.(e); }
    finally { guard.current = false; setBusy(false); }
  };
  const savePayment = async (body, setDialogError) => {
    if (guard.current) return; guard.current = true; setBusy(true);
    try { const res = await adminApi.demoEditPayment(payment.paymentId, body); setPayment(null); applied(res); }
    catch (e) { setDialogError(`${e.message || "Chưa lưu được."} Dữ liệu đã nhập vẫn được giữ.`); onApiError?.(e); }
    finally { guard.current = false; setBusy(false); }
  };

  const days = dates ? overdueDays(form.end, now) : 0;
  const confirmRows = !c ? [] : dates
    ? [["Ngày bắt đầu", `${dateLabel(c.startDate)} → ${dateLabel(form.start)}`], ["Ngày hết hạn", `${dateLabel(c.endDate)} → ${dateLabel(form.end)}`], ["Sau khi lưu", expectedState(form.start, form.end, now)]]
    : [["Giá thuê / tháng", `${money(c.agreedMonthlyRate)} → ${money(Number(form.rate))}`], ["Tiền cọc", `Giữ nguyên ${money(c.depositAmount)}`]];

  return (
    <main className="container page demo-tools">
      <DemoHead title={dates ? "Chỉnh ngày hợp đồng" : "Chỉnh giá"}
        description={dates ? "Chỉnh ngày bắt đầu, ngày hết hạn và ngày của giao dịch đã phát sinh để mô phỏng các tình huống. Mọi thay đổi ghi lại giá trị trước/sau và người chỉnh."
          : "Chỉnh giá thuê tháng và số tiền của giao dịch đã phát sinh để kiểm tra đối soát và báo cáo doanh thu. Mọi thay đổi ghi lại giá trị trước/sau và người chỉnh."}>
        {c && <Tag tone="gray">{c.contractCode} · {c.customerName}</Tag>}
      </DemoHead>
      <div className="demo-tools__row">
        <div className="demo-tools__main">
          <section className="panel demo-tools__card">
            <h2>1 · Chọn hợp đồng</h2>
            <div className="form-pair">
              <Field label="Tìm hợp đồng"><input type="search" value={search} placeholder="Mã hợp đồng, khách hoặc ô kho" onChange={(e) => setSearch(e.target.value)} /></Field>
              <Field label="Hợp đồng">
                <select value={selectedId ?? ""} disabled={!list.rows.length} onChange={(e) => setSelectedId(Number(e.target.value))}>
                  {!list.rows.length && <option value="">{list.loading ? "Đang tải…" : "Không có hợp đồng"}</option>}
                  {list.rows.map((r) => <option key={r.contractId} value={r.contractId}>{r.contractCode} · {r.unitNumber} · {r.customerName} · {r.facilityName}</option>)}
                </select>
              </Field>
            </div>
            {list.error && <Notice tone="error">{list.error} <Button variant="outline" onClick={() => load()}>Thử lại</Button></Notice>}
          </section>
          {!c ? (!list.loading && !list.error && <section className="panel demo-tools__card"><Empty title="Không có hợp đồng" text="Đổi từ khoá tìm kiếm để chọn hợp đồng khác." /></section>) : <>
            {dates ? <>
              <section className="panel demo-tools__card">
                <h2>2 · Mô phỏng nhanh</h2>
                <p className="muted">Chọn một tình huống, hệ thống điền sẵn ngày bắt đầu và hết hạn.</p>
                <div className="demo-tools__scenarios" role="group" aria-label="Kịch bản nhanh">
                  {SCENARIOS.map(([key, label, make]) => <button type="button" key={key} className="chip" onClick={() => { const d = make(now); setForm((f) => ({ ...f, start: d.start, end: d.end })); setError(""); }}>{label}</button>)}
                </div>
              </section>
              <section className="panel demo-tools__card">
                <h2>3 · Ngày hợp đồng</h2>
                <div className="form-pair">
                  <Field label="Ngày bắt đầu" hint={`Trước: ${dateLabel(c.startDate)}`}><input type="date" value={form.start} disabled={busy} onChange={(e) => { setForm({ ...form, start: e.target.value }); setError(""); }} /></Field>
                  <Field label="Ngày hết hạn" hint={`Trước: ${dateLabel(c.endDate)}`}><input type="date" value={form.end} disabled={busy} onChange={(e) => { setForm({ ...form, end: e.target.value }); setError(""); }} /></Field>
                </div>
              </section>
            </> : (
              <section className="panel demo-tools__card">
                <h2>2 · Giá thuê</h2>
                <div className="form-pair">
                  <Field label="Giá thuê/tháng (đồng)" hint={`Trước: ${money(c.agreedMonthlyRate)}`}><input inputMode="numeric" value={form.rate} disabled={busy} onChange={(e) => { setForm({ ...form, rate: e.target.value.replace(/[^\d]/g, "") }); setError(""); }} /></Field>
                  <Field label="Tiền cọc · chỉ xem" hint="Cọc thu theo giá lúc đặt, không chỉnh ở đây"><input value={money(c.depositAmount)} disabled readOnly /></Field>
                </div>
              </section>
            )}
            <section className="panel demo-tools__card">
              <h2>{dates ? "4 · Giao dịch đã phát sinh" : "3 · Số tiền giao dịch"}</h2>
              {!c.payments.length ? <p className="muted">Hợp đồng chưa có giao dịch.</p> : c.payments.map((p) => (
                <div className="demo-tools__pay" key={p.paymentId}>
                  <span><strong>{payCode(p.paymentId)} · {TYPE[p.paymentType] || p.paymentType}</strong>
                    <small>{money(p.amount)} · {p.paidAt ? `ngày giao dịch ${dateTimeLabel(p.paidAt)}` : p.dueDate ? `chưa thanh toán · hạn ${dateLabel(p.dueDate)}` : "chưa thanh toán"}</small></span>
                  <Button variant="outline" disabled={dates && !p.paidAt} title={dates && !p.paidAt ? "Giao dịch chưa thanh toán nên chưa có ngày để sửa" : undefined} onClick={() => setPayment(p)}>{dates ? "Sửa ngày" : "Sửa số tiền"}</Button>
                </div>
              ))}
            </section>
          </>}
        </div>
        {c && <aside className="demo-tools__aside">
          <section className="panel demo-tools__card">
            <h2>Kết quả sau khi lưu</h2>
            <dl className="demo-tools__sum">
              {dates ? <>
                <div><dt>Trạng thái</dt><dd className={days > 0 ? "is-red" : ""}>{expectedState(form.start, form.end, now) || "—"}</dd></div>
                <div><dt>Số ngày quá hạn</dt><dd>{days} ngày</dd></div>
                <div><dt>Phí quá hạn</dt><dd>5% cọc/ngày · {money(overdueFee(c.depositAmount, days))}</dd></div>
                <div><dt>Khấu trừ dự kiến</dt><dd>{money(overdueFee(c.depositAmount, days))}</dd></div>
              </> : <>
                <div><dt>Giá thuê/tháng</dt><dd>{money(c.agreedMonthlyRate)} → {money(Number(form.rate) || 0)}</dd></div>
                <div><dt>Trạng thái</dt><dd>{statusOf(c.status)[0]}</dd></div>
                <div><dt>Tiền cọc</dt><dd>Giữ nguyên {money(c.depositAmount)}</dd></div>
              </>}
            </dl>
            <p className="demo-tools__hint">{dates ? "Cập nhật ở Kho của tôi, danh sách kho, đối soát và báo cáo. Hết hạn tính từ 00:00 ngày hết hạn; mã mở cửa dùng được từ 00:00 ngày bắt đầu." : "Cập nhật ở hợp đồng của khách, danh sách hợp đồng, đối soát và báo cáo doanh thu. Không gửi thông báo cho khách."}</p>
            <Field label="Lý do (không bắt buộc)"><input maxLength={200} value={form.reason} disabled={busy} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={dates ? "Ví dụ: demo quá hạn 3 ngày" : "Ví dụ: demo tăng giá"} /></Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button block disabled={busy || !changed} title={!changed ? "Chưa có thay đổi" : undefined} onClick={ask}>Lưu thay đổi</Button>
            <Button block variant="outline" disabled={busy || !changed} onClick={reset}>Khôi phục giá trị trước</Button>
          </section>
          <section className="panel demo-tools__card">
            <h2>Nhật ký chỉnh</h2>
            {!history.length ? <p className="muted">Chưa chỉnh trong lần mở trang này. Toàn bộ lịch sử xem ở Nhật ký hoạt động.</p>
              : <ul className="demo-tools__log">{history.map((h, i) => <li key={i}><strong>{h.text}</strong><small>{h.at}</small></li>)}</ul>}
          </section>
        </aside>}
      </div>
      {confirm && c && <ConfirmDialog title={`Lưu thay đổi cho ${c.contractCode}?`} busy={busy} label="Lưu thay đổi"
        text={dates ? "Trạng thái hợp đồng, ô kho và số ngày quá hạn được tính lại theo ngày mới." : "Các màn và số liệu liên quan cập nhật theo giá mới."}
        rows={confirmRows} onCancel={() => setConfirm(false)} onConfirm={save} />}
      {payment && <PaymentDialog mode={mode} payment={payment} busy={busy} onSave={savePayment} onClose={() => setPayment(null)} />}
      {result && <ConfirmDialog tone="success" title={`Đã lưu thay đổi cho ${result.target}`} cancelLabel={null} hint="" label="Đóng"
        text="Các màn khách, nhân viên, quản lý và báo cáo dùng số liệu mới ngay sau khi tải lại."
        rows={result.changes.map((x) => [x.field, `${changeText(x.field, x.before)} → ${changeText(x.field, x.after)}`])}
        onCancel={() => setResult(null)} onConfirm={() => setResult(null)} />}
    </main>
  );
}
