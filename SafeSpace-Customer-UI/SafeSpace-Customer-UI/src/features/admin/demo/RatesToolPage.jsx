/**
 * RATES TOOL PAGE - CÔNG CỤ DEMO · CHỈNH GIÁ THEO CƠ SỞ (D57 · Figma A-DEMO-GIÁ vẽ lại 13/11)
 *
 * Giống Bảng giá thuê của Vận hành KD: chọn cơ sở → sửa giá thuê tháng của từng loại kho.
 * Giá mới dùng ngay cho báo giá và đơn đặt mới; hợp đồng đang thuê giữ giá đã chốt.
 * Máy chủ ghi RATE_SET (giá trước/sau, người chỉnh) vào Nhật ký hoạt động.
 */
import React, { useEffect, useMemo, useState } from "react";
import { adminApi } from "../api/adminApi.js";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button, Empty, Field, Notice, Tag } from "../../../shared/components/UI.jsx";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import { DemoHead } from "./DemoShared.jsx";
import { digits, rateError } from "./demoModel.js";
import "./demo-tools.css";

export default function RatesToolPage() {
  const { user, onApiError } = useApp();
  const [facilities, setFacilities] = useState([]), [facilityId, setFacilityId] = useState("");
  const [rates, setRates] = useState([]), [draft, setDraft] = useState({});
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [confirm, setConfirm] = useState(false), [result, setResult] = useState(null), [history, setHistory] = useState([]);

  useEffect(() => {
    adminApi.facilities().then((list) => {
      const active = (list || []).filter((f) => !f.status || f.status === "ACTIVE");
      setFacilities(active);
      setFacilityId((id) => id || String(active[0]?.facilityId || ""));
    }).catch((e) => { setError(e.message); onApiError?.(e); }).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (id) => {
    if (!id) return;
    setLoading(true); setError("");
    adminApi.demoRates(Number(id)).then((list) => {
      const current = (list || []).filter((r) => r.isCurrent !== false).sort((a, b) => a.unitTypeId - b.unitTypeId);
      setRates(current); setDraft(Object.fromEntries(current.map((r) => [r.unitTypeId, String(r.monthlyRate)])));
    }).catch((e) => { setError(e.message); onApiError?.(e); }).finally(() => setLoading(false));
  };
  useEffect(() => load(facilityId), [facilityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const facility = facilities.find((f) => String(f.facilityId) === String(facilityId));
  const changed = useMemo(() => rates.filter((r) => digits(draft[r.unitTypeId]) && Number(digits(draft[r.unitTypeId])) !== Number(r.monthlyRate)), [rates, draft]);
  const errors = Object.fromEntries(rates.map((r) => [r.unitTypeId, rateError(draft[r.unitTypeId])]).filter(([, e]) => e));
  const first = changed[0];

  const save = async () => {
    setBusy(true); setError("");
    const done = [];
    try {
      for (const r of changed) {
        const after = Number(digits(draft[r.unitTypeId]));
        await adminApi.demoSetRate({ facilityId: r.facilityId, unitTypeId: r.unitTypeId, monthlyRate: after });
        done.push([r.unitTypeName, `${money(r.monthlyRate)} → ${money(after)}`]);
      }
      setHistory((h) => [...done.map(([t, c]) => ({ text: `${facility?.name || ""} · ${t} · ${c}`, at: `${dateTimeLabel(new Date().toISOString())} · ${user?.full_name || "Quản trị"}` })), ...h]);
      setResult(done); setConfirm(false); load(facilityId);
    } catch (e) {
      setError(e.message); setConfirm(false); onApiError?.(e);
      if (done.length) { setResult(done); load(facilityId); }
    } finally { setBusy(false); }
  };

  return (
    <main className="container page demo-tools">
      <DemoHead title="Chỉnh giá" description="Chỉnh giá thuê tháng của các loại kho trong từng cơ sở, giống Bảng giá thuê của Vận hành KD. Giá mới dùng cho báo giá và đơn đặt mới; hợp đồng đang thuê giữ giá đã chốt. Mọi thay đổi ghi lại giá trước/sau và người chỉnh.">
        {facility && <Tag tone="gray">{facility.name}</Tag>}
      </DemoHead>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="demo-tools__row">
        <div className="demo-tools__main">
          <section className="panel demo-tools__card">
            <h2>1 · Chọn cơ sở</h2>
            <Field label="Cơ sở">
              <select value={facilityId} disabled={busy} onChange={(e) => setFacilityId(e.target.value)}>
                {facilities.map((f) => <option key={f.facilityId} value={f.facilityId}>{f.name}</option>)}
              </select>
            </Field>
          </section>
          <section className="panel demo-tools__card">
            <h2>2 · Giá thuê theo loại kho</h2>
            {loading ? <p className="muted">Đang tải bảng giá…</p> : !rates.length ? <Empty title="Cơ sở chưa có bảng giá" text="Thêm giá ở màn Bảng giá thuê của Vận hành KD." /> :
              <div className="demo-rates">{rates.map((r) => {
                const edited = changed.includes(r);
                return <div key={r.unitTypeId} className={`demo-rates__row${edited ? " is-edited" : ""}`}>
                  <div><strong>{r.unitTypeName}</strong><small>Giá hiện tại {money(r.monthlyRate)} / tháng{edited ? " · đã sửa" : ""}</small></div>
                  <Field label={`Giá mới ${r.unitTypeName}`} error={errors[r.unitTypeId]} className="demo-rates__field">
                    <input inputMode="numeric" value={draft[r.unitTypeId] ? Number(digits(draft[r.unitTypeId])).toLocaleString("vi-VN") : ""} disabled={busy}
                      onChange={(e) => setDraft((d) => ({ ...d, [r.unitTypeId]: digits(e.target.value) }))} />
                  </Field>
                </div>;
              })}</div>}
            <p className="demo-tools__hint">Tiền cọc của đơn mới tự bằng 1 tháng thuê theo giá mới. Giá không được để trống hoặc bằng 0.</p>
          </section>
        </div>
        <aside className="demo-tools__aside">
          <section className="panel demo-tools__card">
            <h2>Kết quả sau khi lưu</h2>
            <dl className="demo-tools__sum">
              <div><dt>{first ? first.unitTypeName : "Loại kho"}</dt><dd>{first ? `${money(first.monthlyRate)} → ${money(Number(digits(draft[first.unitTypeId])))}` : "Chưa sửa giá"}</dd></div>
              {changed.length > 1 && <div><dt>Loại kho khác</dt><dd>+{changed.length - 1} loại</dd></div>}
              <div><dt>Báo giá &amp; đơn đặt mới</dt><dd>Dùng giá mới ngay</dd></div>
              <div><dt>Hợp đồng đang thuê</dt><dd>Giữ giá đã chốt</dd></div>
              {first && <div><dt>Cọc đơn mới</dt><dd>{money(Number(digits(draft[first.unitTypeId])))} (= 1 tháng)</dd></div>}
            </dl>
            <Notice>Cập nhật ở Bảng giá thuê của Vận hành KD, trang chi tiết cơ sở và bước đặt kho của khách. Không gửi thông báo cho khách.</Notice>
            <Button block disabled={busy || !changed.length || Object.keys(errors).length > 0} onClick={() => setConfirm(true)}>Lưu thay đổi</Button>
            <Button block variant="outline" disabled={busy || !changed.length} onClick={() => setDraft(Object.fromEntries(rates.map((r) => [r.unitTypeId, String(r.monthlyRate)])))}>Khôi phục giá trước</Button>
          </section>
          <section className="panel demo-tools__card">
            <h2>Nhật ký chỉnh</h2>
            {!history.length ? <p className="muted">Chưa chỉnh trong lần mở trang này. Toàn bộ lịch sử xem ở Nhật ký hoạt động.</p>
              : <ul className="demo-tools__log">{history.map((h, i) => <li key={i}><strong>{h.text}</strong><small>{h.at}</small></li>)}</ul>}
          </section>
        </aside>
      </div>
      {confirm && <ConfirmDialog title={`Lưu giá mới cho ${facility?.name || "cơ sở"}?`} busy={busy} label="Lưu thay đổi"
        text="Giá mới dùng ngay cho báo giá và đơn đặt mới. Hợp đồng đang thuê giữ giá đã chốt."
        rows={changed.map((r) => [r.unitTypeName, `${money(r.monthlyRate)} → ${money(Number(digits(draft[r.unitTypeId])))}`])}
        onCancel={() => setConfirm(false)} onConfirm={save} />}
      {result && <ConfirmDialog tone="success" title="Đã lưu giá mới" cancelLabel={null} hint="" label="Đóng"
        text="Bảng giá thuê, trang cơ sở và bước đặt kho dùng giá mới ngay sau khi tải lại." rows={result}
        onCancel={() => setResult(null)} onConfirm={() => setResult(null)} />}
    </main>
  );
}
