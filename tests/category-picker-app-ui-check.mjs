import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
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
 await context.addInitScript(()=>{
  localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language','ru');localStorage.setItem('dayris_voice_feedback','off');
  if(!localStorage.getItem('money_calendar_guest_trades_cache')){
   const d=new Date(),dateKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   localStorage.setItem('money_calendar_guest_trades_cache',JSON.stringify({[dateKey]:[{id:'old-category',time:'10:00',instrument:'АКВАРИУМ',pnl:-20,currency:'MDL',platform:'Manual',traderMode:false}]}));
  }
  if(!localStorage.getItem('dayris_money_categories:guest'))localStorage.setItem('dayris_money_categories:guest',JSON.stringify(['Сок','Такси','Монитор',...Array.from({length:90},(_,i)=>'Раздел '+i)]));
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){}};
  window.finishPhrase=phrase=>{window.voice.onresult({results:[Object.assign([{transcript:phrase}],{isFinal:true})]});window.voice.onend?.();};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const ready=async()=>{await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));};
 const cache=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat());
 await page.goto(origin);await ready();assert.equal((await cache()).length,1);
 await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await page.getByRole('button',{name:'Расходы',exact:true}).click();
 await page.getByRole('button',{name:'50',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('аквариум');
 await page.getByRole('button',{name:'Закрепить АКВАРИУМ',exact:true}).click();
 await page.getByRole('button',{name:'АКВАРИУМ',exact:true}).click();await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 assert.equal((await cache()).length,1,'category selection never saves the entry');
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===2);
 assert.ok((await cache()).some(record=>record.instrument==='АКВАРИУМ'&&record.pnl===-50));
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>finishPhrase('80 лей на сок'));
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===3);
 await page.getByRole('button',{name:'Закрыть голосовой режим'}).click();
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 await page.getByRole('dialog',{name:'Разделы'}).waitFor();assert.equal(await page.locator('.category-picker-quick .category-picker-choice').textContent(),'АКВАРИУМ');
 assert.ok((await page.locator('.category-picker-list .category-picker-choice').allTextContents()).includes('Сок'));
 await page.screenshot({path:'tests/category-picker-app.png',animations:'disabled'});
 await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 assert.equal(await page.getByRole('button',{name:'Сохранить запись',exact:true}).isVisible(),true,'Escape closes only category picker');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Сохранить запись',exact:true}).waitFor({state:'detached'});
 await page.getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:/^Фильтры/}).click();
 await page.locator('.category-picker-trigger').click();await page.getByRole('textbox',{name:'Найти раздел'}).fill('аквариум');
 await page.getByRole('button',{name:'АКВАРИУМ',exact:true}).click();await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 assert.match(await page.locator('.category-picker-trigger').textContent(),/АКВАРИУМ/);assert.equal((await cache()).length,3,'history filter preserves records');
 await page.reload();await ready();await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 assert.equal(await page.locator('.category-picker-quick .category-picker-choice').textContent(),'АКВАРИУМ');assert.deepEqual(errors,[]);
 console.log('PASS: real app manual/voice saves, legacy category discovery, shared favorites/recents, persistence, nested Escape and history filter');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
