import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import CategoryPicker from './src/shared/ui/CategoryPicker.jsx';
function App(){const[value,setValue]=useState('Раздел 1');return <><CategoryPicker options={Array.from({length:80},(_,i)=>({value:'Раздел '+i,label:'Раздел '+i}))} value={value} onChange={setValue} onCreate={name=>name}/><output>{value}</output></>;}createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'swipe.js',define:{'process.env.NODE_ENV':'"production"'}});
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(6000);
 await page.route('http://category-swipe.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}*{box-sizing:border-box}body{margin:0;padding:24px;font:14px system-ui;background:#101114}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://category-swipe.test');const cdp=await context.newCDPSession(page);
 const send=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
 const open=async()=>{await page.locator('.category-picker-trigger').click();await page.getByRole('dialog').waitFor();await page.waitForTimeout(380);};
 const headerPoint=async()=>{const box=await page.locator('.category-picker-sheet>header').boundingBox();return {x:box.x+55,y:box.y+22};};
 const swipe=async(point,dx,dy,{cancel=false,delay=24}={})=>{await send('touchStart',point.x,point.y);for(let i=1;i<=8;i++){await page.waitForTimeout(delay);await send('touchMove',point.x+dx*i/8,point.y+dy*i/8);}await send(cancel?'touchCancel':'touchEnd');};
 await open();let point=await headerPoint();await send('touchStart',point.x,point.y);await send('touchMove',point.x,point.y+45);await page.waitForTimeout(25);
 assert.ok(await page.locator('.category-picker-motion').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42)>30,'panel follows the finger');
 await send('touchCancel');await page.waitForTimeout(310);assert.equal(await page.locator('.category-picker-motion').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m42),0);
 await swipe(await headerPoint(),0,20,{delay:45});assert.equal(await page.getByRole('dialog').count(),1,'short pull returns');
 await swipe(await headerPoint(),120,3);assert.equal(await page.getByRole('dialog').count(),1,'horizontal touch does not close');
 const list=await page.locator('.category-picker-scroll').boundingBox();await swipe({x:180,y:list.y+list.height-60},0,-180);await page.waitForTimeout(280);
 assert.ok(await page.locator('.category-picker-scroll').evaluate(el=>el.scrollTop)>0,'list scrolls normally');
 await swipe({x:180,y:list.y+50},0,135);assert.equal(await page.getByRole('dialog').count(),1,'scrolling back down does not close');await page.waitForTimeout(280);
 await swipe(await headerPoint(),0,140);await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.locator('output').textContent(),'Раздел 1','dragging never selects a category');assert.equal(await page.locator('#root').evaluate(el=>el.inert),false);
 await page.emulateMedia({reducedMotion:'reduce'});await open();await page.getByRole('button',{name:'Добавить раздел',exact:true}).click();await page.getByRole('textbox',{name:'Название раздела'}).fill('Черновик');await swipe(await headerPoint(),0,140);await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.locator('output').textContent(),'Раздел 1','swipe cancels without saving a draft');
 assert.deepEqual(errors,[]);console.log('PASS: native touch drag, return, cancellation, horizontal isolation, native list scrolling, dismiss, draft preservation and reduced motion');
}finally{await browser.close();}
