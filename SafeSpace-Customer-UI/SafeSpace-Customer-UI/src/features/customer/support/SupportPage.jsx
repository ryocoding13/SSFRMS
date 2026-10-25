import React, { useRef, useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, LinkButton, Dialog, Field, Icon, Modal, Notice, PageHeader, StatusTag } from "../../../shared/components/UI.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";
import { ACCESS_REQUESTS, TICKET_STATUS, TICKET_TOPICS } from "../../../shared/utils/status.js";
import { href } from "../../../app/router.js";
import { facilityOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";

const MAX_FILES = 3;
const MAX_MB = 5;

function TicketCard({ t }) {
  const { dispatch, notify } = useApp();
  const [confirm, setConfirm] = useState(false);
  const cancel = async () => {
    const res = await dispatch("CANCEL_TICKET", { ticket_id: t.ticket_id });
    setConfirm(false);
    notify(res.ok ? "Đã huỷ yêu cầu hỗ trợ." : res.error, res.ok ? "success" : "error");
  };
  return (
    <article className="panel ticket">
      <StatusTag map={TICKET_STATUS} status={t.status} square />
      <h3>{t.ticket_id} · {t.title || TICKET_TOPICS[t.topic]?.title || "Yêu cầu hỗ trợ"}</h3>
      <p className="muted ticket__preview">
        {t.responses?.length > 0 && <span className="visually-hidden">Phản hồi của nhân viên: </span>}
        {t.responses?.length ? `${t.responses.at(-1).by || "Nhân viên"}: “${t.responses.at(-1).text}”` : t.staff_note}
        <br />
        Cập nhật: {dateTimeLabel(t.updated_at)}
      </p>
      {t.responses_error && <Notice tone="error">Chưa tải được phản hồi. Vui lòng cập nhật lại yêu cầu.</Notice>}
      {t.status !== "CANCELLED" && (
        <p className="muted">Nếu đang đứng tại cổng cơ sở, liên hệ nhân viên trực để được hỗ trợ ngay.</p>
      )}
      <div className="stack">
        <a className="link-btn support-detail-link" aria-label="Xem chi tiết →" href={href(`support/${encodeURIComponent(t.ticket_id)}`)}>Xem chi tiết <Icon name="back" size={14} /></a>
        {t.status === "OPEN" && (
          <button type="button" className="link-btn link-btn--danger" onClick={() => setConfirm(true)}>Huỷ yêu cầu</button>
        )}
      </div>
      {confirm && (
        <Modal title="Huỷ yêu cầu hỗ trợ?" onClose={() => setConfirm(false)}>
          <p className="modal__text">Yêu cầu {t.ticket_id} sẽ bị huỷ. Bạn có thể gửi yêu cầu mới bất cứ lúc nào.</p>
          <div className="modal__actions">
            <Button variant="danger" onClick={cancel}>Huỷ yêu cầu</Button>
            <Button variant="outline" onClick={() => setConfirm(false)}>Giữ lại</Button>
          </div>
        </Modal>
      )}
    </article>
  );
}

export default function SupportPage({ query }) {
  const { data, dispatch, mode, retry, loadError } = useApp();
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const preContract = query.get("contract");
  const preTopic = query.get("topic");
  const [form, setForm] = useState({
    contract_id: data.contracts.some((c) => c.contract_id === preContract) ? preContract : data.contracts[0]?.contract_id || "",
    topic: TICKET_TOPICS[preTopic] ? preTopic : "ACCESS",
    description: "",
    subject: "",
    access_request: "QR",
  });
  const [files, setFiles] = useState([]);
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(null);
  const picker = useRef(null);

  const set = (k, v) => {
    setForm({ ...form, [k]: v });
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const addFiles = (list) => {
    const next = [...files];
    let problem = "";
    for (const f of list) {
      if (!["image/jpeg", "image/png"].includes(f.type)) problem = "Chỉ đính kèm ảnh JPG hoặc PNG.";
      else if (f.size > MAX_MB * 1024 * 1024) problem = `Mỗi ảnh tối đa ${MAX_MB} MB.`;
      else if (next.length >= MAX_FILES) problem = `Tối đa ${MAX_FILES} ảnh.`;
      else next.push(f);
    }
    setFiles(next);
    setErrors((p) => ({ ...p, files: problem || undefined }));
    if (picker.current) picker.current.value = "";
  };
  const submit = async (e) => {
    e.preventDefault();
    if (form.topic === "OTHER" && !form.subject.trim()) return setErrors({ subject: "Vui lòng nhập chủ đề của bạn." });
    if (!form.description.trim()) return setErrors({ description: "Vui lòng mô tả vấn đề bạn đang gặp." });
    setBusy(true);
    const res = await dispatch("CREATE_TICKET", { ...form, attachments: files.map((f) => f.name) });
    setBusy(false);
    if (!res.ok) return setErrors({ form: res.error });
    setSent(res.ticket_id);
    setForm({ ...form, description: "" });
    setFiles([]);
  };

  const tickets = [...data.tickets].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <main className="container page">
      <div className="workflow-links"><LinkButton to="inquiries" variant="outline">Hỗ trợ khi chưa có hợp đồng</LinkButton></div>
      <PageHeader title="Bạn cần hỗ trợ điều gì?" description="Gửi yêu cầu đến đúng cơ sở. Theo dõi phản hồi ngay trong tài khoản.">
        {mode === "api" && <Button variant="outline" disabled={refreshing} onClick={async () => {
          setRefreshing(true);
          try { await retry(); } finally { setRefreshing(false); }
        }}>{refreshing ? "Đang cập nhật…" : "Cập nhật yêu cầu"}</Button>}
      </PageHeader>
      {loadError && <Notice tone="error">{loadError}</Notice>}
      <div className="detail-grid support-grid">
        <form className="panel form-card" onSubmit={submit} noValidate>
          <Field label="Kho / hợp đồng liên quan">
            <Select value={form.contract_id} onChange={(e) => set("contract_id", e.target.value)}>
              {data.contracts.map((c) => (
                <option key={c.contract_id} value={c.contract_id}>{c.unit_number} · {facilityOf(data, c.facility_id, c.facility_name).name}</option>
              ))}
              {data.contracts.length === 0 && <option value="">{mode === "api" ? "Bạn chưa có hợp đồng thuê kho" : "Vấn đề chung (chưa thuê kho)"}</option>}
            </Select>
          </Field>
          <Field label="Chủ đề">
            <Select value={form.topic} onChange={(e) => set("topic", e.target.value)}>
              {Object.entries(TICKET_TOPICS).filter(([, t]) => !t.legacy).map(([k, t]) => (
                <option key={k} value={k}>{t.label}</option>
              ))}
            </Select>
          </Field>
          {form.topic === "ACCESS" && <div className="field">
            <span className="field__label" id="access-request-label">Bạn cần cấp lại mục nào?</span>
            <div className="support-access-options" role="group" aria-labelledby="access-request-label">
              {Object.entries(ACCESS_REQUESTS).map(([key, label]) => <Button key={key} variant={form.access_request === key ? "primary" : "outline"} aria-pressed={form.access_request === key} onClick={() => set("access_request", key)}>{label}</Button>)}
            </div>
            <p className="hint">QR và PIN được cấp theo hợp đồng. Chìa khóa vật lý nhận tại quầy cơ sở.</p>
          </div>}
          {form.topic === "OTHER" && <Field label="Chủ đề của bạn *" error={errors.subject} hint="Nhập tiêu đề ngắn gọn, tối đa 100 ký tự. Vui lòng không để trống.">
            <input required maxLength={100} placeholder="VD: Cập nhật thông tin người liên hệ" value={form.subject} onChange={e => set("subject", e.target.value)} />
          </Field>}
          <Field label="Mô tả vấn đề" error={errors.description}>
            <textarea rows={3} maxLength={1000} placeholder="Mô tả chi tiết vấn đề để cơ sở hỗ trợ bạn…" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className={`field${errors.files ? " field--invalid" : ""}`}>
            <span className="field__label">Ảnh đính kèm (không bắt buộc)</span>
            <button type="button" className="attach" onClick={() => picker.current?.click()}><span aria-hidden="true">+</span><span>Thêm ảnh</span></button>
            <input ref={picker} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(e) => addFiles([...e.target.files])} />
            <p className="hint">Tối đa 3 ảnh · JPG, PNG · mỗi ảnh tối đa 5 MB</p>
            {files.length > 0 && (
              <ul className="files">
                {files.map((f, i) => (
                  <li key={`${f.name}-${i}`}>
                    <span>{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} aria-label={`Bỏ ${f.name}`}>×</button>
                  </li>
                ))}
              </ul>
            )}
            {errors.files && <p className="field__error" role="alert">{errors.files}</p>}
          </div>
          {errors.form && <Notice tone="error">{errors.form}</Notice>}
          <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi yêu cầu"}</Button>
        </form>

        <div className="stack stack--col stack--fill">
          {tickets.length === 0 ? (
            <section className="panel ticket">
              <h3>Chưa có yêu cầu nào</h3>
              <p className="muted">Yêu cầu bạn gửi sẽ hiện ở đây cùng trạng thái xử lý.</p>
            </section>
          ) : (
            tickets.map((t) => <TicketCard key={t.ticket_id} t={t} />)
          )}
        </div>
      </div>
      {sent && <Dialog title="Đã gửi yêu cầu hỗ trợ" message={`Mã yêu cầu ${sent}. Cơ sở sẽ phản hồi qua thông báo trong tài khoản.`} onClose={() => setSent(null)} />}
    </main>
  );
}
