import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardAnalytics} from '../src/features/capital/dashboardAnalytics.js';
import {calculatePositions,parseScaled,scaledToString,MONEY_SCALE} from '../src/features/capital/decimal.js';
import {buildPortfolioReturnSeries,calculatePortfolioPeriodResults} from '../src/features/capital/portfolioHistory.js';
const day=new Date('2026-10-14T00:00:00Z');
const buy=(asset_id,currency,date,quantity,unit_price,operation='buy',fee='0')=>({id:asset_id+date+operation,asset_id,currency,occurred_on:date,created_at:date,quantity,unit_price,operation,fee});
test('dashboard separates USDT, converts position value and income without double counting dividends',()=>{
 const ops=[buy('a','USD','2026-10-01','2','100'),buy('b','USDT','2026-10-01','1','50'),buy('a','USD','2026-10-12','2','5','dividend','1')];
 const assets=calculatePositions([{id:'a',currency:'USD',category:'stock'},{id:'b',currency:'USDT',category:'crypto'}],ops);
 const price=a=>parseScaled(a.id==='a'?'110':'60',MONEY_SCALE);
 const result=dashboardAnalytics(assets,ops,price,{},'USD','base','week',day);
 assert.equal(scaledToString(result.total,MONEY_SCALE),'220');assert.equal(scaledToString(result.income,MONEY_SCALE),'9');assert.equal(scaledToString(result.rows[0].pnl,MONEY_SCALE),'29');assert.equal(result.largestBps,10000);assert.equal(result.rows.length,1);
 const crypto=dashboardAnalytics(assets,ops,price,{},'USD','USDT','week',day);assert.equal(scaledToString(crypto.total,MONEY_SCALE),'60');assert.equal(scaledToString(crypto.rows[0].pnl,MONEY_SCALE),'10');
});
test('missing market quotes or FX prevent complete totals and invented allocation percentages',()=>{
 const ops=[buy('a','EUR','2026-10-01','1','100')];const assets=calculatePositions([{id:'a',category:'stock',currency:'EUR'}],ops);
 const result=dashboardAnalytics(assets,ops,()=>parseScaled('110',MONEY_SCALE),{},'USD','base','all',day);
 assert.equal(result.total,null);assert.equal(result.rows[0].pnl,null);assert.equal(result.largestBps,null);
 const unpriced=dashboardAnalytics(assets,ops,()=>null,{},'EUR','EUR','all',day);assert.equal(unpriced.total,null);
});
test('closed positions retain realized profit even when current market quote is unavailable',()=>{
 const ops=[buy('a','USD','2026-10-01','2','100'),buy('a','USD','2026-10-13','2','120','sell','2')];const assets=calculatePositions([{id:'a',category:'stock',currency:'USD'}],ops);
 const result=dashboardAnalytics(assets,ops,()=>null,{},'USD','base','all',day);assert.equal(result.total,0n);assert.equal(scaledToString(result.rows[0].pnl,MONEY_SCALE),'38');assert.equal(result.largest,undefined);
});
test('distributions obey selected period, currency on payment date, and net fees',()=>{
 const ops=[buy('a','EUR','2026-10-01','1','100'),buy('a','EUR','2026-10-01','1','10','dividend'),buy('a','EUR','2026-10-13','1','8','dividend','1')];const assets=calculatePositions([{id:'a',category:'bond',currency:'EUR'}],ops);
 const fx={EUR:[{date:'2026-10-01',rate:'1.1'},{date:'2026-10-13',rate:'1.2'}]};const result=dashboardAnalytics(assets,ops,()=>parseScaled('100',MONEY_SCALE),fx,'USD','base','week',day);assert.equal(scaledToString(result.income,MONEY_SCALE),'8.4');assert.equal(result.incomeCount,1);
});
test('contributions increase value without creating investment profit',()=>{
 const snapshots=[{currency:'USD',sampled_on:'2026-10-12',portfolio_value:'100'},{currency:'USD',sampled_on:'2026-10-14',portfolio_value:'200'}];const ops=[buy('a','USD','2026-10-13','1','100')];
 const result=calculatePortfolioPeriodResults(snapshots,ops,'all',day);assert.equal(result.consolidated.result,0n);
 assert.deepEqual(buildPortfolioReturnSeries(snapshots,ops,{},'USD').map(r=>r.portfolio_value),['100','100']);
});
test('return chart is unavailable when an operation FX rate is missing',()=>{
 const snapshots=[{currency:'USD',sampled_on:'2026-10-12',portfolio_value:'100'},{currency:'USD',sampled_on:'2026-10-14',portfolio_value:'200'}];assert.deepEqual(buildPortfolioReturnSeries(snapshots,[buy('a','EUR','2026-10-13','1','100')],{},'USD'),[]);
});
