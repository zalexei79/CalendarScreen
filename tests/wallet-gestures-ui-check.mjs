import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
const require=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:[path.resolve('tests/wallet-gestures-ui.jsx')],bundle:true,write:false,outfile:'wallet.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(file=>file.path.endsWith('.css')).text;
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage(), errors=[];
  page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>localStorage.setItem('dayris_wallet_onboarding_v2','1'));
  await page.route('http://dayris.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}
    body{margin:0;font:14px system-ui}*{box-sizing:border-box}svg{width:18px;height:18px}button,input,select{font:inherit;padding:12px}p{margin:8px 0}.wallet-panel-enter{height:650px;overflow-y:auto;padding:16px}.wallet-gesture-content>.space-y-2>div{min-height:80px}.fixed{position:fixed;inset:0;background:#111;color:white;z-index:220}form{padding:20px;height:100%;overflow:auto}form label{display:block;margin:12px 0}
    </style><div id="root"></div><script>${js}</script></html>`}));
  const cdp=await context.newCDPSession(page);
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function send(type,x,y) {
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1,radiusX:2,radiusY:2}]});
  }
  // Visibility can precede React's passive effect that installs native listeners.
  async function fresh() {await page.goto('http://dayris.test/');await page.locator('.wallet-gesture-content h2').waitFor();await page.waitForTimeout(75);}
  async function swipe(x,y,dx,dy,{duration=160,cancel=false,steps=8}={}) {
    await send('touchStart',x,y);
    for(let i=1;i<=steps;i++){await delay(duration/steps);await send('touchMove',x+dx*i/steps,y+dy*i/steps);}
    await send(cancel?'touchCancel':'touchEnd');
  }
  async function remains() {assert.equal(await page.locator('#calendar').count(),0);assert.equal(await page.locator('.wallet-gesture-content').count(),1);}
  async function returns() {await page.locator('#calendar').waitFor();}
  // Actual browser touch events, including native scroll arbitration.
  for(const dx of [-130,130]) {await fresh();await swipe(195,110,dx,3);await returns();}
  await fresh();await swipe(195,110,60,0,{duration:0,steps:2});await returns();
  await fresh();await swipe(195,110,60,0,{duration:700});await remains();
  await fresh();await swipe(195,110,24,0);await remains();
  await fresh();await swipe(195,110,0,175,{duration:450});await returns();
  await fresh();await swipe(195,110,0,90);await remains();
  await fresh();await swipe(195,110,130,0,{cancel:true});await remains();
  await fresh();await swipe(195,110,40,160);await returns();
  await fresh();await swipe(195,110,90,90);await remains();
  // Normal upward scrolling and pulling a scrolled list back to its top do not exit.
  await fresh();await swipe(190,580,0,-230,{duration:350});await remains();
  assert.ok(await page.locator('.wallet-panel-enter').evaluate(el=>el.scrollTop)>0);
  await page.locator('.wallet-panel-enter').evaluate(el=>{el.scrollTop=250;});
  await swipe(190,180,0,220,{duration:450});await remains();
  // Body scrolling is also a scroll boundary, not just the wallet section.
  await fresh();await page.evaluate(()=>{document.querySelector('.wallet-panel-enter').style.height='auto';document.scrollingElement.scrollTop=250;});
  assert.ok(await page.evaluate(()=>document.scrollingElement.scrollTop)>0);
  await swipe(190,180,0,200,{duration:400});await remains();
  await fresh();const select=await page.locator('select').boundingBox();await swipe(select.x+select.width/2,select.y+select.height/2,-110,0);await remains();
  await fresh();await page.getByRole('button',{name:'Add money',exact:true}).click();
  await page.locator('form').waitFor();await swipe(195,110,130,0);await remains();
  await page.locator('input[type="number"]').fill('42');
  const input=await page.locator('input[type="number"]').boundingBox();await swipe(input.x+input.width/2,input.y+input.height/2,80,0);await remains();
  assert.equal(await page.locator('input[type="number"]').inputValue(),'42');
  // A second finger cancels; lifting it cannot resume the old navigation gesture.
  await fresh();await send('touchStart',130,110);await send('touchMove',180,110);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:110,id:1},{x:230,y:150,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:240,y:110,id:1},{x:290,y:150,id:2}]});
  await send('touchEnd');await remains();
  // The content follows the finger and snaps back when the gesture is cancelled.
  await page.emulateMedia({reducedMotion:'no-preference'});await fresh();
  await send('touchStart',150,110);await send('touchMove',220,110);
  assert.notEqual(await page.locator('.wallet-gesture-content').evaluate(el=>getComputedStyle(el).transform),'none');
  await send('touchCancel');await remains();
  await swipe(195,110,-130,0);await returns();
  assert.deepEqual(errors,[]);
  console.log('PASS: left/right flick, distance and speed thresholds, strong pull-down, cancellation, native section/body scrolling, currency/form isolation, preserved input, multitouch, reduced motion and animated return.');
} finally {await browser.close();}
