/**
 * Xuất hợp đồng giấy (Figma C07g) thành tệp PDF khổ A4 ngay trên trình duyệt.
 *
 * - Chụp tờ hợp đồng trong khung xem (html2canvas) rồi chia trang A4 (jsPDF).
 * - Ngắt trang ở cuối đoạn / dòng bảng, không cắt ngang dòng chữ; tiêu đề điều khoản đi cùng đoạn sau.
 * - Phụ lục chính sách luôn sang trang mới; chân trang "HĐ-… · Trang x/y" vẽ bằng canvas để giữ dấu tiếng Việt.
 * Thư viện chỉ tải khi khách bấm "Tải PDF" để không làm nặng trang.
 */

const PAGE_W = 210; // mm
const PAGE_H = 297;
const MARGIN_X = 20;
const MARGIN_TOP = 18;
const MARGIN_BOTTOM = 20;
const CONTENT_W = PAGE_W - MARGIN_X * 2;
const CONTENT_H = PAGE_H - MARGIN_TOP - MARGIN_BOTTOM;
const SCALE = 2; // độ nét ảnh chụp mong muốn
// Giới hạn canvas của trình duyệt: Chrome/Edge tối đa 32.767 px mỗi cạnh, Safari (iPhone) tối đa ~16,7 triệu điểm ảnh.
// Hợp đồng dài vượt giới hạn thì html2canvas trả ảnh rỗng/ném lỗi, nên hạ độ nét cho vừa.
const MAX_CANVAS_SIDE = 32000;
const MAX_CANVAS_AREA = 16_000_000;

/** Độ nét lớn nhất (≤ SCALE) để ảnh chụp tờ hợp đồng w×h px CSS không vượt giới hạn canvas. */
export function captureScale(width, height) {
  if (!(width > 0 && height > 0)) return SCALE;
  const bySide = MAX_CANVAS_SIDE / Math.max(width, height);
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  return Math.max(0.5, Math.min(SCALE, bySide, byArea));
}

// Bố cục khi xuất: tờ rộng đúng vùng nội dung A4, bỏ viền / bóng của bản xem trên màn hình
const EXPORT_CSS = `html,body{background:#fff!important;padding:0!important;margin:0!important}
.sheet{max-width:none!important;width:${CONTENT_W}mm!important;margin:0!important;padding:0!important;border:0!important;box-shadow:none!important}
.annex{margin-top:0!important;padding-top:0!important;border-top:0!important}`;

/** Chọn các điểm ngắt trang (px theo tờ hợp đồng), ưu tiên cuối đoạn gần đáy trang nhất. */
export function pageBreaks(totalHeight, pageHeight, safeBottoms, forcedTops = []) {
  const bottoms = [...new Set(safeBottoms.map(Math.round))].sort((a, b) => a - b);
  const forced = [...new Set(forcedTops.map(Math.round))].sort((a, b) => a - b);
  const pages = [];
  let start = 0;
  while (start < totalHeight - 1) {
    const limit = start + pageHeight;
    const force = forced.find((top) => top > start + 1 && top < limit);
    let end = force ?? (limit >= totalHeight ? totalHeight : 0);
    if (!end) {
      const fit = bottoms.filter((b) => b > start + pageHeight * 0.4 && b <= limit);
      end = fit.length ? fit[fit.length - 1] : limit;
    }
    pages.push([start, end]);
    start = end;
  }
  return pages;
}

export async function downloadContractPdf(frame, { code, fileName }) {
  const doc = frame?.contentDocument;
  const sheet = doc?.querySelector(".sheet") || doc?.body;
  if (!sheet) throw new Error("Chưa tải xong hợp đồng.");
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

  const style = doc.createElement("style");
  style.textContent = EXPORT_CSS;
  doc.head.appendChild(style);
  try {
    if (doc.fonts?.ready) await doc.fonts.ready;
    const top = sheet.getBoundingClientRect().top;
    const pxPerMm = sheet.getBoundingClientRect().width / CONTENT_W;
    const rel = (el, edge) => el.getBoundingClientRect()[edge] - top;
    // Điểm ngắt an toàn: cuối đoạn, cuối dòng bảng, cuối dòng thông tin, cuối phần ký (không dùng cuối tiêu đề)
    const safe = [...sheet.querySelectorAll("p, tr, .row, .sign, h1")].map((el) => rel(el, "bottom"));
    const forced = [...sheet.querySelectorAll(".annex")].map((el) => rel(el, "top"));
    const total = sheet.scrollHeight;
    const pages = pageBreaks(total, CONTENT_H * pxPerMm, safe, forced);

    const width = sheet.getBoundingClientRect().width;
    const shot = await html2canvas(sheet, { scale: captureScale(width, total), backgroundColor: "#ffffff", useCORS: true, logging: false,
      windowWidth: doc.documentElement.scrollWidth, windowHeight: Math.max(total, doc.documentElement.scrollHeight) });
    if (!shot?.width || !shot?.height) throw new Error("Trình duyệt không chụp được tờ hợp đồng.");
    const ratio = shot.width / sheet.getBoundingClientRect().width; // px ảnh trên mỗi px CSS
    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const pagePx = { w: Math.round(PAGE_W * pxPerMm * ratio), h: Math.round(PAGE_H * pxPerMm * ratio) };

    pages.forEach(([from, to], index) => {
      const canvas = document.createElement("canvas");
      canvas.width = pagePx.w;
      canvas.height = pagePx.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Trình duyệt không cấp được vùng vẽ cho trang PDF.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const sy = Math.round(from * ratio);
      const sh = Math.min(Math.round((to - from) * ratio), shot.height - sy);
      const dx = Math.round(MARGIN_X * pxPerMm * ratio);
      const dy = Math.round(MARGIN_TOP * pxPerMm * ratio);
      if (sh > 0) ctx.drawImage(shot, 0, sy, shot.width, sh, dx, dy, shot.width, sh);
      // Chân trang
      ctx.fillStyle = "#5b6b82";
      ctx.font = `italic ${Math.round(12 * ratio)}px "Times New Roman", Tinos, serif`;
      ctx.textAlign = "right";
      ctx.fillText(`${code} · Trang ${index + 1}/${pages.length}`, canvas.width - dx, canvas.height - Math.round(10 * pxPerMm * ratio));
      if (index > 0) pdf.addPage("a4", "portrait");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, PAGE_W, PAGE_H);
    });
    pdf.setProperties({ title: `Hợp đồng ${code}`, author: "SafeSpace" });
    pdf.save(fileName);
    return pages.length;
  } finally {
    style.remove();
  }
}

/** Phương án dự phòng: mở hộp thoại In của tờ hợp đồng (mẫu đã có @page A4) để khách chọn "Lưu dưới dạng PDF". */
export function printContract(frame) {
  const win = frame?.contentWindow;
  if (!win || typeof win.print !== "function") return false;
  try { win.focus(); win.print(); return true; } catch { return false; }
}
