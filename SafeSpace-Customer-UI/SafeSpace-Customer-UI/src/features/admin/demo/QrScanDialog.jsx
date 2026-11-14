/**
 * Hộp quét QR bằng camera của máy quét mô phỏng (#51, D53).
 * Luôn xin quyền camera trước; đọc mã bằng BarcodeDetector nếu trình duyệt có,
 * không có (Chrome/Edge trên Windows) thì dùng jsQR. Không mở được camera → nêu đúng lý do,
 * vẫn cho dán mã hoặc quay lại nhập PIN.
 */
import React, { useEffect, useRef, useState } from "react";
import ConfirmDialog from "../../../shared/components/ConfirmDialog.jsx";
import { Button, Field, Modal } from "../../../shared/components/UI.jsx";
import { cameraErrorState, cameraProblem, createQrReader } from "./qrReader.js";

const CAMERA_TEXT = {
  missing: ["Không tìm thấy camera", "Thiết bị này không có camera hoặc camera đang tắt. Dán nội dung mã QR của khách bên dưới, hoặc dùng PIN 6 số."],
  busy: ["Camera đang bận", "Camera đang được ứng dụng khác sử dụng (ví dụ Zalo, Zoom, Teams). Đóng ứng dụng đó rồi bấm Thử lại, hoặc dán mã / dùng PIN."],
  insecure: ["Trang chưa được phép dùng camera", "Trình duyệt chỉ cho mở camera trên trang HTTPS hoặc localhost. Mở máy quét bằng địa chỉ localhost / HTTPS, hoặc dán mã / dùng PIN."],
};

export default function QrScanDialog({ onCode, onClose, onPin }) {
  const video = useRef(null);
  const [state, setState] = useState("starting"); // starting | live | blocked | missing | busy | insecure
  const [attempt, setAttempt] = useState(0);
  const [paste, setPaste] = useState("");
  useEffect(() => {
    let stream, timer, stop = false;
    setState("starting");
    (async () => {
      const problem = cameraProblem(window);
      if (problem) return setState(problem);
      try {
        // Hiện hộp hỏi quyền camera của trình duyệt; "environment" chỉ là ưu tiên, laptop vẫn dùng webcam trước
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stop) return stream.getTracks().forEach((t) => t.stop());
        video.current.srcObject = stream; await video.current.play(); setState("live");
        const detect = await createQrReader(window);
        const tick = async () => {
          if (stop) return;
          try { const code = await detect(video.current); if (code) return onCode(code); } catch { /* khung hình chưa sẵn sàng */ }
          timer = setTimeout(tick, 250);
        };
        tick();
      } catch (e) { if (!stop) setState(cameraErrorState(e)); }
    })();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()); };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state === "blocked") return <ConfirmDialog tone="warning" title="Trình duyệt đang chặn camera" label="Nhập PIN" cancelLabel="Đóng" hint=""
    text="Bấm biểu tượng ổ khoá cạnh thanh địa chỉ → Camera → Cho phép, rồi bấm lại “Mở cửa bằng QR”. Hoặc nhập PIN 6 số." onCancel={onClose} onConfirm={onPin} />;
  const problem = CAMERA_TEXT[state];
  return <Modal title={problem ? problem[0] : "Đưa mã QR vào camera"} size="md" onClose={onClose}>
    {problem
      ? <p className="modal__text">{problem[1]}</p>
      : <div className="demo-scan__video"><video ref={video} muted playsInline aria-label="Camera máy quét" />{state === "starting" && <span>Đang mở camera… Chọn “Cho phép” khi trình duyệt hỏi.</span>}</div>}
    <Field label="Hoặc dán nội dung mã QR"><input value={paste} placeholder="Ví dụ: SSQR-12-4821" onChange={(e) => setPaste(e.target.value)} /></Field>
    <div className="modal__actions modal__actions--end">
      {(state === "busy" || state === "missing") && <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>Thử lại</Button>}
      <Button variant="outline" onClick={onPin}>Nhập PIN</Button>
      <Button disabled={!paste.trim()} onClick={() => onCode(paste.trim())}>Quét mã này</Button>
    </div>
  </Modal>;
}
