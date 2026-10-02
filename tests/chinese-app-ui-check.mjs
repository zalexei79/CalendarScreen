import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {translate} from '../src/shared/i18n/index.js';
const root=path.resolve('dist');
const server=http.createServer((request,response)=>{
 const name=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,name==='/'?'index.html':'.'+name);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':name.endsWith('.png')?'image/png':'text/html'});response.end(fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await context.addInitScript(()=>{
  localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language','zh-CN');localStorage.setItem('dayris_voice_feedback','off');
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){}};
  window.finishPhrase=phrase=>{window.voice.onresult({results:[Object.assign([{transcript:phrase}],{isFinal:true})]});window.voice.onend?.();};
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(origin);await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 const cache=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}'));
 assert.equal(Object.values(await cache()).flat().length,0);
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>finishPhrase('昨天支出250元用于食品'));
 await page.locator('.calendar-voice-review').waitFor();assert.equal(Object.values(await cache()).flat().length,0,'review creates no stored record');
 await page.screenshot({path:'tests/chinese-app.png',animations:'disabled'});
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>finishPhrase('不对，350元'));
 await page.getByRole('button',{name:'保存',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===1);
 const records=await cache(),dateKey=await page.evaluate(()=>{const date=new Date();date.setDate(date.getDate()-1);return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;});
 assert.equal(records[dateKey][0].pnl,-350);assert.equal(records[dateKey][0].currency,'CNY');assert.equal(records[dateKey][0].instrument,'ПРОДУКТЫ');
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>finishPhrase('收入100欧元'));
 await page.locator('.calendar-voice-review').waitFor();await page.getByRole('button',{name:'保存',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')||'{}')).flat().length===2);
 await page.reload();await page.locator('.calendar-days-grid').waitFor();await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 assert.equal(Object.values(await cache()).flat().length,2,'saved records survive app reload');
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>finishPhrase('支出80元保存到钱包'));
 assert.match(await page.locator('.calendar-voice-answer').textContent(),/PRO/);assert.equal(Object.values(await cache()).flat().length,2,'FREE cannot write to wallet');
 await page.getByRole('button',{name:'关闭语音模式'}).click();
 await page.locator('.calendar-voice-button').click();await page.evaluate(()=>finishPhrase('打开历史'));
 await page.getByRole('button',{name:'分享',exact:true}).waitFor();
 for (const language of ['ru','en','md','zh-CN']) {
  const localizedContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await localizedContext.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  await localizedContext.addInitScript(language=>{
   localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language',language);
  },language);
  const localizedPage=await localizedContext.newPage();localizedPage.on('pageerror',error=>errors.push(error.message));
  await localizedPage.goto(origin);await localizedPage.locator('.calendar-days-grid').waitFor();await localizedPage.waitForFunction(()=>!document.getElementById('boot-screen'));
  await localizedPage.getByRole('button',{name:translate(language,'history'),exact:true}).click();
  await localizedPage.getByRole('button',{name:({ru:'Поделиться',en:'Share',md:'Distribuie','zh-CN':'分享'})[language],exact:true}).waitFor();
  await localizedContext.close();
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: full app review, amount correction, direct expense/income save, local dates, persistence and FREE wallet restriction');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
