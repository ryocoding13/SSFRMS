import React, { useEffect, useState } from "react";
import { Field } from "./UI.jsx";
import { MAX_RENTAL_MONTHS, MIN_RENTAL_MONTHS, isValidMonths, monthsMessage } from "../utils/catalog.js";

/**
 * D67: ô nhập số tháng thuê / gia hạn — số nguyên 1–99, tối đa hai chữ số, không có 0.
 * Chỉ báo `onChange(n)` khi giá trị hợp lệ; `onValidity(false)` khi ô đang trống hoặc sai để màn cha khoá nút.
 */
export default function MonthsInput({ label = "Số tháng thuê", what = "thuê", value, onChange, onValidity, hint, disabled }) {
  const [text, setText] = useState(String(value ?? ""));
  useEffect(() => {
    setText((t) => (Number(t) === Number(value) ? t : String(value ?? "")));
  }, [value]);
  const valid = isValidMonths(text);
  useEffect(() => { onValidity?.(valid); }, [valid]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Field label={label} error={monthsMessage(text, what)} hint={valid ? hint : undefined}>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        autoComplete="off"
        value={text}
        disabled={disabled}
        aria-valuemin={MIN_RENTAL_MONTHS}
        aria-valuemax={MAX_RENTAL_MONTHS}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 2);
          setText(next);
          if (isValidMonths(next)) onChange(Number(next));
        }}
      />
    </Field>
  );
}
