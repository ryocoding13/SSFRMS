import React, { useEffect, useRef, useState } from "react";
import { GALLERY, facilityCard, galleryImage, heroImage } from "../config/media";
import { Icon } from "./UI";

// Hình vẽ dự phòng khi file ảnh chưa có hoặc tải lỗi (giữ nguyên bố cục)
function Art({ kind, seed = 1 }) {
  const doors = 7 + (seed % 3);
  if (kind === "plan") {
    const rooms = [];
    for (let i = 0; i < 5; i++) {
      rooms.push({ x: 80 + i * 78, y: 60, w: 78, h: 100, label: `${String(6 + i).padStart(2, "0")}`, cold: i > 2 });
      rooms.push({ x: 80 + i * 66, y: 250, w: 66, h: 80, label: `${String(i + 1).padStart(2, "0")}`, cold: i > 2 });
    }
    return (
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
        <rect width="600" height="400" fill="#fff" />
        <text x="80" y="42" fontSize="15" fill="#64748b">Sơ đồ mặt bằng</text>
        {rooms.map((r, i) => (
          <g key={i}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={r.cold ? "#dbeafe" : "#f8fafc"} stroke="#334155" strokeWidth="2" />
            <text x={r.x + r.w / 2} y={r.y + r.h / 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">
              {r.label}
            </text>
          </g>
        ))}
        <rect x="80" y="160" width="390" height="90" fill="#f1f5f9" stroke="#334155" strokeWidth="2" />
        <text x="275" y="210" textAnchor="middle" fontSize="15" fontWeight="700" fill="#334155">HÀNH LANG</text>
        <rect x="420" y="250" width="50" height="80" fill="#e2e8f0" stroke="#334155" strokeWidth="2" />
        <text x="80" y="372" fontSize="13" fill="#64748b">Kho thường · Kho lạnh (nền xanh)</text>
      </svg>
    );
  }
  if (kind === "aisle") {
    return (
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
        <rect width="600" height="400" fill="#e2e8f0" />
        <polygon points="0,0 230,120 230,270 0,400" fill="#2563eb" opacity=".85" />
        <polygon points="600,0 370,120 370,270 600,400" fill="#1d4ed8" opacity=".85" />
        <polygon points="230,120 370,120 370,270 230,270" fill="#cbd5e1" />
        <polygon points="0,400 230,270 370,270 600,400" fill="#f1f5f9" />
        {[60, 130, 190].map((x, i) => (
          <polygon key={i} points={`${x},${70 + i * 30} ${x + 45},${95 + i * 25} ${x + 45},${300 - i * 25} ${x},${330 - i * 30}`} fill="#fff" opacity=".3" />
        ))}
        <rect x="285" y="150" width="30" height="120" fill="#94a3b8" />
      </svg>
    );
  }
  if (kind === "shelf") {
    return (
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
        <rect width="600" height="400" fill="#f1f5f9" />
        {[0, 1, 2].map((r) => (
          <g key={r}>
            <rect x="60" y={70 + r * 100} width="480" height="8" fill="#2563eb" />
            {[0, 1, 2, 3, 4].map((c) => (
              <rect key={c} x={80 + c * 92} y={26 + r * 100 + (c % 2) * 8} width="70" height={44 - (c % 2) * 8} rx="3" fill={c % 2 ? "#ddb980" : "#c89d66"} />
            ))}
          </g>
        ))}
        <rect x="60" y="30" width="8" height="300" fill="#2563eb" />
        <rect x="532" y="30" width="8" height="300" fill="#2563eb" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfdbfe" />
          <stop offset="1" stopColor="#eff6ff" />
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill={`url(#sky-${seed})`} />
      <rect y="320" width="600" height="80" fill="#cbd5e1" />
      <polygon points="70,150 300,70 530,150 530,320 70,320" fill="#e2e8f0" />
      <polygon points="70,150 300,70 530,150 500,150 300,90 100,150" fill="#94a3b8" />
      <rect x="180" y="118" width="240" height="46" rx="6" fill="#2563eb" />
      <text x="300" y="150" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff">SafeSpace</text>
      {Array.from({ length: doors }).map((_, i) => (
        <g key={i}>
          <rect x={92 + i * (416 / doors)} y="200" width={416 / doors - 8} height="120" fill="#2563eb" />
          {[0, 1, 2, 3, 4].map((l) => (
            <line key={l} x1={96 + i * (416 / doors)} x2={84 + (i + 1) * (416 / doors) - 8} y1={214 + l * 20} y2={214 + l * 20} stroke="#fff" strokeOpacity=".45" />
          ))}
        </g>
      ))}
    </svg>
  );
}

const ART_KIND = { cover: "front", "inside-1": "shelf", "inside-2": "aisle", "inside-3": "shelf", "inside-4": "aisle", plan: "plan" };

/**
 * Ảnh cơ sở.
 * - mặc định: ảnh đại diện (thẻ cơ sở)
 * - `index` (0–5): ảnh trong thư viện C03c (0 = mặt tiền, 1–4 = bên trong kho, 5 = sơ đồ)
 * - `hero`: ảnh hero trang chủ
 */
export function Photo({ facility, index, className = "", badge, hero = false, eager = false }) {
  const id = facility?.facility_id || 1;
  const item = index === undefined ? null : galleryImage(facility || id, index);
  const src = hero ? heroImage : item ? item.src : facilityCard(facility || id);
  const alt = hero
    ? "Cơ sở kho tự phục vụ SafeSpace"
    : `${facility?.name || "SafeSpace"}${item ? ` — ${item.caption}` : ""}`;
  const [failed, setFailed] = useState(false);
  return (
    <div className={`photo${item?.fit === "contain" ? " photo--contain" : ""} ${className}`}>
      {!failed ? (
        <img src={src} alt={alt} loading={eager || hero ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} />
      ) : (
        <Art kind={hero || !item ? "front" : ART_KIND[item.id]} seed={id} />
      )}
      {badge && <span className="photo__badge">{badge}</span>}
    </div>
  );
}

export function Lightbox({ facility, index, onIndex, onClose }) {
  const ref = useRef(null);
  const total = GALLERY.length;
  const prev = () => onIndex((index - 1 + total) % total);
  const next = () => onIndex((index + 1) % total);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onIndex((index - 1 + total) % total);
      if (e.key === "ArrowRight") onIndex((index + 1) % total);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, total, onClose, onIndex]);
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={`Ảnh ${facility.name}`} tabIndex={-1} ref={ref}>
      <div className="lightbox__top">
        <strong>{facility.name}</strong>
        <button type="button" className="lightbox__round" onClick={onClose} aria-label="Đóng thư viện ảnh">
          <Icon name="close" size={20} />
        </button>
      </div>
      <div className="lightbox__stage">
        <button type="button" className="lightbox__round" onClick={prev} aria-label="Ảnh trước">
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}><Icon name="chevron" size={22} /></span>
        </button>
        <Photo facility={facility} index={index} className="lightbox__photo" eager />
        <button type="button" className="lightbox__round" onClick={next} aria-label="Ảnh sau">
          <Icon name="chevron" size={22} />
        </button>
      </div>
      <p className="lightbox__count" aria-live="polite">{index + 1} / {total}</p>
      <div className="lightbox__thumbs">
        {GALLERY.map((g, i) => (
          <button type="button" key={g.id} className={i === index ? "is-active" : ""} onClick={() => onIndex(i)} aria-label={g.caption} aria-current={i === index}>
            <Photo facility={facility} index={i} />
          </button>
        ))}
      </div>
      <p className="lightbox__caption">{GALLERY[index].caption}</p>
    </div>
  );
}
