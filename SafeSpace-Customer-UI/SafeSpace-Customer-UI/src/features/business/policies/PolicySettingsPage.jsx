import React, { useState } from 'react';
import { businessApi } from "../api/businessApi.js";
import { Button, Field, LinkButton } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { today } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { createPolicy, replacePolicy } from "./policyActions.js";
import { LoadState, useConfirm } from "../components/BusinessComponents.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import { POLICY_SECTIONS, fieldPolicy, fieldValue, policyJobs } from "./policyFields.js";

export default function PolicySettingsPage() {
  const { notify, onApiError } = useApp();
  const load = useLoad(() => businessApi.policies({}), [], onApiError);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmEl, ask] = useConfirm();
  const [flowEl, runChange] = useChangeFlow();
  const save = async policies => {
    let jobs;
    try {
      // Validate every edited field before the first network mutation.
      jobs = policyJobs(policies, drafts, today());
    } catch (e) { return notify(e.message, 'error'); }
    if (!jobs.length) return notify('Chưa có thay đổi nào.');
    // Figma 885:10487–10511: xác nhận → đã lưu / không lưu được
    setBusy(true);
    try {
      const out = await runChange({
        action: 'Lưu chính sách cho thuê', scope: 'Toàn hệ thống', content: `${jobs.length} giá trị chính sách trên biểu mẫu`,
        perform: async isCurrent => {
          for (const { keys, p, body } of jobs) {
            if(!isCurrent())return false;
            const applied = p ? await replacePolicy(p, body, ask) : (await createPolicy(body, true, ask)).active;
            if (!applied) { notify('Đã giữ bản nháp; các ô chưa áp dụng vẫn được giữ lại.'); return false; }
            setDrafts(d => { const next = { ...d }; for (const key of keys) delete next[key]; return next; });
          }
          return true;
        },
      });
      if (out.error) onApiError(out.error);
    } finally { setBusy(false); load.reload(); }
  };
  return <main className="container page business-policies">
    <header className="page-header page-header--tight"><div><h1>Chính sách cho thuê chung</h1><p>Áp dụng cho toàn bộ cơ sở trong hệ thống, trừ khi có quy định riêng cho từng cơ sở.</p></div></header>
    <div className="workflow-links"><LinkButton to="business/policy-content">Chính sách chi tiết khách đọc</LinkButton><LinkButton to="business/policy-status" variant="outline">Trạng thái chính sách</LinkButton></div>
    <LoadState load={load}>{policies => <>
      {POLICY_SECTIONS.map(section => <section className="panel biz-section" key={section.title}>
        <h2>{section.title}</h2><div className="biz-policies">{section.fields.map(field => {
          const p = fieldPolicy(policies, field, today());
          return <Field key={field.key} label={field.label}><input disabled={busy} value={drafts[field.key] ?? fieldValue(p, field)} placeholder="Chưa thiết lập" onChange={e => setDrafts({ ...drafts, [field.key]: e.target.value })}/></Field>;
        })}</div>
      </section>)}
      <div className="ops-actions"><Button disabled={busy} onClick={() => save(policies)}>Lưu thay đổi chính sách</Button></div>
    </>}</LoadState>
    {confirmEl}
    {flowEl}
  </main>;
}
