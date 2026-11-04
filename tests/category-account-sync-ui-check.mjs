import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json'));
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import useLibrary from './src/shared/ui/useVoiceCategories.js';function App(){const [owner,setOwner]=useState('22222222-2222-4222-8222-222222222222');const library=useLibrary(owner);window.addCategory=library.add;window.removeCategory=library.remove;window.changeOwner=setOwner;return <><output id="categories">{JSON.stringify(library.categories)}</output><output id="hidden">{JSON.stringify(library.hidden)}</output></>;}createRoot(document.getElementById('root')).render(<App/>);`},bundle:true,write:false,format:'iife',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://category-fixture.supabase.co'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('local-test-key')}});
const browser=await createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
const server=new Map(),owner='22222222-2222-4222-8222-222222222222',errors=[];
async function device(initial=[],storageState){
 const context=await browser.newContext(storageState?{storageState}:{});
 if(!storageState)await context.addInitScript(({owner,initial})=>localStorage.setItem(`dayris_money_categories:${owner}`,JSON.stringify(initial)),{owner,initial});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.hostname==='library.test')return route.fulfill({contentType:'text/html',body:`<div id="root"></div><script>${bundle.outputFiles[0].text}</script>`});
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  let result=[];
  if(url.pathname.includes('/rpc/')){
   const body=route.request().postDataJSON();const library=server.get(body.p_owner)||new Map();server.set(body.p_owner,library);
   if(url.pathname.endsWith('/import_money_categories')){for(const row of body.p_entries)if(!library.has(row.key))library.set(row.key,{category_key:row.key,name:row.name,deleted:row.deleted});}
   else if(url.pathname.endsWith('/set_money_category'))library.set(body.p_key,{category_key:body.p_key,name:body.p_name,deleted:body.p_deleted});
  }else if(url.pathname.endsWith('/money_category_library'))result=[...(server.get(url.searchParams.get('user_id').replace('eq.',''))||new Map()).values()];
  return route.fulfill({headers,contentType:'application/json',body:JSON.stringify(result)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://library.test');await page.locator('#categories').waitFor();
 return {page,context};
}
try{
 const pc=await device(['Diaries']),phone=await device(['Телефон']);
 const has=(page,name)=>page.waitForFunction(name=>JSON.parse(document.querySelector('#categories').textContent).includes(name),name);
 const hidden=(page,name)=>page.waitForFunction(name=>JSON.parse(document.querySelector('#hidden').textContent).includes(name),name);
 await has(phone.page,'Diaries');await pc.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await has(pc.page,'Телефон');
 await pc.page.evaluate(()=>window.addCategory('Общий раздел'));await phone.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await has(phone.page,'Общий раздел');
 await phone.page.evaluate(()=>window.removeCategory('Diaries'));await hidden(phone.page,'Diaries');await pc.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await hidden(pc.page,'Diaries');
 const old=await device(['Diaries']);await hidden(old.page,'Diaries');assert.ok(!JSON.parse(await old.page.locator('#categories').textContent()).includes('Diaries'),'An old device cannot resurrect a deleted category');
 await phone.context.setOffline(true);await phone.page.evaluate(()=>window.addCategory('Без интернета'));await has(phone.page,'Без интернета');
 const state=await phone.context.storageState();await phone.context.close();
 const reloaded=await device([],state);await has(reloaded.page,'Без интернета');
 await pc.page.evaluate(()=>window.dispatchEvent(new Event('focus')));await has(pc.page,'Без интернета');
 await reloaded.page.evaluate(()=>window.changeOwner('33333333-3333-4333-8333-333333333333'));
 await reloaded.page.waitForFunction(()=>JSON.parse(document.querySelector('#categories').textContent).length===0);
 assert.deepEqual(errors,[]);console.log('PASS: PC/phone merge, new categories, deletion, stale-device import, offline reload/retry and account isolation.');
}finally{await browser.close();}
