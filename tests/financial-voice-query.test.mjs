import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCalendarVoiceCommand as parse} from '../src/shared/lib/calendarVoiceCommand.js';
import {financialQueryResult, financialQueryRange, resolveFinancialQueryCategory} from '../src/shared/lib/financialVoiceQuery.js';
import {voiceEntryReview} from '../src/shared/lib/voiceEntryReview.js';

test('queries accept category and period in either order without creating purchases',()=>{
 for(const phrase of ['Покажи расходы на машину за сентябрь','Покажи за сентябрь расходы на машину'])assert.deepEqual(parse(phrase),{type:'financial-search',metric:'expense',mode:'search',period:'named-month',month:9,category:'машину'});
 for(const phrase of ['Сколько потратил на еду на этой неделе?','Сколько на этой неделе потратил на еду?','Сколько на еду потратил на этой неделе?']){
  assert.deepEqual(parse(phrase),{type:'question',metric:'expense',period:'current-week',category:'еду'});
  assert.equal(voiceEntryReview(phrase),null);
 }
 assert.deepEqual(parse('Когда я последний раз платил за интернет?'),{type:'financial-search',metric:'expense',mode:'last',period:'all-time',category:'интернет'});
 assert.equal(parse('сколько потратил за сентябрь 2025').year,2025);
 assert.equal(parse('How much did I spend on food this week').period,'current-week');
 for(const phrase of ['сколько потратил за год','сколько потратил на еду на этой неделе за прошлый месяц','потратил 30к на монитор','покажи 13 ноября 2048'])assert.notEqual(parse(phrase)?.type,'financial-search');
 assert.equal(parse('сколько потратил на еду на этой неделе за прошлый месяц'),null);
});

test('ranges use local calendar boundaries, Monday weeks, leap years and year rollover',()=>{
 assert.deepEqual(financialQueryRange({period:'current-week'},'2026-10-02'),{from:'2026-09-28',to:'2026-10-04'});
 assert.deepEqual(financialQueryRange({period:'last-week'},'2026-10-02'),{from:'2026-09-21',to:'2026-09-27'});
 assert.deepEqual(financialQueryRange({period:'last-month'},'2026-01-03'),{from:'2025-12-01',to:'2025-12-31'});
 assert.deepEqual(financialQueryRange({period:'named-month',month:2,year:2024},'2026-10-02'),{from:'2024-02-01',to:'2024-02-29'});
 assert.deepEqual(financialQueryRange({period:'yesterday'},'2026-01-01'),{from:'2025-12-31',to:'2025-12-31'});
});

const records={
 '2026-09-27':[{id:'outside',instrument:'Продукты',pnl:-999,currency:'MDL'}],
 '2026-09-28':[{id:'week1',instrument:'Продукты',pnl:-30,currency:'MDL'},{id:'income',instrument:'Продукты',pnl:20,currency:'MDL'}],
 '2026-10-02':[{id:'week2',instrument:'Продукты',pnl:-40,currency:'EUR'},{id:'trade',instrument:'Продукты',pnl:-500,currency:'USD',trading:true},{id:'bad',instrument:'Продукты',pnl:null}],
 '2026-08-10':[{id:'internet-old',instrument:'Интернет',pnl:-50,currency:'MDL'}],
 '2026-09-15':[{id:'internet-new',time:'19:00',instrument:'Интернет',pnl:-80,currency:'MDL'},{id:'internet-earlier',time:'08:00',instrument:'Интернет',pnl:-60,currency:'MDL'}],
};
test('answer and evidence use exactly the same rows, currencies and sign',()=>{
 const snapshot=structuredClone(records);
 const result=financialQueryResult({records,command:parse('сколько потратил на еду на этой неделе'),category:'Продукты',todayKey:'2026-10-02',isTrading:item=>item.trading});
 assert.deepEqual(result.items.map(item=>item.id),['week2','week1']);
 assert.match(result.text,/30.*ле/);assert.match(result.text,/40.*евро/);assert.doesNotMatch(result.text,/999|500|70/);
 assert.deepEqual(records,snapshot);
 const last=financialQueryResult({records,command:parse('когда я последний раз платил за интернет'),category:'Интернет',todayKey:'2026-10-02'});
 assert.equal(last.items[0].id,'internet-new');assert.equal(last.items.length,1);assert.match(last.text,/15 сентября 2026.*80/);
 assert.deepEqual(last.range,{from:'2026-09-15',to:'2026-09-15'});
});
test('unknown categories and empty periods never fall back to unrelated entries',()=>{
 const result=financialQueryResult({records,command:parse('сколько потратил на сок вчера'),todayKey:'2026-10-02'});
 assert.equal(result.items.length,0);assert.match(result.text,/не найдено/);
 const definitions=[{key:'Продукты'},{key:'Транспорт'}];
 assert.equal(resolveFinancialQueryCategory('еду',definitions,['Продукты','Транспорт']),'Продукты');
 assert.equal(resolveFinancialQueryCategory('машину',definitions,['Продукты','Транспорт']),'Транспорт');
 assert.equal(resolveFinancialQueryCategory('машину',definitions,['Машина','Транспорт']),'Машина');
 assert.equal(resolveFinancialQueryCategory('Интернет',definitions,['Интернет']),'Интернет');
});
test('explicit asset queries are trading losses rather than personal spending',()=>{
 const result=financialQueryResult({records:{'2026-10-01':[{id:'gold',instrument:'XAUUSD.m',pnl:-20,currency:'USD'},{id:'food',instrument:'Продукты',pnl:-500,currency:'USD'}]},command:parse('сколько потратил на золото на этой неделе'),todayKey:'2026-10-02',category:'золото',isTrading:()=>true});
 assert.equal(result.items.length,1);assert.match(result.text,/Торговые убытки.*20/);assert.equal(result.asset,true);
});
