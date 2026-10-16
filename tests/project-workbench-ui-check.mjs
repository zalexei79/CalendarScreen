import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel:'msedge',headless:true });
let page;
try {
  const context=await browser.newContext({viewport:{width:1440,height:1050},serviceWorkers:'block'});
  await context.addInitScript(()=>{
    const files = new Map([['package.json','{"name":"ai-trade-journal"}'],['src/main.jsx','export {};'],['Header.jsx','export const label = "Микрофон";']]);
    window.__testFiles=files;
    const directory=(prefix='')=>({name:'ai-trade-journal',getDirectoryHandle:async name=>directory(prefix+name+'/'),getFileHandle:async(name,options)=>{
      const key=prefix+name;
      if(key==='.dayris-project-desk.json') files.set(key,JSON.stringify({workspace:window.__DAYRIS_DESK_WORKSPACE__}));
      if(!files.has(key)&&!options?.create)throw new Error('File not found');
      return {getFile:async()=>{const text=files.get(key)||'';return {size:new Blob([text]).size,lastModified:1,text:async()=>text};},createWritable:async()=>{let value;return {write:async text=>{value=text;},close:async()=>files.set(key,value),abort:async()=>{}};}};
    }});
    window.showDirectoryPicker=async()=>directory();
    localStorage.setItem('atj_language','ru');localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1');
  });
  let admin=true;const payloads=[];
  const dist=path.resolve('dist');
  await context.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(route.request().postData())payloads.push(route.request().postData());
    const json=value=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
    if(url.pathname.endsWith('/rpc/admin_capabilities'))return json({design:admin,viewUsers:admin,editUsers:admin});
    if(url.pathname.endsWith('/rpc/admin_list_users'))return json({users:[],total:0});
    if(url.origin!=='http://calendar.test')return route.abort();
    const target=path.resolve(dist,'.'+url.pathname);
    if(!target.startsWith(dist+path.sep)||!fs.existsSync(target)||fs.statSync(target).isDirectory())return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:target.endsWith('.js')?'text/javascript':target.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(target)});
  });
  await installStoryAccount(context);
  page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://calendar.test/admin.html');
  await page.getByRole('button',{name:'Проект',exact:true}).click();
  await page.getByRole('heading',{name:'Карта проекта',exact:true}).waitFor();
  await page.getByRole('button',{name:'Подключить папку проекта',exact:true}).click();
  await page.getByText(/Подключена локальная папка/).waitFor();
  const search=page.getByRole('searchbox');
  await search.fill('Header.jsx');
  await page.locator('.project-browser').getByRole('button',{name:'Header.jsx',exact:true}).click();
  await page.getByRole('heading',{name:'Шапка календаря',exact:true}).waitFor();
  const source=page.getByRole('textbox',{name:'Исходный текст файла',exact:true});
  assert.equal(await source.inputValue(),'export const label = "Микрофон";');
  assert.equal(await source.getAttribute('readonly'),'');
  await page.getByRole('button',{name:'Редактировать локально',exact:true}).click();
  await source.fill('export const label = "Новый микрофон";');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Пользователи',exact:true}).click();
  await page.getByRole('heading',{name:'Карта проекта',exact:true}).waitFor();
  await page.getByRole('button',{name:'Проверить и сохранить',exact:true}).click();
  assert.equal(await page.getByRole('textbox',{name:'Исходный вариант',exact:true}).inputValue(),'export const label = "Микрофон";');
  await page.getByRole('button',{name:'Создать копию и сохранить файл',exact:true}).click();
  await page.getByText(/Сохранено на этом ПК/).waitFor();
  assert.equal(await page.evaluate(()=>window.__testFiles.get('Header.jsx')),'export const label = "Новый микрофон";');
  assert.equal(await page.evaluate(()=>[...window.__testFiles].some(([key,value])=>key.startsWith('.dayris-project-backups/')&&value.includes('"Микрофон"'))),true);
  assert.equal(payloads.some(value=>value.includes('Новый микрофон')),false,'local source never sent over network');
  await page.getByRole('button',{name:'Редактировать локально',exact:true}).click();await source.fill('another edit');
  await page.evaluate(()=>window.__testFiles.set('Header.jsx','external editor changed this'));
  await page.getByRole('button',{name:'Проверить и сохранить',exact:true}).click();
  await page.getByRole('button',{name:'Создать копию и сохранить файл',exact:true}).click();
  await page.getByText(/Файл изменился в другом редакторе/).waitFor();
  assert.equal(await page.evaluate(()=>window.__testFiles.get('Header.jsx')),'external editor changed this');
  page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Заново открыть файл',exact:true}).click();
  await page.screenshot({path:'tests/project-workbench-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tests/project-workbench-mobile.png',fullPage:true});
  admin=false;await page.reload();await page.getByRole('button',{name:'Проект',exact:true}).click();
  await page.getByRole('heading',{name:'Нужен доступ к данным пользователей',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Подключить папку проекта',exact:true}).count(),0);
  assert.deepEqual(errors,[]);
  if(process.env.DAYRIS_DESK_URL){
    const local=await context.newPage();
    page=local;
    // Keep the real local server; all outside API requests remain blocked by the route.
    await context.unroute('**/*');
    await local.goto(process.env.DAYRIS_DESK_URL+'/project-desk.html',{waitUntil:'domcontentloaded'});
    await local.getByRole('heading',{name:'Карта проекта',exact:true}).waitFor();
    await local.getByText(/Ветка:/).waitFor();
    assert.equal((await context.request.get(process.env.DAYRIS_DESK_URL+'/__dayris_desk/status')).status(),403);
    await local.getByRole('button',{name:'Подключить папку проекта',exact:true}).click();
    await local.getByText(/Подключена локальная папка/).waitFor();
    await local.getByRole('button',{name:'Проверить сборку',exact:true}).click();
    await local.getByText(/Готово: Сборка и базовые тесты прошли/).waitFor({timeout:120000});
    assert.equal(await local.getByRole('button',{name:'Выбрать другую папку',exact:true}).count(),1,'build must preserve the connected folder');
    assert.equal(await local.getByRole('button',{name:'Подготовить публикацию',exact:true}).isDisabled(),true,'no files selected automatically');
    await local.screenshot({path:'tests/project-local-desk.png',fullPage:true});
  }
  console.log('PASS: project map/search, local source editing, before/after, backup, conflict, unsaved guard, no source upload, role gate, responsive layout; optional real local build API.');
} catch(error){console.error('Workbench scenario failed:',error.message);if(page)await page.screenshot({path:'tests/project-workbench-failure.png',fullPage:true,timeout:3000}).catch(()=>{});throw error;}
finally{await browser.close();}
