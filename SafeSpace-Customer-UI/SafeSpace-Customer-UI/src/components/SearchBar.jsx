import React, { useEffect, useState } from "react";
import { SIZE_BANDS, UNIT_TYPES, listAreas } from "../lib/catalog";
import { Select } from "./Pickers";
import { Button, Field } from "./UI";

// Thanh tìm kho dùng chung cho C02 (danh sách) và C02m (bản đồ): Loại kho · Diện tích · Khu vực · Tìm kho
export default function SearchBar({ facilities, filters, onSubmit, submitLabel = "Tìm kho" }) {
  const [draft, setDraft] = useState({ type: filters.type, band: filters.band, area: filters.area });
  useEffect(() => setDraft({ type: filters.type, band: filters.band, area: filters.area }), [filters.type, filters.band, filters.area]);
  return (
    <form
      className="panel search-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(draft);
      }}
    >
      <Field label="Loại kho">
        <Select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
          <option value="">Tất cả loại kho</option>
          {UNIT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Diện tích">
        <Select value={draft.band} onChange={(e) => setDraft({ ...draft, band: e.target.value })}>
          <option value="">Mọi diện tích</option>
          {SIZE_BANDS.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </Select>
      </Field>
      <Field label="Khu vực">
        <Select value={draft.area} onChange={(e) => setDraft({ ...draft, area: e.target.value })}>
          <option value="">Tất cả khu vực</option>
          {listAreas(facilities).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>
      </Field>
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
