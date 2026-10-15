import React, { useState } from 'react';
import { businessApi } from '../api/business';
import { Button, Field } from '../components/UI';
import { useLoad } from '../admin/util';
import { today } from '../lib/format';
import { useApp } from '../state/store';
import { createPolicy, replacePolicy } from './actions';
import { LoadState, useConfirm } from './parts';
import { POLICY_SECTIONS, fieldPolicy, fieldValue, policyJobs } from './policy-fields';

export default function BusinessPolicies() {
  const { notify, onApiError } = useApp();
  const load = useLoad(() => businessApi.policies({}), [], onApiError);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmEl, ask] = useConfirm();
  const save = async policies => {
    let jobs;
    try {
      // Validate every edited field before the first network mutation.
      jobs = policyJobs(policies, drafts, today());
    } catch (e) { return notify(e.message, 'error'); }
    if (!jobs.length) return notify('Chưa có thay đổi nào.');
    setBusy(true);
    try {
      for (const { keys, p, body } of jobs) {
        const applied = p ? await replacePolicy(p, body, ask) : (await createPolicy(body, true, ask)).active;
        if (!applied) { notify('Đã giữ bản nháp; các ô chưa áp dụng vẫn được giữ lại.'); return; }
        setDrafts(d => { const next = { ...d }; for (const key of keys) delete next[key]; return next; });
      }
      notify('Đã lưu thay đổi chính sách.');
    } catch (e) { onApiError(e); notify(e.message, 'error'); }
    finally { setBusy(false); load.reload(); }
  };
  return <main className="container page business-policies">
    <header className="page-header page-header--tight"><div><h1>Chính sách cho thuê chung</h1><p>Áp dụng cho toàn bộ cơ sở trong hệ thống, trừ khi có quy định riêng cho từng cơ sở.</p></div></header>
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
  </main>;
}
