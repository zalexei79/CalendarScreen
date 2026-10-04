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
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Bucharest'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await context.addInitScript(()=>{
  localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language','ru');localStorage.setItem('dayris_voice_feedback','off');
  localStorage.setItem('dayris_money_categories:guest',JSON.stringify(['Интернет']));
  localStorage.setItem('money_calendar_guest_trades_cache',JSON.stringify({
   '2026-09-27':[{id:'outside',instrument:'Продукты',pnl:-999,currency:'MDL',traderMode:false}],
   '2026-09-28':[{id:'food-week',instrument:'Продукты',pnl:-30,currency:'MDL',traderMode:false}],
   '2026-10-02':[{id:'food-eur',instrument:'Продукты',pnl:-40,currency:'EUR',traderMode:false},{id:'income',instrument:'Продукты',pnl:800,currency:'MDL',traderMode:false},{id:'gold',instrument:'XAUUSD',pnl:-500,currency:'MDL',platform:'cTrader',traderMode:true}],
   '2026-09-03':[{id:'car',instrument:'Транспорт',pnl:-200,currency:'USD',traderMode:false}],
   '2026-09-15':[{id:'internet-latest',instrument:'Интернет',time:'19:00',pnl:-80,currency:'MDL',traderMode:false},{id:'internet-earlier',instrument:'Интернет',time:'08:00',pnl:-60,currency:'MDL',traderMode:false}],
   '2026-08-01':[{id:'internet-old',instrument:'Интернет',pnl:-50,currency:'MDL',traderMode:false}],
  }));
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){window.voiceActive=true;this.onstart?.();}stop(){this.onend?.();}abort(){window.voiceActive=false;}};
  window.finishPhrase=phrase=>{window.voice.onresult({results:[Object.assign([{transcript:phrase}],{isFinal:true})]});window.voice.onend?.();};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-10-02T09:00:00Z'));
 await page.goto(origin);await page.locator('.calendar-days-grid').waitFor().catch(async error=>{console.log('UI errors',errors);console.log((await page.locator('body').innerText()).slice(0,900));throw error;});await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 const cache=()=>page.evaluate(()=>localStorage.getItem('money_calendar_guest_trades_cache'));
 const before=await cache();
 const say=async phrase=>{if(await page.locator('.voice-workspace').count())await page.waitForFunction(()=>window.voiceActive,null,{timeout:1200}).catch(()=>{});if(!await page.evaluate(()=>window.voiceActive)){const footer=page.locator('.voice-workspace .voice-workspace-mic');if(await footer.count())await footer.click();else await page.locator('.calendar-voice-button').click();}await page.waitForFunction(()=>window.voiceActive);await page.evaluate(phrase=>finishPhrase(phrase),phrase);};
 const closeHistory=()=>page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await say('Сколько потратил на еду на этой неделе?');
 const answer=page.locator('.calendar-voice-answer');await answer.waitFor();assert.match(await answer.textContent(),/30.*ле/);assert.match(await answer.textContent(),/40.*евро/);assert.doesNotMatch(await answer.textContent(),/999|500|800/);
 await answer.screenshot({path:'tests/financial-voice-answer.png',animations:'disabled'});
 await page.getByRole('button',{name:'Показать записи',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),2);
 assert.match(await page.locator('.voice-history-filter-note').textContent(),/голосового поиска/);
 await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();await page.getByRole('button',{name:'Сбросить поиск',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),9);
 await closeHistory();
 await say('Покажи расходы на машину за сентябрь');
 assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),1);assert.match(await page.getByRole('button',{name:'Редактировать запись',exact:true}).textContent(),/Транспорт/);
 await closeHistory();
 await say('Когда я последний раз платил за интернет?');await answer.waitFor();assert.match(await answer.textContent(),/15 сентября 2026.*80/);
 await page.getByRole('button',{name:'Показать записи',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),1);assert.match(await page.getByRole('button',{name:'Редактировать запись',exact:true}).textContent(),/19:00/);
 await closeHistory();
 await say('Сколько потратил на сок вчера?');await answer.waitFor();assert.match(await answer.textContent(),/не найдено/);assert.equal(await page.getByRole('button',{name:'Показать записи',exact:true}).count(),0);
 assert.equal(await page.locator('.calendar-voice-review').count(),0);assert.equal(await cache(),before,'voice queries never write records');
 assert.deepEqual(errors,[]);
 console.log('PASS: real speech flow, week totals, distinct currencies, exact evidence, car search, latest internet payment, reset, empty results and zero data writes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
