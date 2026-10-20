import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {DEMO_SESSION_KEY} from '../src/features/auth/demoCalendar.js';
const root=path.resolve('dist');
const server=http.createServer((request,response)=>{
 const name=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,name==='/'?'index.html':'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'text/html'});response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await context.addInitScript(key=>{sessionStorage.setItem(key,'1');localStorage.setItem('atj_language','uk');localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');},DEMO_SESSION_KEY);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('.calendar-days-grid').first().waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 assert.equal(await page.locator('html').getAttribute('lang'),'uk');
 for(const label of await page.locator('.calendar-weekdays').allTextContents())assert.equal(label,'ПнВтСрЧтПтСбНд');
 await page.locator('[data-site-element=settings]').click();
 await page.getByRole('button',{name:/Мова/}).click();await page.getByRole('button',{name:/Українська/}).waitFor();
 await page.getByRole('button',{name:/English/}).click();
 await page.waitForFunction(()=>document.querySelector('.calendar-weekdays')?.textContent==='MonTueWedThuFriSatSun');
 await page.getByRole('button',{name:/Українська/}).click();
 await page.waitForFunction(()=>document.querySelector('.calendar-weekdays')?.textContent==='ПнВтСрЧтПтСбНд');
 await page.getByRole('button',{name:'Закрити налаштування',exact:true}).click();
 await page.locator('[data-site-element=settings]').click();await page.getByRole('button',{name:/Валюта нових записів/}).click();
 await page.getByRole('button',{name:/UAH.*Українська гривня/}).click();assert.equal(await page.evaluate(()=>localStorage.getItem('atj_entry_currency')),'UAH');
 await page.getByRole('button',{name:'Закрити налаштування',exact:true}).click();
 await page.getByRole('button',{name:'Історія',exact:true}).click();await page.getByRole('button',{name:'Поділитися',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('PASS: full app Ukrainian history, real settings language switches and persisted UAH entry currency');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
