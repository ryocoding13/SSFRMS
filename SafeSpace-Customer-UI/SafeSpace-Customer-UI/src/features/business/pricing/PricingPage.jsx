import React, { useCallback, useState } from "react";
import { businessApi } from "../api/businessApi.js";
import { Button, LinkButton, Tag } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { money, today } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { createPolicy, replacePolicy } from "../policies/policyActions.js";
import { POLICY_STATUS, parseMoney, policyFor, policyValueLabel, replacementOf } from "../utils/businessFormat.js";
import { LoadState, PolicyForm, useConfirm } from "../components/BusinessComponents.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";

// Ba cột chính sách theo loại kho (Figma B03): khung giá, phí dịch vụ / tháng, phí quá hạn / ngày
const COLUMNS = [
  { type: "PRICE_RANGE", calc: "RANGE", unit: "", name: (t) => `Khung giá ${t.typeName}`, rule: "Giá thuê theo tháng của loại kho này tại mọi cơ sở phải nằm trong khung." },
  { type: "EXTRA_FEE", calc: "FIXED", unit: "/ tháng", name: (t) => `Phí dịch vụ ${t.typeName}`, rule: "Phí dịch vụ cộng thêm mỗi tháng thuê." },
  { type: "OVERDUE", calc: "FIXED", unit: "/ ngày", name: (t) => `Phí quá hạn ${t.typeName}`, rule: "Phí cho mỗi ngày quá hạn trả kho hoặc thanh toán." },
];

const cellKey = (unitTypeId, type) => `${unitTypeId}:${type}`;

function cellDraft(policy, col) {
  if (!policy) return col.calc === "RANGE" ? { minValue: "", maxValue: "" } : { value: "" };
  return col.calc === "RANGE" ? { minValue: policy.minValue == null ? "" : money(policy.minValue), maxValue: policy.maxValue == null ? "" : money(policy.maxValue) } : { value: policy.value == null ? "" : money(policy.value) };
}

