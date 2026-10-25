import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import Goal from './MonthlyGoal.jsx';
function App(){const p=new URLSearchParams(location.search);const [currency,setCurrency]=useState('USD'),[month,setMonth]=useState(9),[user,setUser]=useState('alice'),[pnl,setPnl]=useState(42);window.changeCurrency=setCurrency;window.changeMonth=setMonth;window.changeUser=setUser;window.changePnl=setPnl;
const language=p.get('language')||'ru',light=p.has('light');document.documentElement.dataset.dayrisTheme=light?'light':'dark';
return <main style={{padding:12}}><Goal year={2026} month={month} userId={user} currency={currency} currentPnl={pnl} monthSummary={{total:pnl,entries:[{pnl:pnl+58},{pnl:-58}]}} language={language} isLight={light} traderMode={p.has('trader')}/><div id="calendar">Calendar</div></main>;}
createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'overview.js',define:{'process.env.NODE_ENV':'"production"'}});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>/^main-.*\.css$/.test(f))),'utf8');
const browser=await (process.env.DAYRIS_TEST_WEBKIT?require('playwright').webkit.launch({headless:true}):require('playwright').chromium.launch({channel:'msedge',headless:true}));
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.route('http://overview.test/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+' body{margin:0;background:#09090b;color:#ddd}#calendar{padding-top:12px}</style><div id="root"></div><script>'+js+'</script>'}));
 for(const width of [320,390,430,1280]) for(const language of ['ru','en','ro','md','uk','zh']) for(const light of [false,true]){
  await page.setViewportSize({width,height:844});await page.goto('http://overview.test/?language='+language+(light?'&light':''));
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('pro_month_goal_v1:alice:2026-10:USD','100')});await page.reload();
  const overview=page.locator('.calendar-month-overview'),summary=overview.locator(':scope > summary');
  assert.ok((await overview.boundingBox()).height<=48,'one compact row replaces both strips');
  assert.match(await summary.innerText(),/42%/);
  assert.equal(await page.locator('.monthly-goal-bar').isVisible(),false);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  const values=await summary.locator('strong,.month-overview-goal,svg').all();
  for(const value of values){const b=await value.boundingBox();assert.ok(b.x>=0 && b.x+b.width<=width,'summary items stay within viewport');}
  await summary.click();assert.equal(await page.locator('.month-brief-grid > div').count(),3);assert.equal(await page.locator('.monthly-goal-bar').isVisible(),true);
  assert.ok((await page.locator('.goal-progress-track').boundingBox()).height>=3,'expanded goal keeps a visible progress bar');
  assert.ok((await page.locator('.month-overview-progress').boundingBox()).height>=3,'compact summary keeps a visible progress track');
  if(width===390&&language==='uk'&&!light){await summary.click();await page.screenshot({path:'artifacts/month-overview-mobile.png'});await summary.click();}
  await summary.click();assert.ok((await overview.boundingBox()).height<=48);
 }
 await page.goto('http://overview.test/?language=en');
 const overview=page.locator('.calendar-month-overview'),summary=overview.locator(':scope > summary');
 await summary.click();await page.getByRole('button',{name:'Edit goal',exact:true}).click();await page.locator('input').fill('200');await page.getByRole('button',{name:'Save',exact:true}).click();
 await summary.click();assert.match(await summary.innerText(),/21%/);await page.reload();assert.match(await summary.innerText(),/21%/);
 const waitProgress=expected=>page.waitForFunction(expected=>document.querySelector('.calendar-month-overview > summary').textContent.includes('21%')===expected,expected);
 await page.evaluate(()=>changeCurrency('EUR'));await waitProgress(false);await page.evaluate(()=>changeCurrency('USD'));await waitProgress(true);
 await page.evaluate(()=>changeMonth(8));await waitProgress(false);await page.evaluate(()=>changeMonth(9));await waitProgress(true);
 await page.evaluate(()=>changeUser('bob'));await waitProgress(false);await page.evaluate(()=>changeUser('alice'));await waitProgress(true);
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>changePnl(200));await page.waitForFunction(()=>document.querySelector('.month-overview-goal').textContent.includes('Goal achieved') && document.querySelector('.month-overview-progress > i').style.width==='100%');
 assert.equal(await overview.getAttribute('data-goal-achieved'),'true');
 assert.equal(await summary.locator('.month-overview-progress > i').evaluate(el=>el.style.width),'100%');
 await summary.click();assert.ok((await page.locator('.goal-progress-track').boundingBox()).height>=3);
 await page.screenshot({path:'artifacts/month-overview-achieved-mobile.png'});
 await page.evaluate(()=>changePnl(-50));await page.waitForFunction(()=>document.querySelector('.month-overview-goal').textContent.includes('0%') && document.querySelector('.month-overview-progress > i').style.width==='0%');
 assert.equal(await overview.getAttribute('data-goal-achieved'),'false');
 assert.equal(await summary.locator('.month-overview-progress > i').evaluate(el=>el.style.width),'0%');
 await page.goto('http://overview.test/?language=uk&trader');await summary.click();assert.match(await page.locator('.month-brief-details').innerText(),/Прибуткові угоди/);
 assert.deepEqual(errors,[]);console.log('Combined month overview: 48 layouts, disclosure, goal editing/persistence, scope isolation and Ukrainian trading copy passed.');
}finally{await browser.close();}
