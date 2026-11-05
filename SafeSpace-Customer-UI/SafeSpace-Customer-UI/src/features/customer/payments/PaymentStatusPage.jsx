import React, { useState } from "react";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import PayosModal from "../../../shared/components/PayosModal.jsx";
import { money } from "../../../shared/utils/format.js";
import { canPayLedger } from "../../../shared/utils/returnPolicy.js";
import "../../../shared/styles/customer-detail.css";

export function PaymentStatusPage({ id }) {
  const { data, services } = useApp();
  const row = data.ledger.find(l => l.ref === id);
  const [checking, setChecking] = useState(false), [result, setResult] = useState(null), [error, setError] = useState(""), [paying, setPaying] = useState(false);
  const paid = row?.status === "RECONCILED" || result?.paid === true;
  const check = async () => {
    if (checking || !row) return;
    setChecking(true); setError(""); setResult(null);
    try {
      const out = await services.checkPaid({ kind: "payment", item: row });
      if (out.ok) setResult(out);
      else setError(out.error || "Chưa kiểm tra được trạng thái. Vui lòng thử lại.");
    } catch { setError("Không kết nối được máy chủ. Vui lòng thử lại."); }
    finally { setChecking(false); }
  };
  if (!row || row.kind !== "RENEWAL") return <main className="container page"><Empty title="Không tìm thấy khoản gia hạn" text="Hãy chọn khoản thu từ danh sách thanh toán." /><LinkButton to="payments">Về thanh toán</LinkButton></main>;
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Thanh toán & lịch hẹn</p>
    <PageHeader title="Kiểm tra trạng thái thanh toán" description="Xem kết quả ghi nhận của khoản thu trước khi tạo hoặc quét QR mới."><Tag tone={paid ? "green" : "amber"}>{paid ? "Đã thanh toán" : "Chưa xác nhận thanh toán"}</Tag></PageHeader>
    <div className="customer-detail__grid">
      <section className="panel customer-detail__card"><h2>Khoản gia hạn {row.contract_id}</h2>
        <DetailList items={[["Khoản thu", row.ref], ["Nội dung", row.label], ["Số tiền", money(row.amount)], ["Trạng thái", paid ? "Đã thanh toán" : result ? "Chưa ghi nhận đủ tiền" : "Chưa kiểm tra"]]} />
        <Notice>Nếu vừa chuyển tiền, hãy kiểm tra trạng thái trước. Khi chưa xác nhận, kỳ gia hạn chưa được kéo dài.</Notice>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="customer-detail__actions"><Button variant="outline" disabled={checking || !result || paid || !canPayLedger(row)} onClick={() => setPaying(true)}>Mở mã QR thanh toán</Button><Button disabled={checking || paid} onClick={check}>{checking ? "Đang kiểm tra…" : "Kiểm tra trạng thái"}</Button></div>
        <LinkButton to="payments" variant="outline">Về thanh toán</LinkButton>
      </section>
      <aside className="panel customer-detail__card"><h2>Lưu ý</h2><p className="hint">Thanh toán gia hạn trong 24 giờ sau khi được duyệt và trước ngày hết hạn. Quá hạn, yêu cầu hết hiệu lực. Máy chủ quyết định phiên QR còn hợp lệ; không chuyển tiền lại khi chưa kiểm tra.</p><div className="customer-detail__actions"><LinkButton to="policies" variant="outline">Xem chính sách</LinkButton></div></aside>
    </div>
    {paying && <PayosModal target={{ kind: "payment", item: row }} title="Thanh toán gia hạn" onClose={() => setPaying(false)} onPaid={() => { setPaying(false); setResult({ paid: true }); }} />}
  </main>;
}
