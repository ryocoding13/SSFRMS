import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { bankAccount } from "../config/payment";
import { vietQrPayload } from "../lib/vietqr";
import { Icon } from "./UI";

export default function PaymentQr({ amount, content, payOSQrCode, checkoutUrl, loading = false }) {
  const [svg, setSvg] = useState("");

  // Determine PayOS checkout link
  const payOSUrl =
    checkoutUrl ||
    (payOSQrCode && (payOSQrCode.startsWith("http://") || payOSQrCode.startsWith("https://")) && !payOSQrCode.includes("vietqr.io")
      ? payOSQrCode
      : null);

  // Check if it's an actual image file URL
  const isImageUrl =
    Boolean(
      payOSQrCode &&
        !payOSUrl &&
        (payOSQrCode.startsWith("data:image/") ||
          /\.(png|jpe?g|svg|webp)(\?.*)?$/i.test(payOSQrCode) ||
          payOSQrCode.includes("img.vietqr.io"))
    );

  // Payload for generating the QR code:
  // 1. PayOS checkout link (so scanning opens the PayOS payment link)
  // 2. Or PayOS raw VietQR code if provided and not an image
  // 3. Fallback to standard VietQR payload
  const payload =
    payOSUrl ||
    (!isImageUrl && payOSQrCode) ||
    vietQrPayload({ bin: bankAccount.bin, accountNo: bankAccount.accountNo, amount, content });

  useEffect(() => {
    let alive = true;
    if (loading || isImageUrl) {
      setSvg("");
      return;
    }
    QRCode.toString(payload, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#10152a", light: "#ffffff" },
    })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [payload, isImageUrl, loading]);

  if (loading) {
    return (
      <figure className="qr">
        <div className="qr__code qr__code--loading" style={{ display: "grid", placeItems: "center", minHeight: "200px" }}>
          <Icon name="qr" size={32} />
          <span style={{ fontSize: "12px", color: "var(--muted)", marginTop: "8px" }}>Đang kết nối payOS...</span>
        </div>
        <figcaption>Đang chuẩn bị mã thanh toán...</figcaption>
      </figure>
    );
  }

  if (isImageUrl) {
    return (
      <figure className="qr">
        <img
          src={payOSQrCode}
          alt={`Mã payOS VietQR ${content}`}
          className="qr__code"
          style={{ width: "200px", height: "200px", objectFit: "contain", background: "#ffffff", borderRadius: "10px", padding: "8px" }}
        />
        <figcaption>
          <strong>payOS VietQR</strong> · Mã đơn {content}
          <br />
          Quét mã bằng app ngân hàng để thanh toán
        </figcaption>
      </figure>
    );
  }

  const isPayOS = Boolean(payOSUrl && (payOSUrl.includes("payos.vn") || payOSUrl.includes("pay.payos.vn")));

  return (
    <figure className="qr">
      {svg ? (
        payOSUrl ? (
          <a
            href={payOSUrl}
            target="_blank"
            rel="noreferrer"
            title="Nhấn để mở liên kết thanh toán payOS"
            style={{ display: "block", textDecoration: "none", cursor: "pointer" }}
          >
            <div className="qr__code" role="img" aria-label={`Mã QR liên kết thanh toán payOS ${content}`} dangerouslySetInnerHTML={{ __html: svg }} />
          </a>
        ) : (
          <div className="qr__code" role="img" aria-label={`Mã QR chuyển khoản ${content}`} dangerouslySetInnerHTML={{ __html: svg }} />
        )
      ) : (
        <div className="qr__code qr__code--loading"><Icon name="qr" size={30} /></div>
      )}
      <figcaption>
        {isPayOS ? (
          <>
            <strong>Liên kết thanh toán payOS</strong> · Mã đơn {content}
            <br />
            Quét mã bằng camera hoặc ứng dụng để mở thanh toán payOS
            {payOSUrl && (
              <>
                <br />
                <a
                  href={payOSUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-block", marginTop: "4px", fontSize: "12px", color: "var(--blue)", textDecoration: "underline", fontWeight: 600 }}
                >
                  Mở trang thanh toán payOS ↗
                </a>
              </>
            )}
          </>
        ) : (
          <>
            <strong>{bankAccount.bankName}</strong> · {bankAccount.accountNo}
            <br />
            {bankAccount.holder}
          </>
        )}
      </figcaption>
    </figure>
  );
}


