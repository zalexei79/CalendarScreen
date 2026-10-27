import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

// Reuse the production-account bootstrap, not a simplified component mock.
// Only the OS sensor/permission boundary is simulated; all styling, controls,
// subscription cleanup and PRO enforcement are from the production bundle.
const engine=process.env.DAYRIS_TEST_ENGINE==='webkit'?'webkit':'chromium';
const palette=process.env.DAYRIS_TEST_THEME==='emerald'?'emerald':'gold';
const source=fs.readFileSync('tests/gold-theme-ui-check.mjs','utf8');
let setup=source.slice(0,source.indexOf(' for(const width of [320,390,1280])'))
 .replace("'./life-story-auth-fixture.mjs'",JSON.stringify(pathToFileURL(path.resolve('tests/life-story-auth-fixture.mjs')).href))
 .replaceAll('http://gold.test','https://gold.test');
if(engine==='webkit') setup=setup.replace('const {chromium}=','const {webkit}=').replace("chromium.launch({channel:'msedge',headless:true})",'webkit.launch({headless:true})');
if(palette==='emerald') setup=setup.replace("atj_theme:'gold'","atj_theme:'emerald'")
 .replace(",'gold','Pending access",",'emerald','Pending access")
 .replace("document.documentElement.dataset.dayrisTheme==='gold'","document.documentElement.dataset.dayrisTheme==='emerald'")
 .replace(" assert.equal(await page.locator('html').getAttribute('data-gold-motion'),'');",'')
 .replace("'#0b0b0d'","'#071c16'");
