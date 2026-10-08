import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceEntryReview} from '../src/shared/lib/voiceEntryReview.js';
import {voiceEntryBatch} from '../src/shared/lib/voiceEntryBatch.js';
import {parseCalendarVoiceCommand} from '../src/shared/lib/calendarVoiceCommand.js';
import {parseSpokenAmount} from '../src/shared/lib/spokenAmount.js';
import {canAutoSaveVoiceEntry} from '../src/shared/lib/voiceAutoSave.js';
const options={todayKey:'2026-10-08',defaultCurrency:'MDL',requireCategory:true,walletAvailable:true};
const parse=(phrase,draft=null,locale='ru')=>voiceEntryReview(phrase,draft,locale,[],options);
const expected={type:'entry',kind:'record',amount:'50',currency:'MDL',sign:'minus',dateKey:'2026-10-07',destination:'main',category:'сок'};

test('432 spoken expense combinations keep the same amount, category and date',()=>{
 const verbs=['потратил','потратила','потратили','тратил','трачу','заплатил','заплатили','заплачено','оплатил','оплачено','уплачено','потрачено','израсходовано','ушло','списалось','обошлось','выложил','расход'];
 const units=[['лей','MDL'],['лэй','MDL'],['леев','MDL'],['баксов','USD'],['евриков','EUR'],['рубчиков','RUB'],['юаней','CNY'],['рублями','RUB']];
 for(const verb of verbs)for(const [unit,currency] of units)for(const phrase of [
  `Вчера ${verb} 50 ${unit} за сок`,
  `За сок вчера ${verb} пятьдесят ${unit}`,
  `50 ${unit} на сок ${verb} вчера`,
 ])assert.deepEqual(parse(phrase)?.entry,{...expected,currency},phrase);
});

test('income, explicit recipient and polite phrases retain the financial direction',()=>{
 for(const phrase of ['Вчера получил 50 лей за работу','Вчера начислили 50 леев за работу','За работу вчера зачислилось 50 лей','Вчера мне перевели 50 леев за работу','Мне перечислили вчера 50 леев за работу','Мне заплатили 50 леев за работу вчера'])assert.deepEqual(parse(phrase)?.entry,{...expected,sign:'plus',category:'работу'},phrase);
 for(const phrase of ['Вчера с меня сняли 50 лей за сок','С меня списали 50 лей за сок вчера','Ну, бро, можно записать расход 50 лей на сок вчера, плиз','Не мог бы ты мне записать расход 50 лей на сок вчера','Давай запишите расход 50 лей на сок вчера'])assert.deepEqual(parse(phrase)?.entry,expected,phrase);
 for(const [phrase,locale,currency,category] of [['I paid fifty bucks for juice yesterday','en','USD','juice'],['We spent fifty roubles on juice yesterday','en','RUB','juice'],['Received fifty dollars for work yesterday','en','USD','work'],['Am achitat cincizeci lei pentru suc ieri','ro','MDL','suc'],['Am plătit cincizeci dolari pentru suc ieri','ro','USD','suc']]){
  const entry=parse(phrase,null,locale)?.entry;assert.equal(entry?.amount,'50',phrase);assert.equal(entry.currency,currency);assert.equal(entry.category,category);assert.equal(entry.dateKey,expected.dateKey);
 }
});

test('colloquial exact numbers and attached currency units preserve precision',()=>{
 for(const [phrase,amount] of [['50лей','50'],['50лэй','50'],['$50','50'],['30к лэй','30000'],['полтинник','50'],['полтос баксов','50'],['сотка рублей','100'],['две сотни','200'],['три сотки','300'],['два косаря','2000'],['2 косаря','2000'],['2тыщи','2000'],['2 тысячи 500','2500'],['полтора косаря','1500'],['две тыщи','2000'],['one hundred twenty-five bucks','125'],['o rublă și cinci bani','1.05']])assert.equal(parseSpokenAmount(phrase),amount,phrase);
 for(const [phrase,amount,currency] of [['потратил полтинник лей на сок','50','MDL'],['потратил два косаря рублей на монитор','2000','RUB'],['на монитор потратил 30к баксов','30000','USD'],['потратил 50лей 25 bani на сок','50.25','MDL']]){
  const entry=parse(phrase)?.entry;assert.equal(entry?.amount,amount,phrase);assert.equal(entry.currency,currency);
 }
 for(const phrase of ['несколько тысяч','пара косарей','полтос и сотка','50 лайков','50 шоуруб','50 кг','30kk','100 и 200','200 50','2 тысячи 3000','2 тысячи 50 70'])assert.equal(parseSpokenAmount(phrase),null,phrase);
});

