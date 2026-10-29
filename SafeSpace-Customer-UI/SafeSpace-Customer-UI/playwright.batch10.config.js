import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./tests',testMatch:'batch10-browser.spec.js',workers:1,fullyParallel:false,reporter:'list',timeout:30000,
 projects:[1440,768,390].map(width=>({name:`chromium-${width}`,use:{viewport:{width,height:900}}})),
 use:{baseURL:'http://127.0.0.1:5173',browserName:'chromium',timezoneId:'Asia/Ho_Chi_Minh',locale:'vi-VN',launchOptions:process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH,args:['--no-sandbox','--disable-dev-shm-usage']}:{},screenshot:'off'},
 webServer:{command:'npm run dev:demo',url:'http://127.0.0.1:5173',reuseExistingServer:false},
});
