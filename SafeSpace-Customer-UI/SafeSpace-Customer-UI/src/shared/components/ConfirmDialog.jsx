import React, { useCallback } from "react";
import { Button, Modal } from "./UI.jsx";

export default function ConfirmDialog({ title, text, rows = [], label = "Xác nhận", busy, onCancel, onConfirm }) {
  const close = useCallback(() => { if (!busy) onCancel(); }, [busy, onCancel]);
  return <Modal title={title} size="confirm" onClose={close}>
    <p className="modal__text">{text}</p>
    <dl className="confirm-summary">{rows.map(([key, value], i) => <div key={`${key}-${i}`}><dt>{key}</dt><dd>{value || "—"}</dd></div>)}</dl>
    <p className="hint">Chọn “Quay lại” để kiểm tra hoặc chỉnh sửa trước khi xác nhận.</p>
    <div className="modal__actions">
      <Button variant="outline" disabled={busy} onClick={close}>Quay lại</Button>
      <Button disabled={busy} onClick={onConfirm}>{busy ? "Đang lưu…" : label}</Button>
    </div>
  </Modal>;
}