test('explicit spoken corrections change one field and preserve the pending context',()=>{
 const draft={...expected,destination:'wallet'};
 for(const phrase of ['Точнее 70','Вернее 70','Ой, 70','Поправка: 70','Нет, я имел в виду 70 лей','Я ошибся, 70','Должно быть 70','Вместо 50 — 70','Вместо 50 поставь 70','70 вместо 50','70 а не 50','Исправь сумму с 50 на 70','Actually 70','I meant 70','De fapt 70'])assert.deepEqual(parse(phrase,draft)?.entry,{...draft,amount:'70'},phrase);
 for(const phrase of ['Точнее на пиво','Не на сок а на пиво'])assert.deepEqual(parse(phrase,draft)?.entry,{...draft,category:'пиво'},phrase);
 assert.deepEqual(parse('Точнее это доход',draft)?.entry,{...draft,sign:'plus'});
 assert.deepEqual(parse('Точнее евро',draft)?.entry,{...draft,currency:'EUR'});
 const pending=parse('потратил 50 лэй вчера');assert.equal(pending.field,'category');
 assert.deepEqual(parse('за сок',pending.draft)?.entry,expected);
 for(const phrase of ['не 50','точнее не 70','вместо сока ничего','вместо 50 не 70','не на сок'])assert.equal(parse(phrase,draft)?.entry,undefined,phrase);
});

test('looser questions and help remain read-only',()=>{
 for(const phrase of ['Во сколько мне обошлось такси вчера','Скока я заплатил за такси вчера','Сколько у меня ушло на такси вчера','Посчитай сколько я оплатил за такси вчера'])assert.deepEqual(parseCalendarVoiceCommand(phrase),{type:'question',metric:'expense',period:'yesterday',category:'такси'},phrase);
 assert.deepEqual(parseCalendarVoiceCommand('Напомни сколько мне перечислили вчера'),{type:'question',metric:'income',period:'yesterday'});
 for(const phrase of ['Чё ты умеешь','А че ты можешь','Ну, бро, чё ты умеешь-то','Чем ты можешь мне помочь','Как с тобой разговаривать','Какие команды могу произнести'])assert.equal(parseCalendarVoiceCommand(phrase)?.type,'voice-help',phrase);
 for(const phrase of ['чё ты умеешь потратил 50 лей','скока потратил 50 лей на сок','не записывай 50 баксов на сок','я потрачу 50 лей на сок','я перевел 50 лей за сок'])assert.equal(parse(phrase)?.entry,undefined,phrase);
});

test('literal names, different currencies and different amounts cannot be collapsed',()=>{
 for(const category of ['За новый раздел','Баксы и доход','Нет не 50 а 70','на']){
  const entry=parse(`потратил 50 лей на «${category}»`)?.entry;assert.equal(entry?.amount,'50',category);assert.equal(entry.currency,'MDL');assert.equal(entry.sign,'minus');assert.equal(entry.category,category.toLowerCase());
 }
 assert.equal(parse('потратил 50 баксов и 70 евриков на сок')?.entry,undefined);
 const state=voiceEntryBatch('вчера заплатил 50 лэй за сок и 70 за такси',null,'ru',[],options);
 assert.deepEqual(state?.batch.states.map(item=>[item.entry.amount,item.entry.category,item.entry.currency,item.entry.dateKey]),[['50','сок','MDL',expected.dateKey],['70','такси','MDL',expected.dateKey]]);
 const confident={isFinal:true,confidence:.95};
 const phrase='Заплатил 50 лэй за сок';assert.equal(canAutoSaveVoiceEntry(phrase,parse(phrase),'ru',[],options,confident),true);
 for(const phrase of ['Точнее потратил 70 лей на сок','Нет, не 50 а 70 лей на сок','Не расход а доход 70 лей на сок'])assert.equal(canAutoSaveVoiceEntry(phrase,parse(phrase),'ru',[],options,confident),false,phrase);
 assert.equal(canAutoSaveVoiceEntry('потратил 50 баксов на сок',parse('потратил 50 баксов на сок'),'ru',[],options,{...confident,alternatives:['потратил 50 евриков на сок']}),false);
});
