/**
 * SUPPORT PAGE - TRUNG TÂM TRỢ GIÚP VÀ GỬI YÊU CẦU HỖ TRỢ KỸ THUẬT (C12 / D35 / D36 / D43)
 *
 * Nghiệp vụ hỗ trợ:
 * - Tạo yêu cầu theo các chủ đề: Đặt lịch nhận chìa khóa (KEY_PICKUP - D36), Kẹt khóa/quên mã,
 *   Sự cố vệ sinh, Yêu cầu đổi kho, Hỗ trợ thanh toán.
 * - Đính kèm tối đa 3 ảnh chụp thực tế (D35).
 * - Luồng trao đổi hai chiều liên tục, cơ sở phản hồi chuyển sang WAITING_CUSTOMER (D43).
 */
import React, { useState } from "react";
import { DatePicker, Select } from "../../../shared/components/Pickers.jsx";
import { Button, Dialog, Field, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { dateLabel, dateTimeLabel, today } from "../../../shared/utils/format.js";
import { TICKET_OPTIONS, TICKET_STATUS, TICKET_TOPICS, firstOption } from "../../../shared/utils/status.js";
import { go, href } from "../../../app/router.js";
import { contractStatus } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { typeLabel } from "../../../shared/utils/catalog.js";
import { contractVisitRange, visitDateError } from "../../../shared/utils/returnPolicy.js";
import "../../../shared/styles/customer-detail.css";

// Task #6: Nhận chìa khóa chỉ chọn ngày (DatePicker), bỏ khung giờ Sáng/Chiều và bỏ "Ngày khác · ghi trong mô tả"
// Nhận chìa khóa trong kỳ thuê: từ hôm nay (hoặc ngày bắt đầu nếu chưa tới) đến trước ngày hết hạn.
const keyRange = (c) => contractVisitRange(c?.end_date, today(), c?.start_date);
const defaultKeyDate = (c) => keyRange(c).min;

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
  const initialContractId = supportable.some((c) => c.contract_id === preContract) ? preContract : supportable[0]?.contract_id || "";
  const initialContract = supportable.find((c) => c.contract_id === initialContractId);
  const [form, setForm] = useState({
    contract_id: initialContractId,
    topic: startTopic,
    option: firstOption(startTopic),
    subject: "",
    key_date: defaultKeyDate(initialContract),
  });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);

  const set = (k, v) => {
    setForm((f) => {
      if (k === "contract_id") {
        const nextC = supportable.find((c) => c.contract_id === v);
        return { ...f, contract_id: v, key_date: defaultKeyDate(nextC) };
      }
      return { ...f, [k]: v, ...(k === "topic" ? { option: firstOption(v) } : {}) };
    });
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const submit = async (e) => {
    e.preventDefault();
    if (blockedContract || (mode === "api" && !form.contract_id)) return setErrors({ form: "Chưa có kho đang thuê để gắn yêu cầu. Vui lòng dùng hỗ trợ khi chưa có hợp đồng." });
    if (form.topic === "OTHER" && !form.subject.trim()) return setErrors({ subject: "Vui lòng nhập tiêu đề." });
    if (form.topic === "KEY_PICKUP") {
      const keyContract = supportable.find((x) => x.contract_id === form.contract_id);
      const keyError = visitDateError(form.key_date, keyContract?.end_date, today(), "nhận chìa khóa", keyContract?.start_date);
      if (keyError) return setErrors({ key_date: keyError });
    }
    setBusy(true);
    // Task #5: bỏ mục mô tả & ảnh đính kèm; Task #6: KEY_PICKUP chỉ gửi ngày muốn nhận chìa khóa
    const res = await dispatch("CREATE_TICKET", {
      ...form,
      access_request: form.topic === "ACCESS" ? form.option : undefined,
      preferred_date: form.topic === "KEY_PICKUP" ? form.key_date : undefined,
    });
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    setSent(res.ticket_id);
    setForm((f) => ({ ...f, subject: "" }));
  };
  const reset = () => {
    const c = supportable.find((x) => x.contract_id === form.contract_id);
    setForm((f) => ({ ...f, subject: "", key_date: defaultKeyDate(c) }));
    setErrors({});
  };

  const tickets = [...data.tickets].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const openCount = tickets.filter((t) => ["OPEN", "IN_PROGRESS"].includes(t.status)).length;
  const optionSet = TICKET_OPTIONS[form.topic];
  const radio = (name, value, current, label, onPick) => <label key={value} className="refund-method__option"><input type="radio" name={name} checked={current === value} disabled={busy} onChange={onPick} /><span>{label}</span></label>;
  const contractLabel = (c) => `${c.unit_number} · ${typeLabel(c.type)} · ${c.contract_id}`;

  return (
    <main className="container page customer-records customer-detail">
      <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Hỗ trợ</p>
      <PageHeader title="Gửi yêu cầu hỗ trợ" description={form.topic === "KEY_PICKUP" ? "Hợp đồng đã thanh toán nhưng chưa tới ngày bắt đầu vẫn gửi được. Chọn chủ đề \"Nhận chìa khóa\" và ngày bạn muốn đến nhận." : "Chọn kho và chủ đề cần hỗ trợ. Cơ sở phản hồi trong mục Hỗ trợ và chuông thông báo."}>
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
            {form.topic === "KEY_PICKUP" && (
              <>
                <DatePicker label="Ngày muốn nhận chìa khóa *" value={form.key_date} min={keyRange(supportable.find((x) => x.contract_id === form.contract_id)).min} max={keyRange(supportable.find((x) => x.contract_id === form.contract_id)).max} error={errors.key_date} onChange={(v) => set("key_date", v)} />
                <p className="hint">Ngày khách chọn: <strong>{form.key_date ? dateLabel(form.key_date) : "Chưa chọn"}</strong>. Nhân viên xác minh giấy tờ và giao chìa trong ngày hẹn; mã QR/PIN mở khóa từ ngày bắt đầu thuê.</p>
              </>
            )}
            {form.topic === "OTHER" && <Field label="Tiêu đề *" error={errors.subject} hint="Tiêu đề 1–100 ký tự. Không ghi mật khẩu hoặc mã PIN.">
              <input required maxLength={100} value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>}
            {errors.form && <Notice tone="error">{errors.form}</Notice>}
            <div className="customer-detail__actions"><Button variant="outline" disabled={busy} onClick={reset}>Huỷ</Button><Button type="submit" disabled={busy || blockedContract}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</Button></div>
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
