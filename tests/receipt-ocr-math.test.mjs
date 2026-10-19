import test from 'node:test';
import assert from 'node:assert/strict';
import {refineReceiptMath} from '../src/features/receipts/receiptOcrMath.js';
import {parseReceipt,receiptValidation} from '../src/features/receipts/receiptModel.js';
const fixture=(row,total='59.90')=>({text:`SHOP\nIDNO: 123\nПиво\n${row}\nTOTAL ${total}\n19-10-2026`,blocks:[{paragraphs:[{lines:[{text:row,words:row.split(' ').map((text,index)=>({text,bbox:{x0:40+index*30,x1:65+index*30,y0:100,y1:120}}))}]}]}]});
test('an independent line read can verify unchanged factors and correct the printed amount',async()=>{
 const data=fixture('2 buc x 29.95 = 59.80 A'),calls=[];
 const text=await refineReceiptMath(data,async(rectangle,mode)=>{calls.push({rectangle,mode});return '2 x 29.95 = 59.90';});
 assert.equal(calls.length,1);assert.ok(calls[0].rectangle.left>0);assert.equal(parseReceipt(text).items[0].printedTotal,'59.90');assert.equal(receiptValidation(parseReceipt(text),'2026-10-19',['MDL']).valid,true);
});
test('changing a factor requires two agreeing independent valid equation readings',async()=>{
 const data=fixture('2 buc x 23.95 = 39.90 A'),calls=[];
 const text=await refineReceiptMath(data,async(_,mode)=>{calls.push(mode);return '2 x 29.95 = 59.90';});
 assert.deepEqual(calls,['7','13']);assert.equal(parseReceipt(text).items[0].unitPrice,'29.95');assert.equal(parseReceipt(text).items[0].total,'59.90');
});
test('arithmetic rejects contradictions; no values are invented to fit the grand total',async()=>{
 const data=fixture('2 buc x 23.95 = 39.90 A');
 for(const readings of [['2 x 29.95 = 59.90','2 x 19.95 = 39.90'],['2 x 23.95 = 39.90','2 x 23.95 = 39.90'],['2 x 29.95 = 59.90','unreadable']]){
  let index=0;assert.equal(await refineReceiptMath(data,async()=>readings[index++]),data.text);
 }
 assert.equal(await refineReceiptMath(data,async()=>{throw new Error('READ_FAILED');}),data.text,'a failed retry preserves the original evidence');
});
test('unambiguous equations need no retry; weighted units and product prefixes survive repair',async()=>{
 let calls=0;const good=fixture('2 buc x 29. 95 = 59.90 A');assert.equal(await refineReceiptMath(good,async()=>{calls++;}),good.text);assert.equal(calls,0);
 const weighted=fixture('Mere 0.125 kg x 10.20 = 1.20 A','1.28');const fixed=await refineReceiptMath(weighted,async()=> '0.125 x 10.20 = 1.28');
 const item=parseReceipt(fixed).items[0];assert.equal(item.name,'Mere');assert.equal(item.unit,'kg');assert.equal(item.quantity,'0.125');assert.equal(item.total,'1.28');
});
test('cancellation stops the numeric re-read',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(refineReceiptMath(fixture('2 buc x 23.95 = 39.90'),async()=>'',{signal:controller.signal}),/CANCELLED/);
});
