import test from'node:test';import assert from'node:assert/strict';
import {refineReceiptTotals,locateReceiptTotal}from'../src/features/receipts/receiptOcrTotal.js';
import {receiptPaperBounds}from'../src/features/receipts/receiptOcrImage.js';
import {parseReceiptPhoto,photoAmount}from'../src/features/receipts/receiptPhoto.js';
import {parseReceipt,receiptValidation}from'../src/features/receipts/receiptModel.js';
import {recoverReceiptTotal}from'../src/features/receipts/receiptTotalRecovery.js';
const context={today:'2026-10-20',defaultDateKey:'2026-10-20',defaultCurrency:'MDL'};
const fixture=(label='Сума',amount='22,90')=>({text:`SHOP\nЧек № 123\n${label} ${amount}\n20-10-2026`,blocks:[{paragraphs:[{lines:[{text:`${label} ${amount}\n`,bbox:{x0:10,y0:200,x1:500,y1:240},words:[{text:label,bbox:{x0:10,y0:200,x1:100,y1:240}},{text:amount,bbox:{x0:300,y0:200,x1:450,y1:240}}]}]}]}]});
test('two agreeing total-region readings recover digits without relying on item recognition',async()=>{
 const calls=[],result=await refineReceiptTotals(fixture(),async(rect,mode)=>{calls.push({rect,mode});return'532.90';});
 assert.equal(parseReceiptPhoto(result,context).total,'532.90');assert.equal(calls.length,2);assert.deepEqual(calls.map(call=>call.mode),['7','13']);assert.ok(calls[0].rect.left>200,'read the amount, not the label/background');
});
test('known OCR label confusions require pixels; a fuzzy word alone cannot supply a total',async()=>{
 for(const label of['счма','CYMA','curma','curna','С У М А','T0TAL','Tota1','ИT0Г','И Т О Г','ВСЕГ0','TOTA|']){
  const source=fixture(label,'725,08');assert.equal(parseReceipt(source.text).total,'');assert.equal(parseReceiptPhoto(source,context).kind,'receipt');
  const fixed=await refineReceiptTotals(source,async()=> '725,00');assert.equal(parseReceiptPhoto(fixed,context).total,'725.00',label);
 }
});
test('different numeric readings leave the total for manual review, never choose one',async()=>{
 let index=0;const result=await refineReceiptTotals(fixture('TOTAL','532.90'),async()=>['532.90','582.90'][index++]);
 assert.equal(parseReceiptPhoto(result,context).total,'');assert.equal(result.totalNeedsReview,true);
 for(const reading of['-532.90','53290','532.90 5.00','0.920','unreadable']){
  const result=await refineReceiptTotals(fixture('счма','725,08'),async()=>reading);assert.equal(parseReceiptPhoto(result,context).total,'',reading);
 }
});
test('currency survives total recovery; items and their original amounts are not adjusted',async()=>{
 const data=fixture('TOTAL','25.00 EUR');data.text='SHOP\nMilk 30.00\nTOTAL 25.00 EUR\n20-10-2026';
 const result=await refineReceiptTotals(data,async()=> '25.00'),draft=parseReceiptPhoto(result,context);
 assert.equal(draft.currency,'EUR');assert.equal(draft.items[0].total,'30.00');assert.equal(draft.total,'25.00');assert.equal(receiptValidation(draft,context.today,['EUR']).valid,false);
});
test('products and tax summaries are never total-region candidates',async()=>{
 for(const label of['Total cereal','Sumac','Сума податку','Сума ПДВ']){
  let calls=0;const data=fixture(label,'8.00');const result=await refineReceiptTotals(data,async()=>{calls++;return'8.00';});assert.equal(calls,0,label);assert.equal(result.text,data.text);
 }
 for(const tail of['100.00 5.00','100.00 + 5.00','20% 100.00']){
  let calls=0;const result=await refineReceiptTotals(fixture('TOTAL',tail),async()=>{calls++;return'5.00';});assert.equal(calls,0,tail);assert.equal(result.totalNeedsReview,true);
 }
});
test('Ukrainian totals exclude tax, cash, change and discounts',()=>{
 for(const label of['СУМА','СУММА','Сума до сплати','Загальна сума','РАЗОМ','ВСЬОГО','УСЬОГО','ДО СПЛАТИ','SUMA']){
  const draft=parseReceiptPhoto(`SHOP\n${label} 725.00\nСУМА ПОДАТКУ 120.83\nПДВ 20% 120.83\nГОТІВКА 750.00\nРЕШТА 25.00\nЗнижка -274.00`,context);
  assert.equal(draft.total,'725.00',label);assert.equal(draft.kind,'receipt');assert.equal(draft.currency,'','Ukrainian words do not imply MDL');
 }
});
test('receipt weights and prose cannot become calculator totals',()=>{
 for(const text of['Банан 1.316 x 32.95\n0.920 x 1\nСума 532.90','Milk\n0.920 x 1','Coffee shop\n920.00','Позиции\nОрдера\nXAUUSD\n0.01 Лоты\n64.09'])assert.equal(photoAmount({text}).total,'',text);
 assert.equal(photoAmount({text:'0.920 x 1'}).total,'0.92','a three-decimal factor is a decimal quantity, never thousands');
 assert.equal(photoAmount({text:'29.95 x 2\n59.90'}).total,'59.90');
 assert.equal(photoAmount({text:'2 x 3 = 6\n2 x 4 = 8\n6'}).total,'');
});
test('trading screenshots cannot be saved as expenses even with an edited total',()=>{
 const draft=parseReceiptPhoto('XAUUSD\nПозиции Ордера История\n0.01 Лоты\nРеализ. прибыль 64.09\nБаланс 11306.15',context);
 assert.equal(draft.documentIssue,'trading');assert.equal(draft.kind,'receipt');assert.equal(receiptValidation({...draft,total:'64.09',currency:'USD',dateKey:context.today,items:[]},context.today,['USD']).valid,false);
});
test('cancellation stops total recovery',async()=>{
 const controller=new AbortController();controller.abort();await assert.rejects(refineReceiptTotals(fixture(),async()=>'',{signal:controller.signal}),/CANCELLED/);
});
test('the equals sign is excluded from the numeric crop instead of becoming an extra digit',async()=>{
 const data=fixture('ИТОГ','=16628.00'),word=data.blocks[0].paragraphs[0].lines[0].words[1];
 word.symbols=[{text:'=',bbox:{x0:300,x1:320,y0:200,y1:240}},{text:'1',bbox:{x0:330,x1:340,y0:200,y1:240}}];
 const result=await refineReceiptTotals(data,async(rectangle)=>{assert.ok(rectangle.left>320);return'16628.00';});assert.equal(parseReceiptPhoto(result,context).total,'16628.00');
});
test('small footer print merged into the total row cannot hide a split monetary token',async()=>{
 const data=fixture('Сума','asa A 532 „90'),line=data.blocks[0].paragraphs[0].lines[0];
 line.words=[line.words[0],{text:'asa',bbox:{x0:150,x1:180,y0:230,y1:240}},{text:'532',bbox:{x0:300,x1:350,y0:200,y1:240}},{text:'„90',bbox:{x0:355,x1:400,y0:200,y1:240}}];
 const fixed=await refineReceiptTotals(data,async(rectangle)=>{assert.ok(rectangle.left>250);assert.ok(rectangle.width>90);return'532.90';});assert.equal(parseReceiptPhoto(fixed,context).total,'532.90');
});
test('small distant background digits are excluded from the amount crop',async()=>{
 const data=fixture('счма','725,00 3)'),line=data.blocks[0].paragraphs[0].lines[0];
 line.words[1].text='725,00';line.words.push({text:'3)',bbox:{x0:490,x1:510,y0:220,y1:240}});
 const fixed=await refineReceiptTotals(data,async()=> '725,00');assert.equal(parseReceiptPhoto(fixed,context).total,'725.00');
});
test('paper recovery finds a neutral bright region without treating an all-white image as a crop',()=>{
 const width=100,height=100,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const index=(y*width+x)*4;data.set(x>=25&&x<75?[205,202,199,255]:[155,110,70,255],index);}
 const bounds=receiptPaperBounds({data,width,height});assert.ok(bounds.left>.2&&bounds.left<.3);assert.ok(bounds.width>.45&&bounds.width<.6);
 data.fill(255);assert.equal(receiptPaperBounds({data,width,height}),null);data.fill(0);assert.equal(receiptPaperBounds({data,width,height}),null);
});
test('a large footer number needs a separately recognized total label; conflicting values remain unselected choices',async()=>{
 const word=(text,x,y,height)=>({text,bbox:{x0:x,x1:x+120,y0:y,y1:y+height}}),amount=word('633.30',600,520,90);
 const data={text:'Product\n20.00\n633.30',blocks:[{paragraphs:[{lines:[{text:'rows',bbox:{y1:300},words:[word('12.00',400,100,40),word('20.00',400,200,40)]},{text:'633.30',bbox:{y1:650},words:[amount]}]}]}]};
 assert.equal(await locateReceiptTotal(data,async()=> 'Cash'),null,'a large cash/payment value is not a total');
 const located=await locateReceiptTotal(data,async()=> 'Cuma');assert.ok(located);
 let index=0;const result=await refineReceiptTotals(located,async()=>['635.50','695.50'][index++]);const draft=parseReceiptPhoto(result,context);
 assert.equal(draft.total,'');assert.deepEqual(draft.totalCandidates,['635.50','695.50']);assert.equal(draft.preferTotalOnly,true);
});

