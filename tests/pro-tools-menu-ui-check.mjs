import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:['tests/workspace-panel-ui.jsx'],bundle:true,write:false,outfile:'tools.js',format:'iife',loader:{'.svg':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{"VITE_SUPABASE_URL":"https://local-test.supabase.co","VITE_SUPABASE_ANON_KEY":"test-anon-key"}'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text,css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^main-.*\.css$/.test(file))),'utf8');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({hasTouch:true}),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);
 await page.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!=='http://tools.test')return route.abort();const file=path.resolve('public','.'+url.pathname);if(file.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':'image/svg+xml'});return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${js}</script>`});});
 const menu=page.locator('.pro-tools-popover'),trigger=page.locator('.workspace-mode-toggle');
 const settle=()=>menu.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished.catch(()=>{}))));
 const show=async()=>{await trigger.click();await menu.waitFor({state:'visible'});await settle();};
 const cases=[[320,700,'ru','dark'],[390,844,'ru','emerald'],[1280,900,'en','light'],[390,844,'uk','purple'],[390,844,'md','gold'],[390,844,'zh-CN','dark'],[740,360,'ru','emerald']];
 for(const [width,height,language,theme] of (process.argv.includes('--desktop-only')?cases.filter(item=>item[0]===1280):cases)){
  await page.setViewportSize({width,height});await page.goto(`http://tools.test/header?preview&mode=pro&language=${language}&theme=${theme}${theme==='light'?'&light':''}`);await trigger.waitFor();
  assert.equal(await page.locator('.dayris-workspace-slot').count(),0,'tools occupy no permanent header row');
  const before=await page.locator('.dayris-header').boundingBox();
  if(width===390&&theme==='emerald')await page.screenshot({path:'artifacts/pro-tools-calendar-closed.png'});
  await show();let box=await menu.boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=height+1);
  assert.equal((await page.locator('.dayris-header').boundingBox()).height,before.height,'opening tools does not move calendar');
  if(width===390&&theme==='emerald')await page.screenshot({path:'artifacts/pro-tools-menu-mobile.png'});
  await trigger.click();await menu.waitFor({state:'hidden'});assert.equal(await trigger.getAttribute('aria-expanded'),'false','second PRO click closes instead of reopening');
  const touch=await trigger.boundingBox();await page.touchscreen.tap(touch.x+touch.width/2,touch.y+touch.height/2);await menu.waitFor({state:'visible'});await settle();
  await page.touchscreen.tap(touch.x+touch.width/2,touch.y+touch.height/2);await menu.waitFor({state:'hidden'});
  await show();await page.mouse.click(2,height-2);await menu.waitFor({state:'hidden'});assert.equal(await trigger.getAttribute('aria-expanded'),'false','blank page space dismisses PRO');
  await show();await page.locator('.dayris-month-trigger').click();await page.locator('.calendar-period-menu').waitFor({state:'visible'});await menu.waitFor({state:'hidden'});assert.equal(await page.locator('.calendar-period-menu').isVisible(),true,`outside dismissal preserves the newly opened date picker: ${theme}/${width}/${language}`);await page.keyboard.press('Escape');await page.locator('.calendar-period-menu').waitFor({state:'hidden'});
  await show();
  await page.locator('[data-destination="capital"]').click();await menu.waitFor({state:'hidden'});await page.waitForFunction(()=>window.handoffs?.at(-1)?.kind==='capital');assert.equal(await page.evaluate(()=>handoffs.at(-1).open),false);
  await show();await page.locator('.pro-tools-trader').click();await settle();assert.equal(await page.locator('.pro-tools-trader').getAttribute('aria-checked'),'true');
  if(width===390&&theme==='emerald')await page.screenshot({path:'artifacts/pro-tools-menu-platforms.png'});
  if(width===1280)await page.screenshot({path:'artifacts/pro-tools-menu-desktop.png'});
  await page.locator('.pro-tools-platform').first().click();await menu.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>handoffs.at(-1).kind),'ctrader');assert.equal(await page.evaluate(()=>handoffs.at(-1).open),false);
  await show();await page.locator('.pro-tools-platform').nth(1).click();await menu.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>handoffs.at(-1).kind),'mt5');
  await show();await page.locator('.pro-control-lot').click();await page.locator('.lot-calculator').waitFor();assert.equal(await menu.isVisible(),false);await page.keyboard.press('Escape');await page.locator('.lot-calculator').waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>document.activeElement===el),true,'calculator restores focus to visible pass');
  await show();await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(el=>document.activeElement===el),true);
  await show();await page.locator('[data-site-element="brand"]').click();await menu.waitFor({state:'hidden'});
  await show();await page.locator('[data-destination="wallet"]').click();await page.locator('.wallet-focus-header').waitFor();assert.equal(await page.evaluate(()=>handoffs.at(-1).open),false);await page.locator('.wallet-focus-header button').click();await trigger.waitFor();assert.equal(await menu.isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await show();assert.equal(await menu.evaluate(el=>el.getAnimations({subtree:true}).length),0);await page.locator('.workspace-pro-info').click();await menu.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>handoffs.at(-1).kind),'offer');assert.equal(await page.evaluate(()=>handoffs.at(-1).open),false);
 await page.goto('http://tools.test/header?preview&mode=free');await trigger.click();assert.equal(await page.locator('.pro-tools-popover').count(),0);assert.equal(await page.evaluate(()=>handoffs.at(-1).kind),'offer');
 assert.deepEqual(errors,[]);console.log('PASS: compact PRO header, localized menus, wallet/capital/platform handoffs, lot calculator focus, escape/outside dismissal, all palettes, phone/desktop/landscape and reduced motion');
}finally{await browser.close();}
