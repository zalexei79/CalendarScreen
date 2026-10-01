import test from 'node:test';
import assert from 'node:assert/strict';
import {financialVoiceAnswer} from '../src/shared/lib/financialVoiceAnswer.js';
import {parseCalendarVoiceCommand} from '../src/shared/lib/calendarVoiceCommand.js';
test('custom category commands and questions preserve arbitrary names',()=>{
 assert.deepEqual(parseCalendarVoiceCommand('Создай новый раздел Настольные игры'),{type:'category',name:'настольные игры'});
 assert.deepEqual(parseCalendarVoiceCommand('запиши расход 20 евро на сигареты'),{type:'entry',kind:'record',amount:'20',currency:'EUR',sign:'minus',category:'сигареты'});
 assert.deepEqual(parseCalendarVoiceCommand('я потратил на сигареты двадцать евро'),{type:'entry',kind:'record',amount:'20',currency:'EUR',sign:'minus',category:'сигареты'});
 for(const phrase of ['сколько я всего потратил за этот месяц на сигареты','сколько потратил на сигареты за месяц'])assert.deepEqual(parseCalendarVoiceCommand(phrase),{type:'question',metric:'expense',period:'current-month',category:'сигареты'});
 assert.equal(parseCalendarVoiceCommand('сколько потратил на сигареты за прошлый месяц'),null);
});
test('category answers count only matching personal expenses in each currency',()=>{
 const records={'2026-10-01':[{instrument:'Сигареты',pnl:-500,currency:'EUR'},{instrument:'Продукты',pnl:-70,currency:'EUR'},{instrument:'Сигареты',pnl:25,currency:'EUR'},{instrument:'Сигареты',pnl:-100,currency:'RUB'}]};
 const reply=financialVoiceAnswer({records,monthKey:'2026-10',metric:'expense',category:'сигареты'});
 assert.match(reply,/500.*евро/);assert.match(reply,/100.*руб/);assert.doesNotMatch(reply,/570|475/);
 assert.match(financialVoiceAnswer({records,monthKey:'2026-10',metric:'expense',category:'Такси'}),/пока нет/);
});
test('financial questions never create entries',()=>{
 for(const [phrase,metric] of [['сколько заработал за месяц','income'],['сколько я заработала за текущий месяц','income'],['расскажи сколько получил в этом месяце','income'],['сколько потратил за месяц','expense'],['какие у меня расходы за месяц','expense'],['подведи итог за месяц','summary'],['скажи итоги за текущий месяц','summary']])assert.deepEqual(parseCalendarVoiceCommand(phrase),{type:'question',metric,period:'current-month'});
 for(const [phrase,metric] of [['Расскажи сколько я потратил за этот месяц','expense'],['Сколько я заработал за этот месяц','income'],['Подведи итог за этот месяц','summary'],['How much did I spend this month','expense'],['Cât am cheltuit luna aceasta','expense']])assert.deepEqual(parseCalendarVoiceCommand(phrase),{type:'question',metric,period:'current-month'});
 assert.equal(parseCalendarVoiceCommand('сколько я потратил за прошлый месяц'),null);
 assert.equal(parseCalendarVoiceCommand('сколько заработал за год'),null);
});
test('current month only, currencies stay separate, trading excluded from expenses',()=>{
 const records={'2026-10-01':[{pnl:-50,currency:'RUB'},{pnl:100,currency:'EUR'},{pnl:-20,currency:'EUR'},{pnl:-500,currency:'USD',traderMode:true},{pnl:NaN,currency:'USD'}],'2026-09-30':[{pnl:-999,currency:'RUB'}]};
 const answer=financialVoiceAnswer({records,monthKey:'2026-10',metric:'summary',isTrading:item=>item.traderMode});
 assert.match(answer,/100.*евро/);assert.match(answer,/20.*евро/);assert.match(answer,/50.*руб/);assert.match(answer,/80.*евро/);assert.match(answer,/Торговый результат отдельно: -500/);assert.doesNotMatch(answer,/999|570|NaN/);
 assert.deepEqual(records['2026-10-01'][0],{pnl:-50,currency:'RUB'});
});
test('empty and trading-only months do not invent personal data',()=>{
 assert.match(financialVoiceAnswer({records:{},monthKey:'2026-10',metric:'expense'}),/записей пока нет/);
 assert.match(financialVoiceAnswer({records:{'2026-10-01':[{pnl:-20}]},monthKey:'2026-10',metric:'expense',isTrading:()=>true}),/Личные расходы: нет записей/);
});
