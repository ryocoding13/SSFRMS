import React, { useState } from "react";
import { Button, Field, LinkButton, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { POLICY_SECTIONS, defaultRentalPolicy } from "../../facility-operations/workflows/workflowModel.js";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { useWorkflowChange, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function RentalPolicyEditorPage() {
  const load = useWorkflowData("policy"), [draft, setDraft] = useState(null), [preview, setPreview] = useState(false), [error, setError] = useState("");
  const policy = draft || load.data || defaultRentalPolicy(), [dialog, ask] = useWorkflowChange(load);
  const update = (id, value) => setDraft({ ...policy, sections: { ...policy.sections, [id]: value } });
  const save = e => { e.preventDefault(); if (!(Number(policy.rate) > 0 && Number(policy.rate) <= 100) || POLICY_SECTIONS.some(([id]) => !policy.sections[id]?.trim())) return setError("Điền đủ nội dung và nhập tỷ lệ khấu trừ lớn hơn 0, tối đa 100%."); setError(""); ask("SAVE_RENTAL_POLICY", policy, "Lưu chính sách hiển thị cho khách?", "Chỉ bản đã lưu được hiển thị cho khách. Không thay đổi ngược các giao dịch đã được backend ghi nhận."); };
  return <main className="container page workflow-page"><PageHeader title="Chỉnh sửa chính sách cho thuê" description="Cập nhật nội dung khách hàng được đọc; kiểm tra bản xem trước trước khi lưu." /><WorkflowState load={load}>
    <form onSubmit={save}><section className="panel form-card"><h2>Chính sách SafeSpace · Toàn hệ thống</h2><Notice>{draft ? "Đang chỉnh sửa · Chưa lưu thay đổi" : "Bản nội dung đang hiển thị"}</Notice><div className="workflow-tiles"><Field label="Mức trừ mỗi ngày (%)"><input type="number" min="0.01" max="100" step="0.01" value={policy.rate} onChange={e => setDraft({ ...policy, rate: e.target.value })} /></Field><Field label="Giới hạn khấu trừ"><input readOnly value="100% cọc ban đầu" /></Field><Field label="Mốc cọc còn 0 đ"><input readOnly value={Number(policy.rate) > 0 ? `${Math.ceil(100 / policy.rate)} ngày` : "—"} /></Field></div></section>
      {POLICY_SECTIONS.map(([id, title]) => <section className="panel form-card" key={id}><h2>{title}</h2><Field label="Nội dung hiển thị cho khách"><textarea rows={4} maxLength={3000} value={policy.sections[id]} onChange={e => update(id, e.target.value)} /></Field></section>)}
      {error && <Notice tone="error">{error}</Notice>}<div className="stack"><Button variant="outline" onClick={() => setPreview(true)}>Xem trước bản khách đọc</Button><Button type="submit" disabled={load.busy}>Kiểm tra & lưu thay đổi</Button><LinkButton to="business/policies" variant="outline">Về cấu hình chính sách</LinkButton></div>
    </form></WorkflowState>{preview && <Modal title="Xem trước · Chưa lưu" size="md" onClose={() => setPreview(false)}>{POLICY_SECTIONS.map(([id, title]) => <section key={id}><h3>{title}</h3><p>{policy.sections[id]}</p></section>)}<Button onClick={() => setPreview(false)}>Quay lại chỉnh sửa</Button></Modal>}{dialog}</main>;
}
