import React, { useState } from 'react';
import { businessApi } from "../api/businessApi.js";
import { Button, Field, LinkButton, Notice, Tag } from "../../../shared/components/UI.jsx";
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
  fieldValue,
  policyJobs,
  legacyPolicies,
} from "./policyFields.js";

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
        action: 'Lưu chính sách cho thuê',
        scope: 'Toàn hệ thống',
        content: `${jobs.length} giá trị chính sách trên biểu mẫu`,
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
        <h1>Chính sách cho thuê chung</h1>
        <p>Phân định rõ tham số vận hành tự động, quy định cố định hệ thống và nội dung hướng dẫn khách hàng.</p>
      </div>
    </header>
    <div className="workflow-links">
      <LinkButton to="business/policy-content">Chính sách chi tiết khách đọc</LinkButton>
      <LinkButton to="business/policy-status" variant="outline">Trạng thái chính sách</LinkButton>
    </div>

    <LoadState load={load}>{policies => {
      const legacyList = legacyPolicies(policies);
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
                return (
                  <Field key={field.key} label={field.label} hint={field.hint}>
                    <input
                      disabled={busy}
                      value={drafts[field.key] ?? fieldValue(p, field)}
                      placeholder="Chưa thiết lập"
                      onChange={e => setDrafts({ ...drafts, [field.key]: e.target.value })}
                    />
                  </Field>
                );
              })}
            </div>
          </section>
        ))}

        {/* Nhóm 2: Quy định cố định theo hệ thống (Chỉ đọc) */}
        <section className="panel biz-section">
          <div className="biz-section__head">
            <div>
              <h2>Quy định cố định theo hệ thống</h2>
              <p className="field__hint" style={{ marginTop: 4 }}>
                Các mốc thời gian và hạn mức được thực thi cố định bởi backend services và background worker theo quyết định thiết kế (D02, D11, D27, D32, D45).
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
                <small style={{ fontSize: 11, color: 'var(--text-subtle, #94a3b8)' }}>Căn cứ: {item.reference}</small>
              </div>
            ))}
          </div>
        </section>

        {/* Nhóm 3: Nội dung hướng dẫn nghiệp vụ (Guidance Only) */}
        {GUIDELINE_SECTIONS.map(section => (
          <section className="panel biz-section" key={section.title}>
            <div className="biz-section__head">
              <div>
                <h2>{section.title}</h2>
                <p className="field__hint" style={{ marginTop: 4 }}>{section.notice}</p>
              </div>
              <Tag tone={section.tone}>{section.badge}</Tag>
            </div>
            <Notice tone="info">
              <strong>Lưu ý:</strong> Thay đổi tại đây chỉ cập nhật nội dung hướng dẫn hiển thị cho người dùng, không làm thay đổi logic xử lý tự động của máy chủ.
            </Notice>
            <div className="biz-policies">
              {section.fields.map(field => {
                const p = fieldPolicy(policies, field, today());
                return (
                  <Field key={field.key} label={field.label} hint={field.hint}>
                    <input
                      disabled={busy}
                      value={drafts[field.key] ?? fieldValue(p, field)}
                      placeholder="Chưa thiết lập"
                      onChange={e => setDrafts({ ...drafts, [field.key]: e.target.value })}
                    />
                  </Field>
                );
              })}
            </div>
          </section>
        ))}

        {/* Nhóm 4: Bản ghi legacy trong DB nếu có */}
        {legacyList.length > 0 && (
          <section className="panel biz-section" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="biz-section__head">
              <div>
                <h2>Bản ghi cấu hình cũ trong cơ sở dữ liệu (Legacy)</h2>
                <p className="field__hint" style={{ marginTop: 4 }}>
                  Hệ thống bảo toàn bản ghi và lịch sử kiểm toán trong cơ sở dữ liệu nhưng không ánh xạ vào công thức tự động.
                </p>
              </div>
              <Tag tone="warn">[LEGACY / CHƯA ÁP DỤNG]</Tag>
            </div>
            <Notice tone="warn">
              {legacyList.map(lp => (
                <div key={lp.policyId} style={{ display: 'grid', gap: 4 }}>
                  <strong>{lp.policyName} (Mã: #{lp.policyId} · {lp.policyType} = {lp.value} giờ)</strong>
                  <p style={{ margin: 0 }}>
                    {lp.ruleDescription || 'Bản ghi giữ chỗ đặt trước 24 giờ ban đầu (từ trước khi chuyển sang thanh toán QR 15 phút theo D02).'}
                  </p>
                  <small style={{ color: 'var(--muted, #64748b)' }}>
                    Trạng thái: {lp.status} · Hiệu lực từ {lp.effectiveFrom}. Bản ghi này không được dùng để tính ngày thông báo hết hạn hoặc xử lý gia hạn.
                  </small>
                </div>
              ))}
            </Notice>
          </section>
        )}

        <div className="ops-actions">
          <Button disabled={busy} onClick={() => save(policies)}>Lưu thay đổi chính sách</Button>
        </div>
      </>;
    }}</LoadState>
    {confirmEl}
    {flowEl}
  </main>;
}
