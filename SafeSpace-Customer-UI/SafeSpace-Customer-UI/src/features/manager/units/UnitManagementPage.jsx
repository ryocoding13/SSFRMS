import React, { useMemo, useState } from "react";
import { Pagination, Select } from "../../../shared/components/Pickers.jsx";
import { Button, Field, Icon, Modal, Tag } from "../../../shared/components/UI.jsx";
import { SIZE_BANDS, UNIT_TYPES, bandOfArea, typeLabel } from "../../../shared/utils/catalog.js";
import { dateLabel, money } from "../../../shared/utils/format.js";
import { useApp } from "../../../app/state/AppProvider.jsx";
import { go, qs } from "../../../app/router.js";
import { UNIT_STATE } from "../../facility-operations/data/facilityOperationsSeed.js";
import { UNIT_TRANSITIONS } from "../../facility-operations/state/facilityOperationsReducer.js";
import { useOps } from "../../facility-operations/state/FacilityOperationsProvider.jsx";

export const UNIT_TABS = [
  ["", "Tất cả"],
  ["ACTIVE", "Đang hoạt động"],
  ["EMPTY", "Trống"],
  ["EXPIRING", "Sắp hết hạn"],
  ["OVERDUE", "Quá hạn"],
  ["WAITING_HANDOVER", "Chưa đến ngày sử dụng"],
  ["MAINTENANCE", "Bảo trì"],
];

export const STATUS_HELP = {
  MAINTENANCE: "Tạm khoá ô, khách không đặt được",
  EMPTY: "Mở lại ô, khách đặt được và quản lý phân bổ được",
};

export function UnitStatusDialog({ unit, onClose }) {
  const { run } = useOps();
  const options = UNIT_TRANSITIONS[unit.status] || [];
  const [status, setStatus] = useState(options[0]);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [label] = UNIT_STATE[unit.status] || [unit.status];
  const submit = async () => {
    if (!reason.trim()) return setErr("Nhập lý do đổi trạng thái.");
    setBusy(true);
    const r = await run("UPDATE_UNIT_STATUS", { code: unit.code, status, reason }, `Đã đổi ô ${unit.code} sang ${UNIT_STATE[status][0].toLowerCase()}`);
    setBusy(false);
    if (r.ok || r.shown) onClose();
    else if (!r.cancelled) setErr(r.error);
  };
  return (
    <Modal title={`Đổi trạng thái kho #${unit.code}`} onClose={onClose}>
      <p className="modal__text modal__text--sub">Hiện tại: {label} · {unit.area} m² · {typeLabel(unit.type)}</p>
      <fieldset className="radio-list">
        <legend className="field__label">Trạng thái mới</legend>
        {options.map((s) => (
          <label key={s} className={`radio-card${status === s ? " is-on" : ""}`}>
            <input type="radio" name="unit-status" value={s} checked={status === s} onChange={() => setStatus(s)} />
            <span><strong>{UNIT_STATE[s][0]}</strong><small>{STATUS_HELP[s]}</small></span>
          </label>
        ))}
      </fieldset>
      <p className="hint">Chỉ hiện các trạng thái được phép chuyển: Trống ↔ Bảo trì. Ô đang có khách thuê không đổi được ở đây.</p>
      <Field label="Lý do (bắt buộc)" error={err}>
        <textarea rows={3} maxLength={255} value={reason} placeholder="Ví dụ: Hỏng khoá cửa, chờ thợ sửa" onChange={(e) => { setReason(e.target.value); setErr(""); }} />
      </Field>
      <p className="hint">Lần đổi này được ghi vào lịch sử trạng thái của ô.</p>
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" onClick={onClose}>Huỷ</Button>
        <Button onClick={submit} disabled={busy}>{busy ? "Đang lưu…" : "Xác nhận"}</Button>
      </div>
    </Modal>
  );
}

