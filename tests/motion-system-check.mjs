import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({
  stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import Sheet from './src/shared/ui/SwipeDismissSheet';
    import Cell from './CalendarDayCell';
    import './src/shared/ui/MotionSystem.css';
    import './src/shared/ui/WorkspaceViewport.css';
    createRoot(document.getElementById('root')).render(<main className="premium-shell">
      <header className="dayris-header"><button>DAYRIS</button></header>
      <div className="calendar-days-grid"><Cell cell={{key:'today',inMonth:true,isToday:true,date:new Date()}} cellIndex={0} notes={{}} plans={[]} pnl={0} monthMaxAbsPnl={1} formatPnlDisplay={String}/></div>
      <Sheet data-sheet-entrance="true" style={{background:'#18181b',padding:20}}><h2>Планировщик</h2><button>Запланировать</button></Sheet>
      <div className="calendar-action-dock" data-pulling="false"><div className="calendar-dock-morph"><div className="calendar-dock-actions">История · Добавить</div><div className="calendar-dock-wallet">Открыть кошелёк</div></div></div>
    </main>);
  ` }, bundle: true, write: false, outfile: 'motion.js', format: 'iife', define: {'process.env.NODE_ENV':'"production"'},
});
const js = bundle.outputFiles.find(f => f.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(f => f.path.endsWith('.css')).text;
const browser = await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://motion.test/**',route=>route.fulfill({contentType:'text/html',body:`<html><style>${css}body{background:#09090b;color:#eee;font:16px system-ui}button{height:44px}.calendar-days-grid{height:160px;display:grid}.today-calendar-cell{position:relative}</style><div id="root"></div><script>${js}</script></html>`}));
  await page.goto('http://motion.test');
  await page.locator('.dayris-swipe-sheet').waitFor();
  const sheet = await page.locator('.dayris-swipe-sheet').evaluate(el=>{
    const animation=el.getAnimations()[0]; animation.pause(); animation.currentTime=0;
    return {duration:animation.effect.getTiming().duration,translate:getComputedStyle(el).translate};
  });
  assert.equal(sheet.duration,360); assert.equal(sheet.translate,'0px 24px');
  assert.equal(await page.locator('.today-calendar-cell').evaluate(el=>getComputedStyle(el,'::after').animationName),'todayAmbientGlow');
  const dock = page.locator('.calendar-action-dock');
  await dock.evaluate(el=>el.dataset.pulling='true'); await page.waitForTimeout(350);
  assert.equal(await page.locator('.calendar-dock-wallet').evaluate(el=>getComputedStyle(el).opacity),'1');
  assert.equal(await page.locator('.calendar-dock-actions').evaluate(el=>getComputedStyle(el).opacity),'0');
  assert.equal(await page.locator('.calendar-dock-wallet').evaluate(el=>getComputedStyle(el).filter),'none');
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.dayris-swipe-sheet').evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.equal(await page.locator('.today-calendar-cell').evaluate(el=>getComputedStyle(el,'::after').animationName),'none');
  assert.deepEqual(errors,[]);
  console.log('PASS: real sheet entrance, compositor-only today glow, dock text morph, reduced-motion alternatives.');
} finally { await browser.close(); }
