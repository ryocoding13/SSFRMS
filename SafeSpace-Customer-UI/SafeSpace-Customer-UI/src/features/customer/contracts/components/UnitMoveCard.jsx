import React, { useRef, useState } from "react";
import { Button, DetailList, Notice } from "../../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../../shared/components/ConfirmDialog.jsx";
import { dateLabel, money, today } from "../../../../shared/utils/format.js";
import { canMarkMoved, moveWindowStart, UNIT_MOVE_STATUS } from "../renewalUnitModel.js";
import { useUnitMove } from "../useRenewalUnitMove.js";

// D46 · Figma C07b-D46: khối "Chuyển sang ô mới" trong chi tiết hợp đồng + popup xác nhận / thành công / thất bại.
export function UnitMoveCard({ contractApiId, onMoved }) {
  const load = useUnitMove(contractApiId);
  const [confirm, setConfirm] = useState(false), [ticked, setTicked] = useState(false), [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const m = load.data;
  if (load.demo || load.loading || load.error || !m || !["HELD", "PAID", "MOVED"].includes(m.status)) return null;
  const from = m.moveFrom || moveWindowStart(m.oldEndDate);
  const can = canMarkMoved(m, today());
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try { await load.markMoved(); setConfirm(false); setResult({ ok: true }); await load.reload(); onMoved?.(); }
    catch (e) { setConfirm(false); setResult({ ok: false, message: e?.message || "Chưa ghi nhận được. Vui lòng thử lại." }); }
    finally { guard.current = false; setBusy(false); }
  };
  const rows = [["Ô hiện tại", m.fromUnit], ["Ô mới", `${m.toUnit}${m.status === "HELD" ? " · đã giữ, chờ bạn thanh toán gia hạn" : m.status === "PAID" ? " · đã giữ cho bạn" : ""}`],
    ["Thời gian chuyển đồ", `${dateLabel(from)} – hết ${dateLabel(m.oldEndDate)} (3 ngày cuối kỳ cũ)`],
    ["Mã ra vào", m.status === "MOVED" ? `Đã cấp QR/PIN mới cho ${m.toUnit}; mã ${m.fromUnit} hết hiệu lực` : `QR/PIN hiện tại mở được cả ${m.fromUnit} và ${m.toUnit} trong thời gian chuyển`],
    ...(Number(m.depositTopUp) > 0 ? [["Cọc chênh", `${money(m.depositTopUp)}${m.status === "HELD" ? " · gộp trong khoản gia hạn" : " · đã thu"}`]] : [])];
  return <section className="panel customer-detail__card">
    <h2>Chuyển sang ô mới</h2>
    <DetailList items={rows} />
    {m.status === "MOVED"
      ? <Notice tone="success">{UNIT_MOVE_STATUS.MOVED[0]}. Nhân viên kiểm tra ô {m.fromUnit}; hư hỏng hoặc chưa đạt tiêu chuẩn vệ sinh trừ vào cọc đang giữ, không bắt bù cọc.</Notice>
      : <Notice>Chuyển xong bấm “Đã chuyển đồ”: mã ô {m.fromUnit} hết hiệu lực, bạn nhận QR/PIN mới cho {m.toUnit}. Hết {dateLabel(m.oldEndDate)} mà chưa bấm, hệ thống tự chuyển; nếu ô cũ còn đồ sẽ tính phí quá hạn 5% cọc/ngày.</Notice>}
    {m.status !== "MOVED" && <div className="customer-detail__actions">
      <Button disabled={!can || busy} onClick={() => { setTicked(false); setConfirm(true); }}>{m.status === "HELD" ? "Thanh toán gia hạn trước" : can ? "Đã chuyển đồ" : `Chuyển đồ từ ${dateLabel(from)}`}</Button>
    </div>}
    {confirm && <ConfirmDialog title={`Đã chuyển hết đồ sang ${m.toUnit}?`} busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => ticked && send()} label="Xác nhận đã chuyển"
      text={`Mã ô ${m.fromUnit} hết hiệu lực ngay; bạn nhận QR/PIN mới cho ${m.toUnit}. Nhân viên sẽ kiểm tra ô ${m.fromUnit}.`}
      hint="Ô cũ có hư hỏng hoặc chưa đạt tiêu chuẩn vệ sinh thì trừ vào cọc đang giữ, không bắt bù cọc.">
      <label className="customer-detail__choice"><input type="checkbox" checked={ticked} onChange={e => setTicked(e.target.checked)} /><span>Tôi đã chuyển hết đồ khỏi ô {m.fromUnit}</span></label>
    </ConfirmDialog>}
    {result?.ok && <ConfirmDialog title={`Đã chuyển sang ô ${m.toUnit}`} tone="success" cancelLabel={null} hint="" label="Xem mã mới"
      text="QR/PIN mới đã cấp, xem trong mục “QR, PIN & chìa khóa”. Có chìa khóa vật lý thì nhận chìa ô mới tại quầy." onCancel={() => setResult(null)} onConfirm={() => setResult(null)} />}
    {result && !result.ok && <ConfirmDialog title="Chưa ghi nhận được" tone="failure" hint="" label="Thử lại"
      text={`${result.message} Mã hiện tại vẫn mở được cả ${m.fromUnit} và ${m.toUnit} đến hết ${dateLabel(m.oldEndDate)}.`} onCancel={() => setResult(null)} onConfirm={() => { setResult(null); setTicked(false); setConfirm(true); }} />}
  </section>;
}
