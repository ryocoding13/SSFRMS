/**
 * CANCEL RENEWAL BUTTON - NÚT HỦY YÊU CẦU GIA HẠN ĐANG CHỜ DUYỆT (L5 / D32)
 *
 * Cho phép khách hàng chủ động hủy yêu cầu gia hạn đang ở trạng thái PENDING
 * để gửi lại kỳ hạn khác hoặc chuyển sang làm thủ tục trả kho.
 */
import React, { useRef, useState } from "react";
import { Button } from "../../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog.jsx";
import { dateLabel } from "../../../../shared/utils/format.js";
import { useApp } from "../../../../app/state/AppProvider.jsx";

// 3.2 · Figma C07b-L5c: khách huỷ yêu cầu gia hạn còn chờ duyệt để gửi trả kho hoặc gia hạn mới.
// BE chỉ cho huỷ khi PENDING; quản lý vừa duyệt thì popup thất bại hướng dẫn thanh toán hoặc chờ tự hết hiệu lực.
/**
 * Component nút bấm hủy yêu cầu gia hạn kèm hộp thoại xác nhận an toàn.
 * @param {{ renewalId: number|string, onCancelled: Function }} props
 */
export function CancelRenewalButton({ renewal, contract }) {
  const { dispatch, retry } = useApp();
  const [stage, setStage] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const guard = useRef(false);
  if (!renewal || renewal.status !== "PENDING") return null;
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      const res = await dispatch("CANCEL_RENEWAL", { renewal_id: renewal.renewal_id });
      if (res?.ok) setStage("success");
      else { setError(res?.error || ""); setStage("failure"); }
    } catch (e) { setError(e?.message || ""); setStage("failure"); }
    finally { guard.current = false; setBusy(false); }
  };
  return <>
    <Button variant="outline" className="customer-detail__task-secondary" disabled={busy} onClick={() => { setError(""); setStage("confirm"); }}>Huỷ yêu cầu</Button>
    {stage === "confirm" && <ConfirmDialog tone="danger" title={`Huỷ yêu cầu gia hạn ${renewal.renewal_id}?`} busy={busy} label="Huỷ yêu cầu" hint=""
      text="Yêu cầu đang chờ quản lý duyệt sẽ bị huỷ. Kỳ thuê hiện tại giữ nguyên."
      rows={[["Kho", `${contract.unit_number} · ${contract.contract_id}`], ["Kỳ thuê hiện tại", `đến ${dateLabel(contract.end_date)}`], ["Sau khi huỷ", "Gửi được trả kho hoặc gia hạn mới"]]}
      onCancel={() => setStage(null)} onConfirm={send} />}
    {stage === "success" && <ConfirmDialog tone="success" title={`Đã huỷ yêu cầu gia hạn ${renewal.renewal_id}`} cancelLabel={null} hint="" label="Về hợp đồng"
      text="Nút Trả kho đã mở lại. Bạn có thể gửi trả kho hoặc gửi yêu cầu gia hạn mới." onCancel={() => setStage(null)} onConfirm={() => setStage(null)} />}
    {stage === "failure" && <ConfirmDialog tone="failure" title="Chưa huỷ được yêu cầu gia hạn" hint="" cancelLabel="Đóng" label="Tải lại"
      text={`${error ? `${error} ` : ""}Có thể quản lý vừa duyệt yêu cầu này. Tải lại để xem trạng thái mới; yêu cầu đã duyệt thì thanh toán trước hạn hoặc để tự hết hiệu lực sau 24 giờ.`}
      onCancel={() => setStage(null)} onConfirm={() => { setStage(null); retry?.(); }} />}
  </>;
}
