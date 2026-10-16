import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "./UI";

// Vẽ một chuỗi (VietQR của PayOS, mã mở cửa…) thành ảnh QR SVG. Chưa có chuỗi → ô chờ như Figma C04 / C07q.
export default function QrCode({ value, label, title, caption, size = 200 }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let alive = true;
    if (!value) {
      setSvg("");
      return undefined;
    }
    QRCode.toString(String(value), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#10152a", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [value]);
  return (
    <figure className="qr">
      {svg ? (
        <div className="qr__code" style={{ width: `min(100%, ${size}px)` }} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="qr__code qr__code--loading qr__code--empty" style={{ width: `min(100%, ${size}px)` }} aria-busy={Boolean(value)}>
          <Icon name="qr" size={30} />
          {title && <strong>{title}</strong>}
        </div>
      )}
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
