import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {installStoryAccount} from './life-story-auth-fixture.mjs';
const root=path.resolve('dist');
const server=http.createServer((request,response)=>{
 const name=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,name==='/'?'index.html':'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'text/html'});response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await installStoryAccount(context);
 await context.addInitScript(()=>{
  window.hapticPulses=[];Object.defineProperty(navigator,'vibrate',{value:duration=>{window.hapticPulses.push(duration);return true;}});localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language','ru');localStorage.setItem('dayris_voice_feedback','off');
  if(!localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')){
   const d=new Date(),dateKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   localStorage.setItem('money_calendar_trades_22222222-2222-4222-8222-222222222222',JSON.stringify({[dateKey]:[{id:'local-old-category',time:'10:00',instrument:'АКВАРИУМ',pnl:-20,currency:'MDL',platform:'Manual',traderMode:false}]}));
  }
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);
 const ready=async()=>{await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));};
 const cache=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')||'{}')).flat());
 await page.goto(origin);await ready();console.log('Ready');
 await page.getByRole('button',{name:'Добавить',exact:true}).click();
 assert.match(await page.getByRole('button',{name:'Расходы',exact:true}).getAttribute('class'),/bg-red-500/);
 assert.ok((await page.evaluate(()=>window.hapticPulses)).includes(10),'trusted button clicks pulse');
 await page.locator('.amount-digits').getByRole('button',{name:'5',exact:true}).click();
 await page.getByRole('button',{name:'0',exact:true}).click();
 await page.getByRole('button',{name:'Категория',exact:true}).click();console.log('Category picker');
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('Транспорт');
 const transport=page.getByRole('button',{name:'Транспорт',exact:true});
 assert.equal(await transport.locator('svg.lucide-car').count(),1);
 await transport.click();
 await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();
 await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')||'{}')).flat().length===2);
 assert.ok((await cache()).some(record=>record.instrument==='ТРАНСПОРТ'&&record.pnl===-50),'default entry saves as an expense');console.log('Transport saved');
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).waitFor({state:'detached'});
 await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await page.getByRole('button',{name:'Доходы',exact:true}).click();
 await page.locator('.amount-digits').getByRole('button',{name:'5',exact:true}).click();
 await page.getByRole('button',{name:'0',exact:true}).click();
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();
 await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')||'{}')).flat().length===3);
 assert.ok((await cache()).some(record=>record.instrument==='ЗАРПЛАТА'&&record.pnl===50),'explicit income remains positive');
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).waitFor({state:'detached'});
 await page.getByRole('button',{name:'Добавить',exact:true}).click();
 assert.match(await page.getByRole('button',{name:'Расходы',exact:true}).getAttribute('class'),/bg-red-500/,'a new entry defaults to expense after income');
 // Programmatic clicks and reduced-motion interactions must remain silent.
 await page.emulateMedia({reducedMotion:'reduce'});
 const before=await page.evaluate(()=>window.hapticPulses.length);
 await page.getByRole('button',{name:'Доходы',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.hapticPulses.length),before);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.getByRole('button',{name:'Расходы',exact:true}).evaluate(button=>button.click());
 assert.equal(await page.evaluate(()=>window.hapticPulses.length),before);
 await page.screenshot({path:'artifacts/expense-transport-mobile.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('PASS: expense default and negative transport save, explicit income, fresh-entry reset, trusted haptics, reduced motion and synthetic-click silence');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
