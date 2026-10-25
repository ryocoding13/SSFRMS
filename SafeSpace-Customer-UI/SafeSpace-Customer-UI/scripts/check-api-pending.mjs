import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const server=spawn(process.execPath,['scripts/dev-business.mjs'],{env:{...process.env,MOCK_API_PORT:'5299',VITE_WORKFLOW_DEMO:'false'},stdio:'ignore'});
process.on('exit',()=>server.kill('SIGTERM'));
for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:5173');break;}catch{await new Promise(r=>setTimeout(r,150));}}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}),page=await browser.newPage();
await page.goto('http://127.0.0.1:5173/#/login');await page.locator('input').first().fill('staff01');await page.locator('input[type=password]').fill('Staff@123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.waitForFunction(()=>!location.hash.includes('/login'));
await page.goto('http://127.0.0.1:5173/#/staff/mismatch');await page.getByText(/Máy chủ chưa cung cấp dữ liệu/).waitFor();
assert.equal(await page.getByText('MÔ PHỎNG FE · Dữ liệu thử nghiệm, không thanh toán / chuyển tiền thật.').count(),0);
await page.getByLabel('Số tiền thực nhận').fill('100000');await page.getByLabel('Lý do / nội dung cần kiểm tra').fill('Giữ nguyên nội dung khi API chưa có.');await page.getByRole('button',{name:'Kiểm tra & gửi báo cáo'}).click();await page.getByRole('dialog').getByRole('button',{name:'Xác nhận',exact:true}).click();await page.getByRole('dialog').getByText(/Máy chủ chưa hỗ trợ lưu màn này/).waitFor();assert.equal(await page.getByRole('dialog').getByText('Đã lưu kết quả',{exact:true}).count(),0);await page.getByRole('dialog').getByRole('button',{name:'Quay lại',exact:true}).click();assert.equal(await page.getByLabel('Lý do / nội dung cần kiểm tra').inputValue(),'Giữ nguyên nội dung khi API chưa có.');assert.equal(await page.evaluate(()=>localStorage.getItem('safespace.approved-workflows.demo.v1')),null);
console.log(JSON.stringify({apiPending:true,noDemoFallback:true,preservedInput:true}));await browser.close();server.kill('SIGTERM');
