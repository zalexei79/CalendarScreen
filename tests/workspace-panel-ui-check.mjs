import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
const require=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url);
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:[path.resolve('tests/workspace-panel-ui.jsx')],bundle:true,write:false,outfile:'workspace.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage({viewport:{width:390,height:844}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://dayris.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${js}</script></html>`}));
 await page.goto('http://dayris.test/');
 await page.emulateMedia({reducedMotion:'reduce'});
 for (const width of [320,360,390,430,1280]) {
  await page.setViewportSize({width,height:844});
  for(const language of ['ru','en','md']) {
   await page.locator('#language').selectOption(language);
   for (const light of [false,true]) {
    const isLight=await page.locator('.workspace-mode-panel').evaluate(el=>el.classList.contains('pro-light'));
    if(isLight!==light)await page.locator('#theme').click();
    await page.locator('#free').click();
    const free=await page.locator('.workspace-mode-panel').boundingBox();
    assert.ok(free.height<=70,`FREE should be compact at ${width}`);
    assert.equal(await page.locator('.pro-actions-reveal').count(),0);
    assert.equal(await page.locator('.wallet-entry').count(),1);
    await page.locator('#idle').click();
    const idle=await page.locator('.workspace-mode-panel').boundingBox();
    assert.equal(await page.locator('.pro-control-platform:disabled').count(),2);
    assert.ok((await page.locator('.pro-platform-reveal').boundingBox()).height<1,'closed platforms must occupy no height');
    await page.locator('#trader').click();
    const active=await page.locator('.workspace-mode-panel').boundingBox();
    assert.ok(active.height>idle.height+40,'Trader expands a dedicated platform row');
    assert.equal(await page.locator('.pro-control-platform:disabled').count(),0);
    const foreground = await page.locator('.pro-platform-label strong').first().evaluate(el=>getComputedStyle(el).color);
    assert.equal(foreground, light ? 'rgb(34, 35, 37)' : 'rgb(243, 240, 233)', 'platform text must match the theme');
    assert.ok(active.height<=140,'PRO panel is compact');
    const wallet=await page.locator('.wallet-entry').boundingBox();
    assert.ok(wallet.height>=60 && wallet.x>=0 && wallet.x+wallet.width<=width,'prominent wallet remains inside viewport');
    for(const button of await page.locator('.workspace-mode-panel button').all()) {
     const box=await button.boundingBox();
     assert.ok(box && box.height>=44 && box.x>=0 && box.x+box.width<=width,`button bounds at ${width}/${language}/${light}`);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   }
  }
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#language').selectOption('ru');
 if(await page.locator('.workspace-mode-panel').evaluate(el=>el.classList.contains('pro-light')))await page.locator('#theme').click();
 await page.locator('#free').click();await page.locator('.wallet-entry').click();
 assert.equal(await page.locator('#action').textContent(),'offer','locked wallet opens PRO information, never wallet');
 await page.locator('#access').click();await page.locator('.wallet-entry').click();
 assert.equal(await page.locator('#action').textContent(),'wallet','active entitlement opens wallet even in FREE view');
 await page.locator('#loading').click();assert.equal(await page.locator('.wallet-entry').isDisabled(),true);await page.locator('#loading').click();
 await page.locator('#access').click();await page.locator('#trader').click();
 await page.locator('.pro-control-info').click();assert.equal(await page.locator('#action').textContent(),'offer');
 for(const name of ['cTrader','MT5']) {
  await page.getByRole('button',{name:new RegExp(`^${name} ·`)}).click();assert.equal(await page.locator('#action').textContent(),name==='cTrader'?'ctrader':'mt5');
 }
 await page.locator('#idle').click();
 assert.equal(await page.getByRole('button',{name:/^cTrader ·/}).count(),0,'closed platforms are not accessible');
 await page.locator('.pro-control-trader').focus();await page.keyboard.press('Tab');
 assert.equal(await page.locator('.pro-control-info').evaluate(el=>el===document.activeElement),true);
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('#trader').click();
 const opening=await page.locator('.pro-platform-reveal').evaluate(async el=>{await new Promise(r=>setTimeout(r,100));const mid=el.getBoundingClientRect().height;await new Promise(r=>setTimeout(r,550));return {mid,end:el.getBoundingClientRect().height};});
 assert.ok(opening.mid>0 && opening.mid<opening.end,'opening passes through intermediate height');
 await page.locator('#idle').click();
 const closing=await page.locator('.pro-platform-reveal').evaluate(async el=>{await new Promise(r=>setTimeout(r,100));const mid=el.getBoundingClientRect().height;await new Promise(r=>setTimeout(r,550));return {mid,end:el.getBoundingClientRect().height};});
 assert.ok(closing.mid>0 && closing.mid<opening.end && closing.end<1,'closing animates back to zero');
 await page.evaluate(async()=>{document.querySelector('#trader').click();await new Promise(r=>setTimeout(r,80));document.querySelector('#idle').click();await new Promise(r=>setTimeout(r,80));document.querySelector('#trader').click();await new Promise(r=>setTimeout(r,700));});
 assert.ok((await page.locator('.pro-platform-reveal').boundingBox()).height>40,'rapid reversal ends open');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#idle').click();
 assert.ok((await page.locator('.pro-platform-reveal').boundingBox()).height<1,'reduced motion collapses immediately');
 if(process.env.DAYRIS_QA_DIR) {
  fs.mkdirSync(process.env.DAYRIS_QA_DIR,{recursive:true});
  for(const mode of ['free','idle','trader']) {
   await page.locator(`#${mode}`).click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#stage').screenshot({path:path.join(process.env.DAYRIS_QA_DIR,`workspace-${mode}.png`)});
  }
  await page.locator('#theme').click();await page.locator('#stage').screenshot({path:path.join(process.env.DAYRIS_QA_DIR,'workspace-light.png')});
 }
 for (const motion of ['reduce','no-preference']) {
  await page.emulateMedia({reducedMotion:motion});await page.goto('http://dayris.test/header');
  await page.locator('.wallet-entry').click();
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='main/false/true');
  await page.locator('#access').click();await page.locator('#loading').click();
  assert.equal(await page.locator('.wallet-entry').isDisabled(),true);
  await page.locator('#loading').click();await page.locator('.wallet-entry').click();
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='wallet/true/true');
  await page.getByRole('button',{name:'Вернуться в календарь'}).click();
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='main/true/true');
  await page.locator('.wallet-entry').click();
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='wallet/true/true');
  await page.locator('#access').click();
  await page.waitForFunction(()=>document.querySelector('#state').textContent==='main/true/true');
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: animated open/close, rapid reversal, reduced motion, hidden focus isolation, wallet visible in FREE, entitlement/loading gate, real Header FREE-to-wallet/back/revocation with and without view transitions, RU/EN/RO, light/dark, 320/360/390/430/1280, platform routing. Production panel CSS.');
} finally {await browser.close();}
