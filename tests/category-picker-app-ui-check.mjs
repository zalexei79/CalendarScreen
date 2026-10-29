import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {installStoryAccount,storyUserId} from './life-story-auth-fixture.mjs';
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
 const now=new Date(),dateKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 let backend=[{id:randomUUID(),date_key:dateKey,time:'10:00',instrument:'АКВАРИУМ',pnl:-20,currency:'MDL',platform:'Manual',trader_mode:false,user_id:storyUserId}];
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(url.origin===origin)return route.continue();
  if(url.pathname.startsWith('/rest/v1/')){
   if(url.pathname.endsWith('/trades')){
    if(request.method()==='POST'){const input=request.postDataJSON(),row={...(Array.isArray(input)?input[0]:input),id:randomUUID()};backend.push(row);return route.fulfill({contentType:'application/json',body:JSON.stringify(row)});}
    if(request.method()==='PATCH'){const updates=request.postDataJSON();backend=backend.map(row=>[...url.searchParams].every(([key,value])=>!value.startsWith('eq.')||String(row[key])===value.slice(3))?{...row,...updates}:row);}
    return route.fulfill({contentType:'application/json',body:JSON.stringify(backend)});
   }
   return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname.endsWith('get_my_pro_status')?{active:false}:[])});
  }
  return route.abort();
 });
 await installStoryAccount(context);
 await context.addInitScript(id=>{
  window.testOwner=id;
  localStorage.setItem('dayris_voice_intro_v1:'+id,'seen');
  localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');localStorage.setItem('atj_language','ru');localStorage.setItem('atj_pro_view','0');localStorage.setItem('atj_trader_mode','0');localStorage.setItem('dayris_voice_feedback','off');
  if(!localStorage.getItem('money_calendar_trades_'+window.testOwner)){
   const d=new Date(),dateKey=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
   localStorage.setItem('money_calendar_trades_'+window.testOwner,JSON.stringify({[dateKey]:[{id:'old-category',time:'10:00',instrument:'АКВАРИУМ',pnl:-20,currency:'MDL',platform:'Manual',traderMode:false}]}));
  }
  if(!localStorage.getItem('dayris_money_categories:'+window.testOwner))localStorage.setItem('dayris_money_categories:'+window.testOwner,JSON.stringify(['АКВАРИУМ','Сок','Такси','Монитор',...Array.from({length:90},(_,i)=>'Раздел '+i)]));
  window.SpeechRecognition=class{constructor(){window.voice=this;}start(){this.onstart?.();}stop(){this.onend?.();}abort(){}};
  window.finishPhrase=phrase=>{window.voice.onresult({results:[Object.assign([{transcript:phrase}],{isFinal:true})]});window.voice.onend?.();};
 },storyUserId);
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const ready=async()=>{try{await page.locator('.calendar-days-grid').waitFor({timeout:10000});await page.waitForFunction(()=>!document.getElementById('boot-screen'));}catch(error){console.log(JSON.stringify({errors,screen:(await page.locator('body').innerText()).slice(0,1600)}));await page.screenshot({path:'artifacts/category-picker-app-startup.png',fullPage:true});throw error;}};
 const cache=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_'+window.testOwner)||'{}')).flat());
 await page.goto(origin);await ready();assert.equal((await cache()).length,1);
 await page.getByRole('button',{name:'Добавить',exact:true}).click();
 await page.getByRole('button',{name:'Расходы',exact:true}).click();
 await page.getByRole('button',{name:'+50',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('аквариум');
 await page.getByRole('button',{name:'Закрепить АКВАРИУМ',exact:true}).click();
 await page.getByRole('button',{name:'АКВАРИУМ',exact:true}).click();await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 assert.equal((await cache()).length,1,'category selection never saves the entry');
 await page.getByRole('button',{name:'Сохранить запись',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_'+window.testOwner)||'{}')).flat().length===2);
 assert.ok((await cache()).some(record=>record.instrument==='АКВАРИУМ'&&record.pnl===-50));
 await page.locator('.calendar-voice-button').click();await page.waitForFunction(()=>typeof window.voice?.onresult==='function');await page.evaluate(()=>finishPhrase('80 лей на сок'));
 await page.getByRole('button',{name:'Сохранить',exact:true}).click();await page.waitForFunction(()=>Object.values(JSON.parse(localStorage.getItem('money_calendar_trades_'+window.testOwner)||'{}')).flat().length===3);
 await page.getByRole('button',{name:'Закрыть голосовой режим'}).click();
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 await page.getByRole('dialog',{name:'Разделы'}).waitFor();assert.equal((await page.locator('.category-picker-quick .category-picker-choice').allTextContents())[0],'АКВАРИУМ');
 assert.ok((await page.locator('.category-picker-choice').allTextContents()).includes('Сок'));
 await page.screenshot({path:'tests/category-picker-app.png',animations:'disabled'});
 await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 assert.equal(await page.getByRole('button',{name:'Сохранить запись',exact:true}).isVisible(),true,'Escape closes only category picker');
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Сохранить запись',exact:true}).waitFor({state:'detached'});
 await page.getByRole('button',{name:'История',exact:true}).click();await page.getByRole('button',{name:/^Фильтры/}).click();
 await page.locator('.category-picker-trigger').click();await page.getByRole('textbox',{name:'Найти раздел'}).fill('аквариум');
 await page.getByRole('button',{name:'АКВАРИУМ',exact:true}).click();await page.getByRole('dialog',{name:'Разделы'}).waitFor({state:'detached'});
 assert.match(await page.locator('.category-picker-trigger').textContent(),/АКВАРИУМ/);assert.equal((await cache()).length,3,'history filter preserves records');
 await page.reload();await ready();await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 assert.equal((await page.locator('.category-picker-quick .category-picker-choice').allTextContents())[0],'АКВАРИУМ');
 // Create a section independently of a financial entry.
 await page.getByRole('button',{name:'Добавить раздел',exact:true}).click();
 await page.getByRole('textbox',{name:'Название раздела'}).fill('Настольные игры');
 await page.getByRole('button',{name:'Повседневные',exact:true}).click();await page.locator('[data-category-icon="game"]').click();
 await page.getByRole('button',{name:'Создать',exact:true}).click();await page.locator('.category-picker-layer').waitFor({state:'detached'});
 assert.equal((await cache()).length,3);assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_money_categories:'+window.testOwner)).includes('Настольные игры')));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_category_library:'+window.testOwner)).icons['настольные игры']),'game');
 assert.equal(await page.locator('.category-picker-trigger .lucide-gamepad-2').count(),1,'custom icon is used by the actual entry composer');
 await page.getByRole('button',{name:'Категория',exact:true}).click();await page.getByRole('textbox',{name:'Найти раздел'}).fill('Настольные игры');
 assert.equal(await page.getByRole('button',{name:'Настольные игры',exact:true}).count(),1);
 await page.getByRole('button',{name:'Управлять разделами'}).click();await page.getByRole('button',{name:'Удалить раздел Настольные игры',exact:true}).click();
 await page.getByRole('button',{name:'Отмена',exact:true}).click();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_money_categories:'+window.testOwner)).includes('Настольные игры')));
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('АКВАРИУМ');await page.getByRole('button',{name:'Удалить раздел АКВАРИУМ',exact:true}).click();
 assert.match(await page.locator('.category-picker-confirm').textContent(),/Записи, суммы и даты сохранятся/);
 const before=await cache();await page.screenshot({path:'tests/category-delete-confirm.png',animations:'disabled'});
 await page.getByRole('button',{name:'Удалить',exact:true}).dblclick();await page.locator('.category-picker-confirm').waitFor({state:'detached'});
 const after=await cache();assert.deepEqual(after,before.map(item=>item.instrument==='АКВАРИУМ'?{...item,instrument:'Другое'}:item));
 assert.equal(await page.getByRole('button',{name:'АКВАРИУМ',exact:true}).count(),0);
 assert.ok(!await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_category_library:'+window.testOwner)).favorites.includes('АКВАРИУМ')));
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('Продукты');await page.getByRole('button',{name:'Удалить раздел Продукты',exact:true}).click();await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.locator('.category-picker-confirm').waitFor({state:'detached'});
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('Другое');assert.equal(await page.getByRole('button',{name:'Удалить раздел Другое',exact:true}).count(),0);
 await page.reload();await ready();assert.deepEqual(await cache(),after);
 await page.getByRole('button',{name:'Добавить',exact:true}).click();await page.getByRole('button',{name:'Категория',exact:true}).click();
 await page.getByRole('textbox',{name:'Найти раздел'}).fill('АКВАРИУМ');assert.equal(await page.locator('.category-picker-choice').count(),0,'removed section never reappears from old records');
 await page.getByRole('button',{name:'Создать «АКВАРИУМ»'}).click();await page.getByRole('button',{name:'Создать',exact:true}).click();await page.locator('.category-picker-layer').waitFor({state:'detached'});assert.deepEqual(await cache(),after,'recreating a category does not relabel old money');
 assert.deepEqual(errors,[]);
 console.log('PASS: real app independent category creation, cancel/delete, exact preservation of records and amounts, builtin removal, persistence, recreation, manual/voice saves and history filter');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
