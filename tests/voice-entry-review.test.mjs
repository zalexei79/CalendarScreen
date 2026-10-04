import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceEntryReview as review,extractEntryDate,shortEntryAnswer} from '../src/shared/lib/voiceEntryReview.js';
const options={todayKey:'2026-10-02',walletAvailable:true};
const categories=[{value:'Продукты',label:'Продукты'}];
const parse=(phrase,draft=null,locale='ru',config=options)=>review(phrase,draft,locale,categories,config);
test('required category continues the same expense with a bare name and retained fields',()=>{
 const config={...options,requireCategory:true};
 let result=parse('Я потратил 50 лей вчера',null,'ru',config);
 assert.equal(result.field,'category');assert.equal(result.draft.amount,'50');assert.equal(result.draft.currency,'MDL');
 result=parse('сок',result.draft,'ru',config);
 assert.equal(result.entry.category,'сок');assert.equal(result.entry.amount,'50');assert.equal(result.entry.currency,'MDL');assert.equal(result.entry.dateKey,'2026-10-01');
 for(const [locale,initial,reply] of [['en','I spent 50 MDL','juice'],['ro','Am cheltuit 50 lei','suc']]){
  const pending=parse(initial,null,locale,config);assert.equal(pending.field,'category');
  const complete=parse(reply,pending.draft,locale,config);assert.equal(complete.entry.amount,'50');assert.equal(complete.entry.category,reply);
 }
});
test('one phrase retains date, category and currency without a destination question',()=>{
 const result=parse('Потратил 250 леев на продукты вчера');
 assert.deepEqual(result.entry,{type:'entry',kind:'record',amount:'250',currency:'MDL',sign:'minus',dateKey:'2026-10-01',destination:'main',category:'Продукты'});
 assert.equal(result.command,undefined,'review never submits a write');
});
test('short corrections change only specified fields',()=>{
 const base=parse('потратил 250 леев на продукты вчера').entry;
 assert.deepEqual(parse('нет, 350',base).entry,{...base,amount:'350'});
 assert.deepEqual(parse('это доход',base).entry,{...base,sign:'plus'});
 assert.deepEqual(parse('запиши в кошелёк',base).entry,{...base,destination:'wallet'});
 assert.deepEqual(parse('на кафе',base).entry,{...base,category:'кафе'});
 assert.deepEqual(parse('сегодня',base).entry,{...base,dateKey:'2026-10-02'});
 assert.equal(parse('непонятная фраза',base).invalid,true);
 assert.equal(parse('отмена',base).cancelled,true);
});
test('clarification retains earlier date and category',()=>{
 let state=parse('потратил 250 на продукты вчера');assert.equal(state.field,'currency');
 const entry=parse('евро',state.draft).entry;
 assert.equal(entry.dateKey,'2026-10-01');assert.equal(entry.category,'Продукты');assert.equal(entry.amount,'250');
 state=parse('купил крем вчера');assert.equal(state.field,'amount');
 state=parse('80 евро',state.draft);assert.equal(state.field,'category');
 assert.equal(parse('новую',state.draft).entry.dateKey,'2026-10-01');
});
test('future and impossible dates require explicit correction without losing money fields',()=>{
 for(const phrase of ['потратил 80 лей завтра','потратил 80 лей 31 февраля 2026']){
  const state=parse(phrase);assert.equal(state.field,'date');assert.equal(state.draft.amount,'80');
  assert.equal(parse('доход',state.draft).field,'date');
  const entry=parse('вчера',state.draft).entry;assert.equal(entry.dateKey,'2026-10-01');assert.equal(entry.amount,'80');
 }
});
test('relative dates cross month, year and leap-day boundaries locally',()=>{
 assert.equal(extractEntryDate('вчера','2026-01-01').dateKey,'2025-12-31');
 assert.equal(extractEntryDate('позавчера','2024-03-01').dateKey,'2024-02-28');
 assert.equal(extractEntryDate('вчера','2024-03-01').dateKey,'2024-02-29');
 assert.equal(extractEntryDate('вчера сегодня','2026-10-02').invalid,true);
});
test('named and numeric dates are removed from categories',()=>{
 for(const suffix of ['1 октября','1 октября 2026','01.10.2026','2026-10-01']){
  const entry=parse(`потратил 80 лей на продукты ${suffix}`).entry;
  assert.equal(entry.dateKey,'2026-10-01');assert.equal(entry.category,'Продукты');
 }
});
test('explicit destinations work in a full phrase and corrections',()=>{
 assert.equal(parse('потратил 80 лей на продукты в кошелек').entry.destination,'wallet');
 assert.equal(parse('потратил 80 лей, запиши это в календарь и кошелек').entry.destination,'both');
 const base=parse('потратил 80 лей').entry;
 assert.equal(parse('не в кошелек',base).invalid,true);
 assert.equal(parse('кошелек',base,'ru',{...options,walletAvailable:false}).field,'destination');
 assert.equal(parse('потратил 80 лей в кошелек',null,'ru',{...options,walletAvailable:false}).field,'destination');
});
test('English and Romanian dates and corrections',()=>{
 const en=parse('I spent 250 lei on groceries yesterday',null,'en').entry;
 assert.equal(en.dateKey,'2026-10-01');assert.equal(parse('no, 350',en,'en').entry.amount,'350');
 assert.equal(parse('save to wallet',en,'en').entry.destination,'wallet');
 const ro=parse('am cheltuit 250 lei pe produse ieri',null,'ro').entry;
 assert.equal(ro.dateKey,'2026-10-01');assert.equal(parse('nu, 350',ro,'ro').entry.amount,'350');
 assert.equal(parse('în portofel',ro,'ro').entry.destination,'wallet');
});
test('navigation remains outside the entry review',()=>{
 for(const phrase of ['открой историю','добавь запись','следующий месяц','сколько потратил за месяц'])assert.equal(parse(phrase),null);
 assert.equal(shortEntryAnswer({sign:'minus',amount:'250',currency:'MDL'}),'Записал расход 250 MDL.');
});
