import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const engine=process.env.DAYRIS_SHAKE_ENGINE==='webkit'?'webkit':'chromium';
const source=fs.readFileSync('tests/gold-theme-ui-check.mjs','utf8');
let setup=source.slice(0,source.indexOf(' for(const width of [320,390,1280])'))
 .replace("'./life-story-auth-fixture.mjs'",JSON.stringify(pathToFileURL(path.resolve('tests/life-story-auth-fixture.mjs')).href))
 .replaceAll('http://gold.test','https://gold.test')
 .replace("serviceWorkers:'block'","serviceWorkers:'block',isMobile:true,hasTouch:true")
 .replace('page.setDefaultTimeout(10000)','page.setDefaultTimeout(30000)');
if(engine==='webkit')setup=setup.replace('const {chromium}=','const {webkit}=').replace("chromium.launch({channel:'msedge',headless:true})",'webkit.launch({headless:true})');
setup=setup.replace(' const page=await context.newPage()',`
 await context.route('**/rest/v1/**',route=>route.request().url().includes('/rpc/get_my_pro_status')?route.fallback():route.fulfill({contentType:'application/json',body:'[]'}));
 await context.route('**/rest/v1/reminders**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
 await context.route('**/rest/v1/rpc/is_site_admin',route=>route.fulfill({contentType:'application/json',body:'false'}));
 await context.route('**/auth/v1/token**',route=>{
  const user={id:storyUserId,email:'story@example.test',role:'authenticated',aud:'authenticated',user_metadata:{nickname:'Story'}};
  const exp=Math.floor(Date.now()/1000)+86400*365,encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const access_token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:storyUserId,exp,role:'authenticated'})+'.local-fixture';
  return route.fulfill({contentType:'application/json',body:JSON.stringify({access_token,refresh_token:'local-fixture',token_type:'bearer',expires_in:86400*365,expires_at:exp,user})});
 });
 await context.addInitScript(()=>{
  // A portrait standalone app can have legacy 0 and a different modern
  // natural-angle frame. Feed portrait axes, not axes adapted to app code.
  Object.defineProperty(navigator,'standalone',{configurable:true,value:true});
  Object.defineProperty(window,'orientation',{configurable:true,value:0});
  Object.defineProperty(screen.orientation,'angle',{configurable:true,get:()=>90});
  const api=DeviceMotionEvent,mode=localStorage.getItem('shake_test_mode');
  Object.defineProperty(window,'DeviceMotionEvent',{configurable:true,value:mode==='unavailable'?undefined:api});
  window.__motionCalls=0;window.__motionPermission='granted';
  Object.defineProperty(api,'requestPermission',{configurable:true,value:mode==='legacy'?undefined:()=>{
   window.__motionCalls++;if(window.__motionPermission==='error')return Promise.reject(new Error('denied'));
   return Promise.resolve(window.__motionPermission);
  }});
  const listeners=new Set(),add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=(name,fn,options)=>{if(name==='devicemotion')listeners.add(fn);return add(name,fn,options);};
  window.removeEventListener=(name,fn,options)=>{if(name==='devicemotion')listeners.delete(fn);return remove(name,fn,options);};
  window.__motionListeners=()=>listeners.size;
  window.__motionLog=[];
  window.__motion=(x=0,y=0,z=0,rates=null)=>{
   window.__motionLog.push([performance.now(),x,y,z]);
   const e=new Event('devicemotion');Object.defineProperties(e,{acceleration:{value:{x,y,z}},rotationRate:{value:rates}});window.dispatchEvent(e);
  };
  window.__flick=async(sign)=>{
   window.__motionLog=[];
   const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   for(let i=0;i<14;i++){window.__motion();await pause(25);}
   for(const [x,y,z] of [[1.5,.8,.4],[3.9,1.8,1.3],[4.2,2.2,1.5],[2.8,1.4,1],[.4,.7,.5],[-2.5,1.2,.7]]){window.__motion(x*sign,y,z,{beta:145,gamma:70});await pause(32);}
  };
 });
 const page=await context.newPage()`);
