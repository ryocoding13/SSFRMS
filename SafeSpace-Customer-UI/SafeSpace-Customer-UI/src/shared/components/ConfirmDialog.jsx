import React, { useCallback } from "react";
import { Button, Modal } from "./UI.jsx";

export default function ConfirmDialog({ title, text, rows = [], label = "Xác nhận", hint = "Chọn “Quay lại” để kiểm tra hoặc chỉnh sửa trước khi xác nhận.", busy, onCancel, onConfirm, tone = "confirm", cancelLabel = "Quay lại", children }) {
  const close = useCallback(() => { if (!busy) onCancel(); }, [busy, onCancel]);
  return <Modal title={title} size="confirm" tone={tone} onClose={close}>
    {text && <p className="modal__text">{text}</p>}
    {rows.length > 0 && <dl className="confirm-summary">{rows.map(([key, value], i) => <div key={`${key}-${i}`}><dt>{key}</dt><dd>{value ?? "—"}</dd></div>)}</dl>}
    {children}
    {hint && <p className="hint">{hint}</p>}
    <div className="modal__actions">
      {cancelLabel && <Button variant="outline" disabled={busy} onClick={close}>{cancelLabel}</Button>}
      <Button variant={tone === "danger" ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>{busy ? "Đang lưu…" : label}</Button>
    </div>
  </Modal>;
}
