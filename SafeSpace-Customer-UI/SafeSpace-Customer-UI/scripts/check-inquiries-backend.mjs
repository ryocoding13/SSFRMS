import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
const host=spawn(process.env.DOTNET_EXECUTABLE||'dotnet',[resolve('../../tools/PasswordResetBrowserHost/bin/Debug/net10.0/PasswordResetBrowserHost.dll'),'--inquiries'],{cwd:resolve('../..'),stdio:['pipe','pipe','inherit']});
let browser,vite;
const apiReady=new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error('Hết thời gian chờ host T19')),20000);
 createInterface({input:host.stdout}).on('line',line=>{if(line.startsWith('INQUIRY_TEST_API=')){clearTimeout(timer);resolve(line.slice('INQUIRY_TEST_API='.length));}});
 host.on('exit',code=>{clearTimeout(timer);reject(new Error(`Host dừng: ${code}`));});
});
try {
 const api=await apiReady;
 vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort'],{env:{...process.env,VITE_USE_API:'true',VITE_API_URL:api,VITE_WORKFLOW_DEMO:'false'},stdio:'ignore'});
 for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:5180');break;}catch{await new Promise(r=>setTimeout(r,100));}}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
 const errors=[];
 async function login(username,password,path){
  const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5180/#/login');await page.getByLabel('Tên đăng nhập hoặc Email').fill(username);await page.getByLabel('Mật khẩu',{exact:true}).fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
  await page.waitForFunction(()=>!location.hash.startsWith('#/login'),null,{timeout:15000});await page.goto(`http://127.0.0.1:5180/#/${path}`);return page;
 }
 async function confirm(page){await page.getByRole('dialog').getByRole('button',{name:'Xác nhận',exact:true}).click();await page.getByRole('heading',{name:'Đã lưu kết quả',exact:true}).waitFor();await page.getByRole('button',{name:'Về hồ sơ',exact:true}).click();}
 const customer=await login('customer02','Customer@123','inquiries');
 await customer.getByLabel('Cơ sở cần hỗ trợ *',{exact:true}).selectOption('1');await customer.getByLabel('Chủ đề *',{exact:true}).fill('Tư vấn kho lạnh');await customer.getByLabel('Mô tả yêu cầu *',{exact:true}).fill('Chưa có hợp đồng, tôi cần kho lạnh 15 m².');await customer.getByRole('button',{name:'Gửi yêu cầu hỗ trợ',exact:true}).click();await confirm(customer);
 await customer.getByRole('link',{name:'Xem yêu cầu',exact:true}).click();await customer.getByRole('heading',{name:/TV-.*Tư vấn kho lạnh/}).waitFor();const detail=customer.url();
 const staff=await login('staff01','Staff@123','staff/inquiries');await staff.getByRole('button',{name:'Xem yêu cầu',exact:true}).click();await staff.getByLabel('Nội dung phản hồi *',{exact:true}).fill('Cơ sở có kho lạnh phù hợp.');await staff.getByRole('button',{name:'Kiểm tra & gửi phản hồi',exact:true}).click();await confirm(staff);
 await customer.reload();await customer.getByText('Cơ sở có kho lạnh phù hợp.',{exact:true}).waitFor();await customer.getByLabel('Nội dung phản hồi *',{exact:true}).fill('Cảm ơn, tôi đã được tư vấn.');await customer.getByRole('button',{name:'Kiểm tra & gửi phản hồi',exact:true}).click();await confirm(customer);
 await staff.reload();await staff.getByRole('button',{name:'Xem yêu cầu',exact:true}).click();await staff.getByText('Cảm ơn, tôi đã được tư vấn.',{exact:true}).waitFor();await staff.getByLabel('Nội dung phản hồi *',{exact:true}).fill('Đã hỗ trợ xong.');await staff.getByLabel('Đóng yêu cầu sau khi phản hồi').check();await staff.getByRole('button',{name:'Kiểm tra & gửi phản hồi',exact:true}).click();await confirm(staff);
 await customer.reload();await customer.getByText('Đã hỗ trợ xong.',{exact:true}).waitFor();assert.equal(await customer.getByLabel('Nội dung phản hồi *',{exact:true}).count(),0);await customer.setViewportSize({width:390,height:844});assert.equal(await customer.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await customer.screenshot({path:'/tmp/mai-inquiry-mobile.png',fullPage:true});
 const wrong=await login('staff02','Staff@123','staff/inquiries');const readDone=wrong.waitForResponse(r=>r.url().endsWith('/api/support/inquiries')&&r.request().method()==='GET');await wrong.reload();assert.deepEqual(await (await readDone).json(),[]);await wrong.getByRole('heading',{name:'Hỗ trợ khách chưa có hợp đồng',exact:true}).waitFor();assert.equal(await wrong.getByRole('button',{name:'Xem yêu cầu',exact:true}).count(),0);
 const other=await login('customer01','Customer@123','inquiries');await other.goto(detail);await other.getByText('Không tìm thấy yêu cầu thuộc tài khoản của bạn.',{exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS T19: khách không hợp đồng gửi, đúng cơ sở trả lời, khách phản hồi, cơ sở đóng, reload lưu đủ, khách/cơ sở khác không thấy, mobile không tràn.');
}finally{await browser?.close();vite?.kill('SIGTERM');host.stdin.end('stop\n');}
