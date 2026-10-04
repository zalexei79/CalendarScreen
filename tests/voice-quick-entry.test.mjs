import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceEntryReview as review} from '../src/shared/lib/voiceEntryReview.js';
import {followupVoiceEntry as more} from '../src/shared/lib/voiceQuickEntry.js';
const categories=[{value:'Такси',label:'Такси'},{value:'Кафе',label:'Кафе',type:'minus'},{value:'Зарплата',label:'Зарплата',type:'plus'},{value:'Проект',label:'Проект'}];
const options={todayKey:'2026-10-04',defaultCurrency:'MDL',walletAvailable:true};
const parse=text=>review(text,null,'ru',categories,options);
const last={type:'entry',amount:'250',sign:'plus',category:'Зарплата',dateKey:'2026-10-02',currency:'EUR',destination:'wallet',mutation:true,mutationSnapshot:{id:'old'}};
test('short expense entries accept category/amount/date in either order',()=>{
 for(const phrase of ['Такси 80 вчера','Вчера 80 такси','80 вчера такси','Вчера такси восемьдесят']){
  assert.deepEqual(parse(phrase).entry,{type:'entry',kind:'record',amount:'80',sign:'minus',category:'Такси',dateKey:'2026-10-03',currency:'MDL',destination:'main'},phrase);
 }
 assert.equal(parse('Кофе 30к лей вчера').entry.amount,'30000');assert.equal(parse('Зарплата 1500 вчера').entry.sign,'plus');
});
test('unknown category asks type while retaining amount/currency/date',()=>{
 for(const phrase of ['Проект 100 вчера','100 вчера наработка']){
  const pending=parse(phrase);assert.equal(pending.field,'sign');assert.equal(pending.draft.amount,'100');assert.equal(pending.draft.currency,'MDL');assert.equal(pending.draft.dateKey,'2026-10-03');
  const resolved=review('Это доход',pending.draft,'ru',categories,options);assert.equal(resolved.entry.sign,'plus');assert.equal(resolved.entry.amount,'100');
 }
 assert.equal(parse('Подарки 100').field,'sign');
});
test('shorthand preserves safeguards for conflicting amounts, negation and queries',()=>{
 assert.equal(parse('Такси 80 и 100').field,'amount');assert.equal(parse('Не такси 80').invalid,true);
 for(const phrase of ['Покажи такси 80','Почему такси 80','Что такое такси 80'])assert.ok(!parse(phrase)?.entry,phrase);
 const income={...last,mutation:undefined};assert.equal(review('на кафе',income,'ru',categories,options).entry.sign,'plus','correction never guesses a new sign');
});
test('another entry inherits only confirmed date, currency and destination',()=>{
 for(const phrase of ['Ещё 50 на кофе','И ещё кофе пятьдесят']){
  const result=more(phrase,last,'ru',categories,options);assert.deepEqual(result.entry,{type:'entry',kind:'record',amount:'50',sign:'minus',category:'Кафе',dateKey:'2026-10-02',currency:'EUR',destination:'wallet'},phrase);
 }
 assert.equal(last.amount,'250');assert.equal(last.category,'Зарплата');
});
test('explicit follow-up fields override inheritance and FREE still restricts wallet',()=>{
 const result=more('Ещё сегодня 60 долларов на такси в календарь',last,'ru',categories,options);
 assert.deepEqual(result.entry,{type:'entry',kind:'record',amount:'60',sign:'minus',category:'Такси',dateKey:'2026-10-04',currency:'USD',destination:'main'});
 assert.equal(more('Ещё 50 на кофе завтра',last,'ru',categories,options).field,'date');
 assert.equal(more('Ещё 50 на кофе',last,'ru',categories,{...options,walletAvailable:false}).field,'destination');
});
test('follow-up without saved context uses current defaults and custom categories ask type',()=>{
 assert.equal(more('Ещё 50 на кофе',null,'ru',categories,options).entry.dateKey,'2026-10-04');
 const pending=more('Ещё 70 проект',last,'ru',categories,options);assert.equal(pending.field,'sign');assert.equal(pending.draft.currency,'EUR');
 assert.equal(more('Такси 80',last,'ru',categories,options),null);
});
