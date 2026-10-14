import {createRequire} from 'node:module';import path from 'node:path';import assert from 'node:assert/strict';
const require=createRequire(path.resolve('package.json')),runtime=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url);
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Chart from './src/features/capital/CapitalFullChart.jsx';createRoot(document.getElementById('root')).render(<Chart asset={{symbol:'BTCUSDT',name:'Bitcoin',currency:'USDT',quote_source:'binance'}} rows={[]} locale="ru" onClose={()=>{}}/>);`},bundle:true,write:false,outfile:'test.js',format:'iife',define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://test.invalid'),'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('fixture-key')}});
const browser=await runtime('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844}});await context.addInitScript(()=>{class Socket{constructor(){this.readyState=0;queueMicrotask(()=>{this.readyState=1;this.onopen?.();});}close(){this.readyState=3;this.onclose?.();}}window.WebSocket=Socket;});
 const page=await context.newPage(),errors=[];let requests=0;page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://history.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><style>${bundle.outputFiles.find(f=>f.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(f=>f.path.endsWith('.js')).text}</script>`}));
 await page.route('https://data-api.binance.vision/api/v3/klines*',route=>{
  const url=new URL(route.request().url());requests++;if(requests===2)return route.fulfill({status:429,body:''});if(requests>3)return route.fulfill({contentType:'application/json',body:'[]'});
  const last=url.searchParams.has('endTime')?Math.floor(Number(url.searchParams.get('endTime'))/60000)*60000:Date.UTC(2026,9,14,12);
  const rows=Array.from({length:500},(_,i)=>[last-(499-i)*60000,'100','110','90','105','10']);return route.fulfill({contentType:'application/json',body:JSON.stringify(rows)});
 });
 await page.goto('http://history.test');await page.waitForFunction(()=>document.querySelector('.capital-chart-canvas')?.dataset.totalBars==='500');
 for(let i=0;i<12&&Number(await page.locator('.capital-chart-canvas').getAttribute('data-range-from'))>=12;i++)await page.getByRole('button',{name:'Уменьшить',exact:true}).click();
 await page.getByText(/Не удалось подгрузить историю/).waitFor();assert.equal(requests,2);
 await page.getByRole('button',{name:'Повторить',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.capital-chart-canvas')?.dataset.totalBars==='1000');
 await page.waitForTimeout(1400);const plot=await page.locator('.capital-chart-canvas').boundingBox();for(let i=0;i<3;i++){await page.mouse.move(plot.x+60,plot.y+plot.height/2);await page.mouse.down();await page.mouse.move(plot.x+260,plot.y+plot.height/2,{steps:12});await page.mouse.up();}
 await page.getByText('Достигнуто начало доступной истории инструмента.',{exact:true}).waitFor();assert.equal(requests,4);assert.deepEqual(errors,[]);console.log('PASS: automatic paging, retry after rate limit, 1,000 candles retained and honest history-end message.');
}finally{await browser.close();}
