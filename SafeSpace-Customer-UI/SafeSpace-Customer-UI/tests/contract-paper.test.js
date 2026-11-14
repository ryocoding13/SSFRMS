import test from "node:test";
import assert from "node:assert/strict";
import { captureScale, pageBreaks } from "../src/features/customer/contracts/contractPdf.js";

test("D58 · PDF hợp đồng: ngắt trang ở cuối đoạn, không cắt ngang dòng", () => {
  // đoạn kết thúc ở 300, 590, 610, 900, 1210; trang cao 600
  assert.deepEqual(pageBreaks(1210, 600, [300, 590, 610, 900, 1210]), [[0, 590], [590, 900], [900, 1210]]);
});

test("D58 · PDF hợp đồng: phụ lục luôn sang trang mới, đoạn quá dài thì cắt theo chiều cao trang", () => {
  assert.deepEqual(pageBreaks(1000, 600, [100, 200, 1000], [300]), [[0, 300], [300, 900], [900, 1000]]);
  assert.deepEqual(pageBreaks(500, 600, [500]), [[0, 500]]);
});

test("Mục 61 · PDF hợp đồng dài: hạ độ nét để ảnh chụp không vượt giới hạn canvas", () => {
  assert.equal(captureScale(605, 4000), 2); // hợp đồng ngắn giữ độ nét 2
  const s = captureScale(605, 20000);
  assert.ok(s < 2 && 605 * s * 20000 * s <= 16_000_000 + 1, "diện tích ≤ 16 triệu điểm ảnh (Safari)");
  assert.ok(captureScale(605, 40000) * 40000 <= 32000, "cạnh dài ≤ 32.000 px (Chrome/Edge)");
});
