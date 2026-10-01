import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCalendarVoiceCommand as parse} from '../src/shared/lib/calendarVoiceCommand.js';
test('navigation and conversational expenses',()=>{
 for(const phrase of ['войди в кошелёк','открой кошелек'])assert.deepEqual(parse(phrase),{type:'wallet'});
 assert.deepEqual(parse('включи режим про'),{type:'pro',enabled:true});
 assert.deepEqual(parse('выключи режим pro'),{type:'pro',enabled:false});
 assert.deepEqual(parse('перемотай на следующий месяц'),{type:'month',direction:1});
 assert.deepEqual(parse('перемотай назад'),{type:'month',direction:-1});
 for(const phrase of ['добавь 60 лей я сегодня потратил в календарь добавь','я сегодня потратил 60 лей запиши в календарь','запиши расход шестьдесят лей'])assert.deepEqual(parse(phrase),{type:'entry',kind:'record',amount:'60',currency:'MDL',sign:'minus'});
 assert.equal(parse('я не потратил 60 лей'),null);
 assert.equal(parse('я потратил 60 лей и 50 евро'),null);
});
test('calendar command vocabulary is explicit and localized',()=>{
 assert.deepEqual(parse('добавь запись'),{type:'add',kind:'record'});
 assert.deepEqual(parse('Добавь новую сделку.'),{type:'add',kind:'trade'});
 assert.deepEqual(parse('add entry'),{type:'add',kind:'record'});
 assert.deepEqual(parse('adaugă o tranzacție'),{type:'add',kind:'trade'});
});
test('dates support spoken numbers, future years and leap days',()=>{
 for(const phrase of ['включи 13 ноября 2048','открой тринадцать ноября две тысячи сорок восемь','open 13 november 2048','deschide 13 noiembrie 2048'])assert.deepEqual(parse(phrase),{type:'date',year:2048,month:10,day:13,dateKey:'2048-11-13'});
 assert.equal(parse('открой 29 февраля 2048').dateKey,'2048-02-29');
});
test('personal-money phrases prepare drafts with an explicit currency',()=>{
 assert.deepEqual(parse('сегодня я потратил 50 рублей'),{type:'entry',kind:'record',amount:'50',currency:'RUB',sign:'minus'});
 assert.deepEqual(parse('сегодня я получил пятьдесят евро'),{type:'entry',kind:'record',amount:'50',currency:'EUR',sign:'plus'});
 assert.equal(parse('сегодня я потратила 50 лей').currency,'MDL');
 assert.equal(parse('Today I spent 50 euros').sign,'minus');
 assert.equal(parse('Astăzi am cheltuit 50 lei').currency,'MDL');
 for(const phrase of ['сегодня я потратил 50','сегодня я потратил 0 рублей','сегодня я потратил 50 и 100 рублей','вчера я потратил 50 евро'])assert.equal(parse(phrase),null,phrase);
});
test('invalid dates and unrelated speech never execute actions',()=>{
 for(const phrase of ['','13 ноября 2048','напомни 13 ноября 2048','открой 31 ноября 2048','открой 29 февраля 2047','открой 13 ноября','открой 13 ноября завтра','удали запись','я сказал добавь запись','открой 13.5 ноября 2048'])assert.equal(parse(phrase),null,phrase);
});
