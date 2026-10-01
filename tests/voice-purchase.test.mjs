import test from 'node:test';import assert from 'node:assert/strict';
import {voiceEntryDialog as dialog}from '../src/shared/lib/voiceEntryDialog.js';
import {spokenText}from '../src/shared/lib/spokenText.js';
import {parseCalendarVoiceCommand as parse}from '../src/shared/lib/calendarVoiceCommand.js';
import {financialVoiceAnswer}from '../src/shared/lib/financialVoiceAnswer.js';
test('purchase asks for amount and category, accepts existing or separate category',()=>{
 const options=[{value:'Покупки',label:'Покупки'}];let state=dialog('сегодня я купил крем');assert.equal(state.field,'amount');
 state=dialog('80 евро',state.draft);assert.equal(state.field,'category');assert.match(state.prompt,/крем/);
 assert.equal(dialog('Покупки',state.draft,'ru',options).command.category,'Покупки');
 assert.equal(dialog('новую',state.draft).command.category,'крем');
 assert.equal(dialog('создай категорию Уход',state.draft).command.category,'уход');
 assert.equal(dialog('да',state.draft).field,'category','ambiguous consent never chooses a category');
 assert.equal(dialog('отмена',state.draft).cancelled,true);
});
test('speech text omits escape syntax and expands currency codes',()=>{
 assert.equal(spokenText('55 \\n / 100 USD'),'55 из 100 долларов');
 assert.equal(spokenText('Доход \\u0440\\u0443\\u0431'),'Доход руб');
});
test('category totals can include earlier months without mixing currencies',()=>{
 const command=parse('сколько потратил на крем за всё время');assert.equal(command.period,'all-time');assert.equal(command.category,'крем');
 const answer=financialVoiceAnswer({records:{'2020-01-01':[{instrument:'крем',pnl:-10,currency:'EUR'}],'2026-10-01':[{instrument:'крем',pnl:-20,currency:'EUR'}]},monthKey:'2026-10',metric:'expense',category:'крем',period:'all-time'});assert.match(answer,/30/);assert.match(answer,/всё время/);assert.doesNotMatch(answer,/этот месяц/);
});
