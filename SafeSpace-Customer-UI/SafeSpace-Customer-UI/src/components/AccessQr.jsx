import React, { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Modal, Notice } from "./UI";
import { useAccessQr } from "../state/useAccessQr";
import { accessError } from "../lib/access";
import { dateLabel, today } from "../lib/format";
import { typeLabel } from "../lib/catalog";
import check from "../assets/access/check.svg";
import close from "../assets/access/close.svg";
import "../styles/access-qr.css";

export default function AccessQr({ contract, facility, user }) {
  const [opened, setOpened] = useState(false);
  const [credential, setCredential] = useState(null);
  const [svg, setSvg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { getCredential, scan } = useAccessQr(contract.contract_id);
  const dismiss = useCallback(() => { setOpened(false); setResult(null); setCredential(null); setSvg(""); setError(""); }, []);
  useEffect(() => { dismiss(); }, [contract.contract_id, user.user_id, dismiss]);
  const open = async () => {
    setBusy(true); setError("");
    try {
      const value = await getCredential();
      const image = await QRCode.toString(value.code, { type: "svg", margin: 2, width: 176, errorCorrectionLevel: "M" });
      setCredential(value); setSvg(image); setOpened(true);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  const scanCode = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { setResult(await scan(credential, credential.code, contract.unit_number)); }
    catch (e) { setResult({ allowed: false, message: e.message }); }
    finally { setBusy(false); }
  };
  const unavailable = accessError(contract, today());
  return <div className="c07-access">
    <Button onClick={open} disabled={busy || Boolean(unavailable)} title={unavailable || undefined}>{busy ? "Đang xử lý…" : (contract.handed_over ? "Mở cửa kho" : "Mở cửa kho (QR)")}</Button>
    {error && <Notice tone="error">{error}</Notice>}
    {opened && credential && <Modal title={result ? (result.allowed ? "Mở cửa" : "Từ chối") : `QR mở cửa · Kho ${contract.unit_number}`} onClose={dismiss} size={result ? (result.allowed ? "c07-access-allowed" : "c07-access-denied") : "c07-access-qr"}>
      {result ? <div className="access-result-content" role="status">
        <img className="access-result-icon" src={result.allowed ? check : close} alt="" />
        <p className="access-scanner-label">CỬA KHO {contract.unit_number} · MÁY QUÉT</p>
        <p className="access-result-title">{result.allowed ? "Mở cửa" : "Từ chối"}</p>
        <p className="access-result-description">{result.allowed ? <>{user.full_name} · {contract.contract_id}<br />{new Date(result.at).toLocaleString("vi-VN")} · Đã ghi nhật ký ra vào</> : <>{result.message}<br />Liên hệ nhân viên cơ sở nếu cần hỗ trợ.</>}</p>
        <Button variant="outline" onClick={() => setResult(null)}>Quay lại</Button>
      </div> : <>
        <p className="access-subtitle">{facility.name}{contract.location ? ` · ${contract.location}` : ""}</p>
        <button type="button" className="access-code" onClick={scanCode} disabled={busy} aria-label="Quét QR mở cửa">
          <span className="access-code-image" dangerouslySetInnerHTML={{ __html: svg }} />
          <strong>QR mở cửa</strong>
          <span>Mã riêng cho hợp đồng {contract.contract_id}</span>
        </button>
        <dl className="access-details">
          <div><dt>Mã dự phòng</dt><dd>{credential.backupCode.replace(/(.{4})(.{4})/, "$1 $2")}</dd></div>
          <div><dt>Ô kho</dt><dd>{contract.unit_number} · {typeLabel(contract.type)}</dd></div>
          <div><dt>Hiệu lực đến</dt><dd>{dateLabel(contract.end_date)}</dd></div>
        </dl>
        <p className="access-help">Đưa mã vào máy quét ở cửa kho. Nếu không quét được, nhập mã dự phòng. Mã hết hiệu lực khi trả kho hoặc hợp đồng hết hạn.</p>
        <Button variant="outline" block onClick={dismiss}>Đóng</Button>
      </>}
    </Modal>}
  </div>;
}
