import test from "node:test";
import assert from "node:assert/strict";
import { pageBreaks } from "../src/features/customer/contracts/contractPdf.js";

test("D58 · PDF hợp đồng: ngắt trang ở cuối đoạn, không cắt ngang dòng", () => {
  // đoạn kết thúc ở 300, 590, 610, 900, 1210; trang cao 600
  assert.deepEqual(pageBreaks(1210, 600, [300, 590, 610, 900, 1210]), [[0, 590], [590, 900], [900, 1210]]);
});

test("D58 · PDF hợp đồng: phụ lục luôn sang trang mới, đoạn quá dài thì cắt theo chiều cao trang", () => {
  assert.deepEqual(pageBreaks(1000, 600, [100, 200, 1000], [300]), [[0, 300], [300, 900], [900, 1000]]);
  assert.deepEqual(pageBreaks(500, 600, [500]), [[0, 500]]);
});