const finish=`
 await page.clock.resume();fs.mkdirSync('artifacts/month-shake',{recursive:true});
 const shots='artifacts/month-shake/${engine}';
 const openSettings=async()=>{await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.locator('.month-shake-control').waitFor();};
 const closeSettings=async()=>{await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.getByRole('button',{name:'История',exact:true}).waitFor();await page.waitForTimeout(250);};
 const toggle=page.getByRole('switch',{name:'Месяцы движением телефона',exact:true});
 const flick=sign=>page.evaluate(s=>window.__flick(s),sign);
 const month=async name=>page.getByRole('button',{name,exact:true}).waitFor().catch(async error=>{
  console.log('Motion failure',await page.evaluate(()=>({samples:window.__motionLog,legacy:window.orientation,modern:screen.orientation?.angle,listeners:window.__motionListeners(),hidden:document.hidden,inert:document.getElementById('root')?.inert,focus:document.activeElement?.tagName,dialogs:[...document.querySelectorAll('dialog,[aria-modal="true"]')].map(el=>({tag:el.tagName,open:el.open,rects:el.getClientRects().length}))})));
  await page.screenshot({path:shots+'-failure.png',animations:'disabled'}).catch(()=>{});throw error;
 });
 const records=await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222'));
 assert.equal(await page.evaluate(()=>window.__motionCalls),0);assert.equal(await page.evaluate(()=>window.__motionListeners()),0);
 await flick(1);await month('Октябрь');
 await openSettings();assert.equal(await toggle.getAttribute('aria-checked'),'false');
 for(const permission of ['denied','error']) {
  await page.evaluate(value=>window.__motionPermission=value,permission);await toggle.click();
  await page.locator('.month-shake-control').getByText(/Доступ не получен/).waitFor();
  assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.equal(await page.evaluate(()=>window.__motionListeners()),0);
 }
 await page.evaluate(()=>window.__motionPermission='granted');await toggle.click();
 assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal(await page.evaluate(()=>window.__motionCalls),3);
 assert.equal(await page.getByRole('switch',{name:'Глубина при наклоне',exact:true}).getAttribute('aria-checked'),'false','Independent from decorative tilt');
 await page.getByRole('button',{name:'Проверить жест',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__motionListeners()),1,'Explicit settings test listens without navigation');
 await flick(1);await page.getByText('Распознан жест вправо.',{exact:true}).waitFor();await month('Октябрь');
 await page.screenshot({path:shots+'-gesture-test-390.png',animations:'disabled'});
 await page.getByRole('button',{name:'Остановить проверку',exact:true}).click();
 assert.equal(await page.evaluate(()=>window.__motionListeners()),0);
 await page.getByRole('button',{name:'Повышенная',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Повышенная',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Обычная',exact:true}).click();
 await toggle.scrollIntoViewIfNeeded();await page.screenshot({path:shots+'-settings-390.png',animations:'disabled'});
 await flick(1);await month('Октябрь');assert.equal(await page.evaluate(()=>window.__motionListeners()),0,'Never switch beneath settings');
 await closeSettings();assert.equal(await page.evaluate(()=>window.__motionListeners()),1);
 console.log('${engine} orientation frames:',await page.evaluate(()=>({legacy:window.orientation,modern:window.screen.orientation?.angle})));
 console.log('${engine}: grant, denial, settings guard');
 await flick(1);
 await flick(1);await month('Ноябрь'); // Rebound during the transition cannot skip months.
 await page.screenshot({path:shots+'-next-390.png',animations:'disabled'});
 await page.waitForTimeout(1300);await flick(-1);await month('Октябрь');
 console.log('${engine}: direction and cooldown');
 // Walking has substantial vertical acceleration, but no lateral gesture.
 await page.evaluate(async()=>{for(let i=0;i<35;i++){window.__motion(1,8*Math.cos(i),3);await new Promise(resolve=>setTimeout(resolve,20));}});
 await month('Октябрь');
 await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();await month('Ноябрь');
 await page.getByRole('button',{name:'Следующий месяц',exact:true}).click();await month('Декабрь');
 await page.waitForTimeout(1300);await flick(1);await month('Январь');await month('2027');
 await page.waitForTimeout(1300);await flick(-1);await month('Декабрь');await month('2026');
 console.log('${engine}: noise rejection and year boundaries');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>window.__motionListeners()),0);await flick(1);await month('Декабрь');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>window.__motionListeners()),1);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(1300);await flick(1);await month('Январь');
 await page.emulateMedia({reducedMotion:'no-preference'});
 // An untracked native modal still blocks the gesture, even if main state is idle.
 await page.evaluate(()=>{const d=document.createElement('dialog');d.id='shake-test-dialog';d.textContent='Modal';document.body.append(d);d.showModal();});
 await page.waitForTimeout(1300);await flick(1);await month('Январь');
 await page.evaluate(()=>{const d=document.getElementById('shake-test-dialog');d.close();d.remove();});
 await page.evaluate(()=>{const d=document.createElement('dialog');d.id='closed-dialog';d.setAttribute('aria-modal','true');document.body.append(d);});
 await page.waitForTimeout(1300);await flick(1);await month('Февраль');
 await page.evaluate(()=>document.getElementById('closed-dialog').remove());
 await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();await month('Январь');
 await openSettings();await page.getByRole('button',{name:'Изумрудное',exact:true}).click();
 assert.equal(await toggle.getAttribute('aria-checked'),'true');await closeSettings();
 await page.waitForTimeout(1300);await flick(-1);await month('Декабрь');
 await openSettings();await page.getByRole('button',{name:'Светлое',exact:true}).click();await closeSettings();
 await page.waitForTimeout(1300);await flick(1);await month('Январь');
 assert.equal(await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')),records);
 console.log('${engine}: modal, visibility, reduced motion and themes');
 await openSettings();await toggle.click();await closeSettings();assert.equal(await page.evaluate(()=>window.__motionListeners()),0);
 await flick(-1);await month('Январь');
 await openSettings();await toggle.click();await closeSettings();
 await page.waitForTimeout(5100);await openSettings();await page.locator('.month-shake-control').getByText(/не передаёт данные/).waitFor();
 await page.getByRole('button',{name:'Проверить жест',exact:true}).click();await page.clock.fastForward(10100);
 await page.getByText(/Показаний нет/).waitFor();assert.equal(await page.evaluate(()=>window.__motionListeners()),0);
 await page.getByRole('button',{name:'Повышенная',exact:true}).click();
 await page.reload();await page.locator('html[data-dayris-theme="light"]').waitFor();await openSettings();
 assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.equal(await page.evaluate(()=>window.__motionCalls),0);
 await page.locator('.month-shake-control').getByText(/снова разрешить/).waitFor();
 await page.evaluate(()=>localStorage.setItem('shake_test_mode','unavailable'));await page.reload();await page.locator('html[data-dayris-theme="light"]').waitFor();await openSettings();
 assert.equal(await toggle.isDisabled(),true);
 await page.evaluate(()=>localStorage.setItem('shake_test_mode','legacy'));await page.reload();await page.locator('html[data-dayris-theme="light"]').waitFor();await openSettings();
 assert.equal(await toggle.getAttribute('aria-checked'),'true');assert.equal(await page.evaluate(()=>window.__motionCalls),0);
 assert.equal(await page.getByRole('button',{name:'Повышенная',exact:true}).getAttribute('aria-pressed'),'true','Device sensitivity survives reload');
 await page.setViewportSize({width:1280,height:950});await toggle.scrollIntoViewIfNeeded();await page.screenshot({path:shots+'-settings-1280.png',animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('PASS ${engine}: optional left/right motion, permissions, year boundaries, no accidental repeats, paused overlays, unchanged data, all themes, reload and unavailable/legacy behavior.');
} finally {await browser.close();}
`;
await import('data:text/javascript;base64,'+Buffer.from(setup+finish).toString('base64')).catch(error=>{console.error(error.message);process.exitCode=1;});
