/**
 * RENEWAL UNIT CHANGE PAGE - CHỌN Ô KHO MỚI KHI GIA HẠN (D46 / D46b)
 *
 * Áp dụng khi:
 * - Ô kho hiện tại đã có khách khác đặt trước từ ngày hết hạn (D41).
 * - Khách hàng chủ động muốn đổi sang ô kho khác hoặc nâng cấp cỡ kho khi tiếp tục thuê.
 * - Tự động tính khoản tiền cọc chênh lệch (depositTopUp) cần thanh toán thêm.
 */
import React, { useRef, useState } from "react";
import { Button, DetailList, Empty, LinkButton, Notice, PageHeader, Tag } from "../../../shared/components/UI.jsx";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { RENTAL_PLANS } from "../../../shared/utils/catalog.js";
import { addMonths, dateLabel, money, today } from "../../../shared/utils/format.js";
import { go } from "../../../app/router.js";
import { contractOf, pendingRenewal, pendingReturn } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { NotFound } from "./components/ContractNotFound.jsx";
import { renewalEstimate, renewalUnitChoices } from "./renewalUnitModel.js";
import { useRenewalUnitOptions } from "./useRenewalUnitMove.js";
import "../../../shared/styles/customer-detail.css";

// D46 / D46b · Figma C08-D41a (gia hạn sang ô khác) và C08-D41b (gia hạn sau nâng cấp miễn phí).
// Khách chọn ô trống cụ thể; ô được giữ khi quản lý duyệt; khoản thanh toán gộp tiền gia hạn + cọc chênh.
function choiceText(x, c) {
  if (x.kind === "KEEP") return `Giữ ô ${x.unitNumber} · giá của ô này theo bảng giá, chốt khi duyệt · không phải chuyển đồ`;
  const deposit = x.depositTopUp > 0 ? `cọc thêm ${money(x.depositTopUp)}` : "không thu thêm cọc";
  const type = x.kind === "ORIGINAL_TYPE" ? " · về loại đã đặt ban đầu" : "";
  return `Ô ${x.unitNumber}${x.typeName ? ` · ${x.typeName}` : ""}${type} · ${money(x.monthlyRate)}/tháng · ${deposit}`;
}

/**
 * Màn hình lựa chọn ô kho mới thay thế khi gia hạn hợp đồng thuê.
 * @param {{ contract: Object }} props
 */
