import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:[path.resolve('tests/platforms-ui.jsx')],bundle:true,write:false,outfile:'platforms-fixture.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const js = bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 const page = await browser.newPage({viewport:{width:390,height:844}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://dayris.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}\nbody{margin:0;background:#101112;color:#f3f0e9;font-family:system-ui}main{padding:12px}main>section{margin-top:24px}button{cursor:pointer;font-family:inherit}main>section:not(.pro-dialog){padding:12px;border:1px solid #45464b;border-radius:16px}svg{max-width:24px;max-height:24px}</style><div id="root"></div><script>${js}</script></html>`}));
 await page.goto('http://dayris.test/');
 const toolbar=page.locator('.pro-actions');
 await toolbar.getByRole('button',{name:/^cTrader · Подключён/}).click();
 const menu=page.getByTestId('platform-menu');
 await menu.getByRole('heading',{name:'cTrader',exact:true}).waitFor();
 await menu.getByRole('button',{name:/^cTrader · Синх/}).click();
 await menu.getByText('Новых сделок нет — проверка завершена.',{exact:true}).waitFor();
 await toolbar.getByRole('button',{name:/^MT5 · Не подключён/}).click();
 await menu.getByRole('heading',{name:/MetaTrader 5/}).waitFor();
 await page.getByTestId('history').getByRole('button',{name:/^cTrader/}).click();
 await menu.getByRole('heading',{name:'cTrader',exact:true}).waitFor();
 await page.getByTestId('history').getByRole('button',{name:/^MT5/}).click();
 await menu.getByRole('heading',{name:/MetaTrader 5/}).waitFor();
 for (const width of [320,390,1280]) {
  await page.setViewportSize({width,height:900});
  for (const label of ['cTrader','MT5']) {
   const box=await toolbar.locator('button').filter({has:page.locator('span',{hasText:label})}).boundingBox();
   assert.ok(box && box.width>40 && box.x>=0 && box.x+box.width<=width,`${label} toolbar at ${width}`);
   const style=await toolbar.getByText(label,{exact:true}).evaluate(el=>getComputedStyle(el).clipPath);
   assert.equal(style,'none');
  }
 }
 await page.getByRole('tab',{name:'Трейдинг',exact:true}).click();
 await page.getByRole('tabpanel').getByRole('heading',{name:'MetaTrader 5',exact:true}).waitFor();
 await page.getByRole('tabpanel').getByText(/Chrome\/Edge/).waitFor();
 await page.getByRole('button',{name:'Открыть торговые площадки',exact:true}).click();
 await menu.getByRole('heading',{name:'Торговые площадки',exact:true}).waitFor();
 await page.locator('#theme').click();
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.locator('.pro-light').count(),2);
 assert.deepEqual(errors,[]);
 // Optional QA screenshots contain only synthetic fixture data.
 if(process.env.DAYRIS_QA_DIR) { fs.mkdirSync(process.env.DAYRIS_QA_DIR,{recursive:true}); await page.screenshot({path:path.join(process.env.DAYRIS_QA_DIR,'platforms-mobile.png'),fullPage:true}); }
 console.log('PASS: distinct toolbar menus, history routing, persistent sync result, platform chooser, PRO booklet, visible provider names at 320/390/1280, light theme, no browser errors. Utility CSS not tested.');
} finally {await browser.close();}
