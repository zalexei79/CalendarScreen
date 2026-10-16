import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
import { EXTENSION_PATH } from '../src/features/extensions/extensionModel.js';
const require = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel:'msedge',headless:true });
const base = process.env.DAYRIS_DESK_URL || 'http://127.0.0.1:5173';
let page;
const messages=[];
try {
  const context = await browser.newContext({ viewport:{width:1500,height:1050} });
  await context.addInitScript(({ path, initial }) => {
    if (location.href === 'about:srcdoc') return;
    const files = new Map([['package.json','{"name":"ai-trade-journal"}'],['src/main.jsx','export {};'],[path,initial]]);
    window.__studioFiles = files;
    const directory = (prefix='') => ({name:'ai-trade-journal',getDirectoryHandle:async name=>directory(prefix+name+'/'),getFileHandle:async(name,options)=>{
      const key=prefix+name;
      if(key==='.dayris-project-desk.json')files.set(key,JSON.stringify({workspace:window.__DAYRIS_DESK_WORKSPACE__}));
      if(!files.has(key)&&!options?.create)throw new Error('Missing file');
      return {getFile:async()=>{const text=files.get(key)||'';return {size:new Blob([text]).size,lastModified:1,text:async()=>text};},createWritable:async()=>{let value;return {write:async text=>{value=text;},close:async()=>files.set(key,value),abort:async()=>{}};}};
    }});
    window.showDirectoryPicker=async()=>directory();
    try { localStorage.setItem('atj_language','ru');localStorage.setItem('dayris_onboarding_v2_completed','1');localStorage.setItem('calendar_guide_completed','1'); } catch {}
  }, {path:EXTENSION_PATH,initial:fs.readFileSync(EXTENSION_PATH,'utf8')});
  await installStoryAccount(context);
  await context.route('**/rest/v1/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({contentType:'application/json',body:JSON.stringify(pathname.endsWith('/site_live_config')?{config:{schema:1,mobile:{global:{},elements:{}},desktop:{global:{},elements:{}}}}:[])});
  });
  const outbound=[];
  context.on('request',request=>{if(new URL(request.url()).origin!==base&&!request.url().includes('supabase.co'))outbound.push(request.url());});
  page=await context.newPage(); page.on('console', message => { if (message.type() === 'error') messages.push(message.text()); });
  await page.goto(base+'/project-desk.html');
  await page.getByRole('button',{name:'Конструктор функций',exact:true}).click();
  await page.getByRole('heading',{name:'Конструктор функций',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'+ Добавить функцию',exact:true}).isDisabled(),true);
  await page.getByRole('button',{name:'Подключить папку проекта',exact:true}).click();
  await page.getByText(/Файл функций открыт с этого ПК/).waitFor();
  await page.getByRole('button',{name:'+ Добавить функцию',exact:true}).click();
  await page.getByLabel('Название кнопки',{exact:true}).fill('Мой счётчик');
  await page.getByRole('button',{name:'Обновить предпросмотр',exact:true}).click();
  const calendar=page.frameLocator('iframe[title="Календарь конструктора функций"]');
  await calendar.getByRole('button',{name:'Мой счётчик',exact:true}).click();
  const child=calendar.frameLocator('iframe[title="Функция: Мой счётчик"]').frameLocator('iframe[title="Содержимое функции"]');
  await calendar.getByRole('dialog').waitFor();
  await child.getByRole('button',{name:'Нажми: 0',exact:true}).click();
  await child.getByRole('button',{name:'Нажми: 1',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.feature-event-log pre')?.textContent.includes('notify: Счётчик: 1'));
  await child.getByRole('button',{name:'Нажми: 1',exact:true}).press('Escape');
  await calendar.getByRole('dialog').waitFor({state:'detached'});
  await page.getByRole('button',{name:'Выбрать место на календаре',exact:true}).click();
  await calendar.getByRole('button',{name:'Выбрать расположение новой кнопки',exact:true}).click({position:{x:180,y:300}});
  assert.ok(Math.abs(Number(await page.getByLabel('X, %',{exact:true}).inputValue())-46)<=1);
  const beforeDesktop = await page.getByLabel('X, %',{exact:true}).inputValue();
  await page.getByRole('button',{name:'ПК · 1280',exact:true}).click();
  assert.equal(await page.getByLabel('X, %',{exact:true}).inputValue(),'20','geometry is device-specific');
  await page.getByRole('button',{name:'Телефон · 390',exact:true}).click();
  assert.equal(await page.getByLabel('X, %',{exact:true}).inputValue(),beforeDesktop);
  await page.locator('.feature-studio-controls fieldset select').first().selectOption('builtin');
  await page.locator('.feature-studio-controls fieldset select').nth(1).selectOption('settings');
  await page.getByRole('button',{name:'Обновить предпросмотр',exact:true}).click();
  await calendar.getByRole('button',{name:'Мой счётчик',exact:true}).click();
  await calendar.locator('.dayris-settings-panel').waitFor();
  await page.waitForFunction(()=>document.querySelector('.feature-event-log pre')?.textContent.includes('DAYRIS: Открыть настройки'));
  await calendar.locator('.settings-close').click();
  await page.locator('.feature-studio-controls fieldset select').first().selectOption('screen');
  await page.getByLabel('Код JS',{exact:true}).fill(`
try { parent.document.body; dayris.notify('BAD parent'); } catch { dayris.notify('parent denied'); }
try { localStorage.getItem('sb-test-auth-token'); dayris.notify('BAD storage'); } catch { dayris.notify('storage denied'); }
fetch('https://blocked.invalid/test').catch(()=>dayris.notify('network denied'));
dayris.navigate('javascript:alert(1)');
dayris.navigate('/?new-function=1');
document.querySelector('#count').onclick = () => dayris.close();
setTimeout(()=>{location.href='https://blocked.invalid/navigation'},200);`);
  await page.getByRole('button',{name:'Обновить предпросмотр',exact:true}).click();
  await calendar.getByRole('button',{name:'Мой счётчик',exact:true}).click();
  for (const text of ['parent denied','storage denied','network denied','Заблокирован небезопасный переход.','navigate: /?new-function=1']) await page.waitForFunction(text=>document.querySelector('.feature-event-log pre')?.textContent.includes(text),text);
  await page.waitForTimeout(400);
  assert.ok(!outbound.some(url=>url.includes('blocked.invalid')),'CSP blocks network and self-navigation before request');
  assert.ok(!await page.locator('.feature-event-log pre').textContent().then(text=>text.includes('BAD')));
  assert.ok(new URL(page.url()).pathname.endsWith('project-desk.html'),'test navigation never leaves studio');
  await calendar.getByRole('button',{name:'Закрыть мини-экран',exact:true}).click();
  // A syntax error is visible in the test log and does not break the host calendar.
  await page.getByLabel('Код JS',{exact:true}).fill('const broken = ;');
  await page.getByRole('button',{name:'Обновить предпросмотр',exact:true}).click();
  await calendar.getByRole('button',{name:'Мой счётчик',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.feature-event-log pre')?.textContent.includes('error:'));
  await calendar.getByRole('button',{name:'Закрыть мини-экран',exact:true}).click();
  await page.getByLabel('Код JS',{exact:true}).fill("document.querySelector('#count').textContent = 'Работает';");
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'Карта и исходники',exact:true}).click();
  await page.getByRole('heading',{name:'Конструктор функций',exact:true}).waitFor();
  await page.getByRole('button',{name:'Проверить и сохранить функции',exact:true}).click();
  await page.getByRole('button',{name:'Создать копию и сохранить функции',exact:true}).click();
  await page.getByText(/Сохранено локально. Копия:/).waitFor();
  const saved = await page.evaluate(path=>JSON.parse(window.__studioFiles.get(path)),EXTENSION_PATH);
  assert.equal(saved.features[0].label,'Мой счётчик');
  assert.equal(await page.evaluate(()=>[...window.__studioFiles.keys()].some(path=>path.startsWith('.dayris-project-backups/'))),true);
  // Save conflict keeps the externally changed file intact.
  await page.getByLabel('Название кнопки',{exact:true}).fill('Конфликт');
  await page.evaluate(path=>window.__studioFiles.set(path,'{"schema":1,"features":[]}'),EXTENSION_PATH);
  await page.getByRole('button',{name:'Проверить и сохранить функции',exact:true}).click();
  await page.getByRole('button',{name:'Создать копию и сохранить функции',exact:true}).click();
  await page.getByText(/Файл изменился в другом редакторе/).waitFor();
  assert.equal(await page.evaluate(path=>JSON.parse(window.__studioFiles.get(path)).features.length,EXTENSION_PATH),0);
  // Restore screenshot to a tested preview without writing the real repository fixture.
  await page.getByLabel('Название кнопки',{exact:true}).fill('Мой счётчик');
  await page.getByRole('button',{name:'Обновить предпросмотр',exact:true}).click();
  await calendar.getByRole('button',{name:'Мой счётчик',exact:true}).click();
  await child.getByRole('button',{name:'Работает',exact:true}).waitFor();
  await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.feature-studio-canvas').scrollTop=0;});
  await page.screenshot({path:'tests/local-feature-studio-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:'tests/local-feature-studio-mobile.png',fullPage:true});
  assert.equal((await context.request.get(base+'/__dayris_desk/status')).status(),403);
  console.log('PASS: local studio, template JS execution, calendar placement, device isolation, sandbox DOM/storage/network denial, safe navigation, errors, dirty guard, backup, conflict, responsive UI. Real project manifest was not edited.');
} catch(error) {
  console.error(error);
  console.error(messages.slice(-12));
  await page?.screenshot({path:'tests/local-feature-studio-failure.png',fullPage:true,timeout:3000}).catch(()=>{});
  throw error;
} finally { await browser.close(); }
