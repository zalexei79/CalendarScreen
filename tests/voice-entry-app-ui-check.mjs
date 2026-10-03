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
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){window.voiceActive=true;this.onstart?.();}stop(){this.onend?.();}abort(){window.voiceActive=false;}};
  window.finishPhrase=phrase=>{window.voice.onresult({results:[Object.assign([{transcript:phrase}],{isFinal:true})]});window.voice.onend?.();};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 const say=async phrase=>{if(await page.locator('.voice-workspace').count())await page.waitForFunction(()=>window.voiceActive,null,{timeout:1200}).catch(()=>{});if(!await page.evaluate(()=>window.voiceActive)){const footer=page.locator('.voice-workspace footer button');if(await footer.count())await footer.click();else await page.locator('.calendar-voice-button').click();}await page.waitForFunction(()=>window.voiceActive);await page.evaluate(phrase=>finishPhrase(phrase),phrase);};
 const cache=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}'));
 assert.equal(Object.values(await cache()).flat().length,0);
 await say('вчера на продукты 250 лей ушло');
 await page.locator('.calendar-voice-review').waitFor();assert.equal(Object.values(await cache()).flat().length,0,'review creates no stored record');
 await page.screenshot({path:'tests/voice-review-app.png',animations:'disabled'});
 await say('не 250, а 350');
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===1);
 const records=await cache(),dateKey=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()-1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});
 assert.equal(records[dateKey][0].pnl,-350);assert.equal(records[dateKey][0].currency,'MDL');assert.equal(records[dateKey][0].instrument,'ПРОДУКТЫ');
 await say('евро 100 сегодня пришло');
 await page.locator('.calendar-voice-review').waitFor();await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===2);
 await say('80 на сок, 50 на такси и 30к на монитор');
 await page.getByRole('button',{name:'L MDL',exact:true}).click();await page.locator('.calendar-voice-batch').waitFor();assert.equal(await page.locator('.calendar-voice-batch-row').count(),3);assert.equal(Object.values(await cache()).flat().length,2,'batch is reviewed before saving');
 await say('во второй записи сумма 60');assert.match(await page.locator('.calendar-voice-batch-row').nth(1).textContent(),/60 MDL/);
 await page.screenshot({path:'tests/voice-batch-app.png',animations:'disabled'});
 await page.getByRole('button',{name:'Сохранить всё',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===5);
 const savedBatch=Object.values(await cache()).flat();for(const [category,amount] of [['СОК',-80],['ТАКСИ',-60],['МОНИТОР',-30000]])assert.ok(savedBatch.some(record=>record.instrument===category&&record.pnl===amount&&record.currency==='MDL'),category);
 await page.reload();await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 assert.equal(Object.values(await cache()).flat().length,5,'saved records survive app reload');
 await say('в кошелек 80 лей ушло');
 assert.match(await page.locator('.calendar-voice-answer').textContent(),/PRO/);assert.equal(Object.values(await cache()).flat().length,5,'FREE cannot write to wallet');
 await page.getByRole('button',{name:'Закрыть голосовой режим'}).click();assert.deepEqual(errors,[]);
 console.log('PASS: full app batch, k shorthand, numbered corrections, review, amount correction, direct expense/income save, local dates, persistence and FREE wallet restriction');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
