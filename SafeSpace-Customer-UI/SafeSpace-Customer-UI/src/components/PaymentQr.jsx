import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { bankAccount } from "../config/payment";
import { vietQrPayload } from "../lib/vietqr";
import { Icon } from "./UI";

export default function PaymentQr({ amount, content }) {
  const [svg, setSvg] = useState("");
  const payload = vietQrPayload({ bin: bankAccount.bin, accountNo: bankAccount.accountNo, amount, content });
  useEffect(() => {
    let alive = true;
    QRCode.toString(payload, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#10152a", light: "#ffffff" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(""));
    return () => {
      alive = false;
    };
  }, [payload]);
  return (
    <figure className="qr">
      {svg ? (
        <div className="qr__code" role="img" aria-label={`Mã QR chuyển khoản ${content}`} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="qr__code qr__code--loading"><Icon name="qr" size={30} /></div>
      )}
      <figcaption>
        <strong>{bankAccount.bankName}</strong> · {bankAccount.accountNo}
        <br />
        {bankAccount.holder}
      </figcaption>
    </figure>
  );
}
