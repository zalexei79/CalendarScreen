import{openReceiptGallery}from'../src/features/receipts/receiptGallery.js';
import test from 'node:test';import assert from 'node:assert/strict';
import{receiptFrameStructure,createReceiptCaptureTracker,RECEIPT_STEADY_MS}from'../src/features/receipts/receiptCaptureTracker.js';
import{receiptFrameMotion}from'../src/features/receipts/receiptFrameSignal.js';
const quality={ready:true,sharpness:.7};
const observe=(tracker,now,patch={})=>tracker.observe({now,detected:true,motion:1,quality,...patch});
test('exposure flicker no longer looks like document movement',()=>{const a=Uint8Array.from({length:160*240},(_,i)=>80+i%100),b=Uint8Array.from(a,v=>v+35);assert.ok(receiptFrameMotion(a,b)>7);assert.ok(receiptFrameMotion(receiptFrameStructure(a,160,240),receiptFrameStructure(b,160,240))<.01);});
test('requires a continuous sharp and steady hold before automatic capture',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<RECEIPT_STEADY_MS;now+=250)assert.equal(observe(tracker,now).capture,false);assert.equal(observe(tracker,RECEIPT_STEADY_MS).capture,true);});
test('blank, fleeting documents and continuous movement never auto-capture',()=>{for(const scenario of ['blank','fleeting','moving']){const tracker=createReceiptCaptureTracker();for(let now=0;now<=4000;now+=250)assert.equal(observe(tracker,now,{detected:scenario==='moving'||scenario==='fleeting'&&now<500,motion:scenario==='moving'?30:1}).capture,false);}});
test('brief exposure gaps preserve sharp still frames but cannot trigger capture',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<=1000;now+=250)observe(tracker,now);assert.equal(observe(tracker,1250,{detected:false}).reset,false);assert.equal(observe(tracker,1500,{detected:false}).capture,false);assert.equal(observe(tracker,1750).capture,true);});
test('removing the receipt discards the previous capture window',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<=1000;now+=250)observe(tracker,now);for(let now=1250;now<=1750;now+=250)assert.equal(observe(tracker,now,{detected:false}).capture,false);assert.equal(observe(tracker,2000).capture,false);});
test('a detection gap never excuses movement or blur',()=>{for(const patch of [{motion:20},{quality:{ready:false,sharpness:.1}}]){const tracker=createReceiptCaptureTracker();for(let now=0;now<=1000;now+=250)observe(tracker,now);assert.equal(observe(tracker,1250,{detected:false,...patch}).reset,true);assert.equal(observe(tracker,1500).capture,false);}});

test('gallery selection and cancellation release the capture pause',async()=>{for(const type of ['change','cancel']){const input=new EventTarget();let clicked=0;input.click=()=>clicked++;let closed=false;const promise=openReceiptGallery(input).then(()=>closed=true);await Promise.resolve();assert.equal(clicked,1);assert.equal(closed,false);input.dispatchEvent(new Event(type));await promise;assert.equal(closed,true);}});

test('a shake restarts the hold instead of capturing on the next frame',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<=1250;now+=250)observe(tracker,now);assert.equal(observe(tracker,1500,{motion:30}).reset,true);for(let now=1750;now<3250;now+=250)assert.equal(observe(tracker,now).capture,false);assert.equal(observe(tracker,3250).capture,true);});

test('slow cumulative drift restarts even when adjacent frames look steady',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<1500;now+=250)observe(tracker,now,{drift:now/250});assert.equal(observe(tracker,1500,{drift:6}).reset,true);assert.equal(observe(tracker,1750,{drift:1}).capture,false);});

test('stationary blurred frames never become eligible through a timeout',()=>{for(const badQuality of [undefined,{ready:false,sharpness:.12},{ready:true,sharpness:NaN}]){const tracker=createReceiptCaptureTracker();for(let now=0;now<15000;now+=250)assert.equal(observe(tracker,now,{quality:badQuality}).capture,false);}});

test('losing sharpness restarts the stable hold',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<1500;now+=250)observe(tracker,now);assert.equal(observe(tracker,1500,{quality:{ready:false,sharpness:.15}}).reset,true);assert.equal(observe(tracker,1750).capture,false);});

test('autofocus fluctuations must settle before capture',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<=2000;now+=250)assert.equal(observe(tracker,now,{quality:{ready:true,sharpness:now%500?.8:.4}}).capture,false);for(let now=2250;now<3000;now+=250)assert.equal(observe(tracker,now).capture,false);assert.equal(observe(tracker,3000).capture,true);});

test('stalled sampling cannot count unseen time toward the hold',()=>{const tracker=createReceiptCaptureTracker();observe(tracker,0);observe(tracker,250);assert.equal(observe(tracker,3000).reset,true);assert.equal(observe(tracker,3250).capture,false);tracker.reset();assert.equal(observe(tracker,3500).capture,false);});
test('unknown motion cannot pass the stability gate',()=>{const tracker=createReceiptCaptureTracker();for(let now=0;now<=4000;now+=250)assert.equal(observe(tracker,now,{motion:NaN}).capture,false);});
