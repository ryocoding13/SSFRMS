/**
 * POLICY SETTINGS PAGE - TRANG CẤU HÌNH CÁC CHÍNH SÁCH THUÊ VÀ HOÀN TIỀN (B02)
 *
 * Quản lý các loại chính sách:
 * - DEPOSIT: Tỷ lệ tiền cọc (D09/D16).
 * - CANCELLATION: Phí hủy đơn đặt chỗ trước khi nhận kho (D21/D40: 5% cọc).
 * - OVERDUE: Phí quá hạn và thời hạn thanh toán nợ.
 * - RELET_BUFFER: Số ngày đệm cho thuê lại giữa 2 kỳ khách (D41).
 */
import React, { useState } from 'react';
import { businessApi } from "../api/businessApi.js";
import { Button, Field, LinkButton, Tag } from "../../../shared/components/UI.jsx";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { today } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { createPolicy, replacePolicy } from "./policyActions.js";
import { LoadState, useConfirm } from "../components/BusinessComponents.jsx";
import { useChangeFlow } from "../../../shared/components/ChangeFlowDialog.jsx";
import {
  ENGINE_SECTIONS,
  SYSTEM_ENFORCED_POLICIES,
  GUIDELINE_SECTIONS,
  fieldPolicy,
  fieldRawValue,
  validatePolicyNumber,
  policyJobs,
  policyFields,
} from "./policyFields.js";

/**
 * Màn hình danh sách và cấu hình các thông số chính sách nghiệp vụ hệ thống.
 */
