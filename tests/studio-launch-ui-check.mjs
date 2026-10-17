import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {installStoryAccount} from './life-story-auth-fixture.mjs';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
const origin='https://ai-trade-journal-ejm8.onrender.com',dist=path.resolve('dist');
let page,child;
try{
 const context=await browser.newContext({viewport:{width:1360,height:1000},serviceWorkers:'block'});
 let allowed=true,localRequests=0;
 await context.addInitScript(()=>{localStorage.setItem('atj_language','ru');localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');window.addEventListener('message',e=>{if(e.data?.type==='dayris:studio-ready')window.__launchReply=e.data;});});
 await context.route('**/*',route=>{
   const url=new URL(route.request().url()),rpc=url.pathname.split('/rpc/')[1];
   if(rpc==='admin_capabilities')return route.fulfill({json:{design:allowed,viewUsers:true,editUsers:false}});
   if(rpc==='admin_list_users')return route.fulfill({json:{users:[],total:0}});
   if(url.pathname.startsWith('/rest/'))return route.fulfill({json:[]});
   if(url.origin==='http://127.0.0.1:5173'){localRequests++;return route.continue();}
   if(url.origin!==origin)return route.abort();
   const target=path.resolve(dist,url.pathname==='/'?'index.html':'.'+url.pathname);
   if(!target.startsWith(dist+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory())return route.fulfill({status:404,body:''});
   return route.fulfill({contentType:target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':target.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(target)});
 });
 await installStoryAccount(context);page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/admin.html?section=studio');
 await page.getByRole('heading',{name:'Студия DAYRIS',exact:true}).waitFor();assert.equal(localRequests,0,'no cross-origin localhost probes before user action');
 const popup=page.waitForEvent('popup');await page.getByRole('button',{name:'Открыть студию на этом ПК',exact:true}).click();child=await popup;
 await child.getByRole('heading',{name:'Редактор приложения',exact:true}).waitFor();
 await page.getByText('Студия загрузилась в отдельной вкладке. Можно работать.',{exact:true}).waitFor();
 assert.equal(await child.evaluate(()=>window.opener===null),true,'disconnect opener after readiness reply');
 assert.deepEqual(await page.evaluate(()=>Object.keys(window.__launchReply).sort()),['nonce','type'],'no local token or auth credentials sent to cloud');
 await child.close();
 await page.screenshot({path:'tests/studio-launch-desktop.png',fullPage:true});
 await page.evaluate(()=>{window.__originalOpen=window.open;window.open=()=>null;});
 await page.getByRole('button',{name:'Открыть студию на этом ПК',exact:true}).click();await page.getByText(/Браузер заблокировал новую вкладку/).waitFor();
 await page.evaluate(()=>{window.open=window.__originalOpen;});
 await context.route('**/src/projectDesk.jsx*',route=>route.abort());
 await page.clock.install();const failedPopup=page.waitForEvent('popup');await page.getByRole('button',{name:'Открыть студию на этом ПК',exact:true}).click();child=await failedPopup;
 await child.getByText(/Не удалось загрузить студию/).waitFor();
 await page.clock.fastForward(12500);await page.getByText(/Студия не подтвердила загрузку/).waitFor();await child.close();
 for(const width of [1024,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'fits '+width);}
 await page.screenshot({path:'tests/studio-launch-mobile.png',fullPage:true});
 allowed=false;await page.reload();await page.getByRole('heading',{name:'Нужен доступ к данным пользователей',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Открыть студию на этом ПК',exact:true}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: role-gated admin studio entry, real local launch/readiness, no credential transfer, no preflight localhost probes, popup blocking, failed-module fallback/unconfirmed launch, 1024/390/320. No project data changed.');
}catch(e){console.error(e);await page?.screenshot({path:'tests/studio-launch-failure.png',fullPage:true,timeout:3000}).catch(()=>{});throw e;}
finally{await browser.close();}
