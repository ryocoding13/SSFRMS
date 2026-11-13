import test from "node:test";
import assert from "node:assert/strict";
import { emailError, maskEmail, passwordErrors } from "../src/features/auth/passwordResetRules.js";
import { rateError, digits } from "../src/features/admin/demo/demoModel.js";
import { validateRemoval, OVERDUE_HOLDING_AREA, OVERDUE_MAX_PHOTOS } from "../src/features/facility-operations/settlements/settlementModel.js";

test("quên mật khẩu: email trống và sai định dạng là hai lỗi khác nhau", () => {
  assert.equal(emailError(""), "Vui lòng nhập email.");
  assert.equal(emailError("   "), "Vui lòng nhập email.");
  assert.match(emailError("mai@gmail"), /chưa đúng định dạng/);
  assert.equal(emailError("mai.nguyen@gmail.com"), "");
  assert.equal(maskEmail("mai.nguyen@gmail.com"), "m***@gmail.com");
});

test("quên mật khẩu: mật khẩu mới tối thiểu 8 ký tự và nhập lại phải khớp", () => {
  assert.match(passwordErrors("", "").password, /Vui lòng nhập/);
  assert.match(passwordErrors("1234567", "1234567").password, /8 ký tự/);
  assert.equal(passwordErrors("NewPass@1", "NewPass@2").confirm, "Mật khẩu nhập lại chưa khớp.");
  assert.deepEqual(passwordErrors("NewPass@1", "NewPass@1"), {});
});

test("chỉnh giá theo cơ sở: giá > 0, bội số 1.000", () => {
  assert.equal(digits("1.250.000 đ"), "1250000");
  assert.match(rateError(""), /trống/);
  assert.match(rateError("0"), /lớn hơn 0/);
  assert.match(rateError("1250500"), /1.000/);
  assert.equal(rateError("1.250.000"), "");
});

test("biên bản đồ quá hạn: 1 ô ảnh 1–10 tấm, nơi lưu giữ tự điền (D56)", () => {
  assert.equal(OVERDUE_HOLDING_AREA, "Khu tạm giữ đồ quá hạn");
  assert.equal(OVERDUE_MAX_PHOTOS, 10);
  const now = new Date("2026-10-28T12:00:00+07:00");
  const item = { status: "ASSIGNED", facilityId: 1, assignee: "Long", endDate: "2026-10-08" };
  const actor = { roles: ["STAFF"], name: "Long", facilityId: 1 };
  const photo = { name: "a.jpg", type: "image/jpeg", size: 20 };
  const p = { inventory: "2 thùng", performedAt: "2026-10-28T11:00", unitStatus: "INSPECTION", confirmed: true, photos: [photo] };
  assert.doesNotThrow(() => validateRemoval(item, p, {}, actor, now));
  assert.throws(() => validateRemoval(item, { ...p, photos: [] }, {}, actor, now), /ít nhất (1|một) ảnh/);
  assert.throws(() => validateRemoval(item, { ...p, photos: Array(11).fill(photo) }, {}, actor, now), /tối đa 10/);
  assert.throws(() => validateRemoval(item, { ...p, inventory: " " }, {}, actor, now), /tình trạng đồ/);
});
