import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
const server = !process.env.QA_EXTERNAL_SERVER ? spawn(process.execPath, ['scripts/dev-demo.mjs'], { env: { ...process.env, MOCK_API_PORT: '5299' }, stdio: 'ignore' }) : null;
if (server) { for (let i=0;i<100;i++) { try { await fetch('http://127.0.0.1:5173'); break; } catch { await new Promise(r=>setTimeout(r,150)); } } }
process.on('exit',()=>server?.kill('SIGTERM'));
const output = process.env.QA_OUTPUT || 'test-results/approved-ui';
await fs.mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const roles=[
 ['manager01','Manager@123',['manager/refunds','manager/discrepancies','manager/discrepancy-detail?id=SL-0001','manager/overdue','manager/deposit-refunds']],
 ['staff01','Staff@123',['staff/mismatch','staff/renewal-payments','staff/overdue','staff/inquiries']],
 ['customer01','Customer@123',['refunds','policies','payments/history','inquiries','inquiries/HT-0091','units/HĐ-2026-0001/deposit','units/HĐ-2026-0001/progress','units/HĐ-2026-0001/renewal-status']],
 ['ops01','Ops@123',['business/policy-content','business/policy-status','business/rates','business/export']],
 ['admin','Admin@123',['admin','admin/new','admin/permissions','admin/logs']],
];
const results=[];
for(const [name,password,routes] of roles){
 await page.goto('http://127.0.0.1:5173/#/login');await page.evaluate(()=>{localStorage.removeItem('safespace.customer.session');});await page.reload();
 await page.locator('input').first().fill(name);await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
 await page.waitForFunction(()=>!location.hash.includes('/login'));
 for(const route of routes){
  await page.goto('http://127.0.0.1:5173/#/'+route);await page.waitForTimeout(250);
  const text=await page.locator('body').innerText();assert.ok(!/Không tìm thấy trang|Cannot read properties|undefined|NaN/.test(text),route);
  assert.ok(await page.locator('main h1').count(),route+' missing title');
  const label=route.replaceAll('/','-').replaceAll('?','-').replaceAll('=','-');
  await page.screenshot({path:output+'/'+label+'.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(80);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  results.push({route,mobileOverflow:overflow,title:await page.locator('main h1').first().innerText()});
  if(overflow)await page.screenshot({path:output+'/'+label+'-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
 }
}
assert.deepEqual(errors,[],'browser runtime errors');
await fs.writeFile(output+'/results.json',JSON.stringify({results,errors},null,2));console.log(JSON.stringify({routes:results.length,overflow:results.filter(r=>r.mobileOverflow),errors}));
await browser.close();
server?.kill("SIGTERM");
