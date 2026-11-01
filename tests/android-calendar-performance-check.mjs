// Relative CPU/render work on one host with 4x CPU throttling, not device FPS.
import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState,useCallback} from 'react';import {createRoot} from 'react-dom/client';import CalendarGrid from './CalendarGrid.jsx';
const cells=Array.from({length:35},(_,i)=>{const date=new Date(2026,9,i+1);return {date,key:String(i),inMonth:true,isToday:false};});
const notes={},empty=[],records=[{pnl:120}],rows=()=>empty,trades=()=>records,total=()=>120,noop=()=>{};
function App(){const[text,setText]=useState(''),[selected,setSelected]=useState(null),[currency,setCurrency]=useState('USD');
 const format=useCallback(value=>{window.formatCalls=(window.formatCalls||0)+1;return value+' '+currency;},[currency]);
 return <><input aria-label="Draft" value={text} onChange={e=>setText(e.target.value)}/><button onClick={()=>setCurrency('EUR')}>Currency</button><CalendarGrid cells={cells} selectedKey={selected} notes={notes} isLight={false} monthMaxAbsPnl={120} tradesForDayFiltered={trades} plansForDay={rows} totalPnlForDay={total} formatPnlDisplay={format} onSelectDay={setSelected} onEmptyClick={noop} onOpenCapital={noop}/></>;
}createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'calendar-perf.js',define:{'process.env.NODE_ENV':'"production"'}});
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:360,height:740},isMobile:true,hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^main-.*\.css$/.test(file))),'utf8');
 await page.route('http://android-perf.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}body{margin:0;padding:12px;background:#111}input{height:44px;color:black}.calendar-section{min-height:450px}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
 await page.goto('http://android-perf.test');await page.locator('.calendar-day-surface').last().waitFor();
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item=>[item.name,item.value]));
 await page.evaluate(()=>window.formatCalls=0);const before=await metrics();
 await page.getByRole('textbox',{name:'Draft'}).pressSequentially('123456789012');
 const after=await metrics(),typingFormats=await page.evaluate(()=>window.formatCalls);
 await page.getByRole('textbox',{name:'Draft'}).blur();await page.evaluate(()=>window.formatCalls=0);
 const box=await page.locator('.calendar-section').boundingBox(),point={x:180,y:box.y+55};
 const touch=(type,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchCancel'?[]:[{id:1,x:point.x,y}]});
 await touch('touchStart',point.y);for(let i=1;i<=12;i++){await touch('touchMove',point.y+i*7);await page.waitForTimeout(18);}await touch('touchCancel');await page.waitForTimeout(300);
 const dragFormats=await page.evaluate(()=>window.formatCalls);
 await page.getByRole('button',{name:'Currency',exact:true}).click();assert.match(await page.locator('.calendar-day-surface').first().textContent(),/EUR/,'format changes still update cells');
 const result={cpuThrottle:4,typingFormats,dragFormats,typingScriptMs:Math.round((after.ScriptDuration-before.ScriptDuration)*1000),typingLayoutMs:Math.round((after.LayoutDuration-before.LayoutDuration)*1000)};
 fs.mkdirSync('artifacts/android-performance',{recursive:true});fs.writeFileSync('artifacts/android-performance/'+(process.env.DAYRIS_PERF_LABEL||'current')+'.json',JSON.stringify(result,null,2));
 if(process.env.DAYRIS_PERF_ASSERT!=='0'){assert.equal(typingFormats,0,'typing outside the calendar must not repaint all days');assert.equal(dragFormats,0,'tracking a pull must not rerender day content');}
 assert.deepEqual(errors,[]);console.log(JSON.stringify(result));
}finally{await browser.close();}
