import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';

const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const { build } = createRequire(path.resolve('package.json'))('esbuild');
const bundle = await build({ stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
  import React,{useState} from 'react';
  import {createRoot} from 'react-dom/client';
  import Panel from './src/features/pro/WorkspaceModePanel.jsx';
  import './src/shared/ui/HeaderCompact.css';
  import {translate} from './src/shared/i18n';
  function App(){
    const [trader,setTrader]=useState(false),[action,setAction]=useState('');
    const p=new URLSearchParams(location.search), language=p.get('language')||'ru';
    return <><style>{'body{margin:0;padding:12px;box-sizing:border-box}*{box-sizing:border-box}'}</style>
      <header className="dayris-header"><Panel hideSelector proView walletAccess
        traderMode={trader} onTraderChange={()=>setTrader(!trader)} language={language}
        isLight={p.has('light')} t={key=>translate(language,key)} currency="USD"
        onWallet={()=>setAction('wallet')} onCapital={()=>setAction('capital')}
        onConnect={setAction} onOffer={()=>{}} /></header>
      <button id="outside" style={{marginTop:220}} onClick={()=>{}}>Outside</button><output>{action}</output></>;
  }
  createRoot(document.getElementById('root')).render(<App/>);
` }, bundle:true, write:false, outfile:'trader.js', format:'iife', define:{'process.env.NODE_ENV':'"production"'} });
const js = bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const browser = await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('http://dayris.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${js}</script>`}));
  for(const width of [320,390,430,1280]) for(const language of ['ru','en','ro','zh']) for(const light of [false,true]) {
    await page.setViewportSize({width,height:844});
    await page.goto(`http://dayris.test/?language=${language}${light?'&light':''}`);
    const header=page.locator('header'), trader=page.locator('.pro-control-trader');
    const before=await header.boundingBox();
    await trader.click();
    if(width<640) await page.locator('.pro-platform-popover').waitFor({state:'visible'});
    await page.locator('.wallet-entry').click();
    assert.equal(await page.locator('output').textContent(),'wallet');
    await page.locator('.workspace-capital-entry').click();
    assert.equal(await page.locator('output').textContent(),'capital');
    if(width<640){
      const trigger=page.locator('.pro-platform-trigger'), popup=page.locator('.pro-platform-popover');
      await trigger.click();
      await assert.doesNotReject(()=>popup.waitFor({state:'visible'}));
      await page.waitForFunction(()=>document.querySelector('.pro-platform-trigger').getAttribute('aria-expanded')==='true');
      if(width===390 && language==='ru' && !light) await page.screenshot({path:'artifacts/trader-platform-popover-mobile.png'});
      const box=await popup.boundingBox();
      assert.ok(box.x>=0 && box.x+box.width<=width,'popup stays within phone');
      assert.ok(Math.abs((await header.boundingBox()).height-before.height)<1,'tools do not shift calendar');
      await page.locator('.pro-control-connect').first().click();
      assert.equal(await page.locator('output').textContent(),'ctrader');
      await page.keyboard.press('Escape');
      await popup.waitFor({state:'hidden'});
      await trigger.click();
      await page.locator('#outside').click();
      await popup.waitFor({state:'hidden'});
      for(const selector of ['.wallet-entry','.workspace-capital-entry','.pro-platform-trigger','.pro-control-trader']){
        const b=await page.locator(selector).boundingBox();
        assert.ok(b.x>=0 && b.x+b.width<=width,`${selector} fits at ${width}/${language}`);
      }
    }
    await trader.click();
    assert.equal(await page.locator('.pro-platform-trigger').count(),0);
  }
  assert.deepEqual(errors,[]);
  console.log('Trader destinations and platform popup: 32 viewport/language/theme combinations passed.');
} finally { await browser.close(); }
