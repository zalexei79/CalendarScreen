import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const local = createRequire(path.resolve('package.json'));
const bundle = await local('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import Label from './src/shared/ui/AnimatedMonthLabel.jsx';
  const root=createRoot(document.getElementById('root'));
  window.showMonth=(month,label)=>root.render(<div className="dayris-month-title"><span><Label month={month} year={2026} label={label}/></span><span className="test-year">2026</span></div>);
  showMonth(8,'Сентябрь');
`},bundle:true,write:false,outfile:'label.js',format:'iife'});
const playwright = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');
const browser = await (process.env.DAYRIS_TEST_WEBKIT ? playwright.webkit.launch({headless:true}) : playwright.chromium.launch({channel:'msedge',headless:true}));
let releaseFont;
const fontGate=new Promise(resolve=>releaseFont=resolve);
try {
  const page=await browser.newPage();
  await page.route('http://label.test/**',async r=>{
    if(new URL(r.request().url()).pathname==='/delayed.ttf'){await fontGate;return r.fulfill({contentType:'font/ttf',body:fs.readFileSync('C:/Windows/Fonts/arialbd.ttf')});}
    return r.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><style>${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}@font-face{font-family:DelayedMonth;src:url('/delayed.ttf');font-display:swap}.dayris-month-title{display:flex;align-items:baseline;gap:8px;font:600 32px DelayedMonth,serif}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`});
  });
  await page.goto('http://label.test',{waitUntil:'domcontentloaded'});
  await page.locator('.dayris-month-label').waitFor();
  const initialWidth=await page.locator('.dayris-month-label').evaluate(el=>el.offsetWidth);
  releaseFont();await page.evaluate(()=>document.fonts.load('600 32px DelayedMonth','Сентябрь'));
  await page.waitForFunction(initialWidth=>document.querySelector('.dayris-month-label > span').offsetWidth!==initialWidth,initialWidth);
  assert.notEqual(await page.locator('.dayris-month-label > span').evaluate(el=>el.offsetWidth),initialWidth,'test font must change text metrics after mount');
  const assertAligned=async()=>{
    await page.waitForFunction(()=>{const label=document.querySelector('.dayris-month-label'),text=label.querySelector('span:not(.dayris-month-outgoing)');return Math.abs(label.offsetWidth-text.offsetWidth)<1;});
    assert.ok(await page.evaluate(()=>{const label=document.querySelector('.dayris-month-label').getBoundingClientRect(),year=document.querySelector('.test-year').getBoundingClientRect();return Math.abs(year.left-label.right-8)<1;}),'year keeps its normal gap without navigating months');
  };
  await assertAligned();
  await page.locator('.dayris-month-title').evaluate(el=>el.style.fontSize='40px');
  await assertAligned();
  await page.evaluate(()=>showMonth(9,'Октябрь'));
  await page.locator('.dayris-month-incoming').waitFor();
  assert.equal(await page.locator('.dayris-month-outgoing').textContent(),'Сентябрь');
  assert.equal(await page.locator('.dayris-month-label').evaluate(el=>el.style.getPropertyValue('--label-direction')),'1');
  await page.evaluate(()=>showMonth(7,'Август'));
  await page.waitForFunction(()=>document.querySelector('.dayris-month-incoming').textContent==='Август');
  assert.equal(await page.locator('.dayris-month-label').evaluate(el=>el.style.getPropertyValue('--label-direction')),'-1');
  await page.waitForTimeout(450);
  assert.equal(await page.locator('.dayris-month-incoming').evaluate(el=>getComputedStyle(el).transform),'matrix(1, 0, 0, 1, 0, 0)');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.dayris-month-outgoing').evaluate(el=>getComputedStyle(el).display),'none');
  console.log('PASS: delayed font load and responsive text sizing keep year aligned; directional crossfade, rapid reversal and reduced motion preserved.');
} finally { releaseFont();await browser.close(); }
