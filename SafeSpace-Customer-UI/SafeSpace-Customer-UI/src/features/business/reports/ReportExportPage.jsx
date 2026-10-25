import React, { useState } from "react";
import { Button, Field, Modal, Notice, PageHeader } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { today } from "../../../shared/utils/format.js";
import { useLoad } from "../../admin/utils/adminUtils.js";
import { businessApi } from "../api/businessApi.js";
import { parseCsv } from "./reportExport.js";

export function ReportExportPage() {
  const { onApiError } = useApp(), facilities = useLoad(() => businessApi.facilities(), [], onApiError);
  const [form, setForm] = useState({ from: today().slice(0, 8) + "01", to: today(), facilityId: "", view: "facilities" });
  const [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(""), [done, setDone] = useState(false);
  const submit = async () => { setBusy(true); setError(""); try {
    const { blob } = await businessApi.exportReport(form);
    const rows = parseCsv(await blob.text());
    if (rows.length <= 1) throw new Error("Không có dữ liệu trong phạm vi đã chọn.");
    const safe = rows.map(row => row.map(value => { const str = String(value ?? ""); return '"' + (/^[=+@\t\r]/.test(str) || (/^-/.test(str) && !/^-\d+(\.\d+)?$/.test(str)) ? "'" + str : str).replaceAll('"', '""') + '"'; }).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + safe], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `safespace-${form.view}-${form.from}-${form.to}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setConfirm(false); setDone(true);
  } catch (e) { setError(e.message); onApiError(e); } finally { setBusy(false); } };
  return <main className="container page workflow-page"><PageHeader title="Xuất dữ liệu báo cáo" description="Kiểm tra thời gian, cơ sở và loại báo cáo trước khi xuất CSV." /><form className="panel form-card" onSubmit={e => { e.preventDefault(); if (!form.from || !form.to || form.from > form.to) return setError("Ngày bắt đầu phải không sau ngày kết thúc."); setError(""); setConfirm(true); }}>
    <div className="workflow-tiles"><Field label="Từ ngày"><input type="date" value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} /></Field><Field label="Đến ngày"><input type="date" value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} /></Field><Field label="Cơ sở"><select value={form.facilityId} onChange={e => setForm({ ...form, facilityId: e.target.value })}><option value="">Toàn hệ thống</option>{(facilities.data || []).map(f => <option value={f.facilityId} key={f.facilityId}>{f.name}</option>)}</select></Field></div>
    <Field label="Loại dữ liệu"><select value={form.view} onChange={e => setForm({ ...form, view: e.target.value })}><option value="facilities">Theo cơ sở</option><option value="unit-types">Theo loại kho</option><option value="revenue-trend">Xu hướng doanh thu</option></select></Field>{facilities.error && <Notice tone="error">{facilities.error}</Notice>}{error && !confirm && <Notice tone="error">{error}</Notice>}<Button type="submit" disabled={busy}>Kiểm tra & xuất CSV</Button>
  </form>{confirm && <Modal title="Xác nhận phạm vi xuất" onClose={busy ? undefined : () => setConfirm(false)}><p>{form.from} → {form.to} · {form.facilityId ? "Cơ sở đã chọn" : "Toàn hệ thống"}</p>{error && <Notice tone="error">{error}</Notice>}<div className="modal__actions"><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Quay lại</Button><Button disabled={busy} onClick={submit}>{busy ? "Đang xuất…" : "Xuất CSV"}</Button></div></Modal>}{done && <Modal title="Đã xuất báo cáo" onClose={() => setDone(false)}><p>Tệp CSV đã được chuyển cho trình duyệt tải xuống.</p><Button onClick={() => setDone(false)}>Về báo cáo</Button></Modal>}</main>;
}
