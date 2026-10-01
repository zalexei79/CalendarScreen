import test from 'node:test';
import assert from 'node:assert/strict';
import {financialVoiceAnswer} from '../src/shared/lib/financialVoiceAnswer.js';
import {parseCalendarVoiceCommand} from '../src/shared/lib/calendarVoiceCommand.js';
test('financial questions never create entries',()=>{
 for(const [phrase,metric] of [['Расскажи сколько я потратил за этот месяц','expense'],['Сколько я заработал за этот месяц','income'],['Подведи итог за этот месяц','summary'],['How much did I spend this month','expense'],['Cât am cheltuit luna aceasta','expense']])assert.deepEqual(parseCalendarVoiceCommand(phrase),{type:'question',metric,period:'current-month'});
 assert.equal(parseCalendarVoiceCommand('сколько я потратил за прошлый месяц'),null);
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
