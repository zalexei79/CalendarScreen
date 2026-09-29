import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
// Optional external test runtime; no production dependency or broker access.
// Run from the repo root with Playwright installed, or set DAYRIS_PLAYWRIGHT_PACKAGE.
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const repoRequire = createRequire(path.resolve('package.json'));
const bundle = await repoRequire('esbuild').build({ entryPoints: [path.resolve('tests/metatrader-ui.jsx')], bundle: true, write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
 const page = await browser.newPage({viewport:{width:390,height:844}});
 const errors=[]; page.on('pageerror', error=>errors.push(error.message));
 await page.addInitScript(()=>{
  const header='platform;server;account;ticket;date;time;symbol;direction;profit;swap;commission;currency';
  window.exports=[`${header}\nACCOUNT;MT5;A-Demo;42;Broker A;Demo;1000;USD;2026-09-30 01:00:00\nEND`,`${header}\nACCOUNT;MT5;B-Live;42;Broker B;Live;2000;USD;2026-09-30 01:00:00\nMT5;B-Live;42;123;2026-09-29;12:30:00;EURUSD;buy;20;0;-1;USD\nEND`];
  window.timers=[]; const original=window.setInterval;
  window.setInterval=(cb,ms)=>{if(ms===30000)window.timers.push(cb);return original(cb,ms);};
  window.showDirectoryPicker=async()=>({async *entries(){for(let i=0;i<window.exports.length;i++)yield [`dayris-mt5-${i}.csv`,{kind:'file',getFile:async()=>({size:window.exports[i].length,text:async()=>window.exports[i]})}];}});
 });
 await page.route('https://cdn.tailwindcss.com/**',route=>route.fulfill({body:''}));
 await page.route('http://dayris.test/**', route => route.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script>${bundle.outputFiles[0].text}</script></html>`}));
 await page.goto('http://dayris.test/',{waitUntil:'domcontentloaded',timeout:20000});
 await page.getByRole('button',{name:'Выбрать папку DAYRIS',exact:true}).click();
 await page.getByRole('button',{name:/Broker A/}).click();
 await page.getByRole('button',{name:'Подключить и синхронизировать',exact:true}).click();
 assert.equal(await page.locator('#saved').textContent(),'0');
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Выбрать счёт',exact:true}).click();
 await page.getByRole('button',{name:/Broker B/}).click();
 assert.equal(await page.getByRole('checkbox').count(),0);
 await page.getByRole('button',{name:'Подключить и синхронизировать',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#saved').textContent==='1');
 await page.getByRole('button',{name:'Синхронизировать',exact:true}).click();
 assert.equal(await page.locator('#saved').textContent(),'1');
 await page.getByRole('checkbox').check();
 await page.evaluate(async()=>{await window.timers.at(-1)();});
 assert.equal(await page.locator('#saved').textContent(),'1');
 await page.getByRole('button',{name:'Отключить',exact:true}).click();
 await page.getByRole('button',{name:'Отключить',exact:true}).click();
 assert.equal(await page.getByRole('checkbox').count(),0);
 assert.equal(await page.locator('#saved').textContent(),'1');
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.locator('#owner').click(); await page.locator('#open').click();
 assert.equal(await page.locator('#saved').textContent(),'0');
 assert.equal(await page.getByRole('button',{name:'Синхронизировать',exact:true}).count(),0);
 await page.getByRole('button',{name:'Закрыть',exact:true}).click();
 await page.locator('#pro').click(); await page.locator('#open').click();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.locator('#pro').click(); await page.setViewportSize({width:1280,height:900});
 await page.getByRole('button',{name:'Выбрать папку DAYRIS',exact:true}).click();
 await page.getByRole('button',{name:/Broker B/}).click();
 await page.getByRole('button',{name:'Подключить и синхронизировать',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#saved').textContent==='1');
 assert.deepEqual(errors,[]);
 console.log('PASS: empty account, account selection, broker isolation, duplicate prevention, auto-sync, disconnect preserves history, owner isolation, PRO gate, desktop/mobile interaction. CSS unavailable: not visual QA.');
} finally {await browser.close();}