const sensors=`
 await context.route('**/rest/v1/reminders**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
 await context.addInitScript(()=>{
  window.__tiltCalls=0;window.__tiltPermission='granted';
  const mode=localStorage.getItem('gold_test_sensor_mode');
  const api=window.DeviceOrientationEvent||class DeviceOrientationEvent{};
  Object.defineProperty(window,'DeviceOrientationEvent',{configurable:true,value:mode==='unavailable'?undefined:api});
  if(mode!=='legacy') Object.defineProperty(api,'requestPermission',{configurable:true,value:()=>{
   window.__tiltCalls++;
   if(window.__tiltPermission==='reject')return Promise.reject(new Error('OS denied'));
   return Promise.resolve(window.__tiltPermission);
  }});
  else Object.defineProperty(api,'requestPermission',{configurable:true,value:undefined});
  const listeners=new Set(),add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=(name,fn,options)=>{if(name==='deviceorientation')listeners.add(fn);return add(name,fn,options);};
  window.removeEventListener=(name,fn,options)=>{if(name==='deviceorientation')listeners.delete(fn);return remove(name,fn,options);};
  window.__tiltListeners=()=>listeners.size;
  window.__tiltReading=(beta,gamma)=>{const event=new Event('deviceorientation');Object.defineProperties(event,{beta:{value:beta},gamma:{value:gamma}});window.dispatchEvent(event);};
 });
`;
setup=setup.replace(' const page=await context.newPage()',sensors+' const page=await context.newPage()');
const finish=`
 await page.clock.resume();
 fs.mkdirSync('artifacts/glass-parallax',{recursive:true});
 const shots='artifacts/glass-parallax/${palette}-${engine}';
 const currentTheme=page.locator('html[data-dayris-theme="${palette}"]');
 const layer=page.locator('.dayris-glass-parallax');
 await page.locator('html[data-glass-parallax]').waitFor();
 assert.equal(await page.evaluate(()=>isSecureContext),true);
 assert.equal(await page.evaluate(()=>window.__tiltCalls),0);
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),0,'Never attach sensors before opt-in');
 await page.setViewportSize({width:1280,height:950});
 await page.mouse.move(1270,20);
 await page.waitForFunction(()=>parseFloat(document.querySelector('.dayris-glass-parallax').style.getPropertyValue('--glass-depth-x'))<-9);
 await page.screenshot({path:shots+'-pointer-1280.png',animations:'disabled'});
 assert.equal(await page.locator('.premium-shell').evaluate(el=>getComputedStyle(el).transform),'none');
 assert.equal(await layer.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
 const hoverDay=page.locator('.calendar-day-surface[data-in-month="true"]').first();
 await hoverDay.hover();const hoverBox=await hoverDay.boundingBox();
 await page.mouse.move(hoverBox.x+hoverBox.width*.8,hoverBox.y+hoverBox.height*.3);
 await page.waitForFunction(()=>{const day=document.querySelector('[data-glass-hover]');return day&&parseFloat(day.style.getPropertyValue('--glass-shadow-x'))<0&&parseFloat(day.style.getPropertyValue('--glass-sheen-x'))>0;});
 await page.setViewportSize({width:390,height:844});
 await page.mouse.move(5,5);
 await page.waitForFunction(()=>document.querySelector('.calendar-days-grid').getBoundingClientRect().bottom+9<=document.querySelector('.history-fab').getBoundingClientRect().top);
 await page.waitForTimeout(200);
 await page.screenshot({path:shots+'-neutral-390.png',animations:'disabled'});
 const geometry=()=>page.locator('.calendar-day-surface .day-amount').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
 const before=await geometry();
 const records=await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222'));
 const openSettings=async()=>{await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.locator('.glass-parallax-control').waitFor();};
 const closeSettings=async()=>{await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.getByRole('button',{name:'История',exact:true}).waitFor();};
 const chooseTheme=async(name)=>{const button=page.getByRole('button',{name,exact:true});await button.scrollIntoViewIfNeeded();await button.click();await page.waitForTimeout(450);};
 const toggle=page.getByRole('switch',{name:'Глубина при наклоне',exact:true});
 await openSettings();
 assert.equal(await toggle.getAttribute('aria-checked'),'false');
 await page.evaluate(()=>window.__tiltPermission='denied');await toggle.click();
 await page.getByText(/Доступ не получен/).waitFor();assert.equal(await toggle.getAttribute('aria-checked'),'false');
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 await page.evaluate(()=>window.__tiltPermission='reject');await toggle.click();
 await page.getByText(/Доступ не получен/).waitFor();assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 await page.evaluate(()=>window.__tiltPermission='granted');await toggle.click();
 await page.locator('.glass-parallax-control [role="switch"][aria-checked="true"]').waitFor();
 assert.equal(await page.evaluate(()=>window.__tiltCalls),3);
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),1);
 await page.evaluate(()=>window.__tiltReading(45,-5));
 await page.evaluate(()=>window.__tiltReading(63,13));
 await page.waitForFunction(()=>document.querySelector('.dayris-glass-parallax').style.getPropertyValue('--glass-depth-x')==='-10.0px');
 await page.screenshot({path:shots+'-settings-enabled.png',animations:'disabled'});
 await closeSettings();
 await page.screenshot({path:shots+'-tilted-390.png',animations:'disabled'});
 assert.deepEqual(await geometry(),before,'Parallax never moves the readable amounts or their hit targets');
 assert.equal(await page.locator('.day-amount').count(),15);
 assert.equal(await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')),records);
 await page.evaluate(()=>{window.__tiltReading(999,-999);window.__tiltReading(null,NaN);});
 await page.waitForTimeout(60);
 assert.ok(await layer.evaluate(el=>Math.abs(parseFloat(el.style.getPropertyValue('--glass-depth-x')))<=10&&Math.abs(parseFloat(el.style.getPropertyValue('--glass-depth-y')))<=8));
 await page.evaluate(()=>window.dispatchEvent(new Event('orientationchange')));
 await page.evaluate(()=>window.__tiltReading(80,30));
 await page.waitForFunction(()=>document.querySelector('.dayris-glass-parallax').style.getPropertyValue('--glass-depth-x')==='0.0px');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.locator('html:not([data-glass-parallax])').waitFor();
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 await page.evaluate(()=>window.__tiltReading(40,0));
 assert.equal(await layer.evaluate(el=>el.style.getPropertyValue('--glass-depth-x')),'');
 await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('html[data-glass-parallax]').waitFor();
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),1);
 // Exercise the actual visibility handler without freezing the test runner.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),1);
 await openSettings();
 await chooseTheme(${JSON.stringify(palette==='gold'?'Изумрудное':'Золото')});
 await page.locator('html[data-dayris-theme="${palette==='gold'?'emerald':'gold'}"]').waitFor();
 assert.equal(await page.evaluate(()=>window.__tiltListeners()),1,'Tilt permission is shared by the two glass materials');
 assert.equal(await page.evaluate(()=>window.__tiltCalls),3);
 await chooseTheme(${JSON.stringify(palette==='gold'?'Золото':'Изумрудное')});
 await chooseTheme('Светлое');await page.locator('html[data-dayris-theme="light"]').waitFor();
 assert.equal(await layer.count(),0);assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 await chooseTheme(${JSON.stringify(palette==='gold'?'Золото':'Изумрудное')});await layer.waitFor();
 assert.equal(await page.evaluate(()=>window.__tiltCalls),3,'Theme reentry does not prompt again in the same session');
 await toggle.click();assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 await toggle.click();assert.equal(await page.evaluate(()=>window.__tiltCalls),4);
 // Saved intent on iOS cannot silently re-grant this session's permission.
 await page.reload();await currentTheme.waitFor();await openSettings();
 assert.equal(await page.evaluate(()=>window.__tiltCalls),0);assert.equal(await page.evaluate(()=>window.__tiltListeners()),0);
 assert.equal(await toggle.getAttribute('aria-checked'),'false');await page.getByText(/снова разрешить наклон/).waitFor();
 await toggle.click();await page.clock.fastForward(5100);await page.getByText(/не передаёт данные/).waitFor();
 assert.equal(await toggle.getAttribute('aria-checked'),'true');
 await page.mouse.move(380,20);
 await page.waitForFunction(()=>parseFloat(document.querySelector('.dayris-glass-parallax').style.getPropertyValue('--glass-depth-x'))<-9);
 await page.evaluate(()=>localStorage.setItem('gold_test_sensor_mode','unavailable'));await page.reload();
 await currentTheme.waitFor();await openSettings();
 assert.equal(await toggle.isDisabled(),true);assert.equal(await page.evaluate(()=>window.__tiltCalls),0);
 await page.evaluate(()=>localStorage.setItem('gold_test_sensor_mode','legacy'));await page.reload();
 await currentTheme.waitFor();await openSettings();
 assert.equal(await toggle.getAttribute('aria-checked'),'true','Previously opted-in browsers without a request API safely resume');
 assert.equal(await page.evaluate(()=>window.__tiltCalls),0);
 assert.deepEqual(errors,[]);
 console.log('PASS ${palette} ${engine}: permission grant/denial/error, calibration, bounds, no moved data, sensor cleanup, shared glass permission, truthful reload, no-data/unsupported/legacy fallback.');
} finally {await browser.close();}
`;
await import('data:text/javascript;base64,'+Buffer.from(setup+finish).toString('base64')).catch(error=>{console.error(error.message);process.exitCode=1;});