export function RenewalUnitChangePage({ id }) {
  const { data, retry } = useApp();
  const c = contractOf(data, id);
  const policy = useWorkflowData("policy");
  const load = useRenewalUnitOptions(c?.api_id);
  const [pick, setPick] = useState(""), [months, setMonths] = useState(1), [acceptedVersion, setAcceptedVersion] = useState(null);
  const [error, setError] = useState(""), [confirm, setConfirm] = useState(false), [result, setResult] = useState(null), [busy, setBusy] = useState(false);
  const guard = useRef(false);
  if (!c) return <NotFound />;
  const opts = load.data;
  const choices = renewalUnitChoices(opts);
  const choice = choices.find(x => x.key === pick) || null;
  const est = renewalEstimate(choice, months, c.monthly_rate);
  const version = policy.data?.version;
  const policyReady = !policy.loading && !policy.error && version != null && Number(version) > 0;
  const accepted = policyReady && acceptedVersion === String(version);
  const blocked = c.end_date <= today() || Boolean(pendingRenewal(data, id) || pendingReturn(data, id));
  const upgraded = Boolean(opts?.upgraded);
  const submit = e => {
    e.preventDefault();
    if (!choice) return setError("Chọn ô cho kỳ gia hạn.");
    if (!accepted) return setError("Vui lòng đọc và đồng ý chính sách hiện hành trước khi gửi.");
    setError(""); setConfirm(true);
  };
  const send = async () => {
    if (guard.current) return;
    guard.current = true; setBusy(true);
    try {
      await load.send(months, { version: String(version) }, choice.kind === "KEEP" ? null : choice.unitId);
      setConfirm(false); retry?.(); go(`units/${encodeURIComponent(id)}/renewal-status`);
    } catch (err) {
      const taken = /vừa có người đặt|không còn trống/i.test(err?.message || "");
      setConfirm(false); setResult({ ok: false, taken, message: err?.message || "Chưa gửi được yêu cầu. Vui lòng thử lại." });
      if (taken) { setPick(""); load.reload(); }
    } finally { guard.current = false; setBusy(false); }
  };
  const title = upgraded ? `Gia hạn sau nâng cấp miễn phí · Kho ${c.unit_number}` : `Gia hạn sang ô khác · Kho ${c.unit_number}`;
  return <main className="container page customer-records customer-detail">
    <p className="customer-records__breadcrumb">SafeSpace / Khách hàng / Kho của tôi / {id} / Gia hạn</p>
    <PageHeader title={title} description={upgraded ? "Bạn đang dùng ô lớn hơn được nâng cấp miễn phí. Chọn giữ ô này với giá của ô lớn, hoặc chuyển về loại đã đặt ban đầu." : "Ô hiện tại đã có khách đặt cho kỳ sau. Chọn một ô trống cùng loại để gia hạn; ô được giữ và mở thanh toán ngay khi bạn xác nhận."}>
      <Tag tone="blue">Hết hạn {dateLabel(c.end_date)}</Tag></PageHeader>
    {load.demo ? <Notice>Chế độ mô phỏng chưa có danh sách ô trống thật. Vui lòng dùng chế độ kết nối máy chủ.</Notice>
      : load.loading ? <Notice>Đang tải ô trống…</Notice>
      : load.error ? <><Notice tone="error">{load.error}</Notice><Button variant="outline" onClick={load.reload}>Tải lại</Button></>
      : choices.length === 0 ? <Empty title="Hiện không còn ô trống phù hợp" text="Liên hệ cơ sở để được hỗ trợ, hoặc gửi trả kho trước ngày hết hạn."><LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Về hợp đồng</LinkButton></Empty>
      : <div className="customer-detail__grid">
        <form className="panel customer-detail__card" onSubmit={submit} noValidate>
          <h2>Chọn ô cho kỳ mới</h2>
          {opts?.bookedFrom && <Notice>Ô {c.unit_number} đã có khách đặt từ {dateLabel(opts.bookedFrom)}, không gia hạn được ô này.</Notice>}
          <fieldset className="choice-list" disabled={busy || blocked}>
            {choices.map(x => <label key={x.key} className="choice-list__item"><input type="radio" name="renewal-unit" checked={pick === x.key} onChange={() => { setPick(x.key); setError(""); }} /><span>{choiceText(x, c)}</span></label>)}
          </fieldset>
          <fieldset className="customer-detail__choices" disabled={busy || blocked}>
            <legend>Chọn số tháng *</legend>
            {RENTAL_PLANS.map(m => <label className="customer-detail__choice" key={m}><input type="radio" name="renewal-unit-months" checked={months === m} onChange={() => setMonths(m)} /><span>{m} tháng{months === m ? ` · ${dateLabel(c.end_date)} – ${dateLabel(addMonths(c.end_date, m))}` : ""}</span></label>)}
          </fieldset>
          <label className="customer-detail__choice"><input type="checkbox" checked={accepted} disabled={!policyReady || busy || blocked} onChange={e => setAcceptedVersion(e.target.checked ? String(version) : null)} /><span>Tôi đã đọc và đồng ý <a href="#/policies" target="_blank" rel="noreferrer">chính sách thuê kho hiện hành</a></span></label>
          {!policyReady && <Notice>{policy.loading ? "Đang tải chính sách…" : "Chưa tải được phiên bản chính sách hợp lệ. Vui lòng tải lại trước khi gửi."}</Notice>}
          {blocked && <Notice>Không thể gửi: hợp đồng đã hết hạn hoặc đang có yêu cầu gia hạn / trả kho chờ xử lý.</Notice>}
          {error && <Notice tone="error">{error}</Notice>}
          <div className="customer-detail__actions"><LinkButton to={`units/${encodeURIComponent(id)}`} variant="outline">Quay lại hợp đồng</LinkButton><Button type="submit" disabled={busy || blocked || !accepted}>Gửi yêu cầu gia hạn</Button></div>
        </form>
        <aside className="panel customer-detail__card customer-detail__sidebar">
          <h2>Chi phí dự kiến</h2>
          <DetailList items={[["Ô kỳ mới", choice ? (choice.kind === "KEEP" ? `${choice.unitNumber} (giữ nguyên)` : choice.unitNumber) : "Chưa chọn"], ["Giá / tháng", choice?.kind === "KEEP" ? "Theo bảng giá ô hiện tại" : money(est.rate)], ["Số tháng", months], ["Tiền gia hạn", choice?.kind === "KEEP" ? "Chốt khi xác nhận" : money(est.rent)], ["Cọc chênh", money(est.topUp)]]} />
          <div className="summary-total"><span>Tổng cần thanh toán</span><strong>{choice?.kind === "KEEP" ? "Chốt khi xác nhận" : money(est.total)}</strong></div>
          <p className="hint">Hệ thống tự động xác nhận gia hạn hợp lệ và mở thanh toán một lần (tiền gia hạn + cọc chênh) trong 24 giờ. Đổi sang ô khác: bạn tự chuyển đồ trong 3 ngày cuối kỳ cũ, mã QR/PIN hiện tại mở được cả ô mới trong thời gian chuyển; hết kỳ cũ mã ô cũ bị khoá, đồ còn lại coi là đồ bạn bỏ. Cọc ô mới thấp hơn thì phần chênh hoàn khi kết thúc hợp đồng.</p>
        </aside>
      </div>}
    {confirm && choice && <ConfirmDialog title={choice.kind === "KEEP" ? `Xác nhận gia hạn ${c.unit_number}?` : `Xác nhận gia hạn sang ô ${choice.unitNumber}?`} busy={busy} onCancel={() => setConfirm(false)} onConfirm={send} label="Xác nhận & thanh toán"
      text={choice.kind === "KEEP" ? "Gia hạn được xác nhận ngay theo bảng giá ô hiện tại để bạn thanh toán trong 24 giờ." : "Ô mới được giữ ngay cho bạn khi xác nhận gia hạn. Sau khi thanh toán, bạn tự chuyển đồ trong 3 ngày cuối kỳ cũ."}
      rows={[["Ô kỳ mới", choice.kind === "KEEP" ? c.unit_number : choice.unitNumber], ["Kỳ gia hạn", `${months} tháng · đến ${dateLabel(addMonths(c.end_date, months))}`], ...(choice.kind === "KEEP" ? [] : [["Tổng thanh toán", money(est.total)]])]} />}
    {result?.ok && <ConfirmDialog title={choice?.kind === "KEEP" || !choice ? "Đã gửi yêu cầu gia hạn" : `Đã gửi yêu cầu gia hạn sang ô ${choice.unitNumber}`} tone="success" cancelLabel={null} hint="" label="Về hợp đồng"
      text="Cơ sở duyệt và chốt giá; bạn thanh toán trong 24 giờ sau khi được duyệt." onCancel={() => go(`units/${encodeURIComponent(id)}`)} onConfirm={() => go(`units/${encodeURIComponent(id)}`)} />}
    {result && !result.ok && <ConfirmDialog title={result.taken ? "Ô vừa có người đặt" : "Chưa gửi được yêu cầu"} tone="failure" hint="" label={result.taken ? "Chọn ô khác" : "Thử lại"}
      text={result.taken ? "Ô bạn chọn không còn trống. Danh sách ô đã được tải lại, vui lòng chọn ô khác." : result.message} onCancel={() => setResult(null)} onConfirm={() => { setResult(null); if (!result.taken && choice) setConfirm(true); }} />}
  </main>;
}
