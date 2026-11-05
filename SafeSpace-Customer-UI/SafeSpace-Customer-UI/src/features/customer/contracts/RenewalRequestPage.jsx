import React, { useState } from "react";
import { Button, DetailList, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import { RENTAL_PLANS } from "../../../shared/utils/catalog.js";
import { addMonths, dateLabel, money, today } from "../../../shared/utils/format.js";
import { go } from "../../../app/router.js";
import { contractOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { NotFound } from "./components/ContractNotFound.jsx";
import "../../../shared/styles/customer-detail.css";

export function RenewalRequestPage({ id }) {
  const { data, dispatch } = useApp();
  const policy = useWorkflowData("policy");
  const c = contractOf(data, id);
  const [months, setMonths] = useState(3);
  const [acceptedVersion, setAcceptedVersion] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!c) return <NotFound />;
  const version = policy.data?.version;
  const policyReady = !policy.loading && !policy.error && version != null && Number.isSafeInteger(Number(version)) && Number(version) > 0;
  const accepted = policyReady && acceptedVersion === String(version);
  const blocked = c.status === "ENDED" || c.end_date <= today() || Boolean(pendingRenewal(data, id) || pendingReturn(data, id));
  const newEnd = addMonths(c.end_date, months);
  const submit = async (e) => {
    e.preventDefault();
    if (busy || blocked) return;
    if (!accepted) return setError("Vui lòng đọc và đồng ý chính sách hiện hành trước khi gửi.");
    setBusy(true); setError("");
    try {
      const res = await dispatch("REQUEST_RENEWAL", { contract_id: id, months, policy_consent: { version: String(version), acceptedAt: new Date().toISOString(), channel: "WEB" } });
      if (!res.ok) { setError(res.error); return; }
      go(`sent?type=renew&contract=${encodeURIComponent(id)}`);
    } catch { setError("Chưa gửi được yêu cầu. Vui lòng kiểm tra kết nối và thử lại."); }
    finally { setBusy(false); }
  };
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id} / Gia hạn</p>
    <PageHeader title={`Gia hạn kho ${c.unit_number}`} description="Gửi yêu cầu trước ngày hết hạn. Cơ sở duyệt và chốt giá, sau đó bạn thanh toán để kéo dài hợp đồng."><Tag tone="blue">Hết hạn {dateLabel(c.end_date)}</Tag></PageHeader>
    <div className="customer-detail__grid">
      <form className="panel customer-detail__card" onSubmit={submit}>
        <h2>Kỳ gia hạn</h2>
        <DetailList items={[["Hợp đồng", `${id} · ${c.unit_number}`], ["Thời hạn hiện tại", `Đến ${dateLabel(c.end_date)}`]]} />
        <fieldset className="customer-detail__choices" disabled={busy || blocked}>
          <legend>Chọn số tháng *</legend>
          {RENTAL_PLANS.map(m => <label className="customer-detail__choice" key={m}><input type="radio" name="renewal-months" value={m} checked={months === m} onChange={() => { setMonths(m); setError(""); }} /><span>{m} tháng{months === m ? ` · ${dateLabel(c.end_date)} – ${dateLabel(addMonths(c.end_date, m))}` : ""}</span></label>)}
        </fieldset>
        {policy.demo && <Notice>Chế độ mô phỏng FE: bằng chứng đồng ý chỉ lưu trong trình duyệt.</Notice>}
        <label className="customer-detail__choice"><input type="checkbox" checked={accepted} disabled={!policyReady || busy || blocked} onChange={e => setAcceptedVersion(e.target.checked ? String(version) : null)} /><span>Tôi đã đọc và đồng ý <a href="#/policies" target="_blank" rel="noreferrer">chính sách hiện hành</a>{policyReady ? ` (${policy.data.displayVersion || version})` : ""} cho kỳ gia hạn.</span></label>
        {!policyReady && <Notice>{policy.loading ? "Đang tải chính sách…" : "Chưa tải được phiên bản chính sách hợp lệ. Vui lòng tải lại trước khi gửi gia hạn."}</Notice>}
        {policy.error && <Button variant="outline" onClick={policy.reload}>Tải lại chính sách</Button>}
        {blocked && <Notice>Không thể gửi thêm yêu cầu: hợp đồng đã hết hạn hoặc đang có yêu cầu gia hạn/trả kho chờ xử lý.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <div className="customer-detail__actions"><LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton><Button type="submit" disabled={busy || blocked || !accepted}>{busy ? "Đang gửi…" : "Gửi yêu cầu gia hạn"}</Button></div>
      </form>
      <aside className="panel customer-detail__card customer-detail__sidebar">
        <h2>Chi phí dự kiến</h2>
        <DetailList items={[["Giá hiện tại", `${money(c.monthly_rate)} / tháng`], ["Số tháng", months], ["Tạm tính", money(months * c.monthly_rate)]]} />
        <p className="hint">Giá chốt khi quản lý duyệt. Thanh toán trong 24 giờ sau khi duyệt và trước {dateLabel(c.end_date)}; hợp đồng chỉ kéo dài khi đã thanh toán đủ. Tiền cọc chuyển sang kỳ mới, không thu thêm.</p>
        <p className="visually-hidden" aria-live="polite">Ngày kết thúc mới dự kiến {dateLabel(newEnd)}</p>
      </aside>
    </div>
  </main>;
}
