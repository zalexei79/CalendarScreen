import test from 'node:test';
import assert from 'node:assert/strict';
import {premiumHistoryModel,premiumTradeFacts} from '../src/features/history/premiumHistoryModel.mjs';
import {premiumHistoryCopy} from '../src/features/history/premiumHistoryCopy.js';
const row=(id,pnl,currency='USD',dateKey='2026-10-01')=>({id,pnl,currency,dateKey,time:'12:00',instrument:'Дом'});
const options={currency:'USD',from:'0000-01-01',to:'9999-12-31',today:'2026-10-27'};
test('summary stays separate from list filters and preserves sub-cent stored precision',()=>{
  const model=premiumHistoryModel([row('a',.004),row('b',.004),row('c',-10),row('d',10)],options);
  assert.equal(model.summary.total,.01);assert.equal(model.summary.count,4);assert.equal(model.expenses[0].amount,10);
});
test('mixed currencies never produce monetary metrics or category comparisons',()=>{
  const model=premiumHistoryModel([row('a',100),row('b',-9999,'MDL')],{...options,currency:'ALL'});
  assert.equal(model.summary.total,null);assert.equal(model.maxDrawdown,null);assert.equal(model.profitFactor,null);assert.equal(model.comparison,null);assert.deepEqual(model.expenses,[]);
});
test('drawdown follows chronological closed results; breakeven is not a winner',()=>{
  const model=premiumHistoryModel([row('d',0,'USD','2026-10-04'),row('c',-60,'USD','2026-10-03'),row('a',100),row('b',-40,'USD','2026-10-02')],options);
  assert.equal(model.maxDrawdown,100);assert.equal(model.winrate,25);assert.equal(model.breakevenCount,1);assert.equal(model.profitFactor,1);
});
test('previous period uses matching duration; all time has no comparison or forecast',()=>{
  const rows=[row('a',-100,'USD','2026-10-03'),row('b',-50,'USD','2026-09-28')];
  const model=premiumHistoryModel(rows,{...options,from:'2026-10-01',to:'2026-10-03'});
  assert.deepEqual(model.comparison.range,{from:'2026-09-28',to:'2026-09-30'});assert.equal(model.comparison.expense,100);assert.equal(premiumHistoryModel(rows,options).projectedExpense,null);
});
test('forecast is labelled spending pace and is unavailable for trading or mixed money',()=>{
  const rows=[row('a',-100)];
  assert.equal(premiumHistoryModel(rows,{...options,from:'2026-10-01',to:'2026-10-31',today:'2026-10-10'}).projectedExpense,310);
  assert.equal(premiumHistoryModel(rows,{...options,from:'2026-10-01',to:'2026-10-31',isTrading:()=>true}).projectedExpense,null);
  assert.equal(premiumHistoryModel([...rows,row('future',-900,'USD','2026-10-20')],{...options,from:'2026-10-01',to:'2026-10-31',today:'2026-10-10'}).projectedExpense,310);
});
test('all currencies resolved to one current currency compares only that same currency',()=>{
  const model=premiumHistoryModel([row('current',-100),row('usd',-50,'USD','2026-09-30'),row('mdl',-9999,'MDL','2026-09-30')],{...options,currency:'ALL',from:'2026-10-01',to:'2026-10-01'});
  assert.equal(model.summary.currency,'USD');assert.equal(model.comparison.expense,100);
});
test('trade facts distinguish missing fees from zero and never subtract costs from net twice',()=>{
  const missing=premiumTradeFacts({pnl:95,comment:'[DAYRIS:MT5:Demo%20server:123:456] A note'});
  assert.equal(missing.gross,null);assert.equal(missing.commission,null);assert.equal(missing.entry,null);assert.equal(missing.account,'123');assert.equal(missing.ticket,'456');assert.equal(missing.note,'A note');
  const explicit=premiumTradeFacts({pnl:95,commission:-5,swap:0,entry_price:2700,exit_price:2701,volume:.1});
  assert.equal(explicit.gross,100);assert.equal(explicit.swap,0);assert.equal(explicit.volume,.1);
});
test('all supported locales have the complete premium copy',()=>{
  const en=premiumHistoryCopy('en');for(const locale of ['ru','uk','en','ro','md','zh-CN']){const copy=premiumHistoryCopy(locale);assert.deepEqual(Object.keys(copy),Object.keys(en));assert(Object.values(copy).every(value=>typeof value==='string'&&value.length));}
});
