import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVnDeadline, validateDamageFiles, vnDateTimeInput } from '../src/features/facility-operations/damage/damageModel.js';
// D48: luồng hồ sơ hư hỏng cũ (Batch06) đã gỡ; còn kiểm các hàm dùng chung cho ảnh bằng chứng và giờ Việt Nam.

test('hạn theo giờ Việt Nam: đổi đúng sang UTC, không nhận ngày cuộn sai', () => {
  assert.equal(parseVnDeadline('2026-10-29T17:00'), '2026-10-29T10:00:00.000Z');
  for (const date of ['2026-02-30T17:00', '2026-10-29', 'bad']) assert.throws(() => parseVnDeadline(date));
  assert.equal(vnDateTimeInput(new Date('2026-10-29T10:00:00Z')), '2026-10-29T17:00');
});

test('ảnh đính kèm: tối đa 5 ảnh JPG/PNG, mỗi ảnh không quá 5 MB', () => {
  assert.doesNotThrow(() => validateDamageFiles([]));
  assert.doesNotThrow(() => validateDamageFiles([{ type: 'image/png', size: 100 }]));
  assert.throws(() => validateDamageFiles(Array(6).fill({ type: 'image/png', size: 1 })));
  assert.throws(() => validateDamageFiles([{ type: 'application/pdf', size: 1 }]));
  assert.throws(() => validateDamageFiles([{ type: 'image/png', size: 6 * 1024 * 1024 }]));
});
