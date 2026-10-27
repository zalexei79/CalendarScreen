// Production bundle with fixture data. Relative rendering-cost measurement,
// not a physical-device FPS certification. Run before/after on the same host;
// DAYRIS_PERF_ASSERT=0 permits measuring an unoptimized baseline build.
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const source=fs.readFileSync('tests/gold-theme-ui-check.mjs','utf8');
const setup=source.slice(0,source.indexOf(' for(const width of [320,390,1280])'))
 .replace("'./life-story-auth-fixture.mjs'",JSON.stringify(pathToFileURL(path.resolve('tests/life-story-auth-fixture.mjs')).href))
 .replaceAll('http://gold.test','https://gold.test')
 .replace(' const page=await context.newPage()',` await context.route('**/rest/v1/reminders**',route=>route.fulfill({contentType:'application/json',body:'[]'}));
 await context.addInitScript(()=>{
  Object.defineProperty(DeviceOrientationEvent,'requestPermission',{configurable:true,value:()=>Promise.resolve('granted')});
  window.__reading=(beta,gamma)=>{const e=new Event('deviceorientation');Object.defineProperties(e,{beta:{value:beta},gamma:{value:gamma}});window.dispatchEvent(e);};
 });
 const page=await context.newPage()`);
const finish=`
 await page.clock.resume();
 const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
 const results=[];
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 for(const theme of ['gold','emerald']) {
  await page.getByRole('button',{name:'Настройки',exact:true}).click();
  if(theme==='emerald')await page.getByRole('button',{name:'Изумрудное',exact:true}).click();
  const toggle=page.getByRole('switch',{name:'Глубина при наклоне',exact:true});
  if(await toggle.getAttribute('aria-checked')!=='true')await toggle.click();
  await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();
  await page.getByRole('button',{name:'История',exact:true}).waitFor();
  for(const width of [1280,390]) {
   await page.setViewportSize({width,height:width===390?844:950});
   await page.evaluate(()=>window.__reading(45,0));
   await page.waitForTimeout(500);
   const before=await metrics();
   await cdp.send('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline,cc',transferMode:'ReturnAsStream'});
   const sample=await page.evaluate(async()=>{
    let bodyChanges=0;const observer=new MutationObserver(records=>bodyChanges+=records.length);
    observer.observe(document.body,{attributes:true,attributeFilter:['style']});
    const intervals=[];let previous=performance.now();
    for(let i=0;i<90;i++) {
     await new Promise(requestAnimationFrame);
     const now=performance.now();intervals.push(now-previous);previous=now;
     window.__reading(45+8*Math.sin(i/90*Math.PI*4),11*Math.cos(i/90*Math.PI*4));
    }
    observer.disconnect();intervals.sort((a,b)=>a-b);
    return {bodyChanges,p50:intervals[45],p95:intervals[85],frames:intervals.length};
   });
   const after=await metrics();
   const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');
   const {stream}=await complete;let trace='';
   while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}
   await cdp.send('IO.close',{handle:stream});
   const events=JSON.parse(trace).traceEvents,rendering={};
   for(const name of ['Paint','RasterTask','UpdateLayoutTree','Layout']) {
    const matching=events.filter(e=>e.name===name&&e.ph==='X');
    rendering[name]={count:matching.length,ms:Math.round(matching.reduce((sum,e)=>sum+(e.dur||0),0)/100)/10};
   }
   const delta={};for(const key of ['RecalcStyleCount','RecalcStyleDuration','LayoutCount','LayoutDuration','ScriptDuration','TaskDuration'])delta[key]=after[key]-before[key];
   results.push({theme,width,...sample,rendering,metrics:delta});console.log(JSON.stringify(results.at(-1)));
   if(process.env.DAYRIS_PERF_ASSERT!=='0')assert.equal(sample.bodyChanges,0,'Motion must not invalidate inherited style across the application');
  }
 }
 assert.deepEqual(errors,[]);
 fs.mkdirSync('artifacts/glass-performance',{recursive:true});
 fs.writeFileSync('artifacts/glass-performance/'+(process.env.DAYRIS_PERF_LABEL||'current')+'.json',JSON.stringify({kind:'headless Chromium relative rendering cost',results},null,2));
} finally {await browser.close();}
`;
await import('data:text/javascript;base64,'+Buffer.from(setup+finish).toString('base64')).catch(error=>{console.error(error.message);process.exitCode=1;});
