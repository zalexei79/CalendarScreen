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
    await page.locator('#idle').click();
    const idle=await page.locator('.workspace-mode-panel').boundingBox();
    assert.equal(await page.locator('.pro-control-platform:disabled').count(),2);
    await page.locator('#trader').click();
    const active=await page.locator('.workspace-mode-panel').boundingBox();
    assert.ok(Math.abs(active.height-idle.height)<1,'Trader must not change panel height');
    assert.equal(await page.locator('.pro-control-platform:disabled').count(),0);
    const foreground = await page.locator('.pro-platform-label strong').first().evaluate(el=>getComputedStyle(el).color);
    assert.equal(foreground, light ? 'rgb(34, 35, 37)' : 'rgb(243, 240, 233)', 'platform text must match the theme');
    assert.ok(active.height<=140,'PRO panel is compact');
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
 for(const [className,action] of [['pro-control-wallet','wallet'],['pro-control-info','offer']]) {
  await page.locator(`.${className}`).click();assert.equal(await page.locator('#action').textContent(),action);
 }
 for(const name of ['cTrader','MT5']) {
  await page.getByRole('button',{name:new RegExp(`^${name} ·`)}).click();assert.equal(await page.locator('#action').textContent(),name==='cTrader'?'ctrader':'mt5');
 }
 if(process.env.DAYRIS_QA_DIR) {
  fs.mkdirSync(process.env.DAYRIS_QA_DIR,{recursive:true});
  for(const mode of ['free','idle','trader']) {
   await page.locator(`#${mode}`).click();await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#stage').screenshot({path:path.join(process.env.DAYRIS_QA_DIR,`workspace-${mode}.png`)});
  }
  await page.locator('#theme').click();await page.locator('#stage').screenshot({path:path.join(process.env.DAYRIS_QA_DIR,'workspace-light.png')});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: FREE/PRO/Trader heights, no hidden layout, no wrapping overflow, 44px targets, RU/EN/RO, light/dark, 320/360/390/430/1280, distinct platform actions. Screenshots use production panel CSS.');
} finally {await browser.close();}
