// #51: máy quét đọc được QR trên trình duyệt không có BarcodeDetector (Chrome/Edge Windows) bằng jsQR,
// và luôn xin quyền camera trước khi báo lỗi.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import QRCode from "qrcode";
import { cameraErrorState, cameraProblem, decodeImageData } from "../src/features/admin/demo/qrReader.js";

/** Vẽ mã QR thành ảnh RGBA (mỗi ô 8 px, viền trắng 4 ô) như một khung hình camera. */
function qrImage(text) {
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size, cell = 8, quiet = 4, size = (n + quiet * 2) * cell;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!qr.modules.get(y, x)) continue;
    for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) {
      const i = (((y + quiet) * cell + dy) * size + (x + quiet) * cell + dx) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  }
  return { data, size };
}

test("jsQR đọc đúng mã mở cửa từ khung hình", () => {
  const { data, size } = qrImage("SSQR-12-4A1F9C2B");
  assert.equal(decodeImageData(data, size, size), "SSQR-12-4A1F9C2B");
  assert.equal(decodeImageData(new Uint8ClampedArray(64 * 64 * 4).fill(255), 64, 64), null, "khung trắng không có mã");
});

test("chỉ báo không có camera khi thật sự không mở được, không chặn vì thiếu BarcodeDetector", () => {
  const withCam = { isSecureContext: true, navigator: { mediaDevices: { getUserMedia() {} } } };
  assert.equal(cameraProblem(withCam), null, "có camera, không có BarcodeDetector → vẫn mở camera");
  assert.equal(cameraProblem({ isSecureContext: true, navigator: {} }), "missing");
  assert.equal(cameraProblem({ isSecureContext: false, navigator: {} }), "insecure");
  assert.equal(cameraErrorState({ name: "NotAllowedError" }), "blocked");
  assert.equal(cameraErrorState({ name: "NotReadableError" }), "busy");
  assert.equal(cameraErrorState({ name: "NotFoundError" }), "missing");
  const src = readFileSync(new URL("../src/features/admin/demo/DoorScannerTool.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /typeof window\.BarcodeDetector !== "function"\) return setState/, "không bỏ qua bước xin quyền camera");
  assert.match(src, /createQrReader/);
  assert.match(src, /pressDigit\("0"\)/, "phím 0 bấm được (D53)");
  assert.match(src, /adminApi\.scan\(code, unit, facilityId\)/, "máy quét gửi kèm cơ sở");
});
