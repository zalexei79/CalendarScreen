import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceEntryReview as review} from '../src/shared/lib/voiceEntryReview.js';
import {resolveVoiceCorrections} from '../src/shared/lib/naturalVoiceEntry.js';
const categories=[{value:'Продукты',label:'Продукты'},{value:'Кафе',label:'Кафе'},{value:'Транспорт',label:'Транспорт'},{value:'Настольные игры',label:'Board games'},{value:'Кафе 24/7',label:'Кафе 24/7'}];
const config={todayKey:'2026-10-02',walletAvailable:true};
const parse=(phrase,draft=null,locale='ru',options=config)=>review(phrase,draft,locale,categories,options);
const base={type:'entry',kind:'record',amount:'250',currency:'MDL',sign:'minus',dateKey:'2026-10-01',destination:'wallet',category:'Продукты'};
function permutations(values){return values.length?values.flatMap((value,index)=>permutations(values.filter((_,i)=>i!==index)).map(rest=>[value,...rest])):[[]];}
test('all 120 orders of five independent fields prepare the same review',()=>{
 for(const words of permutations(['расход','250 лей','продукты','вчера','в кошелек'])){
  const phrase=words.join(' ');assert.deepEqual(parse(phrase).entry,base,phrase);
 }
});
test('amount and currency can be separated and reversed',()=>{
 for(const phrase of ['лей 250 на продукты ушло вчера в кошелек','250 потратил лей на продукты вчера в кошелек','леев потратил двести пятьдесят на продукты вчера в кошелек','на продукты 250 леев вчера в кошелек'])assert.deepEqual(parse(phrase).entry,base,phrase);
});
test('conversational expense and income verbs, polite fillers and category aliases',()=>{
 for(const verb of ['заплатил','оплатила','ушло','списали','обошлось'])assert.deepEqual(parse(`ну пожалуйста в кошелек ${verb} на продукты вчера 250 лей`).entry,base,verb);
 for(const verb of ['пришло','поступило','зачислили','вернули'])assert.equal(parse(`вчера 250 лей ${verb} в календарь`).entry.sign,'plus',verb);
 assert.equal(parse('потратил 50 лей на еду').entry.category,'Продукты');
 assert.equal(parse('за кофе заплатил 50 лей').entry.category,'Кафе');
 assert.equal(parse('вчера потратил 50 лей на бензин').entry.category,'Транспорт');
});
test('explicit replacements discard rejected amounts, dates, currencies, types and destinations',()=>{
 assert.deepEqual(parse('потратил не 100, а 250 лей на продукты вчера в кошелек').entry,base);
 for(const [phrase,patch] of [
  ['не 250, а 350',{amount:'350'}],['не вчера, а сегодня',{dateKey:'2026-10-02'}],
  ['не расход, а доход',{sign:'plus'}],['не леи, а евро',{currency:'EUR'}],
  ['не в кошелек, а в календарь',{destination:'main'}],['поменяй сумму на 350',{amount:'350'}],
 ])assert.deepEqual(parse(phrase,base).entry,{...base,...patch},phrase);
 for(const phrase of ['я не потратил 250 лей','не 250','не в кошелек'])assert.equal(parse(phrase,base).invalid,true,phrase);
 assert.equal(parse('не надо',base).cancelled,true);
 assert.equal(resolveVoiceCorrections('не забудь записать 250 лей').negated,false);
 assert.deepEqual(parse('на кафе',{...base,sign:'plus'}).entry,{...base,sign:'plus',category:'Кафе'},'category-only correction preserves income');
});
test('multiple amounts and currencies require clarification and retain other fields',()=>{
 const state=parse('на продукты вчера потратил 250 лей и 350 евро в кошелек');
 assert.equal(state.field,'amount');assert.equal(state.draft.dateKey,base.dateKey);assert.equal(state.draft.category,base.category);
 assert.equal(state.draft.amount,undefined);assert.equal(state.draft.currency,undefined);
 let next=parse('300',state.draft);assert.equal(next.field,'currency');
 assert.deepEqual(parse('леи',next.draft).entry,{...base,amount:'300'});
 const correction=parse('250 лей и 350 лей',base);assert.equal(correction.field,'amount');
 assert.equal(parse('доход',correction.draft).field,'amount','unrelated correction cannot silently restore an old amount');
 assert.deepEqual(parse('350',correction.draft).entry,{...base,amount:'350'});
});
test('conflicting categories, types and routes stay pending until resolved',()=>{
 let state=parse('вчера потратил 250 лей на продукты и на кафе в кошелек');assert.equal(state.field,'category');
 assert.equal(parse('300',state.draft).field,'category');
 assert.deepEqual(parse('на продукты',state.draft).entry,{...base,amount:'250'});
 state=parse('расход доход 250 лей');assert.equal(state.field,'sign');assert.equal(parse('доход',state.draft).entry.sign,'plus');
 state=parse('в календарь в кошелек потратил 250 лей');assert.equal(state.field,'destination');
 assert.equal(parse('доход',state.draft).field,'destination');assert.equal(parse('в оба',state.draft).entry.destination,'both');
});
test('known numeric and multiword category names never become money',()=>{
 assert.equal(parse('на кафе 24/7 вчера потратил 250 леев').entry.category,'Кафе 24/7');
 assert.equal(parse('настольные игры 250 леев расход').entry.category,'Настольные игры');
 assert.equal(parse('потратил 20 евро на мой новый раздел').entry.category,'мой новый раздел');
});
test('purchase dialogue supports either item order without inventing categories',()=>{
 for(const phrase of ['купил крем за 80 евро вчера','крем купил вчера за 80 евро','80 евро вчера купил крем']){
  const state=parse(phrase);assert.equal(state.field,'category',phrase);assert.equal(state.draft.item,'крем');assert.equal(state.draft.dateKey,'2026-10-01');
  assert.equal(parse('новую',state.draft).entry.category,'крем');
  assert.equal(parse('создай категорию крем',state.draft).entry.category,'крем');
 }
});
test('colloquial fractions, decimal and spoken amounts remain precise',()=>{
 for(const [words,amount] of [['два с половиной сотни','250'],['две с половиной тысячи','2500'],['полторы тысячи','1500'],['полсотни','50'],['250,50','250.5'],['две тысячи пятьсот','2500']])assert.equal(parse(`вчера на продукты ушло ${words} лей`).entry.amount,amount,words);
 assert.equal(parse('потратил 20 лей 50 bani на продукты').entry.amount,'20.5');
 assert.equal(parse('нет, ноль',base).field,'amount');
});
test('FREE destination restrictions apply regardless of destination position',()=>{
 for(const phrase of ['в кошелек расход 250 лей','потратил 250 лей в кошелек','запиши в кошелек 250 лей расход'])assert.equal(parse(phrase,null,'ru',{...config,walletAvailable:false}).field,'destination',phrase);
});
test('spoken calendar dates and relative days stay separate from amounts',()=>{
 for(const [date,expected] of [['два дня назад','2026-09-30'],['3 дня назад','2026-09-29'],['первого октября','2026-10-01'],['двадцать первого сентября','2026-09-21'],['30 сентября 2026','2026-09-30']])assert.equal(parse(`на продукты ${date} ушло 250 лей`).entry.dateKey,expected,date);
 assert.equal(parse('on groceries two days ago spent 250 lei',null,'en').entry.dateKey,'2026-09-30');
 assert.equal(parse('на продукты завтра ушло 250 лей').field,'date');
 assert.equal(parse('на продукты 31 сентября ушло 250 лей').field,'date');
});
test('English and Romanian independent slots and replacements',()=>{
 assert.equal(parse('groceries yesterday 250 lei paid',null,'en').entry.category,'Продукты');
 assert.equal(parse('on groceries yesterday 250 lei spent',null,'en').entry.dateKey,'2026-10-01');
 assert.equal(parse('not 250 but 350',base,'en').entry.amount,'350');
 assert.equal(parse('pe produse ieri 250 lei am cheltuit',null,'ro').entry.amount,'250');
 assert.equal(parse('nu 250 ci 350',base,'ro').entry.amount,'350');
});
test('navigation, questions, unsafe leftovers and unsupported narrative never create entries',()=>{
 for(const phrase of ['сколько потратил 250 лей','открой историю','добавь запись','250 лей номер телефона','250 лей и завтра','удали запись','потратил -250 лей'])assert.equal(parse(phrase)?.entry,undefined,phrase);
});
