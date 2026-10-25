import React, { useState } from "react";
import { Button, Field, LinkButton, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

export function InquiryListPage() {
  const { data, user } = useApp(), load = useWorkflowData("inquiries"), [form, setForm] = useState({ facilityId: "", title: "Tư vấn đặt kho", description: "" }), [error, setError] = useState("");
  const [dialog, ask] = useWorkflowChange(load), rows = (load.data || []).filter(t => String(t.ownerId) === String(user?.user_id));
  return <main className="container page workflow-page"><PageHeader title="Hỗ trợ khi chưa thuê kho" description="Chọn cơ sở bạn muốn tìm hiểu trước khi đặt chỗ." /><WorkflowState load={load}><form className="panel form-card" onSubmit={e => { e.preventDefault(); if (!form.facilityId || !form.title.trim() || !form.description.trim()) return setError("Chọn cơ sở và điền đầy đủ nội dung yêu cầu."); setError(""); ask("CREATE_INQUIRY", { ...form, facilityId: Number(form.facilityId) }, "Gửi yêu cầu hỗ trợ?", "Yêu cầu sẽ được gửi đến cơ sở bạn đã chọn."); }}>
    <InfoTilesPlaceholder />
    <div className="form-row"><Field label="Cơ sở cần hỗ trợ *"><select value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })}><option value="">Chọn cơ sở</option>{data.facilities.map(f => <option key={f.facility_id} value={f.facility_id}>{f.name}</option>)}</select></Field><Field label="Chủ đề *"><input value={form.title} maxLength={100} onChange={e => setForm({ ...form, title: e.target.value })} /></Field></div>
    <Field label="Mô tả yêu cầu *"><textarea rows={3} maxLength={1000} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><Notice>Nhân viên đúng cơ sở tiếp nhận và trả lời; bạn theo dõi phản hồi trong tài khoản.</Notice>{error && <Notice tone="error">{error}</Notice>}<Button type="submit" disabled={load.busy}>Gửi yêu cầu hỗ trợ</Button></form>
    {rows.map(t => <RecordCard key={t.id} title={t.title} subtitle={t.id} status={t.status === "CLOSED" ? "Đã đóng" : "Đang xử lý"} actions={<LinkButton to={`inquiries/${encodeURIComponent(t.id)}`}>Xem yêu cầu</LinkButton>}><p>{t.description}</p></RecordCard>)}{!rows.length && !load.error && <WorkflowEmpty text="Chưa có yêu cầu tư vấn của bạn." />}
  </WorkflowState>{dialog}</main>;
}
function InfoTilesPlaceholder() { return <p className="muted">Kho / hợp đồng liên quan: Chưa có hợp đồng</p>; }
