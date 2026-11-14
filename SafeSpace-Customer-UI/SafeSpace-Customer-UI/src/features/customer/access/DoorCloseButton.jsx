/**
 * Lượt 6 · Figma C06-cửa (D51, 12/11): nút "Đóng cửa" trong Kho của tôi.
 * Cửa không tự khoá; khách đóng bằng một lần xác nhận (không nhập lại QR/PIN).
 * Kết quả: popup "Đã đóng cửa …" hoặc "Chưa đóng được cửa" (giữ khả năng thử lại).
 * Mục 61 (14/11): chỉ hiện ở trang chi tiết kho; cửa đã đóng thì nút bị khoá (trang truyền `disabled`).
 */
import React, { useRef, useState } from "react";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateTimeLabel } from "../../../shared/utils/format.js";

export function DoorCloseButton({ c, disabled, variant = "outline", onClosed }) {
  const { services } = useApp();
  const [step, setStep] = useState(null); // confirm | done | failed
  const [busy, setBusy] = useState(false), [result, setResult] = useState(null), guard = useRef(false);
  const close = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      const out = await services.closeDoor(c);
      if (out.ok) { setResult(out.door); setStep("done"); onClosed?.(out.door); }
      else { setResult({ error: out.error }); setStep("failed"); }
    } catch { setResult({ error: "Mất kết nối tới máy chủ." }); setStep("failed"); }
    finally { guard.current = false; setBusy(false); }
  };
  return <>
    <Button variant={variant} disabled={disabled || busy} onClick={() => setStep("confirm")}>Đóng cửa</Button>
    {step === "confirm" && <ConfirmDialog title={`Đóng cửa kho ${c.unit_number}?`} busy={busy} label="Đóng cửa"
      text="Cửa kho sẽ khoá lại. Lần sau mở cửa bằng QR hoặc PIN như bình thường."
      rows={[["Kho", c.unit_number], ["Hợp đồng", c.contract_id]]} hint="Kiểm tra đã lấy đủ đồ và không còn ai trong kho."
      onCancel={() => setStep(null)} onConfirm={close} />}
    {step === "done" && <ConfirmDialog tone="success" title={`Đã đóng cửa ${c.unit_number}`} cancelLabel={null} hint="" label="Đóng"
      text={result?.changed === false ? "Cửa đã ở trạng thái khoá từ trước, không cần đóng thêm." : "Cửa kho đã khoá."}
      rows={result?.at ? [["Cập nhật", dateTimeLabel(result.at)]] : []} onCancel={() => setStep(null)} onConfirm={() => setStep(null)} />}
    {step === "failed" && <ConfirmDialog tone="danger" title="Chưa đóng được cửa" label="Thử lại" busy={busy}
      text={`${result?.error || "Không gửi được lệnh đóng cửa."} Nếu cửa vẫn mở, liên hệ nhân viên cơ sở.`}
      onCancel={() => setStep(null)} onConfirm={close} />}
  </>;
}
