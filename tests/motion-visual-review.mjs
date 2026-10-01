import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:['tests/workspace-panel-ui.jsx'],bundle:true,write:false,outfile:'review.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(f=>f.path.endsWith('.css')).text;
const utilities=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>f.endsWith('.css'))),'utf8');
const screenCSS=fs.readFileSync('CalendarScreen.jsx','utf8').split('<style>{`')[1].split('`}</style>')[0];
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  await page.route('http://review.test/**',route=>{
    const name=path.basename(new URL(route.request().url()).pathname);
    const asset=path.join('public',name);
    if(name.endsWith('.png') && fs.existsSync(asset)) return route.fulfill({contentType:'image/png',body:fs.readFileSync(asset)});
    return route.fulfill({contentType:'text/html',body:`<html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${utilities}${css}${screenCSS}body{margin:0;background:#09090b}</style><div id="root"></div><script>${js}</script></html>`});
  });
  await page.goto('http://review.test/header?preview=1&mode=idle');
  await page.locator('.calendar-section').waitFor(); await page.waitForTimeout(650);
  const rest=path.join(os.tmpdir(),'dayris-motion-rest.png');
  await page.screenshot({path:rest});
  const cdp=await context.newCDPSession(page);
  const box=await page.locator('.calendar-days-grid').boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y:box.y+60,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:110,y:box.y+60,id:1}]});
  await page.waitForTimeout(80);
  const drag=path.join(os.tmpdir(),'dayris-motion-drag.png'); await page.screenshot({path:drag});
  console.log(JSON.stringify({rest,drag}));
} finally {await browser.close();}
