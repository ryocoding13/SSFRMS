import test from 'node:test';
import assert from 'node:assert/strict';
import { OPS_ACTIONS, loadBoard } from '../src/features/facility-operations/api/facilityOperationsApi.js';
import { composeData } from '../src/shared/api/apiMappers.js';

test('C12 metadata giữ mã truy cập, lịch sử và báo lỗi đọc chi tiết', () => {
  const detail = { ticketId: 7, contractId: 9, issueType: 'ACCESS_CODE', status: 'RESOLVED', title: 'Cấp lại QR',
    createdAt: '2026-10-23T01:00:00', assignedAt: '2026-10-23T02:00:00', resolvedAt: '2026-10-23T03:00:00', responsesError: true,
    responses: [{ message: 'Đã kiểm tra', staffName: 'Nhân viên A', createdAt: '2026-10-23T02:30:00' },
      { message: 'Đã cấp QR mới', staffName: 'Nhân viên A', createdAt: '2026-10-23T03:00:00' }] };
  const data = composeData({ catalog: { facilities: [], unitTypes: [] }, session: { user: { userId: 3 } }, overlay: {},
    remote: { reservations: [], contracts: [], tickets: [detail] }, timeoutSeconds: 600 });
  const t = data.tickets[0];
  assert.equal(t.topic, 'ACCESS'); assert.equal(t.responses_error, true);
  assert.deepEqual(t.responses.map(r => r.text), ['Đã kiểm tra', 'Đã cấp QR mới']);
  assert.equal(t.assigned_at, '2026-10-23T02:00:00.000Z');
  assert.equal(t.updated_at, '2026-10-23T03:00:00.000Z');
  assert.equal(t.closed_at, null); assert.equal(t.raw_status, 'RESOLVED');
});

test('Ghép C12/C13 giữ nguyên API nhận chìa khóa, cấp lại mã và gia hạn của main', () => {
  assert.deepEqual(OPS_ACTIONS.RECORD_KEY_RECEIPT({ id: 'BG-0001' }), ['POST', '/api/ops/keys/BG-0001/receipt']);
  assert.deepEqual(OPS_ACTIONS.TICKET_RESPONSE({ id: 'HT-0001', note: 'Đã xử lý', next: 'DONE' }),
    ['POST', '/api/ops/tickets/HT-0001/responses', { note: 'Đã xử lý', nextStatus: 'DONE' }]);
  assert.deepEqual(OPS_ACTIONS.REISSUE_CREDENTIAL({ unit: 'K01', type: 'PIN', reason: 'Quên mã' }),
    ['POST', '/api/staff/credentials/reissue', { unitCode: 'K01', credentialType: 'PIN', reason: 'Quên mã' }]);
  assert.deepEqual(OPS_ACTIONS.DECIDE_RENEWAL({ id: 'GH-0001', approve: true }), ['POST', '/api/ops/renewals/GH-0001/approve']);
});

test('Board null không làm trắng trang và lỗi phân quyền không chuyển sang API dự phòng', async () => {
  const original = globalThis.fetch;
  const paths = [];
  try {
    globalThis.fetch = async url => { paths.push(new URL(url).pathname); return new Response(JSON.stringify({ tickets: null, staff: null, returns: null, revenue: null }), { status: 200 }); };
    const board = await loadBoard('STAFF');
    assert.deepEqual(board.tickets, []); assert.deepEqual(board.staff, []); assert.deepEqual(board.returns, []);
    assert.deepEqual(board.revenue.months, []); assert.deepEqual(paths, ['/api/ops/board']);
    paths.length = 0;
    globalThis.fetch = async url => { paths.push(new URL(url).pathname); return new Response('{"error":"Không có quyền"}', { status: 403 }); };
    await assert.rejects(loadBoard('STAFF'), e => e.status === 403);
    assert.deepEqual(paths, ['/api/ops/board']);
  } finally { globalThis.fetch = original; }
});
