import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
// Màn có API chưa được máy chủ giả lập cung cấp phải báo rõ "chưa cung cấp dữ liệu", không rơi về dữ liệu mô phỏng.
// Màn báo sai lệch (staff/mismatch) đã gỡ theo D42 nên kiểm bằng hai màn nhân viên còn chờ API trong chế độ này.
const server=spawn(process.execPath,['scripts/dev-business.mjs'],{env:{...process.env,MOCK_API_PORT:'5299',VITE_WORKFLOW_DEMO:'false'},stdio:'ignore'});
process.on('exit',()=>server.kill('SIGTERM'));
for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:5173');break;}catch{await new Promise(r=>setTimeout(r,150));}}
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}),page=await browser.newPage();
await page.goto('http://127.0.0.1:5173/#/login');await page.locator('input').first().fill('staff01');await page.locator('input[type=password]').fill('Staff@123');await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.waitForFunction(()=>!location.hash.includes('/login'));
const checked=[];
for(const route of ['staff/overdue','staff/cash-refunds']){
  await page.goto('http://127.0.0.1:5173/#/'+route);await page.getByText(/Máy chủ chưa cung cấp dữ liệu/).first().waitFor();
  assert.equal(await page.getByText('MÔ PHỎNG FE · Dữ liệu thử nghiệm, không thanh toán / chuyển tiền thật.').count(),0,route);
  assert.equal(await page.locator('.record-card').count(),0,route+' không được hiện dữ liệu mô phỏng');
  checked.push(route);
}
assert.equal(await page.evaluate(()=>localStorage.getItem('safespace.approved-workflows.demo.v1')),null);
console.log(JSON.stringify({apiPending:checked,noDemoFallback:true}));await browser.close();server.kill('SIGTERM');
