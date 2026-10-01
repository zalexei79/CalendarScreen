import { createRequire } from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const local = createRequire(path.resolve('package.json'));
const bundle = await local('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import Label from './src/shared/ui/AnimatedMonthLabel.jsx';
  const root=createRoot(document.getElementById('root'));
  window.showMonth=(month,label)=>root.render(<Label month={month} year={2026} label={label}/>);
  showMonth(8,'Сентябрь');
`},bundle:true,write:false,outfile:'label.js',format:'iife'});
const browser = await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage();
  await page.route('http://label.test/**',r=>r.fulfill({contentType:'text/html',body:`<style>${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
  await page.goto('http://label.test');
  await page.locator('.dayris-month-label').waitFor();
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
  console.log('PASS: directional title crossfade, rapid reversal, settled position and reduced motion.');
} finally { await browser.close(); }
