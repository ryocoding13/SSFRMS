// #51 · Đọc mã QR từ khung hình camera của máy quét.
// Ưu tiên BarcodeDetector của trình duyệt (macOS, Android, ChromeOS). Chrome/Edge trên Windows không có
// BarcodeDetector → đọc bằng thư viện jsQR trên canvas, nên laptop Windows vẫn quét được bằng webcam.
import jsQR from "jsqr";

/** Lý do không mở được camera, dùng để chọn popup phù hợp. */
export function cameraProblem(win = globalThis) {
  if (win.isSecureContext === false) return "insecure";
  if (!win.navigator?.mediaDevices?.getUserMedia) return "missing";
  return null;
}

/** Đổi lỗi của getUserMedia thành trạng thái popup. */
export function cameraErrorState(error) {
  if (error?.name === "NotAllowedError" || error?.name === "SecurityError") return "blocked";
  if (error?.name === "NotReadableError") return "busy";
  return "missing";
}

/** Có dùng được BarcodeDetector cho QR không (có lớp nhưng nền tảng không hỗ trợ thì vẫn trả false). */
async function nativeDetector(win) {
  if (typeof win.BarcodeDetector !== "function") return null;
  try {
    const formats = await win.BarcodeDetector.getSupportedFormats?.();
    if (Array.isArray(formats) && !formats.includes("qr_code")) return null;
    return new win.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    return null;
  }
}

/** Đọc QR từ dữ liệu ảnh RGBA (tách riêng để kiểm thử bằng Node). */
export function decodeImageData(data, width, height) {
  const hit = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return hit?.data || null;
}

/**
 * Tạo bộ đọc QR cho một thẻ <video>. Trả về hàm detect(video) → nội dung mã hoặc null.
 * Khung hình được thu nhỏ còn tối đa 640 px để jsQR chạy nhanh trên laptop.
 */
export async function createQrReader(win = globalThis) {
  const native = await nativeDetector(win);
  if (native) {
    return async (video) => {
      const [hit] = await native.detect(video);
      return hit?.rawValue || null;
    };
  }
  const canvas = win.document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return async (video) => {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return decodeImageData(data, canvas.width, canvas.height);
  };
}