test('an unreadable amount beside a readable total heading cannot stop footer recovery',async()=>{
 const scans=[{image:'paper',mode:'6'},{image:'footer',mode:'11'}],seen=[];
 const result=await recoverReceiptTotal(scans,async(image,options)=>{
  seen.push(image);if(!options.rectangle)return fixture('Сума',image==='paper'?'???':'635.50');
  return {text:image==='footer'?'695.50':''};
 });
 assert.equal(result.input,'footer');assert.equal(parseReceiptPhoto(result.data,context).total,'695.50');assert.ok(seen.includes('paper')&&seen.includes('footer'));
});

test('recovery keeps conflicting footer values for review and never selects a cash amount',async()=>{
 let count=0;const result=await recoverReceiptTotal([{image:'footer',mode:'11'}],async(image,options)=>options.rectangle?{text:['635.50','695.50'][count++]}:fixture('Сума','???'));
 assert.equal(parseReceiptPhoto(result.data,context).total,'');assert.deepEqual(result.data.totalCandidates,['635.50','695.50']);
 assert.equal(await recoverReceiptTotal([{image:'footer',mode:'11'}],async()=>fixture('CASH','1000.00')),null);
 assert.equal(await recoverReceiptTotal([{image:'footer',mode:'11'}],async()=>({text:'1000.00',blocks:[]})),null,'a receipt footer number still needs a total label');
});

