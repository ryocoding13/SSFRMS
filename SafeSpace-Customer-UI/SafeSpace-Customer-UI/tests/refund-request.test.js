import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRefundBank, validateReturnPhotos, verifyPhotoFile, MAX_PHOTO_BYTES } from '../src/shared/utils/refundRequest.js';
import { submitCancellation, submitReturnRequest } from '../src/shared/api/refundRequestApi.js';
import { createSeedData } from '../src/app/data/appSeed.js';
import { pendingReturn } from '../src/app/state/appSelectors.js';
import { reduce } from '../src/app/state/appReducer.js';
const bank = {bankName:'Vietcombank',accountNumber:'00123456789',accountHolder:'NGUYEN THI MAI'};
const photo = new File([new Uint8Array([137,80,78,71,13,10,26,10])], 'empty.png', {type:'image/png'});
const payload = {bank,photos:[photo],emptied:true,date:'2026-12-21',slot:'09:00–09:30',notes:'Đã dọn kho'};
test('tài khoản chính chủ: giữ số 0 đầu, so tên có/không dấu, chặn sai người và sai số', () => {
  assert.equal(validateRefundBank(bank,'Nguyễn Thị Mai'),'');
  for (const number of ['12345','12345678901234567890','12 345678','12345a','']) assert.ok(validateRefundBank({...bank,accountNumber:number}));
  assert.ok(validateRefundBank({...bank,accountHolder:'Nguyễn Thị May'},'Nguyễn Thị Mai'));
  assert.ok(validateRefundBank({...bank,bankName:' '}));
  assert.ok(validateRefundBank({...bank,accountHolder:' '}));
});
test('ảnh kho trống: bắt buộc, giới hạn số lượng/dung lượng và phát hiện giả đuôi', async () => {
  assert.equal(validateReturnPhotos([photo]),'');
  for (const photos of [[],Array(6).fill(photo),[{type:'image/png',size:MAX_PHOTO_BYTES+1}],[{type:'image/svg+xml',size:10}],[{type:'image/png',size:0}]]) assert.ok(validateReturnPhotos(photos));
  await verifyPhotoFile(photo);
  await assert.rejects(verifyPhotoFile(new File(['not an image'],'empty.png',{type:'image/png'})));
});
test('API cũ hoặc thiếu dữ liệu: không POST, không đọc nội dung ảnh', async () => {
  let posted = 0, read = 0;
  const api = {currentRentalPolicy:async()=>({}), requestMoveOut:async()=>posted++, cancelReservation:async()=>posted++};
  await assert.rejects(submitReturnRequest(api,1,payload,null,async()=>read++));
  await assert.rejects(submitCancellation(api,1,'',bank,true));
  await assert.rejects(submitReturnRequest(api,1,{...payload,photos:[]}));
  assert.equal(posted,0); assert.equal(read,0);
  await submitCancellation(api,1,'Không còn nhu cầu',null,false);
  assert.equal(posted,1); // Đơn chưa thanh toán không cần ngân hàng.
});
test('API được hỗ trợ: gửi đủ ngân hàng, ảnh; lỗi máy chủ không thành công giả', async () => {
  const calls = [];
  const api = {currentRentalPolicy:async()=>({returnRequestSupported:true,cancellationBankSupported:true}), requestMoveOut:async(...args)=>calls.push(args),cancelReservation:async(...args)=>calls.push(args)};
  await submitReturnRequest(api,7,payload,'Nguyễn Thị Mai',async()=>({fileName:'empty.png',contentType:'image/png',dataBase64:'abc'}));
  assert.deepEqual(calls[0],[7,{date:payload.date,slot:payload.slot,note:payload.notes,...bank,emptied:true,photos:[{fileName:'empty.png',contentType:'image/png',dataBase64:'abc'}]}]);
  await submitCancellation(api,8,'Đổi kế hoạch',bank,true,'Nguyễn Thị Mai');
  assert.deepEqual(calls[1],[8,'Đổi kế hoạch',bank]);
  api.requestMoveOut=async()=>{throw new Error('mạng lỗi');};
  await assert.rejects(submitReturnRequest(api,7,payload,null,async()=>({})),/mạng lỗi/);
});
test('demo trả kho: lưu ngân hàng/metadata, khoá access, không tạo yêu cầu trùng', () => {
  const s = createSeedData('2026-09-21'); s.returns=[];s.renewals=[];
  const c=s.contracts.find(c=>c.contract_id==='HĐ-2026-0142');
  c.start_date='2026-09-20';
  const action={type:'REQUEST_RETURN',payload:{...payload,contract_id:c.contract_id}};
  const ctx={now:new Date('2026-09-21T09:00:00+07:00')};
  for (const change of [{bank:null},{photos:[]},{emptied:false}]) assert.ok(reduce(s,{...action,payload:{...action.payload,...change}},ctx).error);
  const out=reduce(s,action,ctx);assert.equal(out.error,undefined);
  assert.equal(out.state.contracts.find(x=>x.contract_id===c.contract_id).access_issued,false);
  assert.deepEqual(out.state.returns[0].refund_bank,bank);
  assert.deepEqual(out.state.returns[0].photos,[{name:'empty.png',type:'image/png',size:8}]);
  assert.ok(reduce(out.state,action,ctx).error);
});
test('demo huỷ đơn: chặn sau ngày bắt đầu và thiếu xác nhận; lưu ngân hàng đúng số tiền', () => {
  const s=createSeedData('2026-09-21');const r=s.reservations.find(r=>r.reservation_id==='SS-20260914-0142');
  r.start_date='2026-10-01';
  const a={type:'CANCEL_RESERVATION',payload:{reservation_id:r.reservation_id,bank,bankConfirmed:true}};
  const ctx={now:new Date('2026-09-21T09:00:00+07:00')};
  assert.ok(reduce(s,{...a,payload:{...a.payload,bankConfirmed:false}},ctx).error);
  const out=reduce(s,a,ctx);assert.equal(out.error,undefined);
  const cancelled=out.state.reservations.find(x=>x.reservation_id===r.reservation_id);
  assert.deepEqual(cancelled.refund_bank,bank);assert.equal(cancelled.refund_amount,4485000);assert.equal(cancelled.refund_status,'PENDING');
  assert.ok(reduce(s,a,{now:new Date('2026-10-01T09:00:00+07:00')}).error);
});

test('RETURN_PENDING từ server vẫn chặn thao tác khi thiết bị chưa có overlay lịch hẹn', () => {
  const s = createSeedData('2026-09-21'); s.returns=[]; s.contracts[0].status='RETURN_PENDING';
  const pending = pendingReturn(s,s.contracts[0].contract_id);
  assert.ok(pending); assert.equal(pending.date,undefined);
});
