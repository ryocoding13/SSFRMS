import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAccess } from "../src/shared/utils/access.js";
const c = { contract_id:'C1', unit_number:'K01', handed_over:true, status:'ACTIVE', start_date:'2026-10-01', end_date:'2026-10-31' };
const base = { contract:c, credential:{ owner:1, contractId:'C1', unit:'K01', date:'2026-10-16', code:'reference', backupCode:'12345678' }, code:'reference', unit:'K01', owner:1, date:'2026-10-16' };
test('QR hợp lệ và mã dự phòng',()=>{ assert.equal(validateAccess(base).allowed,true); assert.equal(validateAccess({...base,code:'1234 5678'}).allowed,true); });
for(const [name, patch] of Object.entries({ 'sai mã':{code:'bad'},'sai ô':{unit:'K02'}, 'khác chủ':{owner:2}, 'ngày mới':{date:'2026-10-17'}, 'hết hạn':{date:'2026-11-01'},'chưa bắt đầu':{date:'2026-09-30'}, 'chưa bàn giao':{contract:{...c,handed_over:false}},'đã trả kho':{contract:{...c,status:'ENDED'}},'không có hợp đồng':{contract:null} })) test(name,()=>assert.equal(validateAccess({...base,...patch}).allowed,false));
