/**
 * RENEWAL STATUS PAGE - THEO DÕI VÀ THANH TOÁN GIA HẠN (C07a · Figma C-GH-PAYOS / C-GH-QUẦY / C-GH-DS)
 *
 * Lượt 3 (#26, #27, #28):
 * - Gia hạn hợp lệ được hệ thống xác nhận tự động (D50 #23); khách chọn cách thanh toán ngay trên màn này:
 *   PayOS mở QR trực tiếp (không chuyển sang trang khác), hoặc tại quầy (chờ nhân viên thu, hạn 24 giờ).
 * - Đã chọn tại quầy thì không còn đưa lựa chọn QR, tránh hai trạng thái mâu thuẫn.
 * - Mỗi yêu cầu hiện đủ kho, hợp đồng, kỳ gia hạn, số tiền, phương thức, trạng thái và hạn; nút không bấm được luôn có lý do.
 * - Hạn thuê chỉ đổi sau khi thu đủ tiền.
 */
import React, { useState } from "react";
import { Button, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import PayosModal from "../../../shared/components/PayosModal.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { contractOf, facilityOf } from "../../../app/state/appSelectors.js";
import { dateLabel, money, timeLabel } from "../../../shared/utils/format.js";
import { InfoTiles, WorkflowEmpty } from "../../facility-operations/workflows/WorkflowComponents.jsx";
import { renewalView } from "./renewalStatusModel.js";
import "../../../shared/styles/customer-detail.css";

/**
 * Màn hình theo dõi và thanh toán yêu cầu gia hạn của một hợp đồng.
 * @param {{ id: string }} props mã hợp đồng
 */
export function RenewalStatusPage({ id }) {
  const { data, dispatch } = useApp();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [paying, setPaying] = useState(null), [paid, setPaid] = useState(null), [counter, setCounter] = useState(null);
  const c = contractOf(data, id);
  const f = c ? facilityOf(data, c.facility_id, c.facility_name) : null;
  const rows = data.renewals.filter(r => r.contract_id === id).map(r => renewalView(data, r)).reverse();
  const deadline = v => v.renewal.payment_deadline_at ? `${dateLabel(v.renewal.payment_deadline_at)} · ${timeLabel(v.renewal.payment_deadline_at)}` : "Chưa có thông tin";
  const chooseCounter = async v => {
    setBusy(true); setError("");
    try {
      const out = await dispatch("CHOOSE_RENEWAL_AT_COUNTER", { renewal_id: v.renewal.renewal_id });
      if (!out.ok) setError(out.error); else setCounter(null);
    } catch { setError("Chưa chọn được thanh toán tại quầy. Nội dung được giữ, vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  return <main className="container page customer-records customer-detail renewal-status">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id} / Gia hạn</p>
    <PageHeader title="Thanh toán & theo dõi gia hạn" description="Gia hạn hợp lệ được xác nhận tự động. Chọn cách thanh toán ngay trên trang này; hợp đồng chỉ kéo dài sau khi thanh toán đủ.">
      <Tag tone="gray">{rows.length} yêu cầu</Tag>
    </PageHeader>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="customer-detail__column">
      {rows.map(v => {
        const r = v.renewal;
        return <article className="panel customer-detail__card renewal-card" key={r.renewal_id}>
          <div className="renewal-card__head">
            <div><h2>{c?.unit_number ? `${c.unit_number} · ` : ""}{id} · {r.months} tháng</h2><p className="muted">{r.renewal_id}{f?.name ? ` · ${f.name}` : ""}</p></div>
            <Tag tone={v.tone}>{v.label}</Tag>
          </div>
          <InfoTiles items={[
            ["Kỳ gia hạn", `${dateLabel(r.old_end)} → ${dateLabel(r.new_end)}`],
            ["Số tiền", money(r.amount)],
            ["Phương thức", v.methodLabel],
            ["Hạn thanh toán", v.state === "PAID" ? "Đã thanh toán" : deadline(v)],
          ]} />
          {v.state === "CHOOSE" && <>
            {/* #26: chọn phương thức ngay trong luồng; PayOS mở QR tại chỗ */}
            <div className="renewal-card__methods">
              <div className="renewal-card__method"><strong>PayOS · quét QR ngân hàng</strong><span>Xác nhận tự động khi nhận đủ tiền</span>
                {v.ledger ? <Button onClick={() => setPaying(v.ledger)} disabled={busy}>Hiện mã QR</Button> : <p className="hint">Khoản thanh toán đang được tạo, tải lại trang sau ít phút.</p>}
              </div>
              <div className="renewal-card__method"><strong>Tại quầy cơ sở</strong><span>Thanh toán tại {f?.name || "cơ sở"}{v.renewal.payment_deadline_at ? ` trước ${deadline(v)}` : " trong hạn thanh toán"}</span>
                <Button variant="outline" disabled={busy} onClick={() => setCounter(v)}>Chọn tại quầy</Button>
              </div>
            </div>
            <Notice>Chưa thu đủ thì hợp đồng vẫn hết hạn ngày {dateLabel(r.old_end)}.</Notice>
          </>}
          {v.state === "COUNTER" && <Notice>Bạn đã chọn thanh toán tại quầy. Đọc mã {r.renewal_id} cho nhân viên tại {f?.name || "cơ sở"}{r.payment_deadline_at ? ` trước ${deadline(v)}` : " trong hạn thanh toán"}. Kỳ thuê hiện tại chưa thay đổi; yêu cầu này không dùng mã QR.</Notice>}
          {v.state === "PAID" && <Notice>Đã thanh toán. Hợp đồng kéo dài đến {dateLabel(r.new_end)}.</Notice>}
          {v.state === "EXPIRED" && <Notice>Hết hạn thanh toán: yêu cầu không còn hiệu lực, kỳ thuê giữ nguyên đến {dateLabel(r.old_end)}. Không chuyển tiền theo mã cũ.</Notice>}
          {v.state === "PENDING" && <Notice>Hệ thống đang kiểm tra lịch của ô. Trang tự cập nhật khi yêu cầu được xác nhận.</Notice>}
          {r.reason && <Notice tone="error">Lý do: {r.reason}</Notice>}
        </article>;
      })}
      {!rows.length && <WorkflowEmpty title="Chưa có yêu cầu gia hạn" text="Bấm “Gia hạn” ở Kho của tôi khi muốn thuê tiếp."><LinkButton to={`units/${encodeURIComponent(id)}`}>Về hợp đồng</LinkButton></WorkflowEmpty>}
    </div>
    <div className="customer-detail__actions"><LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton></div>
    {counter && <ConfirmDialog title="Thanh toán tại quầy?" busy={busy}
      text="Sau khi chọn, yêu cầu này chờ nhân viên thu tiền tại quầy và không hiện mã QR nữa. Hạn thanh toán giữ nguyên."
      rows={[["Yêu cầu", counter.renewal.renewal_id], ["Số tiền", money(counter.renewal.amount)], ["Hạn thanh toán", deadline(counter)]]}
      label="Chọn tại quầy" onCancel={() => setCounter(null)} onConfirm={() => chooseCounter(counter)} />}
    {paying && <PayosModal target={{ kind: "payment", item: paying }} title={`Thanh toán gia hạn · Kho ${c?.unit_number || ""}`}
      subtitle={paying.period ? `Kỳ ${dateLabel(paying.period.from)}–${dateLabel(paying.period.to)}` : ""}
      onPaid={() => { setPaid(paying); setPaying(null); }} onClose={() => setPaying(null)} />}
    {paid && <ConfirmDialog title="Gia hạn thành công" tone="success" rows={[["Số tiền", money(paid.amount)], ["Kỳ mới đến", paid.period?.to ? dateLabel(paid.period.to) : "Chưa có dữ liệu"]]}
      text="PayOS đã xác nhận thanh toán. Hợp đồng được kéo dài theo kỳ mới." cancelLabel={null} hint="" label="Đóng" onCancel={() => setPaid(null)} onConfirm={() => setPaid(null)} />}
  </main>;
}
