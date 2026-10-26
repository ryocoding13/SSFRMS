import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createSeedData } from '../src/app/data/appSeed.js';
import { createOpsData, OPS_ACCOUNTS } from '../src/features/facility-operations/data/facilityOperationsSeed.js';
process.env.VITE_USE_API='false';
const server=await createServer({server:{host:'127.0.0.1',port:5186,strictPort:true}});
await server.listen();
let browser;
try {
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 async function open(route,role) {
  await page.goto('http://127.0.0.1:5186');
  const data=createSeedData();
  data.ledger.push({ref:'LEGACY-FEE',kind:'DAMAGE_FEE',fee:true,amount:999999,payable:true,status:'UNPAID',label:'Không được thu phí cũ'});
  await page.evaluate(({data,ops,account})=>{localStorage.setItem('safespace.ops.v1',JSON.stringify(ops));}, {data,ops:createOpsData(),account:OPS_ACCOUNTS.find(a=>a.role===role)||null});
  // Key lấy từ module đang chạy, không giả định key dữ liệu khách.
  await page.evaluate(async ({data,account})=>{const {STORAGE_KEY}=await import('/src/app/state/AppProvider.jsx');localStorage.setItem(STORAGE_KEY,JSON.stringify({version:5,authed:true,data,opsUser:account}));},{data,account:OPS_ACCOUNTS.find(a=>a.role===role)||null});
  await page.goto('http://127.0.0.1:5186/#/'+route); await page.reload();
 }
 await open('payments');
 await page.getByRole('heading',{name:'Thanh toán & lịch hẹn'}).waitFor();
 assert.equal(await page.getByText('Không được thu phí cũ').count(),0);
 assert.equal(await page.getByRole('button',{name:'Thanh toán phí tại quầy'}).count(),0);
 assert.ok(await page.getByRole('button',{name:'Thanh toán',exact:true}).count()>0);
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.setViewportSize({width:1440,height:1000});
 await open('staff/fees?id=PHI-0086','STAFF');
 await page.getByText('Không tìm thấy trang',{exact:true}).waitFor();
 await open('staff/return?id=TK-0098','STAFF');
 const cleaning=page.getByLabel('Phí vệ sinh',{exact:true});
 await cleaning.waitFor(); assert.equal(await cleaning.isDisabled(),true);
 await page.getByLabel('Kho cần vệ sinh trước khi cho thuê lại').check();
 assert.equal(await cleaning.inputValue(),'115000');
 await page.getByLabel('Phí hư hỏng',{exact:true}).fill('2000000');
 await page.getByRole('button',{name:'Gửi biên bản và phí cho quản lý'}).click();
 await page.getByText('Nhập lý do thu phí.',{exact:true}).waitFor();
 await page.getByLabel('Lý do thu phí',{exact:true}).fill('Vết bẩn và hỏng tường');
 await page.getByRole('button',{name:'Gửi biên bản và phí cho quản lý'}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Xác nhận gửi biên bản',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'Về danh sách trả kho',exact:true}).click();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('safespace.ops.v1')));
 assert.equal(saved.returns.find(r=>r.id==='TK-0098').report.cleaning_fee,115000);
 // Chuyển vai trò, giữ biên bản vừa gửi.
 await page.evaluate(async account=>{const {STORAGE_KEY}=await import('/src/app/state/AppProvider.jsx');const state=JSON.parse(localStorage.getItem(STORAGE_KEY));state.opsUser=account;localStorage.setItem(STORAGE_KEY,JSON.stringify(state));},OPS_ACCOUNTS.find(a=>a.role==='MANAGER'));
 await page.goto('http://127.0.0.1:5186/#/manager/contracts?id=HĐ-0098');await page.reload();
 await page.getByRole('button',{name:'Xác nhận trả kho',exact:true}).click();
 assert.doesNotMatch(await page.getByRole('dialog').innerText(),/Còn nợ|Tổng còn phải thu/);
 await page.getByRole('dialog').getByRole('button',{name:'Xác nhận trả kho',exact:true}).click();
 await page.getByRole('heading',{name:'Đã chốt trả kho',exact:true}).waitFor();
 const settled=await page.evaluate(()=>JSON.parse(localStorage.getItem('safespace.ops.v1')));
 assert.equal(settled.contracts.find(c=>c.id==='HĐ-0098').refund_status,'PENDING');
 assert.equal(settled.contracts.find(c=>c.id==='HĐ-0098').refund_amount,0);
 assert.equal(settled.units.find(u=>u.code==='K04').status,'MAINTENANCE');
 assert.deepEqual(errors,[]);
 console.log('D32 browser PASS: C11 legacy fee hidden / renewal retained / mobile; S09f inaccessible; S04 fixed cleaning + validation + save; M07 zero refund + PENDING + maintenance. Local simulation only.');
} finally {await browser?.close();await server.close();}
