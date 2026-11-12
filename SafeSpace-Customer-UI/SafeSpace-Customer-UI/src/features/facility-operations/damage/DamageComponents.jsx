import React, { useEffect, useState } from "react";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import "./damage.css";
// Định dạng và ảnh bằng chứng dùng chung (không còn màn hồ sơ hư hỏng cũ, D48).
export const amountLabel = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? money(value) : "Chưa có dữ liệu";
export const timeLabel = value => value && Number.isFinite(Date.parse(value)) ? dateTimeLabel(value) : "Chưa có thông tin";
export const safeImageUrl = value => typeof value === "string" && (/^https?:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//")) || value.startsWith("data:image/"));
export function DamagePhotos({ photos = [], emptyText = "Chưa có ảnh bằng chứng từ cơ sở." }) {
  const valid = (Array.isArray(photos) ? photos : []).map(photo => {
    if (typeof photo === "string") return { url: photo, caption: "" };
    if (photo?.url) return photo;
    if (photo?.Url) return { url: photo.Url, caption: photo.Caption || "" };
    if (photo?.dataBase64) {
      const src = photo.dataBase64.startsWith("data:")
        ? photo.dataBase64
        : `data:${photo.contentType || "image/jpeg"};base64,${photo.dataBase64}`;
      return { url: src, caption: photo.fileName || photo.caption || "" };
    }
    return photo;
  }).filter(photo => safeImageUrl(photo?.url));
  // #17 · Figma M-ĐS-ẢNH: bấm ảnh mở lớn ngay trong trang (chuyển ảnh, Esc để đóng); vẫn có liên kết ảnh gốc.
  const [open, setOpen] = useState(-1);
  if (!valid.length) return <p className="hint">{emptyText}</p>;
  return <>
    <div className="damage-photos">{valid.map((photo,index) => <button type="button" key={`${photo.url}-${index}`} onClick={() => setOpen(index)} title={photo.caption || "Bấm để xem ảnh lớn"} aria-label={`Xem ảnh ${index+1}${photo.caption ? ` · ${photo.caption}` : ""}`}><img src={photo.url} alt={photo.caption || `Ảnh hiện trạng ${index+1}`} loading="lazy" />{photo.caption && <span>{photo.caption}</span>}</button>)}</div>
    {open >= 0 && <PhotoViewer photos={valid} index={open} onChange={setOpen} onClose={() => setOpen(-1)} />}
  </>;
}

function PhotoViewer({ photos, index, onChange, onClose }) {
  const n = photos.length, photo = photos[index];
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); if (e.key === "ArrowRight") onChange((index + 1) % n); if (e.key === "ArrowLeft") onChange((index - 1 + n) % n); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, n, onChange, onClose]);
  return <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="Xem ảnh hiện trạng" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="photo-viewer__box">
      <div className="photo-viewer__bar"><strong>Ảnh {index + 1}/{n}{photo.caption ? ` · ${photo.caption}` : ""}</strong><span><a href={photo.url} target="_blank" rel="noreferrer">Mở ảnh gốc</a><button type="button" onClick={onClose}>Đóng</button></span></div>
      <img src={photo.url} alt={photo.caption || `Ảnh hiện trạng ${index + 1}`} />
      {n > 1 && <div className="photo-viewer__nav"><button type="button" onClick={() => onChange((index - 1 + n) % n)}>‹ Trước</button><button type="button" onClick={() => onChange((index + 1) % n)}>Sau ›</button></div>}
    </div>
  </div>;
}
