import test from 'node:test';
import assert from 'node:assert/strict';
import {receiptFrameQuality} from '../src/features/receipts/receiptFrameQuality.js';
import {receiptFrameStructure} from '../src/features/receipts/receiptCaptureTracker.js';
import {receiptFrameMotion} from '../src/features/receipts/receiptFrameSignal.js';

const width=320,height=480;
function printed(ink=35,paper=235,shift=0){return Uint8Array.from({length:width*height},(_,i)=>{const x=i%width+shift,y=Math.floor(i/width);return y>40&&y<440&&y%23<5&&x>45&&x<275&&x%15<8?ink:paper;});}
function blur(pixels,radius=4){
  let input=pixels;
  for(let pass=0;pass<2;pass++){
    const output=new Uint8Array(input.length);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      let sum=0,count=0;
      for(let d=-radius;d<=radius;d++){const xx=pass?x:Math.max(0,Math.min(width-1,x+d)),yy=pass?Math.max(0,Math.min(height-1,y+d)):y;sum+=input[yy*width+xx];count++;}
      output[y*width+x]=sum/count;
    }
    input=output;
  }
  return input;
}

test('sharp and faded printed text can both be ready',()=>{for(const pixels of [printed(),printed(145,195)])assert.equal(receiptFrameQuality(pixels,width,height).ready,true);});
test('defocused text is not ready even when the receipt is stationary',()=>{const sharp=receiptFrameQuality(printed(),width,height),soft=receiptFrameQuality(blur(printed()),width,height);assert.equal(soft.ready,false);assert.ok(soft.sharpness<sharp.sharpness*.6);});
test('flat paper, an isolated border and sensor noise do not pass',()=>{for(const pixels of [new Uint8Array(width*height).fill(230),Uint8Array.from({length:width*height},(_,i)=>i%width<40?30:235),Uint8Array.from({length:width*height},(_,i)=>230+(i*17%7)-3)])assert.equal(receiptFrameQuality(pixels,width,height).ready,false);});
test('exposure changes preserve sharpness but real text motion remains visible',()=>{const a=printed(50,190),b=Uint8Array.from(a,v=>v+30),moved=printed(50,190,8),analysis=receiptFrameQuality(a,width,height);assert.ok(Math.abs(analysis.sharpness-receiptFrameQuality(b,width,height).sharpness)<.01);assert.ok(receiptFrameMotion(receiptFrameStructure(a,width,height),receiptFrameStructure(b,width,height))<.01);assert.ok(receiptFrameMotion(receiptFrameStructure(a,width,height),receiptFrameStructure(moved,width,height))>4.5);});
test('camera exposure gain is not mistaken for hand shake',()=>{const a=printed(),dim=Uint8Array.from(a,value=>value*.76),bright=Uint8Array.from(a,value=>Math.min(255,value*1.18));assert.ok(receiptFrameMotion(receiptFrameStructure(dim,width,height),receiptFrameStructure(bright,width,height))<.1);});
