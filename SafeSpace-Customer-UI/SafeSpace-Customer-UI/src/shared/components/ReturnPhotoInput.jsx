import React, { useEffect, useRef, useState } from "react";
import { Button, Notice } from "./UI.jsx";
import { validateReturnPhotos, verifyPhotoFile } from "../utils/refundRequest.js";
export default function ReturnPhotoInput({ files, onChange, disabled, onReading, label = "Tải ảnh kho trống", required = true }) {
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
    const next = [...files, ...chosen], invalid = validateReturnPhotos(next);
    if (invalid) return setError(required ? invalid : invalid.replaceAll("ảnh kho trống", "ảnh đính kèm"));
    reading.current = true; onReading?.(true); setError("");
    try { for (const file of chosen) await verifyPhotoFile(file); if (mounted.current) onChange(next); }
    catch (err) { if (mounted.current) setError(err.message); }
    finally { reading.current = false; if (mounted.current) onReading?.(false); }
  };
  return <div className="return-photos">
    <label className="return-photos__upload"><span>{label} · {required ? "Bắt buộc" : "Không bắt buộc"}</span><span className="hint">JPG hoặc PNG, tối đa 5 ảnh, mỗi ảnh ≤ 5 MB</span><input aria-label={label} type="file" accept="image/jpeg,image/png" multiple disabled={disabled} onChange={select} /></label>
    {error && <Notice tone="error">{error}</Notice>}
    <div className="return-photos__list">{previews.map(({file,url},i) => <figure key={url}><img src={url} alt={`${label} ${i+1}`} /><figcaption>{file.name}</figcaption><Button variant="outline" disabled={disabled} onClick={() => onChange(files.filter((_,index) => index !== i))} aria-label={`Xoá ảnh ${i+1}`}>Xoá</Button></figure>)}</div>
  </div>;
}
