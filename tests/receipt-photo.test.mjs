import test from 'node:test';import assert from 'node:assert/strict';
import {parseReceiptPhoto,photoAmount} from '../src/features/receipts/receiptPhoto.js';
import {receiptComment,receiptValidation} from '../src/features/receipts/receiptModel.js';
import {readSavedReceipt,receiptFromEntry} from '../src/features/receipts/receiptHistory.js';
const context={today:'2026-10-19',defaultDateKey:'2026-10-19',defaultCurrency:'MDL'};
test('calculator screenshot yields a checked expression result, never a status-bar merchant or keypad purchases',()=>{
 const draft=parseReceiptPhoto('22:37 LTE ED\n29,95x2\n59,9\nAC\n7 8 9\n4 5 6\n1 2 3\n0',context);
 assert.equal(draft.kind,'amount');assert.equal(draft.merchant,'');assert.equal(draft.total,'59.90');assert.deepEqual(draft.items,[]);assert.equal(draft.dateKey,context.today);assert.equal(draft.currency,'MDL');assert.equal(draft.expression,'29,95 × 2');assert.equal(receiptValidation(draft,context.today,['MDL']).valid,true);
 const comment=receiptComment(draft),saved=readSavedReceipt(comment,'MDL');assert.equal(saved.kind,'amount');assert.equal(saved.items.length,0);assert.match(comment,/29,95 × 2 = 59.90 MDL/);assert.equal(receiptFromEntry({pnl:-59.9,currency:'MDL',comment}).total,'59.90');
 assert.doesNotMatch(receiptComment({...draft,total:'60.00'}),/×/,'an edited amount must never serialize a false calculator equation');
});
test('receipt totals and dates are not replaced with calendar defaults; screen chrome is not a store',()=>{
 const draft=parseReceiptPhoto('22:37 LTE ED\nMOLDRETAIL GROUP S.R.L.\nIDNO: 123\nPaine\n1 buc x 7.10=7.10\nTOTAL LEI 7.10',context);
 assert.equal(draft.kind,'receipt');assert.equal(draft.dateKey,'');assert.equal(draft.merchant,'MOLDRETAIL GROUP S.R.L.');assert.equal(draft.items.length,1);
});
test('a single amount is offered while ambiguous numbers remain blank',()=>{
 assert.equal(parseReceiptPhoto('59,9',context).total,'59.90');assert.equal(parseReceiptPhoto('12.00\n36.00',context).total,'');
 const unknown=parseReceiptPhoto('22:37 LTE ED\nAC\n7 8 9\n4 5 6\n1 2 3\n0',context);assert.equal(unknown.total,'');assert.equal(unknown.merchant,'');assert.deepEqual(unknown.items,[]);
 assert.equal(photoAmount({text:'29.95×2\n89.85'}).total,'','conflicting calculator factors and a visible result must not be guessed away');
 const amount=parseReceiptPhoto('59.90',{today:context.today,defaultCurrency:''});assert.equal(amount.currency,'','a plain number has no inferred currency');
});
test('prominent amount detection uses layout, never the largest monetary value',()=>{
 const line=(text,height)=>({text,bbox:{x0:0,y0:0,x1:100,y1:height}});
 const data={text:'999.00\n59.90\n1',blocks:[{paragraphs:[{lines:[line('999.00',20),line('59.90',90),line('1',30)]}]}]};
 assert.equal(photoAmount(data).total,'59.90');
});
