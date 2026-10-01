import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCalendarVoiceCommand as parse} from '../src/shared/lib/calendarVoiceCommand.js';
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
test('invalid dates and unrelated speech never execute actions',()=>{
 for(const phrase of ['','13 ноября 2048','напомни 13 ноября 2048','открой 31 ноября 2048','открой 29 февраля 2047','открой 13 ноября','открой 13 ноября завтра','удали запись','я сказал добавь запись','открой 13.5 ноября 2048'])assert.equal(parse(phrase),null,phrase);
});
