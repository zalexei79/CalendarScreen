import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root=path.resolve('dist');
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:['src/main.jsx'],bundle:true,write:false,outfile:'voice-test.js',format:'iife',define:{'process.env.NODE_ENV':'"production"','import.meta.env':JSON.stringify({VITE_SUPABASE_URL:'https://local-fixture.supabase.co',VITE_SUPABASE_ANON_KEY:'local-test-key'})}});
const utility=fs.readFileSync(path.join(root,'assets',fs.readdirSync(path.join(root,'assets')).find(file=>file.endsWith('.css'))),'utf8');
const server=http.createServer((request,response)=>{
 const name=new URL(request.url,'http://localhost').pathname,file=path.resolve(root,name==='/'?'index.html':'.'+name);
 if(name==='/__voice-test.js'||name==='/__voice-test.css'){const js=name.endsWith('.js');response.writeHead(200,{'Content-Type':js?'text/javascript':'text/css'});response.end((js?'':utility)+bundle.outputFiles.find(file=>file.path.endsWith(js?'.js':'.css')).text);return;}
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){response.writeHead(404);response.end();return;}
 response.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html'});response.end(name==='/'?fs.readFileSync(file,'utf8').replace(/\/assets\/index-[^" ]+\.js/g,'/__voice-test.js').replace(/\/assets\/index-[^" ]+\.css/g,'/__voice-test.css'):fs.readFileSync(file));
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,timezoneId:'Europe/Bucharest'});
 await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await context.addInitScript(()=>{
  for(const [key,value] of Object.entries({dayris_onboarding_v2_completed:'1',calendar_guide_completed:'1',atj_language:'ru',dayris_voice_feedback:'off',atj_currency:'MDL'}))localStorage.setItem(key,value);
  localStorage.setItem('dayris_money_categories:guest',JSON.stringify(['Такси','Авто','Интернет','Обед']));
  localStorage.setItem('money_calendar_guest_trades_cache',JSON.stringify({
   '2026-10-02':[{id:'taxi-a',time:'18:00',instrument:'Такси',pnl:-80,currency:'MDL',platform:'Manual',comment:'первая'},{id:'taxi-b',time:'09:00',instrument:'Такси',pnl:-60,currency:'MDL',platform:'Manual',comment:'вторая'},{id:'food-now',instrument:'Продукты',pnl:-30,currency:'MDL',platform:'Manual'}],
   '2026-09-25':[{id:'food-past',instrument:'Продукты',pnl:-50,currency:'MDL',platform:'Manual'},{id:'transport-past',instrument:'Транспорт',pnl:-40,currency:'MDL',platform:'Manual'}],
   '2026-09-15':[{id:'internet',instrument:'Интернет',pnl:-80,currency:'MDL',platform:'Manual',comment:'keep'}],
  }));
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){window.voiceActive=true;this.onstart?.();}stop(){}abort(){window.voiceActive=false;}};
  window.emitPhrase=(phrase,interim=false)=>window.voice.onresult?.({results:[Object.assign([{transcript:phrase}],{isFinal:!interim})]});
 });
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&message.text().includes('[DAYRIS]'))console.log(message.text());});
 await page.clock.setFixedTime(new Date('2026-10-03T09:00:00Z'));await page.goto(origin);
 await page.locator('.calendar-days-grid').waitFor().catch(async error=>{console.log('UI errors',errors);console.log((await page.locator('body').innerText()).slice(0,1200));throw error;});await page.waitForFunction(()=>!document.getElementById('boot-screen'));
 const answer=page.locator('.calendar-voice-answer'),review=page.locator('.calendar-voice-review'),surface=page.locator('.voice-workspace');
 const say=async phrase=>{if(await surface.count())await page.waitForFunction(()=>window.voiceActive,null,{timeout:1200}).catch(()=>{});if(!await page.evaluate(()=>window.voiceActive)){if(await surface.count())await surface.locator('footer button').click();else if(await page.locator('.calendar-voice-button').isVisible())await page.locator('.calendar-voice-button').click();else await page.locator('.day-voice-entry').click();}await page.waitForFunction(()=>window.voiceActive);await page.evaluate(phrase=>emitPhrase(phrase),phrase);};
 const waitAnswer=async pattern=>{await page.waitForFunction(pattern=>new RegExp(pattern).test(document.querySelector('.calendar-voice-answer')?.textContent||''),pattern.source).catch(async error=>{console.log('Expected',pattern,'surface',await surface.innerText(),'cache',await cache());throw error;});};
 const cache=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache')));
 const rows=()=>page.evaluate(()=>Object.entries(JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache'))).flatMap(([dateKey,items])=>items.map(item=>({...item,dateKey}))));
 const before=await cache();
 await say('Вчера: продукты 350, такси 80, обед 120 — всё в леях');await page.locator('.calendar-voice-batch-row').nth(2).waitFor().catch(async error=>{console.log('batch UI',await page.locator('body').innerText());throw error;});
 assert.equal(await page.locator('.calendar-voice-batch-row').count(),3);assert.match(await surface.innerText(),/2026-10-02/);assert.deepEqual(await cache(),before,'review never saves');
 await surface.screenshot({path:'tests/voice-workspace-batch.png',animations:'disabled'});
 await say('Сохрани всё');await waitAnswer(/Сохранено записей: 3/);assert.equal((await rows()).length,9);
 await say('Отмени это');await waitAnswer(/Отменено/);assert.equal((await rows()).length,6);
 await say('Восстанови');await waitAnswer(/Восстановлено/);assert.equal((await rows()).length,9);
 await say('Вчера такси было 100, а не 60');await page.locator('.voice-mutation-diff').waitFor();assert.match(await page.locator('.voice-mutation-diff').innerText(),/60.*100/s);
 await say('Нет, 110');await page.waitForFunction(()=>document.querySelector('.voice-mutation-diff')?.textContent.includes('110'));await say('Сохрани');await waitAnswer(/Сумма исправлена/);const changed=(await rows()).find(row=>row.id==='taxi-b');assert.equal(changed.pnl,-110);assert.equal(changed.comment,'вторая');assert.equal((await rows()).length,9);
 await say('Отмени это');await waitAnswer(/Отменено/);assert.equal((await rows()).find(row=>row.id==='taxi-b').pnl,-60);
 await say('Восстанови');await waitAnswer(/Восстановлено/);assert.equal((await rows()).find(row=>row.id==='taxi-b').pnl,-110);
 await say('Вчера такси было 150');await page.locator('.voice-workspace-choices').waitFor();assert.equal(await review.count(),0);
 await say('Вторую');await page.locator('.voice-mutation-diff').waitFor();await say('Сохрани');await waitAnswer(/Сумма исправлена/);assert.equal((await rows()).length,9);
 await say('Интернет как в прошлом месяце, но 150');await review.waitFor().catch(async error=>{console.log(await surface.innerText());throw error;});assert.match(await review.innerText(),/Сегодня.*150 MDL/s);assert.equal((await rows()).length,9);
 await say('Сохрани');await waitAnswer(/150/);const repeated=(await rows()).filter(row=>row.instrument.toLowerCase()==='интернет');assert.equal(repeated.length,2);assert.equal(repeated.find(row=>row.id==='internet').pnl,-80);assert.equal(repeated.find(row=>row.id!=='internet').dateKey,'2026-10-03');
 await say('Что записал вчера?');await waitAnswer(/350/);await say('Обед забыл — добавь 120');await waitAnswer(/леях/);await say('Да');await review.waitFor();assert.match(await review.innerText(),/Вчера.*120 MDL/s);await say('Сохрани');await waitAnswer(/120/);assert.equal((await rows()).at(-1)?.dateKey==='2026-10-02'||(await rows()).some(row=>row.dateKey==='2026-10-02'&&row.instrument==='ОБЕД'&&row.pnl===-120),true);
 await say('Сколько потратил на еду на этой неделе?');await waitAnswer(/380/);await say('А за прошлую?');await waitAnswer(/50/);assert.match(await page.locator('.voice-workspace-context').innerText(),/Продукты/);
 await say('А на транспорт?');await waitAnswer(/40/);await say('Покажи эти записи');await waitAnswer(/Открыл/);assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),1);
 await say('Вернись в календарь');await waitAnswer(/Календарь открыт/);await page.locator('.voice-history-filter-note').waitFor({state:'detached'});
 await say('Покажи расходы на машину за сентябрь');await waitAnswer(/Какой раздел/);await say('Весь транспорт');await waitAnswer(/Найдено записей: 1/);assert.match(await page.evaluate(()=>localStorage.getItem('dayris_voice_aliases:guest')),/all-transport/);
 await say('Вернись в календарь');await waitAnswer(/Календарь открыт/);
 await say('Покажи расходы на еду за');await waitAnswer(/За какой период/);await say('За прошлую неделю');await waitAnswer(/Найдено записей: 1/);assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),1);
 await say('Вернись в календарь');await waitAnswer(/Календарь открыт/);await say('Покажи покупки примерно на 80 в прошлую пятницу');await waitAnswer(/Найдено записей: 1/);assert.equal(await page.getByRole('button',{name:'Редактировать запись',exact:true}).count(),1);
 await say('Вернись в календарь');await waitAnswer(/Календарь открыт/);
 await page.getByRole('button',{name:'Закрыть голосовой режим',exact:true}).click();
 await say('открой 1 октября 2026');await waitAnswer(/Открыт день/);
 await say('Потратил 30к лей на монитор');await review.waitFor();assert.match(await review.innerText(),/1 октября.*30000 MDL/s);await surface.screenshot({path:'tests/voice-workspace-review.png',animations:'disabled'});await page.getByRole('button',{name:'Отмена',exact:true}).click();
 // Interim words filter continuations without waiting for browser onend.
 await say('потратил');await page.evaluate(()=>emitPhrase('потратил',true));await page.waitForTimeout(150);
 assert.equal(await surface.locator('.calendar-voice-help-groups').count(),0);assert.match(await surface.innerText(),/сумма/i);
 for(const [width,light] of [[390,false],[320,false],[1280,false],[390,true]]){
  await page.setViewportSize({width,height:844});if(light)await page.evaluate(()=>localStorage.setItem('atj_theme','light'));
  if(light){await page.reload();await page.locator('.calendar-days-grid').waitFor();await say('потратил');}
  const box=await surface.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.y+box.height<=844);
  await surface.screenshot({path:`tests/voice-workspace-${width}-${light?'light':'dark'}.png`,animations:'disabled'});
 }
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await surface.evaluate(node=>getComputedStyle(node).animationName),'none');
 assert.deepEqual(errors,[]);console.log('PASS: voice-only batch/save/undo/restore, precise edits, ambiguity, repeat, day context, follow-ups, navigation, alias memory, partial query, approximate search, selected date, 30k, adaptive hints, mobile/desktop/light/reduced motion.');
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
