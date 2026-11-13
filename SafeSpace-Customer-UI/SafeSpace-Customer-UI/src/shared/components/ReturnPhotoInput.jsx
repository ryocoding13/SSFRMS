import React, { useEffect, useRef, useState } from "react";
import { Icon, Notice } from "./UI.jsx";
import { MAX_RETURN_PHOTOS, validateReturnPhotos, verifyPhotoFile } from "../utils/refundRequest.js";
import "../styles/customer-detail.css";

// Khung tải ảnh dùng chung (trả kho, kiểm kê, quá hạn, sự cố): ảnh đã chọn nằm trong khung,
// tiêu đề đổi thành "Đã chọn n/tối đa ảnh" và nút "Thêm ảnh" để chọn tiếp. Hỗ trợ (C12) dùng max = 3.
export default function ReturnPhotoInput({ files, onChange, disabled, onReading, label = "Tải ảnh kho trống", required = true, max = MAX_RETURN_PHOTOS }) {
  const [previews, setPreviews] = useState([]), [error, setError] = useState("");
  const reading = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const urls = files.map(file => ({ file, url: URL.createObjectURL(file) }));
    setPreviews(urls);
    return () => urls.forEach(p => URL.revokeObjectURL(p.url));
  }, [files]);
  const select = async e => {
    const chosen = Array.from(e.target.files || []); e.target.value = "";
    if (reading.current || !chosen.length) return;
    const next = [...files, ...chosen];
    if (next.length > max) return setError(`Tối đa ${max} ảnh. Xoá bớt ảnh trước khi thêm.`);
    const invalid = validateReturnPhotos(next, max);
    if (invalid) return setError(!required ? invalid.replaceAll("ảnh kho trống", "ảnh đính kèm") : label === "Tải ảnh kho trống" ? invalid : invalid.replaceAll("ảnh kho trống", "ảnh"));
    reading.current = true; onReading?.(true); setError("");
    try { for (const file of chosen) await verifyPhotoFile(file); if (mounted.current) onChange(next); }
    catch (err) { if (mounted.current) setError(err.message); }
    finally { reading.current = false; if (mounted.current) onReading?.(false); }
  };
  const count = files.length, full = count >= max;
  const title = count ? `Đã chọn ${count}/${max} ảnh` : `${label} · ${required ? "Bắt buộc" : "Không bắt buộc"}`;
  const hint = full ? `Đã đủ ${max} ảnh. Xoá bớt nếu muốn thay ảnh khác.` : count ? "Có thể thêm ảnh khác · JPG hoặc PNG, mỗi ảnh ≤ 5 MB" : `JPG hoặc PNG, tối đa ${max} ảnh, mỗi ảnh ≤ 5 MB`;
  return <div className={`return-photos${count ? " return-photos--filled" : ""}${error ? " return-photos--error" : ""}`}>
    <div className="return-photos__box">
      <div className="return-photos__head">
        <span className="return-photos__icon"><Icon name={count ? "check" : "image"} size={20} /></span>
        <div><strong>{title}</strong><span className="hint">{hint}</span></div>
      </div>
      <div className="return-photos__list">{previews.map(({ file, url }, i) => <figure key={url}>
        <img src={url} alt={`${label} ${i + 1}`} />
        <figcaption>{file.name}</figcaption>
        <button type="button" className="return-photos__remove" disabled={disabled} onClick={() => onChange(files.filter((_, index) => index !== i))} aria-label={`Xoá ảnh ${i + 1}`}><Icon name="close" size={14} /></button>
      </figure>)}</div>
      <label className={`btn btn--outline return-photos__add${disabled || full ? " is-disabled" : ""}`}>
        <Icon name="plus" size={16} />{count ? "Thêm ảnh" : "Chọn ảnh"}
        <input className="visually-hidden" aria-label={label} type="file" accept="image/jpeg,image/png" multiple disabled={disabled || full} onChange={select} />
      </label>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
  </div>;
}