export default function PolicySettingsPage() {
  const { notify, onApiError } = useApp();
  const load = useLoad(() => businessApi.policies({}), [], onApiError);
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [confirmEl, ask] = useConfirm();
  const [flowEl, runChange] = useChangeFlow();

  const handleChange = (key, value) => {
    setDrafts(prev => ({ ...prev, [key]: value }));
    const err = validatePolicyNumber(key, value);
    setErrors(prev => ({ ...prev, [key]: err }));
  };

  const save = async policies => {
    // Validate every edited field before proceeding
    const newErrors = {};
    for (const key of Object.keys(drafts)) {
      const err = validatePolicyNumber(key, drafts[key]);
      if (err) newErrors[key] = err;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return notify('Vui lòng kiểm tra lại các trường có lỗi trước khi lưu.', 'error');
    }

    let jobs;
    try {
      jobs = policyJobs(policies, drafts, today());
    } catch (e) {
      return notify(e.message, 'error');
    }
    if (!jobs.length) return notify('Chưa có thay đổi nào.');

    // Build human-friendly summary of changes (old -> new with units)
    const summaryLines = jobs.flatMap(j => j.keys).map(key => {
      const f = policyFields.find(field => field.key === key);
      const p = fieldPolicy(policies, f, today());
      const oldVal = p?.value != null ? `${p.value} ${f.suffix || ''}`.trim() : 'Chưa thiết lập';
      const cleanVal = String(drafts[key] ?? '').trim().replace(',', '.');
      const newVal = `${cleanVal} ${f.suffix || ''}`.trim();
      return `${f.label}: ${oldVal} → ${newVal}`;
    });

    setBusy(true);
    try {
      const out = await runChange({
        action: 'Lưu thay đổi chính sách',
        scope: 'Toàn hệ thống',
        content: summaryLines.join('\n'),
        perform: async isCurrent => {
          for (const { keys, p, body } of jobs) {
            if (!isCurrent()) return false;
            const applied = p ? await replacePolicy(p, body, ask) : (await createPolicy(body, true, ask)).active;
            if (!applied) {
              notify('Đã giữ bản nháp; các ô chưa áp dụng vẫn được giữ lại.');
              return false;
            }
            setDrafts(d => {
              const next = { ...d };
              for (const key of keys) delete next[key];
              return next;
            });
            setErrors(e => {
              const next = { ...e };
              for (const key of keys) delete next[key];
              return next;
            });
          }
          return true;
        },
      });
      if (out.error) onApiError(out.error);
    } finally {
      setBusy(false);
      load.reload();
    }
  };

  return <main className="container page business-policies">
    <header className="page-header page-header--tight">
      <div>
        <h1>Chính sách cho thuê</h1>
        <p>Phạm vi: Toàn hệ thống</p>
      </div>
    </header>
    <div className="workflow-links">
      <LinkButton to="business/policy-content">Chính sách chi tiết khách đọc</LinkButton>
      <LinkButton to="business/policy-status" variant="outline">Trạng thái chính sách</LinkButton>
    </div>

    <LoadState load={load}>{policies => {
      // Determine if there are actual modified fields
      const changedKeys = Object.keys(drafts).filter(key => {
        const f = policyFields.find(field => field.key === key);
        if (!f || f.readOnly) return false;
        const p = fieldPolicy(policies, f, today());
        const currentRaw = fieldRawValue(p, f);
        return String(drafts[key]).trim() !== currentRaw.trim();
      });
      const hasChanges = changedKeys.length > 0;
      const hasErrors = Object.values(errors).some(Boolean);
      const canSave = hasChanges && !hasErrors && !busy;

      return <>
        {/* Nhóm 1: Tham số cấu hình vận hành tự động */}
        {ENGINE_SECTIONS.map(section => (
          <section className="panel biz-section" key={section.title}>
            <div className="biz-section__head">
              <div>
                <h2>{section.title}</h2>
                <p className="field__hint" style={{ marginTop: 4 }}>{section.description}</p>
              </div>
              <Tag tone={section.tone}>{section.badge}</Tag>
            </div>
            <div className="biz-policies">
              {section.fields.map(field => {
                const p = fieldPolicy(policies, field, today());
                const isReadOnly = field.readOnly;
                const errorMsg = errors[field.key];
                return (
                  <Field key={field.key} label={field.label} hint={!errorMsg ? field.hint : undefined} error={errorMsg}>
                    {isReadOnly ? (
                      <input
                        disabled
                        readOnly
                        value={fieldRawValue(p, field)}
                        style={{ backgroundColor: 'var(--soft, #f8fafc)', color: 'var(--muted, #64748b)', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          inputMode={field.key === 'overdue' ? 'decimal' : 'numeric'}
                          disabled={busy}
                          value={drafts[field.key] ?? fieldRawValue(p, field)}
                          placeholder={field.placeholder || ''}
                          onChange={e => handleChange(field.key, e.target.value)}
                          style={{ flex: 1 }}
                        />
                        {field.suffix && (
                          <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--muted, #64748b)', whiteSpace: 'nowrap' }}>
                            {field.suffix}
                          </span>
                        )}
                      </div>
                    )}
                  </Field>
                );
              })}
            </div>
          </section>
        ))}

        <div className="ops-actions" style={{ marginTop: -4 }}>
          <Button disabled={!canSave} onClick={() => save(policies)}>Lưu thay đổi chính sách</Button>
        </div>

        {/* Nhóm 2: Quy định cố định theo hệ thống */}
        <section className="panel biz-section">
          <div className="biz-section__head">
            <div>
              <h2>Quy định cố định theo hệ thống</h2>
              <p className="field__hint" style={{ marginTop: 4 }}>
                Các mốc thời gian và hạn mức tự động áp dụng trên toàn hệ thống.
              </p>
            </div>
            <Tag tone="blue">Quy định cố định · Chỉ đọc</Tag>
          </div>
          <div className="biz-policies" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {SYSTEM_ENFORCED_POLICIES.map(item => (
              <div key={item.key} className="panel" style={{ background: 'var(--soft, #f8fafc)', padding: '14px 16px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{item.label}</strong>
                  <Tag tone="gray" square>{item.value}</Tag>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted, #64748b)', lineHeight: 1.4 }}>{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Nhóm 3: Hướng dẫn nghiệp vụ */}
        <section className="panel biz-section">
          <div className="biz-section__head">
            <div>
              <h2>{GUIDELINE_SECTIONS[0].title}</h2>
              <p className="field__hint" style={{ marginTop: 4 }}>{GUIDELINE_SECTIONS[0].notice}</p>
            </div>
            <Tag tone="gray">Hướng dẫn · Chỉ đọc</Tag>
          </div>
          <div className="biz-policies" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
            {GUIDELINE_SECTIONS[0].fields.map(item => (
              <div key={item.key} className="panel" style={{ background: 'var(--soft, #f8fafc)', padding: '14px 16px', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{item.label}</strong>
                  <Tag tone="gray" square>{item.value}</Tag>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted, #64748b)', lineHeight: 1.4 }}>{item.hint}</p>
              </div>
            ))}
          </div>
        </section>
      </>;
    }}</LoadState>
    {confirmEl}
    {flowEl}
  </main>;
}
