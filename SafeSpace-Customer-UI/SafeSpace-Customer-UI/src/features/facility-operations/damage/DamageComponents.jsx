import React from "react";
import { dateTimeLabel, money } from "../../../shared/utils/format.js";
import "./damage.css";
// Định dạng và ảnh bằng chứng dùng chung (không còn màn hồ sơ hư hỏng cũ, D48).
export const amountLabel = value => typeof value === "number" && Number.isFinite(value) && value >= 0 ? money(value) : "Chưa có dữ liệu";
export const timeLabel = value => value && Number.isFinite(Date.parse(value)) ? dateTimeLabel(value) : "Chưa có thông tin";
const safeImageUrl = value => typeof value === "string" && (/^https:\/\//i.test(value) || (value.startsWith("/") && !value.startsWith("//")));
export function DamagePhotos({ photos = [] }) {
  const valid = (Array.isArray(photos) ? photos : []).filter(photo => safeImageUrl(photo?.url));
  return valid.length ? <div className="damage-photos">{valid.map((photo,index) => <a key={`${photo.url}-${index}`} href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.caption || `Ảnh bằng chứng ${index+1}`} loading="lazy" /></a>)}</div> : <p className="hint">Chưa có ảnh bằng chứng từ cơ sở.</p>;
}
