import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {gunzipSync} from 'node:zlib';
const require=createRequire(path.resolve('package.json'));
const {chromium}=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
  import React from 'react';import{createRoot}from'react-dom/client';
  import Scanner from './src/features/receipts/ReceiptScanner.jsx';
  import{receiptCopy}from'./src/features/receipts/receiptCopy.js';
  import{receiptFrameSignal,receiptFrameMotion}from'./src/features/receipts/receiptFrameSignal.js';
  import{receiptFrameStructure}from'./src/features/receipts/receiptCaptureTracker.js';
  import{receiptFrameQuality}from'./src/features/receipts/receiptFrameQuality.js';
  import './src/features/receipts/ReceiptCapture.css';
  window.files=[];
  window.probe=()=>{const video=document.querySelector('video'),box=document.querySelector('.receipt-viewfinder').getBoundingClientRect(),frame=document.querySelector('.receipt-scan-frame').getBoundingClientRect();const scale=Math.max(box.width/video.videoWidth,box.height/video.videoHeight),sample=document.createElement('canvas');sample.width=320;sample.height=480;const context=sample.getContext('2d');context.drawImage(video,(frame.left-box.left+(video.videoWidth*scale-box.width)/2)/scale,(frame.top-box.top+(video.videoHeight*scale-box.height)/2)/scale,frame.width/scale,frame.height/scale,0,0,320,480);const signal=receiptFrameSignal(context.getImageData(0,0,320,480)),structure=receiptFrameStructure(signal.pixels,320,480),motion=receiptFrameMotion(window.previousProbe,structure);window.previousProbe=structure;return{detected:signal.document,motion,...receiptFrameQuality(signal.pixels,320,480)};};
  function App(){const[open,setOpen]=React.useState(true);return open&&<dialog open className="receipt-dialog" data-scanner="true"><Scanner c={receiptCopy('ru')} onClose={()=>setOpen(false)} onGallery={()=>Promise.resolve()} onNativeCamera={()=>{}} onFile={file=>{window.files.push(file);setOpen(false);}}/></dialog>;}
  createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
`},bundle:true,write:false,outfile:'scanner.js'});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(sample=>{
    window.files=[];window.scene='blur';window.shake=0;window.stopped=0;window.opened=0;window.focusRequests=0;
    const receipt=document.createElement('canvas');receipt.width=480;receipt.height=800;
    const text=receipt.getContext('2d');text.fillStyle='#eee';text.fillRect(0,0,480,800);text.fillStyle='#222';
    text.font='bold 24px monospace';text.fillText('MARKET / BON FISCAL',40,65);text.font='19px monospace';
    for(let i=0;i<18;i++)text.fillText('PRODUS '+String(i+1).padStart(2,'0')+'   2 x 14.90',40,105+i*30);
    text.font='bold 28px monospace';text.fillText('TOTAL LEI  536.40',40,720);
    const original=document.createElement('canvas');original.width=160;original.height=240;original.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(sample),160,240),0,0);
    const canvas=document.createElement('canvas');canvas.width=480;canvas.height=800;
    const draw=()=>{
      const c=canvas.getContext('2d');c.fillStyle='#eee';c.fillRect(0,0,480,800);c.save();
      if(window.scene==='blur')c.filter='blur(2.5px)';
      if(window.scene==='dim')c.filter='brightness(.76)';
      if(window.scene==='bright')c.filter='brightness(1.18)';
      const offset=window.scene==='moving'?(Math.floor(performance.now()/150)%2?30:-30):window.shake;
      c.drawImage(['original','dim','bright'].includes(window.scene)?original:receipt,offset,0,480,800);c.restore();
    };
    draw();setInterval(draw,40);
    Object.defineProperty(navigator,'mediaDevices',{value:{getUserMedia:async()=>{
      window.opened++;const media=canvas.captureStream(25);
      for(const track of media.getTracks()){
        track.getCapabilities=()=>({focusMode:['continuous']});
        track.applyConstraints=async constraints=>{if(constraints.advanced?.[0].focusMode==='continuous')window.focusRequests++;};
        const stop=track.stop.bind(track);track.stop=()=>{window.stopped++;stop();};
      }
      return media;
    }}});
  },Array.from(gunzipSync(fs.readFileSync(new URL('./fixtures/receipt-screen-frame.rgba.gz',import.meta.url)))));
  await page.route('http://scanner.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#111;font-family:Arial}*{box-sizing:border-box}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
  const start=async scene=>{await page.goto('http://scanner.test');await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);await page.evaluate(value=>scene=value,scene);};
  await start('blur');await page.waitForTimeout(2200);
  const blurred=await page.evaluate(()=>probe());
  console.log('Blurred frame',blurred);
  assert.equal(blurred.ready,false,'soft text fails the separate sharpness gate');
  assert.equal(await page.evaluate(()=>files.length),0,'stationary blurred receipt never captures');
  await page.evaluate(()=>scene='moving');await page.waitForTimeout(2200);
  assert.equal(await page.evaluate(()=>files.length),0,'continuous hand shake never captures');
  await page.evaluate(()=>scene='sharp');await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(()=>files.length),0,'one second is insufficient');
  await page.evaluate(()=>{scene='moving';});await page.waitForTimeout(600);
  await page.evaluate(()=>scene='sharp');await page.waitForTimeout(1000);
  assert.equal(await page.evaluate(()=>files.length),0,'a shake clears the previous hold');
  await page.waitForFunction(()=>files.length===1,{},{timeout:6000});
  assert.equal(await page.evaluate(()=>stopped),await page.evaluate(()=>opened));
  assert.ok(await page.evaluate(()=>focusRequests>0),'hardware continuous autofocus requested');
  await page.waitForTimeout(600);assert.equal(await page.evaluate(()=>files.length),1);
  await page.setViewportSize({width:1280,height:900});
  await start('original');await page.waitForTimeout(800);
  console.log('Reported receipt frame',await page.evaluate(()=>probe()));
  await page.getByRole('button',{name:/Авто/}).click();
  await page.evaluate(()=>scene='dim');await page.waitForTimeout(400);
  const dim=await page.evaluate(()=>probe());assert.equal(dim.ready,true,'exposure alone does not spoil sharpness');
  await page.evaluate(()=>scene='bright');await page.waitForTimeout(400);
  const bright=await page.evaluate(()=>probe());assert.equal(bright.ready,true);assert.ok(bright.motion<4.5,'exposure alone does not count as shake');
  await page.evaluate(()=>scene='original');await page.getByRole('button',{name:/Авто/}).click();
  await page.waitForFunction(()=>files.length===1,{},{timeout:6000});
  assert.deepEqual(errors,[]);
  console.log('PASS: blur and hand shake blocked, hold restarts after shake, sharp stable frame captures once, optional autofocus, reported receipt still captures');
}finally{await browser.close();}
