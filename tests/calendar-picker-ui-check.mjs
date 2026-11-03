import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:['tests/workspace-panel-ui.jsx'],bundle:true,write:false,outfile:'pickers.js',format:'iife',loader:{'.svg':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{"VITE_SUPABASE_URL":"https://local-test.supabase.co","VITE_SUPABASE_ANON_KEY":"test-anon-key"}'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^main-.*\.css$/.test(file))),'utf8');
const browser=await createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://pickers.test')return route.abort();const file=path.resolve('public','.'+url.pathname);if(file.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':'image/svg+xml'});return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${js}</script>`});});
 const period=page.locator('.calendar-period-menu'),currency=page.locator('.calendar-currency-menu');
 const settle=menu=>menu.evaluate(node=>Promise.all(node.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
 async function inside(menu,width,height){await settle(menu);const box=await menu.boundingBox();assert.ok(box.x>=11&&box.x+box.width<=width-11&&box.y>=11&&box.y+box.height<=height-11,JSON.stringify({width,height,box}));assert.equal(await menu.evaluate(node=>node.parentElement===document.body),true,'menus escape all header clipping');}
 const cases=[[320,568,'dark','ru'],[390,844,'emerald','uk'],[390,844,'gold','md'],[1280,900,'light','en'],[740,360,'purple','ru'],[390,844,'dark','zh-CN'],[390,844,'emerald','ru',true]];
 for(const [width,height,theme,language,large] of (process.argv.includes('--quick')?[cases.at(-1)]:cases)){
  await page.setViewportSize({width,height});await page.goto(`http://pickers.test/header?preview&user&mode=pro&year=2026&month=7&theme=${theme}&language=${language}${theme==='light'?'&light':''}`);
  if(large)await page.evaluate(()=>{document.documentElement.style.setProperty('--dayris-interface-scale','1.15');document.documentElement.style.setProperty('--dayris-text-scale','1.3');});
  const header=await page.locator('.dayris-header').boundingBox();
  await page.locator('.calendar-currency-trigger').click();await inside(currency,width,height);
  if(theme==='emerald'&&!large)await page.screenshot({path:'artifacts/calendar-currency-anchored-phone.png'});
  for(const option of await page.locator('.calendar-currency-option').all()){await option.scrollIntoViewIfNeeded();assert.equal(await option.evaluate(node=>{const box=node.getBoundingClientRect();return node.contains(document.elementFromPoint(box.x+box.width/2,box.y+box.height/2));}),true,'every currency can be reached');}
  await page.locator('.calendar-currency-option').filter({hasText:'EUR'}).click();await currency.waitFor({state:'hidden'});assert.equal(await page.locator('.calendar-currency-trigger > span').textContent(),'EUR');
  assert.equal(await page.locator('.calendar-currency-trigger').evaluate(node=>document.activeElement===node),true);
  await page.locator('.calendar-currency-trigger').click();await currency.waitFor({state:'visible'});await page.locator('[data-site-element="brand"] > div').first().click();await currency.waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('.calendar-currency-trigger').getAttribute('aria-expanded')==='false');
  await page.locator('.calendar-currency-trigger').focus();await page.keyboard.press('ArrowDown');await currency.waitFor({state:'visible'});await page.keyboard.press('End');await page.keyboard.press('Escape');await currency.waitFor({state:'hidden'});
  await page.locator('.dayris-month-trigger').click();await inside(period,width,height);assert.equal(await period.locator('[data-month]').count(),12);assert.equal(await period.evaluate(node=>node.scrollHeight>node.clientHeight+1),false,'month grid needs no scrollbar');
  if(theme==='emerald'&&!large)await page.screenshot({path:'artifacts/calendar-month-grid-phone.png'});
  if(width===1280)await page.screenshot({path:'artifacts/calendar-month-grid-desktop.png'});
  await period.locator('.calendar-picker-heading button').last().click();assert.equal(await period.locator('.calendar-picker-heading strong').textContent(),'2027');await period.locator('[data-month="0"]').click();await period.waitFor({state:'hidden'});assert.equal(await page.locator('.dayris-year-trigger').textContent(),'2027');
  assert.equal(await page.locator('.dayris-month-trigger').evaluate(node=>document.activeElement===node),true);
  await page.locator('.dayris-year-trigger').click();await inside(period,width,height);assert.equal(await period.locator('[data-year]').count(),12);
  const first=Number(await period.locator('[data-year]').first().textContent());await period.locator('.calendar-picker-heading button').last().click();assert.equal(Number(await period.locator('[data-year]').first().textContent()),first+12);
  await period.locator('[data-year]').first().focus();await page.keyboard.press('PageDown');assert.equal(Number(await period.locator('[data-year]').first().textContent()),first+24);
  await page.keyboard.press('PageUp');assert.equal(Number(await period.locator('[data-year]').first().textContent()),first+12);await page.keyboard.press('PageDown');assert.equal(Number(await period.locator('[data-year]').first().textContent()),first+24);
  const grid=await period.locator('.calendar-picker-options').boundingBox();await page.mouse.move(grid.x+grid.width-12,grid.y+20);await page.mouse.down();await page.mouse.move(grid.x+12,grid.y+20,{steps:6});await page.mouse.up();assert.equal(Number(await period.locator('[data-year]').first().textContent()),first+36);
  if(theme==='emerald'&&!large)await page.screenshot({path:'artifacts/calendar-year-pages-phone.png'});
  await period.locator('[data-year]').first().click();await period.waitFor({state:'hidden'});assert.equal(Number(await page.locator('.dayris-year-trigger').textContent()),first+36);
  await page.locator('.dayris-month-trigger').click();await period.waitFor({state:'visible'});await page.keyboard.press('Escape');await period.waitFor({state:'hidden'});assert.equal(await page.locator('.dayris-month-trigger').getAttribute('aria-expanded'),'false');
  if(!large)assert.equal((await page.locator('.dayris-header').boundingBox()).height,header.height,'menus and selections never move the header');
  const overflow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,items:[...document.querySelectorAll('.dayris-header *')].flatMap(node=>{const box=node.getBoundingClientRect();return box.right+scrollX>innerWidth+1?[{class:node.className?.baseVal??node.className,right:box.right+scrollX,width:box.width}]:[]})}));
  if(large)await page.screenshot({path:'artifacts/calendar-header-large-text.png'});
  assert.ok(overflow.scrollWidth<=overflow.width,JSON.stringify(overflow));
 }
 await page.locator('.dayris-year-trigger').click();await page.setViewportSize({width:320,height:568});await inside(period,320,568);
 await page.locator('.calendar-currency-trigger').click();await period.waitFor({state:'hidden'});await currency.waitFor({state:'visible'});assert.equal(await page.locator('.dayris-year-trigger').getAttribute('aria-expanded'),'false');
 await page.locator('.dayris-month-trigger').click();await currency.waitFor({state:'hidden'});await period.waitFor({state:'visible'});assert.equal(await page.locator('.calendar-currency-trigger').getAttribute('aria-expanded'),'false');await page.keyboard.press('Escape');await period.waitFor({state:'hidden'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.dayris-year-trigger').click();assert.equal(await period.evaluate(node=>node.getAnimations({subtree:true}).length),0);await page.keyboard.press('Escape');
 assert.deepEqual(errors,[]);console.log('PASS: currency bounds and all options, month grid, long-range year paging/swipe/keyboard, outside/Escape dismissal, focus return, five locales, phone/desktop/landscape, enlarged text and reduced motion');
}finally{await browser.close();}
