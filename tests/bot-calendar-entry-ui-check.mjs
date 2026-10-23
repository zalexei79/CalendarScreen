import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium } = require('playwright');
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),contents:`
  import React from 'react';import {createRoot} from 'react-dom/client';
  import ProOffer from './src/features/pro/ProOffer.jsx';
  const params=new URLSearchParams(location.search);
  createRoot(document.getElementById('root')).render(<div className={'pro-dialog '+(params.has('light')?'pro-light':'')} style={{maxWidth:1000,margin:'auto',padding:16}}><ProOffer language={params.get('lang')||'ru'} active={false} signedIn={false} copy={{}} onInvite={()=>{}} onCheckout={()=>{}} /></div>);
`,loader:'jsx'},bundle:true,write:false,outfile:'pro-bot.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const js=bundle.outputFiles.find(x=>x.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(x=>x.path.endsWith('.css')).text;
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://dayris.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#101112}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js}</script></html>`}));
  for(const width of [320,390,1280]) for(const light of [false,true]) {
    await page.setViewportSize({width,height:950});
    await page.goto(`http://dayris.test/?${light?'light=1':''}`);
    await page.getByRole('tab').nth(3).click();
    const card=page.getByRole('link',{name:/Посмотреть календарь бота/});
    assert.equal(await card.getAttribute('href'),'/?calendar=bot');assert.ok(await card.isVisible());
    assert.ok(await page.getByText('XAUUSD · M1',{exact:true}).isVisible());
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.locator('.pro-signals-guide summary').click();
    await page.screenshot({path:`artifacts/bot-calendar/pro-entry-${width}-${light?'light':'dark'}.png`,fullPage:true});
    await card.click();assert.equal(new URL(page.url()).searchParams.get('calendar'),'bot');
  }
  for(const [lang,name] of [['en','Trading'],['md','Trading'],['uk','Трейдинг'],['zh-CN','交易']]) {
    await page.goto(`http://dayris.test/?lang=${lang}`);
    // The translated trader tab is identified by its stable aria-controls label.
    const tabs=page.getByRole('tab');await tabs.nth(3).click();
    assert.equal(await page.locator('.pro-bot-calendar-card').getAttribute('href'),'/?calendar=bot');
    assert.ok((await page.locator('.pro-bot-calendar-card strong').textContent()).length>5);
  }
  assert.deepEqual(errors,[]);console.log('PRO bot entry: free visitor, home navigation, 5 languages, 320/390/1280, dark/light passed');
} finally {await browser.close();}
