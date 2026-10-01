import test from 'node:test';import assert from 'node:assert/strict';
import {voiceEntryDialog as dialog}from '../src/shared/lib/voiceEntryDialog.js';
test('short replies fill only missing entry fields',()=>{
 let state=dialog('запиши');assert.equal(state.field,'sign');
 state=dialog('расход',state.draft);assert.equal(state.field,'amount');
 state=dialog('восемьдесят',state.draft);assert.equal(state.field,'currency');
 assert.deepEqual(dialog('в леях',state.draft).command,{type:'entry',kind:'record',sign:'minus',amount:'80',currency:'MDL'});
 assert.equal(dialog('нет, 90',state.draft).draft.amount,'90');
 assert.equal(dialog('отмена',state.draft).cancelled,true);
 assert.equal(dialog('непонятно',state.draft).field,'currency');
 assert.equal(dialog('следующий месяц'),null);
 assert.equal(dialog('добавь запись'),null);
});
test('English and Romanian follow-ups preserve category and amount',()=>{
 let state=dialog('I spent 50 on coffee',null,'en');assert.equal(state.field,'currency');
 assert.equal(dialog('euros',state.draft,'en').command.category,'coffee');
 state=dialog('am cheltuit 80',null,'ro');assert.equal(state.field,'currency');
 assert.equal(dialog('lei',state.draft,'ro').command.currency,'MDL');
});
