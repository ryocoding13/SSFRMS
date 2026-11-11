/**
 * OVERDUE REMOVAL PAGE - NIÊM PHONG VÀ XỬ LÝ KHO QUÁ HẠN (S06 / T12)
 *
 * Quy trình xử lý vi phạm:
 * - Nhân viên cùng đại diện cơ sở tiến hành mở kho quá hạn đã có quyết định xử lý.
 * - Chụp ảnh bằng chứng hiện trạng tài sản (loại ảnh OVERDUE_BEFORE / OVERDUE_AFTER - S06).
 * - Lập biên bản kiểm kê và chuyển hàng hóa vào khu vực lưu giữ tập trung.
 */
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
import { actualVnTime } from "../../facility-operations/settlements/settlementModel.js";
import { vnDateTimeInput } from "../../facility-operations/damage/damageModel.js";
import React, { useState } from "react";
import { Button, Field, LinkButton, PageHeader } from "../../../shared/components/UI.jsx";
import { go } from "../../../app/router.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { useWorkflowData } from "../../facility-operations/workflows/useWorkflowData.js";
import { InfoTiles, RecordCard, useWorkflowChange, WorkflowEmpty, WorkflowState } from "../../facility-operations/workflows/WorkflowComponents.jsx";

/**
 * Màn hình lập biên bản niêm phong và di dời đồ đạc của hợp đồng nợ quá hạn.
 */
export function OverdueRemovalPage() {
  const { user } = useApp(), load = useWorkflowData("overdue"), [selected, setSelected] = useState("");
  const [form, setForm] = useState({ performedAt: "", inventory: "", location: "", unitStatus: "INSPECTION",confirmed:false }), [error, setError] = useState("");
  const [beforePhotos,setBeforePhotos]=useState([]),[afterPhotos,setAfterPhotos]=useState([]),[readingBefore,setReadingBefore]=useState(false),[readingAfter,setReadingAfter]=useState(false);
  const [dialog, ask] = useWorkflowChange(load);
  return <main className="container page workflow-page"><PageHeader title="Công việc xử lý đồ quá hạn" description="Lập biên bản sau khi đã thực hiện, không xác nhận trước." /><WorkflowState load={load}>
    {(load.data || []).map(item => <RecordCard key={item.id} title={`${item.customer} · Kho ${item.unit}`} subtitle={`${item.contractId} · Phụ trách: ${item.assignee || "Chưa phân công"}`} status={item.status === "DONE" ? "Đã lưu biên bản" : "Chờ thực hiện"} actions={<Button onClick={() => {setSelected(selected === item.id ? "" : item.id);setForm({performedAt:"",inventory:"",location:"",unitStatus:"INSPECTION",confirmed:false});setBeforePhotos([]);setAfterPhotos([]);setError("");}}>{item.record ? "Xem biên bản" : "Lập biên bản"}</Button>}>
      {selected === item.id && (item.record ? <InfoTiles items={[["Nhân viên", item.record.staff], ["Tình trạng đồ", item.record.inventory], ["Vị trí", item.record.location], ["Thời gian", item.record.performedAt]]} /> : <form onSubmit={e => { e.preventDefault(); if (!form.inventory.trim() || !form.location.trim() || !form.performedAt) return setError("Điền đầy đủ thời gian, tình trạng đồ và vị trí thực tế."); setError(""); ask("RECORD_REMOVAL", { id: item.id, ...form,beforePhotos,afterPhotos }, `Lưu biên bản xử lý đồ ${item.unit}?`, "Biên bản và ảnh không sửa được sau khi lưu. Kiểm tra danh sách đồ và vị trí thực tế trước khi lưu.", { confirmLabel: "Lưu biên bản", successTitle: "Đã lưu biên bản xử lý đồ", failTitle: "Chưa lưu được biên bản", doneLabel: "Về công việc trong ngày", onDone: () => go("staff") }); }}>
        <Field label="Thời gian thực hiện *"><input type="datetime-local" max={vnDateTimeInput()} value={form.performedAt} onChange={e => setForm({ ...form, performedAt: e.target.value })} /></Field><InfoTiles items={[["Nhân viên thực hiện", user?.full_name]]} />
        <Field label="Danh sách / tình trạng đồ *"><textarea rows={3} value={form.inventory} onChange={e => setForm({ ...form, inventory: e.target.value })} /></Field><Field label="Vị trí đưa đồ ra ngoài *"><textarea rows={2} value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field>
        <ReturnPhotoInput files={beforePhotos} onChange={setBeforePhotos} onReading={setReadingBefore} disabled={load.busy} label="Ảnh trước xử lý"/><ReturnPhotoInput files={afterPhotos} onChange={setAfterPhotos} onReading={setReadingAfter} disabled={load.busy} label="Ảnh sau xử lý"/><label className="customer-detail__choice"><input type="checkbox" checked={form.confirmed} onChange={e=>setForm({...form,confirmed:e.target.checked})}/><span>Tôi xác nhận nội dung phản ánh đúng việc đã thực hiện</span></label><Field label="Trạng thái kho sau kiểm tra"><select value={form.unitStatus} onChange={e => setForm({ ...form, unitStatus: e.target.value })}><option value="INSPECTION">Chờ vệ sinh / kiểm tra</option><option value="MAINTENANCE">Bảo trì</option></select></Field>{error && <p role="alert" className="tone-red">{error}</p>}<Button type="submit" disabled={load.busy||load.needsRefresh||readingBefore||readingAfter}>Kiểm tra &amp; lưu biên bản</Button>
      </form>)}
    </RecordCard>)}{!load.data?.length && !load.error && <WorkflowEmpty title="Không có kho quá hạn đến ngày 20" text="Khi có hợp đồng quá hạn đến ngày 20 và được phân công, việc xử lý đồ sẽ hiện ở đây."><LinkButton to="staff" variant="outline">Về công việc trong ngày</LinkButton></WorkflowEmpty>}
  </WorkflowState>{dialog}</main>;
}
