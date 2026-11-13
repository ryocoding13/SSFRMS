/**
 * OVERDUE REMOVAL PAGE - NIÊM PHONG VÀ XỬ LÝ KHO QUÁ HẠN (S06 / T12)
 *
 * Quy trình xử lý vi phạm:
 * - Nhân viên cùng đại diện cơ sở tiến hành mở kho quá hạn đã có quyết định xử lý.
 * - D56: một ô ảnh hiện trạng (1–10 ảnh); nơi lưu giữ tự điền "Khu tạm giữ đồ quá hạn".
 * - Lập biên bản kiểm kê sau khi đã chuyển đồ tới khu tạm giữ.
 */
import ReturnPhotoInput from "../../../shared/components/ReturnPhotoInput.jsx";
import { OVERDUE_HOLDING_AREA, OVERDUE_MAX_PHOTOS } from "../../facility-operations/settlements/settlementModel.js";
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
  const blank = { performedAt: "", inventory: "", unitStatus: "INSPECTION", confirmed: false };
  const [form, setForm] = useState(blank), [error, setError] = useState("");
  const [photos, setPhotos] = useState([]), [reading, setReading] = useState(false);
  const [dialog, ask] = useWorkflowChange(load);
  const open = item => { setSelected(selected === item.id ? "" : item.id); setForm(blank); setPhotos([]); setError(""); };
  const recordPhotos = r => (r.photos?.length ? r.photos : [...(r.beforePhotos || []), ...(r.afterPhotos || [])]).length;
  const submit = (e, item) => {
    e.preventDefault();
    if (!form.performedAt || !form.inventory.trim()) return setError("Điền thời gian thực hiện và danh sách / tình trạng đồ.");
    if (!photos.length) return setError("Cần ít nhất 1 ảnh hiện trạng.");
    if (!form.confirmed) return setError("Tick xác nhận nội dung phản ánh đúng việc đã thực hiện.");
    setError("");
    ask("RECORD_REMOVAL", { id: item.id, ...form, location: OVERDUE_HOLDING_AREA, photos }, `Lưu biên bản xử lý đồ ${item.unit}?`,
      "Biên bản và ảnh không sửa được sau khi lưu. Kiểm tra danh sách đồ trước khi lưu.",
      { confirmLabel: "Lưu biên bản", successTitle: "Đã lưu biên bản xử lý đồ", failTitle: "Chưa lưu được biên bản", doneLabel: "Về công việc trong ngày", onDone: () => go("staff") });
  };
  return <main className="container page workflow-page overdue-removal"><PageHeader title="Công việc xử lý đồ quá hạn" description={`Lập biên bản sau khi đã chuyển đồ tới ${OVERDUE_HOLDING_AREA}.`} /><WorkflowState load={load}>
    {(load.data || []).map(item => <RecordCard key={item.id} title={`${item.customer} · Kho ${item.unit}`} subtitle={`${item.contractId} · Phụ trách: ${item.assignee || "Chưa phân công"}`} status={item.status === "DONE" ? "Đã lưu biên bản" : "Chờ thực hiện"} actions={<Button variant={selected === item.id ? "outline" : "primary"} onClick={() => open(item)}>{selected === item.id ? "Thu gọn" : item.record ? "Xem biên bản" : "Lập biên bản"}</Button>}>
      {selected === item.id && (item.record
        ? <InfoTiles items={[["Nhân viên", item.record.staff], ["Tình trạng đồ", item.record.inventory], ["Nơi lưu giữ", item.record.location], ["Thời gian", item.record.performedAt], ["Ảnh hiện trạng", `${recordPhotos(item.record)} ảnh`]]} />
        : <form className="overdue-removal__form" onSubmit={e => submit(e, item)} noValidate>
          <h3>Biên bản xử lý đồ</h3>
          <div className="form-row">
            <Field label="Thời gian thực hiện *"><input type="datetime-local" max={vnDateTimeInput()} value={form.performedAt} onChange={e => setForm({ ...form, performedAt: e.target.value })} /></Field>
            <Field label="Nhân viên thực hiện"><input value={user?.full_name || ""} readOnly /></Field>
          </div>
          <Field label="Danh sách / tình trạng đồ *"><textarea rows={3} value={form.inventory} onChange={e => setForm({ ...form, inventory: e.target.value })} /></Field>
          <div className="form-row">
            <Field label="Nơi lưu giữ đồ · tự điền"><input value={OVERDUE_HOLDING_AREA} readOnly /></Field>
            <Field label="Trạng thái kho sau xử lý *"><select value={form.unitStatus} onChange={e => setForm({ ...form, unitStatus: e.target.value })}><option value="INSPECTION">Chờ vệ sinh / kiểm tra</option><option value="MAINTENANCE">Bảo trì</option></select></Field>
          </div>
          <div className="field">
            <span className="field__label">Ảnh hiện trạng *</span>
            <p className="field__hint">Tối thiểu 1 ảnh, tối đa {OVERDUE_MAX_PHOTOS} ảnh. Chụp đồ trong kho và đồ đã chuyển tới {OVERDUE_HOLDING_AREA}.</p>
            <ReturnPhotoInput files={photos} onChange={setPhotos} onReading={setReading} disabled={load.busy} label="Ảnh hiện trạng" max={OVERDUE_MAX_PHOTOS} />
          </div>
          <label className="customer-detail__choice"><input type="checkbox" checked={form.confirmed} onChange={e => setForm({ ...form, confirmed: e.target.checked })} /><span>Tôi xác nhận nội dung phản ánh đúng việc đã thực hiện</span></label>
          {error && <p role="alert" className="tone-red">{error}</p>}
          <div className="overdue-removal__actions"><Button type="submit" disabled={load.busy || load.needsRefresh || reading}>Lưu biên bản</Button></div>
        </form>)}
    </RecordCard>)}{!load.data?.length && !load.error && <WorkflowEmpty title="Không có kho quá hạn đến ngày 20" text="Khi có hợp đồng quá hạn đến ngày 20 và được phân công, việc xử lý đồ sẽ hiện ở đây."><LinkButton to="staff" variant="outline">Về công việc trong ngày</LinkButton></WorkflowEmpty>}
  </WorkflowState>{dialog}</main>;
}
