// Lượt 1 (#34): tiền hiển thị đầy đủ. (#7 xem tests/luot4b-nav.test.js)
import test from "node:test";
import assert from "node:assert/strict";
import { shortMoney } from "../src/features/business/utils/businessFormat.js";

// #7 (#7 bổ sung 12/11): kiểm tra navbar mới ở tests/luot4b-nav.test.js — không còn tab dưới navbar.

test("#34: tiền ở báo cáo Vận hành KD hiển thị đầy đủ, không rút gọn", () => {
  assert.equal(shortMoney(28_300_000), "28.300.000 đ");
  assert.equal(shortMoney(1_080_000_000), "1.080.000.000 đ");
  assert.equal(shortMoney(0), "0 đ");
  assert.equal(shortMoney(null), "Chưa có dữ liệu");
  assert.ok(!/triệu|tỷ/.test(shortMoney(92_400_000)));
});
