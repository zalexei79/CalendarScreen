import test from 'node:test';
import assert from 'node:assert/strict';
import {parseVoiceConversation as parse,prepareConversationEntry,conversationDate} from '../src/shared/lib/voiceConversation.js';
import {voiceEntryBatch} from '../src/shared/lib/voiceEntryBatch.js';
import {financialQueryResult} from '../src/shared/lib/financialVoiceQuery.js';
const todayKey='2026-10-03';
test('continuations replace only the named field and navigation is read-only',()=>{
 const context={type:'question',metric:'expense',period:'current-week',category:'Продукты'};
 assert.deepEqual(parse('А за прошлую?',context),{...context,period:'last-week'});
 assert.deepEqual(parse('А на транспорт?',context),{...context,category:'транспорт'});
 assert.deepEqual(parse('Покажи эти записи',context),{type:'conversation-action',action:'show'});
 assert.deepEqual(parse('Вернись в календарь',context),{type:'conversation-action',action:'calendar'});
 assert.equal(parse('Отмени это').type,'voice-undo');assert.equal(parse('Восстанови').type,'voice-restore');
});
test('one spoken day list preserves shared date/currency and three separate amounts',()=>{
 const prepared=prepareConversationEntry('Вчера: продукты 350, такси 80, обед 120 — всё в леях',{todayKey});
 assert.equal(prepared.dateKey,'2026-10-02');
 const batch=voiceEntryBatch(`${prepared.phrase} ${prepared.dateKey}`,null,'ru',[],{todayKey});
 assert.equal(batch.batch.states.length,3);
 assert.deepEqual(batch.batch.states.map(state=>state.entry.amount),['350','80','120']);
 assert.ok(batch.batch.states.every(state=>state.entry.dateKey==='2026-10-02'&&state.entry.currency==='MDL'));
});
test('explicit dates override selected days; forgotten purchases inherit a reviewed day',()=>{
 assert.equal(prepareConversationEntry('Добавь 200 на продукты',{todayKey,baseDate:'2026-10-01'}).dateKey,'2026-10-01');
 assert.equal(prepareConversationEntry('Вчера добавь 200 на продукты',{todayKey,baseDate:'2026-10-01'}).dateKey,'2026-10-02');
 const review=parse('Что я записал вчера?',null,{todayKey});assert.equal(review.dateKey,'2026-10-02');assert.equal(review.mode,'day-review');
 assert.deepEqual(parse('Обед забыл — добавь 120',review,{todayKey}),{type:'conversation-entry',phrase:'расход 120 на обед',dateKey:'2026-10-02'});
});
test('edits separate old/new amounts; repeating a payment prepares a new entry',()=>{
 const command=parse('Вчера такси было 100, а не 80',null,{todayKey});
 assert.equal(command.type,'voice-edit');assert.equal(command.amount,'100');assert.equal(command.oldAmount,'80');assert.equal(command.dateKey,'2026-10-02');
 const repeat=parse('Интернет как в прошлом месяце, но 150',null,{todayKey});assert.equal(repeat.type,'voice-repeat');assert.equal(repeat.amount,'150');
});
test('approximate weekday searches use actual dates, currency-preserving records and sign',()=>{
 const command=parse('Найди расход примерно на 500 в прошлую пятницу',null,{todayKey});
 assert.equal(command.type,'financial-search');assert.equal(command.dateKey,'2026-10-02');assert.deepEqual(command.amountFilter,{kind:'approx',value:500});
 const records={'2026-10-02':[{id:'yes',pnl:-480,currency:'MDL'},{id:'no',pnl:-800,currency:'EUR'},{id:'income',pnl:500,currency:'MDL'}]};
 const result=financialQueryResult({records,command,todayKey});assert.deepEqual(result.items.map(item=>item.id),['yes']);
 assert.equal(conversationDate('за прошлую пятницу','2026-10-02').dateKey,'2026-09-25');
});
