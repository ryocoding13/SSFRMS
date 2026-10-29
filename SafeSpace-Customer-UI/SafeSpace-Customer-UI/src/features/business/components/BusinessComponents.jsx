import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import React, { useEffect,useRef,useState } from "react";
import { Select } from "../../../shared/components/Pickers.jsx";
import { Button, Empty, Field, Modal } from "../../../shared/components/UI.jsx";
import { today } from "../../../shared/utils/format.js";
import { CALC_TYPES, POLICY_TYPES, parseMoney } from "../utils/businessFormat.js";

// Trạng thái tải chung cho các màn B01–B05
export function LoadState({ load, children }) {
  if (load.error)
    return (
      <Empty title="Không tải được dữ liệu" text={load.error}>
        <Button onClick={load.reload}>Thử lại</Button>
      </Empty>
    );
  if (load.loading || !load.data)
    return (
      <div className="loading" aria-busy="true">
        <span className="loading__spinner" aria-hidden="true" />
        <p>Đang tải dữ liệu…</p>
      </div>
    );
  return children(load.data);
}

/** Biểu đồ cột đơn giản (B04): items = [{ key, label, value, text }] — chiều cao theo giá trị lớn nhất. */
export function BarChart({ title, items, empty = "Chưa có số liệu trong kỳ." }) {
  const max = Math.max(0, ...items.map((i) => i.value));
  return (
    <section className="panel biz-chart" aria-label={title}>
      <h2>{title}</h2>
      {max <= 0 ? (
        <p className="muted biz-chart__empty">{empty}</p>
      ) : (
        <div className="biz-bars" role="list">
          {items.map((it) => (
            <div className="biz-bars__col" key={it.key} role="listitem" aria-label={`${it.label}: ${it.text}`}>
              <b>{it.text}</b>
              <i style={{ height: `${Math.max(0, (it.value / max) * 150)}px` }} />
              <span title={it.label}>{it.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const NUMBER_HINT = {
  FIXED: "Số tiền VND. Riêng đặt cọc: số nhỏ hơn 1.000 là số tháng tiền thuê.",
  PERCENTAGE: "Từ 0 đến 100.",
  RANGE: "Giá thấp nhất – cao nhất (VND / tháng).",
  RULE: "Chỉ là quy định bằng chữ, hệ thống không tự tính.",
};

/**
 * Tạo chính sách mới (UC20, UC21). Luôn tạo bản nháp; "Lưu và áp dụng" kích hoạt ngay (thay chính sách cùng phạm vi).
 * @param {{ types: string[], unitTypes?: object[], facilities?: object[], onSubmit: (body, activate) => Promise<boolean>, onClose: () => void }} props
 */
export function PolicyForm({ title = "Thêm chính sách", types, unitTypes = [], facilities = [], defaults = {}, onSubmit, onClose }) {
  const [f, setF] = useState({
    policyType: types[0],
    calculationType: types[0] === "PRICE_RANGE" ? "RANGE" : types[0] === "DISCOUNT" ? "PERCENTAGE" : "FIXED",
    policyName: "",
    value: "",
    minValue: "",
    maxValue: "",
    ruleDescription: "",
    facilityId: "",
    unitTypeId: "",
    effectiveFrom: today(),
    ...defaults,
  });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (activate) => {
    const e = {};
    if (!f.policyName.trim()) e.policyName = "Nhập tên chính sách.";
    if (!f.ruleDescription.trim()) e.ruleDescription = "Mô tả cách áp dụng để nhân viên và khách hiểu đúng.";
    if (f.calculationType === "RANGE") {
      if (!f.minValue || !f.maxValue) e.range = "Nhập đủ giá thấp nhất và cao nhất.";
      else if (parseMoney(f.minValue) > parseMoney(f.maxValue)) e.range = "Giá thấp nhất phải nhỏ hơn hoặc bằng giá cao nhất.";
    } else if (f.calculationType !== "RULE") {
      const v = Number(String(f.value).replace(",", "."));
      if (String(f.value).trim() === "" || !Number.isFinite(v) || v < 0) e.value = "Nhập giá trị không âm.";
      else if (f.calculationType === "PERCENTAGE" && v > 100) e.value = "Phần trăm từ 0 đến 100.";
    }
    if (!f.effectiveFrom) e.effectiveFrom = "Chọn ngày áp dụng.";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const range = f.calculationType === "RANGE";
    const ok = await onSubmit(
      {
        policyName: f.policyName.trim(),
        policyType: f.policyType,
        calculationType: f.calculationType,
        value: range || f.calculationType === "RULE" ? null : Number(String(f.value).replace(",", ".")),
        minValue: range ? parseMoney(f.minValue) : null,
        maxValue: range ? parseMoney(f.maxValue) : null,
        ruleDescription: f.ruleDescription.trim(),
        facilityId: f.facilityId ? Number(f.facilityId) : null,
        unitTypeId: f.unitTypeId ? Number(f.unitTypeId) : null,
        effectiveFrom: f.effectiveFrom,
        effectiveTo: null,
      },
      activate,
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Modal title={title} onClose={onClose} size="md">
      <div className="biz-form">
        {types.length > 1 && (
          <Field label="Loại chính sách">
            <Select value={f.policyType} onChange={set("policyType")}>
              {types.map((t) => <option key={t} value={t}>{POLICY_TYPES[t]}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Tên chính sách" error={errors.policyName}>
          <input value={f.policyName} onChange={set("policyName")} maxLength={150} placeholder="Ví dụ: Thuê từ 6 tháng trở lên" />
        </Field>
        <Field label="Cách tính" hint={NUMBER_HINT[f.calculationType]}>
          <Select value={f.calculationType} onChange={set("calculationType")} disabled={f.policyType === "PRICE_RANGE"}>
            {Object.entries(CALC_TYPES)
              .filter(([k]) => (f.policyType === "PRICE_RANGE" ? k === "RANGE" : k !== "RANGE"))
              .map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
        </Field>
        {f.calculationType === "RANGE" ? (
          <div className="biz-form__pair">
            <Field label="Giá thấp nhất (đ / tháng)" error={errors.range}>
              <input inputMode="numeric" value={f.minValue} onChange={set("minValue")} placeholder="700000" />
            </Field>
            <Field label="Giá cao nhất (đ / tháng)">
              <input inputMode="numeric" value={f.maxValue} onChange={set("maxValue")} placeholder="1400000" />
            </Field>
          </div>
        ) : (
          f.calculationType !== "RULE" && (
            <Field label={f.calculationType === "PERCENTAGE" ? "Giá trị (%)" : "Giá trị"} error={errors.value}>
              <input inputMode="decimal" value={f.value} onChange={set("value")} placeholder={f.calculationType === "PERCENTAGE" ? "10" : "20000"} />
            </Field>
          )
        )}
        <Field label="Mô tả cách áp dụng" error={errors.ruleDescription}>
          <textarea rows={2} maxLength={1000} value={f.ruleDescription} onChange={set("ruleDescription")} placeholder="Ví dụ: Giảm 10% tổng tiền thuê cho hợp đồng từ 6 tháng" />
        </Field>
        <div className="biz-form__pair">
          <Field label="Áp dụng cho cơ sở">
            <Select value={f.facilityId} onChange={set("facilityId")}>
              <option value="">Toàn hệ thống</option>
              {facilities.map((x) => <option key={x.facilityId} value={x.facilityId}>{x.name}</option>)}
            </Select>
          </Field>
          <Field label="Áp dụng cho loại kho">
            <Select value={f.unitTypeId} onChange={set("unitTypeId")}>
              <option value="">Mọi loại kho</option>
              {unitTypes.map((t) => <option key={t.unitTypeId} value={t.unitTypeId}>{t.typeName}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Áp dụng từ ngày" error={errors.effectiveFrom}>
          <input type="date" min={today()} value={f.effectiveFrom} onChange={set("effectiveFrom")} />
        </Field>
      </div>
      <div className="modal__actions">
        <Button onClick={() => submit(true)} disabled={busy}>Lưu và áp dụng</Button>
        <Button variant="outline" onClick={() => submit(false)} disabled={busy}>Lưu bản nháp</Button>
        <Button variant="ghost" onClick={onClose} disabled={busy}>Huỷ</Button>
      </div>
    </Modal>
  );
}

/** Hộp xác nhận dạng Promise: const [confirmEl, ask] = useConfirm(); if (await ask({ title, message })) … */
export function useConfirm() {
 const [state,setState]=useState(null),resolver=useRef(null);
 useEffect(()=>()=>{resolver.current?.(false);resolver.current=null;},[]);
 const ask=({title,message,actionLabel="Đồng ý"})=>{if(resolver.current)return Promise.resolve(false);return new Promise(resolve=>{resolver.current=resolve;setState({title,message,actionLabel});});};
 const close=value=>{const resolve=resolver.current;resolver.current=null;setState(null);resolve?.(value);};
 return [state&&<ConfirmDialog title={state.title} text={state.message} rows={[]} label={state.actionLabel} onCancel={()=>close(false)} onConfirm={()=>close(true)}/>,ask];
}
