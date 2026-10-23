import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptFrameSignal,receiptFrameMotion} from '../src/features/receipts/receiptFrameSignal.js';
const picture=(draw=()=>{})=>{const width=160,height=240,data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const v=draw(x,y)??235,i=(y*width+x)*4;data.set([v,v,v,255],i);}return {data,width,height};};
const printed=(x,y)=>y>20&&y<220&&y%13<3&&x>20&&x<140&&x%7<4?35:235;
test('printed receipt triggers document hint, blank paper and dark scenes do not',()=>{assert.equal(receiptFrameSignal(picture(printed)).document,true);assert.equal(receiptFrameSignal(picture()).document,false);assert.equal(receiptFrameSignal(picture(()=>35)).document,false);});
test('one label or edge is insufficient',()=>{assert.equal(receiptFrameSignal(picture((x,y)=>y>100&&y<106&&x>20&&x<140?35:235)).document,false);assert.equal(receiptFrameSignal(picture((x)=>x<40?30:235)).document,false);});
test('motion compares frames and requires a previous frame',()=>{const a=receiptFrameSignal(picture(printed)).pixels,b=receiptFrameSignal(picture((x,y)=>printed(x+6,y+5))).pixels;assert.equal(receiptFrameMotion(null,a),Infinity);assert.equal(receiptFrameMotion(a,a),0);assert.ok(receiptFrameMotion(a,b)>4);});
