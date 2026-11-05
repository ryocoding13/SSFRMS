import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Dialog, Field, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, today } from "../../../shared/utils/format.js";
import { TICKET_OPTIONS, TICKET_STATUS, TICKET_TOPICS, firstOption } from "../../../shared/utils/status.js";
import { go, href } from "../../../app/router.js";
import { contractStatus, facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import "../../../shared/styles/customer-detail.css";

const MAX_FILES = 3;
// Figma C12-chìa khóa · D36: khung giờ nhận chìa khóa lần đầu; "Ngày khác" ghi trong mô tả (cơ sở xếp lịch).
const KEY_SLOTS = { MORNING: ["Sáng", "08:00–11:00", "08:00"], AFTERNOON: ["Chiều", "13:00–17:00", "13:00"], OTHER: ["Ngày khác · ghi trong mô tả", "", ""] };

// Figma C12 · "Yêu cầu gần đây": mã · tiêu đề, trạng thái · thời gian, nút Xem
// Thắng chốt 06/11 (D43): hỗ trợ là cuộc trò chuyện, khách không huỷ yêu cầu — chỉ có nút Xem.
function TicketItem({ t }) {
  const [label, tone] = TICKET_STATUS[t.status] || ["Đang xử lý", "amber"];
  const last = t.responses?.at(-1);
  return <article className="support-recent__item">
    <div className="support-recent__text">
      <strong>{t.ticket_id} · {t.title || TICKET_TOPICS[t.topic]?.title || "Yêu cầu hỗ trợ"}</strong>
      <span className={`support-recent__status tone-${tone}`}>{label} · {dateTimeLabel(t.updated_at)}</span>
      {last && <span className="support-recent__reply"><span className="visually-hidden">Phản hồi của nhân viên: </span>{last.by || "Nhân viên"}: “{last.text}”</span>}
      {t.responses_error && <Notice tone="error">Chưa tải được phản hồi. Vui lòng cập nhật lại yêu cầu.</Notice>}
    </div>
    <div className="support-recent__actions">
      <Button variant="outline" onClick={() => go(`support/${encodeURIComponent(t.ticket_id)}`)}>Xem</Button>
    </div>
  </article>;
}

export default function SupportPage({ query }) {
  const { data, dispatch, mode, retry, loadError } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const preContract = query.get("contract");
  const preTopic = query.get("topic");
  // D40 (thay L14 cũ): hợp đồng đã thanh toán, kể cả chưa tới ngày bắt đầu, được gửi hỗ trợ; đã kết thúc thì không
  const supportable = data.contracts.filter((c) => contractStatus(c) !== "ENDED" && !["DRAFT", "CANCELLED"].includes(c.api_status || c.status));
  const noContract = supportable.length === 0;
  const blockedContract = noContract && data.contracts.length > 0;
  const startTopic = TICKET_TOPICS[preTopic] && !TICKET_TOPICS[preTopic].legacy ? preTopic : "ACCESS";
  const [form, setForm] = useState({
    contract_id: supportable.some((c) => c.contract_id === preContract) ? preContract : supportable[0]?.contract_id || "",
    topic: startTopic,
    option: firstOption(startTopic),
    description: "",
    subject: "",
    key_slot: "MORNING",
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const [reading, setReading] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === "topic" ? { option: firstOption(v) } : {}) }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const contract = supportable.find((c) => c.contract_id === form.contract_id);
  const keyDate = contract?.start_date && contract.start_date > today() ? contract.start_date : today();
  const preferredAt = () => form.topic === "KEY_PICKUP" && KEY_SLOTS[form.key_slot]?.[2] ? `${keyDate}T${KEY_SLOTS[form.key_slot][2]}` : "";
  const submit = async (e) => {
    e.preventDefault();
    if (blockedContract || (mode === "api" && !form.contract_id)) return setErrors({ form: "Chưa có kho đang thuê để gắn yêu cầu. Vui lòng dùng hỗ trợ khi chưa có hợp đồng." });
    if (form.topic === "OTHER" && !form.subject.trim()) return setErrors({ subject: "Vui lòng nhập tiêu đề." });
    if (!form.description.trim()) return setErrors({ description: "Vui lòng mô tả vấn đề bạn đang gặp." });
    setBusy(true);
    // D35: gửi ảnh thật (tối đa 3) để nhân viên xem được; D36: giờ muốn nhận chìa khóa
    const res = await dispatch("CREATE_TICKET", { ...form, access_request: form.topic === "ACCESS" ? form.option : undefined, preferred_at: preferredAt(), photos: files, attachments: files.map((f) => f.name) });
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    setSent(res.ticket_id);
    setForm((f) => ({ ...f, description: "" }));
    setFiles([]);
  };
  const reset = () => { setForm((f) => ({ ...f, description: "", subject: "" })); setFiles([]); setErrors({}); };

  const tickets = [...data.tickets].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const openCount = tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length;
  const optionSet = TICKET_OPTIONS[form.topic];
  const radio = (name, value, current, label, onPick) => <label key={value} className="refund-method__option"><input type="radio" name={name} checked={current === value} disabled={busy} onChange={onPick} /><span>{label}</span></label>;
  const contractLabel = (c) => `${c.unit_number} · ${typeLabel(c.type)} · ${c.contract_id}`;

  return (
    <main className="container page customer-records customer-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Hỗ trợ</p>
      <PageHeader title="Gửi yêu cầu hỗ trợ" description={form.topic === "KEY_PICKUP" ? "Hợp đồng đã thanh toán nhưng chưa tới ngày bắt đầu vẫn gửi được. Chọn chủ đề \"Nhận chìa khóa\" để hẹn giờ nhận lần đầu." : "Chọn kho và chủ đề, mô tả vấn đề. Cơ sở phản hồi trong mục Hỗ trợ và chuông thông báo."}>
        <Tag tone="blue">{openCount} yêu cầu đang mở</Tag>
      </PageHeader>
      {loadError && <Notice tone="error">{loadError}</Notice>}
      <div className="customer-detail__grid">
        <form className="customer-detail__column" onSubmit={submit} noValidate>
          <section className="panel customer-detail__card"><h2>1 · Kho và chủ đề</h2>
            <div className="form-row">
              <Field label="Kho / hợp đồng liên quan *">
                <Select value={form.contract_id} onChange={(e) => set("contract_id", e.target.value)}>
                  {supportable.map((c) => <option key={c.contract_id} value={c.contract_id}>{contractLabel(c)}</option>)}
                  {noContract && <option value="">{blockedContract ? "Không có kho đang trong kỳ thuê" : mode === "api" ? "Bạn chưa có hợp đồng thuê kho" : "Không gắn kho cụ thể"}</option>}
                </Select>
              </Field>
              <Field label="Chủ đề *">
                <Select value={form.topic} onChange={(e) => set("topic", e.target.value)}>
                  {Object.entries(TICKET_TOPICS).filter(([, t]) => !t.legacy).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                </Select>
              </Field>
            </div>
            {blockedContract && <Notice>Chỉ gửi yêu cầu theo kho khi hợp đồng đã thanh toán và chưa kết thúc. Kho đã kết thúc, vui lòng dùng <a href={href("inquiries")}>hỗ trợ khi chưa có hợp đồng</a>.</Notice>}
            {optionSet && <div className="refund-method__row" role="radiogroup" aria-label={optionSet.question}>
              <span className="refund-method__label">{optionSet.question} *</span>
              <div className="refund-method__options">{Object.entries(optionSet.options).map(([k, label]) => radio("ticket-option", k, form.option, label, () => set("option", k)))}</div>
              <p className="hint">{optionSet.hint}</p>
            </div>}
            {form.topic === "KEY_PICKUP" && <div className="refund-method__row" role="radiogroup" aria-label="Thời gian muốn nhận">
              <span className="refund-method__label">Thời gian muốn nhận *</span>
              <div className="refund-method__options">{Object.entries(KEY_SLOTS).map(([k, [part, hours]]) => radio("key-slot", k, form.key_slot, hours ? `${part} ${dateLabel(keyDate).slice(0, 5)} · ${hours}` : part, () => set("key_slot", k)))}</div>
              <p className="hint">Nhân viên xác minh giấy tờ rồi xác nhận giờ giao chìa. Yêu cầu được xử lý theo thứ tự gửi. Mã QR/PIN dùng được từ ngày bắt đầu thuê.</p>
            </div>}
            {form.topic === "OTHER" && <Field label="Tiêu đề *" error={errors.subject} hint="Tiêu đề 1–100 ký tự, nội dung 1–1000 ký tự. Không ghi mật khẩu hoặc mã PIN.">
              <input required maxLength={100} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>}
          </section>
          <section className="panel customer-detail__card"><h2>2 · Mô tả & ảnh đính kèm</h2>
            <p className="hint">Mô tả càng rõ, cơ sở xử lý càng nhanh. Không ghi mật khẩu hoặc mã PIN trong mô tả.</p>
            <Field label="Mô tả vấn đề *" error={errors.description}>
              <textarea rows={3} maxLength={1000} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </Field>
            <ReturnPhotoInput files={files} onChange={setFiles} onReading={setReading} disabled={busy} required={false} max={MAX_FILES} label="Đính kèm ảnh" />
            {errors.form && <Notice tone="error">{errors.form}</Notice>}
            <div className="customer-detail__actions"><Button variant="outline" disabled={busy} onClick={reset}>Huỷ</Button><Button type="submit" disabled={busy || reading || blockedContract}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</Button></div>
          </section>
        </form>
        <aside className="customer-detail__column customer-detail__sidebar">
          <section className="panel customer-detail__card support-recent"><h2>Yêu cầu gần đây</h2>
            {tickets.length === 0 ? <p className="hint">Yêu cầu bạn gửi sẽ hiện ở đây cùng trạng thái xử lý.</p> : tickets.slice(0, 5).map((t) => <TicketItem key={t.ticket_id} t={t} />)}
            {mode === "api" && <Button variant="outline" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await retry(); } finally { setRefreshing(false); } }}>{refreshing ? "Đang cập nhật…" : "Cập nhật yêu cầu"}</Button>}
          </section>
          <section className="panel customer-detail__card return-request__warning"><h2>Lưu ý khi gửi</h2>
            <ul><li>Sự cố khóa cửa khẩn cấp: gọi hotline của cơ sở.</li><li>Chìa khóa vật lý nhận tại quầy sau khi nhân viên xác minh.</li><li>Phản hồi hiện trong mục Hỗ trợ và chuông thông báo.</li><li>Chưa có hợp đồng? Gửi câu hỏi tại <a href={href("inquiries")}>hỗ trợ khi chưa có hợp đồng</a>.</li></ul>
          </section>
        </aside>
      </div>
      {sent && <Dialog title="Đã gửi yêu cầu hỗ trợ" message={`Mã yêu cầu ${sent}. Cơ sở sẽ phản hồi qua thông báo trong tài khoản.`} onClose={() => setSent(null)} />}
    </main>
  );
}