// B03 · Quản lý giá & phí (UC21): khung giá / phí theo loại kho, giảm giá / miễn phí
export default function PricingPage() {
  const { notify, onApiError } = useApp();
  const load = useLoad(
    async () => {
      const [policies, facilities, unitTypes] = await Promise.all([businessApi.policies({}), businessApi.facilities(), businessApi.unitTypes()]);
      return { policies, facilities, unitTypes: unitTypes.filter((t) => t.status !== "INACTIVE") };
    },
    [],
    onApiError,
  );
  const [edit, setEdit] = useState({}); // Only edited cells are sent to the backend.
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmEl, ask] = useConfirm();
  const [flowEl, runChange] = useChangeFlow();
  const close = useCallback(() => setAdding(false), []);

  const saveTable = async ({ policies, unitTypes }) => {
    const jobs = [];
    for (const t of unitTypes)
      for (const col of COLUMNS) {
        const d = edit[cellKey(t.unitTypeId, col.type)];
        if (!d) continue;
        const current = policyFor(policies, col.type, t.unitTypeId);
        const own = current && current.unitTypeId === t.unitTypeId ? current : null;
        const blank = col.calc === "RANGE" ? !d.minValue && !d.maxValue : !String(d.value).trim();
        if (blank) continue;
        const values =
          col.calc === "RANGE" ? { minValue: parseMoney(d.minValue), maxValue: parseMoney(d.maxValue) } : { value: parseMoney(d.value) };
        if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0)) return notify(`${t.typeName}: giá trị không hợp lệ.`, "error");
        if (col.calc === "RANGE" && values.minValue > values.maxValue) return notify(`${t.typeName}: giá thấp nhất phải nhỏ hơn hoặc bằng giá cao nhất.`, "error");
        const same = own && (col.calc === "RANGE" ? own.minValue === values.minValue && own.maxValue === values.maxValue : Number(own.value) === values.value);
        if (same) continue;
        jobs.push(own
          ? () => replacePolicy(own, replacementOf(own, values, today()), ask)
          : () => createPolicy({ policyName: col.name(t), policyType: col.type, calculationType: col.calc, value: null, minValue: null, maxValue: null, ruleDescription: col.rule, facilityId: null, unitTypeId: t.unitTypeId, effectiveFrom: today(), effectiveTo: null, ...values }, true, ask));
      }
    if (!jobs.length) {
      setEdit({});
      return notify("Chưa có thay đổi nào.");
    }
    // Figma 885:10521–10545: xác nhận → đã lưu / không lưu được
    setBusy(true);
    try {
      const out = await runChange({
        action: "Lưu giá và phí", scope: "Toàn hệ thống", content: `${jobs.length} thay đổi khung giá / phí, áp dụng từ hôm nay`,
        perform: async () => {
          for (const job of jobs) { const result = await job(); if (result === false || result?.active === false) return false; }
          setEdit({});
          return true;
        },
      });
      if (out.error) onApiError(out.error);
      load.reload();
    } finally { setBusy(false); }
  };

  return (
    <main className="container page business-pricing">
      <header className="page-header page-header--tight"><div><h1>Quản lý giá &amp; phí</h1></div></header>
      <div className="workflow-links"><LinkButton to="business/rates">Giá thuê theo cơ sở</LinkButton></div>
      <LoadState load={load}>
        {(data) => {
          const { policies, facilities, unitTypes } = data;
          const discounts = policies.filter((p) => ["DISCOUNT", "FEE_WAIVER"].includes(p.policyType) && ["ACTIVE", "DRAFT"].includes(p.status));
          
          return (
            <>
              <section className="biz-block" aria-labelledby="range-title">
                <div className="biz-section__head">
                  <h2 className="section-title" id="range-title">Khoảng giá theo loại kho</h2>

                </div>
                <div className="panel table-wrap">
                  <table className="table">
                    <thead><tr><th>Loại kho</th><th>Khoảng giá (theo tháng)</th><th>Phí dịch vụ</th><th>Phí quá hạn / ngày</th></tr></thead>
                    <tbody>
                      {unitTypes.length === 0 && <tr><td colSpan={4} className="table__empty">Chưa có loại kho.</td></tr>}
                      {unitTypes.map((t) => (
                        <tr key={t.unitTypeId}>
                          <td className="cell-strong">{t.typeName}</td>
                          {COLUMNS.map((col) => {
                            const p = policyFor(policies, col.type, t.unitTypeId);
                            const key = cellKey(t.unitTypeId, col.type);
                            const d = edit[key] ?? cellDraft(p, col);
                            const put = (patch) => setEdit({ ...edit, [key]: { ...d, ...patch } });
                            return (
                              <td key={col.type} className="business-price-cell">
                                {col.calc === "RANGE" ? (
                                  <div className="biz-range">
                                    <input className="biz-cell-input" disabled={busy} inputMode="numeric" aria-label={`Giá thấp nhất ${t.typeName}`} value={d.minValue} onChange={(e) => put({ minValue: e.target.value })} placeholder="Từ" />
                                    <span>–</span>
                                    <input className="biz-cell-input" disabled={busy} inputMode="numeric" aria-label={`Giá cao nhất ${t.typeName}`} value={d.maxValue} onChange={(e) => put({ maxValue: e.target.value })} placeholder="Đến" />
                                  </div>
                                ) : (
                                  <input className="biz-cell-input" disabled={busy} inputMode="numeric" aria-label={`${col.type === "EXTRA_FEE" ? "Phí dịch vụ" : "Phí quá hạn"} ${t.typeName}`} value={d.value} onChange={(e) => put({ value: e.target.value })} placeholder="Chưa đặt" />
                                )}
                                {col.type === "EXTRA_FEE" && <span className="business-fee-unit"> / tháng</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="biz-block" aria-labelledby="discount-title">
                <h2 className="section-title" id="discount-title">Chính sách giảm giá / miễn phí</h2>
                {discounts.length === 0 && <p className="muted">Chưa có chính sách giảm giá hoặc miễn phí.</p>}
                <ul className="biz-list">
                  {discounts.map((p) => {
                    const [label, tone] = POLICY_STATUS[p.status] || [p.status, "gray"];
                    const scope = [p.facilityName, p.unitTypeName].filter(Boolean).join(" · ");
                    return (
                      <li className="panel biz-list__item" key={p.policyId}>
                        <div>
                          <strong>{p.policyName}</strong>
                          <span className="muted">
                            {p.ruleDescription || policyValueLabel(p)}
                            {scope ? ` · ${scope}` : ""}
                          </span>
                        </div>
                        <div className="biz-list__side">
                          <Tag tone={tone}>{label}</Tag>

                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <div className="ops-actions">
                <Button variant="outline" disabled={busy} onClick={() => setAdding(true)}>Thêm quy tắc giảm giá</Button>
                <Button onClick={() => saveTable(data)} disabled={busy}>Lưu thay đổi</Button>
              </div>

              {adding && (
                <PolicyForm
                  title="Thêm quy tắc giảm giá / miễn phí"
                  types={["DISCOUNT", "FEE_WAIVER"]}
                  facilities={facilities}
                  unitTypes={unitTypes}
                  onClose={close}
                  onSubmit={async (body, activate) => {
                    try {
                      const { active } = await createPolicy(body, activate, ask);
                      notify(activate && active ? `Đã áp dụng “${body.policyName}”.` : `Đã lưu bản nháp “${body.policyName}”.`);
                      load.reload();
                      return true;
                    } catch (e) {
                      onApiError(e);
                      notify(e.message, "error");
                      return false;
                    }
                  }}
                />
              )}
              {confirmEl}
              {flowEl}
            </>
          );
        }}
      </LoadState>
    </main>
  );
}