// M02b Thêm ô kho / M02c Sửa ô kho (Figma 634:8938, 634:8978). Giá thuê lấy theo bảng giá cơ sở, không nhập tay.
export const floorLabel = (floor) => (/tầng|dãy/i.test(String(floor)) ? floor : `Tầng ${floor}`);
function UnitFormDialog({ unit, onClose }) {
  const { ops, run } = useOps();
  const { data } = useApp();
  const editing = Boolean(unit);
  const [form, setForm] = useState({ code: unit?.code || "", location: unit && /dãy|tầng/i.test(unit.floor) ? unit.floor : "", type: unit?.type || "normal", band: unit ? bandOfArea(unit.area) : "M" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => { setForm({ ...form, [k]: e.target.value }); setErr(""); };
  const facility = (data?.facilities || []).find((f) => f.facility_id === ops.facility?.facility_id);
  const offer = facility?.offers?.find((o) => o.type === form.type && o.band === form.band);
  const locked = Boolean(unit?.tenant);
  const [label] = unit ? UNIT_STATE[unit.status] || [unit.status] : [];
  const submit = async () => {
    if (!form.code.trim()) return setErr("Nhập mã ô.");
    const area = SIZE_BANDS.find((b) => b.id === form.band)?.area;
    setBusy(true);
    const payload = { code: form.code.trim().toUpperCase(), location: form.location.trim(), type: form.type, area };
    const r = await run(editing ? "UPDATE_UNIT" : "CREATE_UNIT", editing ? { id: unit.code, ...payload } : payload, editing ? `Đã lưu ô kho ${payload.code}` : `Đã thêm ô kho ${payload.code}`);
    setBusy(false);
    if (r.ok || r.shown) onClose();
    else if (!r.cancelled) setErr(r.error);
  };
  return (
    <Modal title={editing ? `Sửa ô kho #${unit.code}` : "Thêm ô kho"} size="md" onClose={busy ? undefined : onClose}>
      <p className="modal__text modal__text--sub">{editing ? `Hiện tại: ${label} · ${unit.area} m² · ${typeLabel(unit.type)}` : `${ops.facility.name} · ô mới ở trạng thái Trống`}</p>
      <Field label="Mã ô" error={err}>
        <input maxLength={20} value={form.code} placeholder="Ví dụ: K13" onChange={set("code")} />
      </Field>
      <Field label="Vị trí (dãy · tầng)">
        <input maxLength={60} value={form.location} placeholder="Ví dụ: Dãy B · Tầng 1" onChange={set("location")} />
      </Field>
      <div className="form-pair">
        <Field label="Loại kho">
          <Select value={form.type} onChange={set("type")} disabled={locked}>
            {UNIT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
        </Field>
        <Field label="Cỡ">
          <Select value={form.band} onChange={set("band")} disabled={locked}>
            {SIZE_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Giá thuê mỗi tháng">
        <input readOnly value={offer?.monthly_rate ? `${money(offer.monthly_rate)} · theo bảng giá cơ sở` : "Theo bảng giá cơ sở"} />
      </Field>
      <p className="hint">
        {editing
          ? "Ô đang có khách thuê thì không đổi được loại kho và cỡ. Đổi trạng thái (Trống / Bảo trì) dùng nút Đổi trạng thái."
          : "Giá thuê tự lấy theo bảng giá của cơ sở cho loại kho và cỡ đã chọn (Vận hành KD đặt khung giá). Mã ô không trùng với ô đã có."}
      </p>
      <div className="modal__actions modal__actions--end">
        <Button variant="outline" disabled={busy} onClick={onClose}>Huỷ</Button>
        <Button disabled={busy} onClick={submit}>{busy ? "Đang lưu…" : editing ? "Lưu thay đổi" : "Thêm ô kho"}</Button>
      </div>
    </Modal>
  );
}

export const PER_PAGE = 12;

export function UnitManagementPage({ query }) {
  const { ops } = useOps();
  const tab = query.get("tab") || "";
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(null); // { unit } khi sửa, {} khi thêm
  const page = Math.max(1, Number(query.get("page")) || 1);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ops.units.filter((u) => (!tab || u.status === tab) && (!q || u.code.toLowerCase().includes(q) || (u.tenant || "").toLowerCase().includes(q)));
  }, [ops.units, tab, search]);
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
  const cur = Math.min(page, pages);
  const shown = list.slice((cur - 1) * PER_PAGE, cur * PER_PAGE);
  const count = (s) => (s ? ops.units.filter((u) => u.status === s).length : ops.units.length);
  return (
    <main className="container page">
      <header className="page-header page-header--tight"><div><h1>Danh sách kho — {ops.facility.name}</h1></div></header>
      <Button variant="outline" className="btn--sm btn--fit" onClick={() => setForm({})}>+ Thêm ô kho</Button>
      <div className="admin-toolbar">
        <div className="chips" role="group" aria-label="Lọc theo trạng thái">
          {UNIT_TABS.map(([k, label]) => (
            <button type="button" key={k || "all"} className={`chip chip--dark${tab === k ? " is-on" : ""}`} aria-pressed={tab === k} onClick={() => go(`manager/units${qs({ tab: k })}`, { replace: true })}>
              {label} · {count(k)}
            </button>
          ))}
        </div>
        <label className="search-input">
          <Icon name="search" size={18} />
          <input type="search" placeholder="Tìm mã kho hoặc khách thuê" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Tìm mã kho hoặc khách thuê" />
        </label>
      </div>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Mã kho</th><th>Khách thuê</th><th>Loại kho</th><th>Diện tích</th><th>Trạng thái</th><th>Hết hạn</th><th>Thao tác</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="table__empty">Không có kho phù hợp.</td></tr>}
            {shown.map((u) => {
              const [label, tone] = UNIT_STATE[u.status] || [u.status, "gray"];
              return (
                <tr key={u.code}>
                  <td className="cell-strong">#{u.code}</td>
                  <td>{u.tenant || "—"}</td>
                  <td>{typeLabel(u.type)}</td>
                  <td>{u.area} m² · {floorLabel(u.floor)}</td>
                  <td><Tag tone={tone}>{label}</Tag></td>
                  <td>{u.end ? dateLabel(u.end) : "—"}</td>
                  <td>
                    {UNIT_TRANSITIONS[u.status] ? (
                      <span className="row-actions">
                        <button type="button" className="link-btn" onClick={() => setEditing(u)}>Đổi trạng thái</button>
                        {u.status === "EMPTY" && <button type="button" className="link-btn" onClick={() => setForm({ unit: u })}>Sửa</button>}
                      </span>
                    ) : (
                      <span className="muted">{u.tenant ? "Đang có khách thuê" : "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Pagination page={cur} pages={pages} total={list.length} from={(cur - 1) * PER_PAGE + 1} to={(cur - 1) * PER_PAGE + shown.length} noun="kho" onPage={(n) => go(`manager/units${qs({ tab, page: n === 1 ? "" : n })}`, { replace: true })} />
      {editing && <UnitStatusDialog unit={editing} onClose={() => setEditing(null)} />}
      {form && <UnitFormDialog unit={form.unit} onClose={() => setForm(null)} />}
    </main>
  );
}
