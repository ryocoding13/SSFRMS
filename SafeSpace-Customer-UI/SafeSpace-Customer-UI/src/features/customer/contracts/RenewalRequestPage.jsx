import React, { useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { RENTAL_PLANS } from "../../../shared/utils/catalog.js";
import { addMonths, dateLabel, money } from "../../../shared/utils/format.js";
import { go } from "../../../app/router.js";
import { contractOf } from "../../../app/state/appSelectors.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { NotFound } from "./components/ContractNotFound.jsx";

export function RenewalRequestPage({ id }) {
  const { data, dispatch } = useApp();
  const c = contractOf(data, id);
  const [months, setMonths] = useState(3);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!c) return <NotFound />;
  const newEnd = addMonths(c.end_date, months);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await dispatch("REQUEST_RENEWAL", { contract_id: id, months });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    go(`sent?type=renew&contract=${encodeURIComponent(id)}`);
  };
  return (
    <main className="container page">
      <PageHeader title={`Gia hạn kho ${c.unit_number}`} description="Giữ không gian hiện tại sau khi cơ sở kiểm tra kỳ thuê tiếp theo." />
      <form className="panel form-card" onSubmit={submit}>
        <Field label="Thời hạn hiện tại">
          <input readOnly value={`Đến ${dateLabel(c.end_date)}`} />
        </Field>
        <Field label="Kỳ gia hạn đề xuất">
          <Select value={months} onChange={(e) => { setMonths(Number(e.target.value)); setError(""); }}>
            {RENTAL_PLANS.map((m) => (
              <option key={m} value={m}>{`${dateLabel(c.end_date)}–${dateLabel(addMonths(c.end_date, m))} · ${m} tháng`}</option>
            ))}
          </Select>
        </Field>
        <h3>Chi phí dự kiến</h3>
        <p className="muted">
          {months} × {money(c.monthly_rate)} = {money(months * c.monthly_rate)}. Chỉ trả tiền thuê kỳ mới qua mã QR sau khi yêu cầu được duyệt. Tiền cọc đang giữ được chuyển sang kỳ mới, không thu thêm.
        </p>
        <p className="visually-hidden" aria-live="polite">Ngày kết thúc mới dự kiến {dateLabel(newEnd)}</p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="stack">
          <Button type="submit" disabled={busy}>{busy ? "Đang gửi…" : "Gửi yêu cầu gia hạn"}</Button>
          <LinkButton to={`units/${id}`} variant="outline">Quay lại hợp đồng</LinkButton>
        </div>
      </form>
    </main>
  );
}
