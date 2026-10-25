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
try {
 for(const [width,height,mobile] of [[390,844,true],[320,640,true],[1440,1000,false]]) for(const theme of ['dark','light']) {
  const context=await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await installStoryAccount(context);
  await context.addInitScript(theme=>{localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language','ru');localStorage.setItem('atj_theme',theme);localStorage.setItem('atj_trader_mode','0');},theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(origin);await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
  await page.getByRole('button',{name:'Добавить',exact:true}).click();
  const composer=page.locator('.quick-money-composer');await composer.waitFor();await page.waitForTimeout(450);
  await page.getByRole('button',{name:'Добавить заметку',exact:true}).waitFor();
  assert.equal(await composer.locator('textarea').count(),0,'new entry hides optional details');
  assert.equal(await composer.getByRole('button',{name:'Категория',exact:true}).isVisible(),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const layout=await composer.evaluate(el=>{const box=el.getBoundingClientRect(),category=el.querySelector('.category-picker-trigger').getBoundingClientRect(),keypad=el.querySelector('.amount-keypad').getBoundingClientRect(),save=[...el.querySelectorAll('button')].find(b=>b.textContent==='Сохранить запись').getBoundingClientRect();return {height:box.height,top:box.top,bottom:box.bottom,inside:box.top>=0&&box.bottom<=innerHeight,categoryFirst:category.bottom<=keypad.top,saveVisible:save.bottom<=innerHeight&&save.top>=0,scroll:el.scrollHeight-el.clientHeight};});
  assert.ok(layout.inside&&layout.saveVisible&&layout.categoryFirst,JSON.stringify({width,height,theme,layout}));
  assert.ok(layout.scroll<3,'main composer needs no scrolling');
  assert.ok(layout.height<(mobile?590:450),'composer stays compact');
  assert.ok(await composer.getByRole('textbox',{name:'Сумма',exact:true}).evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=36),'amount remains the main visual anchor');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await composer.locator('.quick-money-category').evaluate(el=>getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  assert.equal(await composer.getByRole('button',{name:'+500',exact:true}).isVisible(),true);
  await composer.getByRole('button',{name:'+500',exact:true}).click();
  await composer.getByRole('button',{name:'+500',exact:true}).click();
  assert.equal(await composer.getByRole('textbox',{name:'Сумма',exact:true}).inputValue(),'1000');
  if(mobile) for(let i=0;i<4;i++) await composer.getByRole('button',{name:'Удалить цифру',exact:true}).click();
  if(mobile) {await composer.getByRole('button',{name:'8',exact:true}).click();await composer.getByRole('button',{name:'8',exact:true}).click();}else await composer.getByRole('textbox',{name:'Сумма',exact:true}).fill('88');
  assert.equal(await composer.getByRole('textbox',{name:'Сумма',exact:true}).inputValue(),'88');
  await composer.getByRole('combobox',{name:'Валюта',exact:true}).selectOption('EUR');
  await page.screenshot({path:'artifacts/quick-money-'+theme+'-'+width+'.png',animations:'disabled'});
  await composer.getByRole('button',{name:'Добавить заметку',exact:true}).click();
  await composer.locator('textarea').fill('Покупки на неделю');
  assert.equal(await composer.locator('input[type=time]').count(),1);
  await composer.getByRole('button',{name:'Скрыть детали',exact:true}).click();
  await composer.getByRole('button',{name:'Сохранить запись',exact:true}).click();
  await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')||'{}')).flat().some(x=>x.pnl===-88&&x.currency==='EUR'&&x.comment==='Покупки на неделю'));
  assert.deepEqual(errors,[]);await context.close();console.log('PASS',width,height,theme,JSON.stringify(layout));
 }
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
