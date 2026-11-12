/**
 * DOOR LOG PAGE - NHẬT KÝ CỬA (Lượt 6b · #49 · Figma A-NK-CỬA)
 * Mỗi lần mở, từ chối, đóng cửa là một dòng; lọc theo cơ sở, ô kho, kết quả, khoảng ngày.
 * Không hiển thị nguyên mã QR hay PIN (máy chủ không trả về).
 */
import React, { useEffect, useRef, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import { Button, Empty, Field, Notice, Tag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateLabel, today } from "../../../shared/utils/format.js";
import { DemoHead } from "./DemoShared.jsx";
import { DOOR_RESULT, doorLogLine } from "./demoModel.js";
import "./demo-tools.css";

const PAGE_SIZE = 20;

export default function DoorLogPage() {
  const { onApiError } = useApp();
  const [facilities, setFacilities] = useState([]);
  const [filter, setFilter] = useState({ facilityId: "", unitNumber: "", result: "", from: today(), to: today() });
  const [page, setPage] = useState(1), [data, setData] = useState({ loading: true, error: "", items: [], total: 0, pages: 1 });
  const seq = useRef(0);
  useEffect(() => { adminApi.facilities().then((l) => setFacilities(l || [])).catch(() => setFacilities([])); }, []);
  const load = async () => {
    const n = ++seq.current;
    if (filter.from && filter.to && filter.to < filter.from) return setData((d) => ({ ...d, loading: false, error: "Đến ngày phải sau hoặc bằng Từ ngày." }));
    setData((d) => ({ ...d, loading: true, error: "" }));
    try {
      const res = await adminApi.doorLogs({ ...filter, unitNumber: filter.unitNumber.trim(), page, pageSize: PAGE_SIZE });
      if (n !== seq.current) return;
      setData({ loading: false, error: "", items: res?.items || [], total: res?.totalItems ?? 0, pages: Math.max(1, res?.totalPages || 1) });
    } catch (e) { if (n === seq.current) { setData((d) => ({ ...d, loading: false, error: e.message || "Không tải được nhật ký cửa." })); onApiError?.(e); } }
  };
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setPage(1); setFilter({ ...filter, [k]: e.target.value }); };
  const isToday = filter.from === today() && filter.to === today();
  return (
    <main className="container page demo-tools">
      <DemoHead title="Nhật ký cửa" description="Ghi mỗi lần mở, đóng và từ chối. Không hiển thị nguyên mã QR hay PIN. Cửa không tự khoá nên không có sự kiện tự khoá.">
        <Tag tone="gray">{isToday ? "Hôm nay" : `${dateLabel(filter.from)} – ${dateLabel(filter.to)}`} · {data.total} sự kiện</Tag>
      </DemoHead>
      <section className="panel demo-log__filter" aria-label="Bộ lọc nhật ký cửa">
        <Field label="Cơ sở"><select value={filter.facilityId} onChange={set("facilityId")}><option value="">Tất cả cơ sở</option>{facilities.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}</select></Field>
        <Field label="Ô kho"><input value={filter.unitNumber} placeholder="Ví dụ: B-015" onChange={set("unitNumber")} /></Field>
        <Field label="Kết quả"><select value={filter.result} onChange={set("result")}><option value="">Tất cả</option>{Object.entries(DOOR_RESULT).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Từ ngày"><input type="date" max={filter.to || undefined} value={filter.from} onChange={set("from")} /></Field>
        <Field label="Đến ngày"><input type="date" min={filter.from || undefined} value={filter.to} onChange={set("to")} /></Field>
      </section>
      {data.error ? <Notice tone="error">{data.error} <Button variant="outline" onClick={load}>Thử lại</Button></Notice>
        : data.loading && !data.items.length ? <p className="muted" role="status">Đang tải nhật ký cửa…</p>
        : !data.items.length ? <section className="panel"><Empty title="Chưa có sự kiện" text="Không có lần mở, đóng hay từ chối nào khớp bộ lọc. Đổi khoảng ngày hoặc bỏ bớt bộ lọc." /></section>
        : <ul className="demo-log__list">{data.items.map((r, i) => {
            const [label, tone] = DOOR_RESULT[r.result] || [r.result, "gray"];
            return <li key={r.logId} className="panel demo-log__item" style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}>
              <span><strong>{String(r.at).slice(11, 16)} · {r.unitNumber || "—"} · {label}</strong>
                <small>{isToday ? "" : `${dateLabel(String(r.at).slice(0, 10))} · `}{r.facilityName ? `${r.facilityName} · ` : ""}{doorLogLine(r)}</small></span>
              <Tag tone={tone}>{label}</Tag>
            </li>;
          })}</ul>}
      {data.pages > 1 && <div className="demo-log__pager">
        <Button variant="outline" disabled={page <= 1 || data.loading} onClick={() => setPage(page - 1)}>Trang trước</Button>
        <span className="muted">Trang {page}/{data.pages}</span>
        <Button variant="outline" disabled={page >= data.pages || data.loading} onClick={() => setPage(page + 1)}>Trang sau</Button>
      </div>}
    </main>
  );
}