test('damaged fiscal identifiers cannot become the store name',()=>{
 for(const line of['II FTAB23425a3 @H 30002177)','31 PIABZIAZua oH 300217783','ФН 30002177']){
  assert.equal(parseReceiptPhoto(`${line}\nMilk 20.00\nTOTAL 20.00`,context).merchant,'',line);
 }
});

test('a damaged large amount still locates its label and rereads all monetary digits',async()=>{
 const word=(text,x,y,width,height)=>({text,bbox:{x0:x,x1:x+width,y0:y,y1:y+height}});
 const first=word('695.',470,415,140,80),last=word('ЭЙ',630,415,70,80);
 const data={text:'rows\n695. ЭЙ',blocks:[{paragraphs:[{lines:[{text:'rows',bbox:{y1:200},words:[word('45.39',400,100,90,30),word('48.32',400,160,90,30)]},{text:'695. ЭЙ',bbox:{y1:500},words:[first,last]}]}]}]};
 const located=await locateReceiptTotal(data,async()=> 'Сума');assert.ok(located);assert.match(located.text,/Сума 695\. ЭЙ/);assert.equal(located.totalRequiresDecimal,true);
 const result=await refineReceiptTotals(located,async rectangle=>{assert.ok(rectangle.left+rectangle.width>last.bbox.x1,'the fractional digits are inside the numeric crop');return '695.50';});assert.equal(parseReceiptPhoto(result,context).total,'695.50');
 const dropped=await refineReceiptTotals(located,async()=> '69550');assert.equal(parseReceiptPhoto(dropped,context).total,'','a lost decimal separator cannot create a hundredfold expense');
});

test('folded paper and a merged tax box do not clip the total label or include the tax in its amount',async()=>{
 const word=(text,x0,y0,x1,y1)=>({text,bbox:{x0,y0,x1,y1}});
 const data={text:'rows\n635, ЭЙ',blocks:[{paragraphs:[{lines:[{text:'rows',bbox:{y1:200},words:[word('45.39',400,100,490,130),word('48.32',400,160,490,190)]},{text:'635, ЭЙ',bbox:{y1:542},words:[word('635,',467,384,602,542),word('ЭЙ',623,416,692,488),word('115.97',586,498,694,540)]}]}]}]};
 const located=await locateReceiptTotal(data,async rectangle=>rectangle.top>=410&&rectangle.top<=435&&rectangle.height<150?'[ума':'unreadable');assert.ok(located);
 let count=0;const result=await refineReceiptTotals(located,async rectangle=>{assert.ok(rectangle.top+rectangle.height<520);assert.ok(rectangle.left+rectangle.width>692);return['635.50','695.50'][count++];});
 assert.deepEqual(result.totalCandidates,['635.50','695.50']);assert.equal(parseReceiptPhoto(result,context).total,'');
});

test('a readable labelled total remains a review choice when an independent reread is inconclusive',async()=>{const data={...fixture('TOTAL','151.85'),totalNeedsReview:true};const result=await refineReceiptTotals(data,async()=> '');assert.equal(parseReceiptPhoto(result,context).total,'');assert.deepEqual(result.totalCandidates,['151.85']);});
