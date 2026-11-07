import React from "react";
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
  return valid.length ? <div className="damage-photos">{valid.map((photo,index) => <a key={`${photo.url}-${index}`} href={photo.url} target="_blank" rel="noreferrer" title={photo.caption || "Bấm để mở ảnh gốc trong tab mới"}><img src={photo.url} alt={photo.caption || `Ảnh bằng chứng ${index+1}`} loading="lazy" /></a>)}</div> : <p className="hint">{emptyText}</p>;
}
