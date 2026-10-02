import test from 'node:test';import assert from 'node:assert/strict';
import {categoryRemovalTargets,detachCategoryLabels} from '../src/shared/lib/categoryRemoval.js';
import {forgetCategory} from '../src/shared/lib/categoryLibrary.js';
test('removing a category changes only its label, preserving each amount, currency, sign, date, ID and note',()=>{
 const records={'2026-09-30':[{id:'a',instrument:'Сок',pnl:-80,currency:'MDL',time:'13:00',comment:'с яблоком',direction:'SHORT',platform:'Manual',traderMode:false},{id:'b',instrument:'Такси',pnl:-50,currency:'MDL',traderMode:false}],'2026-10-01':[{id:'c',instrument:'СОК',pnl:30,currency:'EUR',traderMode:false},{id:'d',instrument:'Сок',pnl:500,currency:'USD',platform:'cTrader',traderMode:true}]};
 const original=structuredClone(records),targets=categoryRemovalTargets(records,'сок',item=>item.traderMode===false),next=detachCategoryLabels(records,targets);
 assert.equal(targets.length,2);assert.deepEqual(records,original);
 assert.deepEqual(next,{'2026-09-30':[{...original['2026-09-30'][0],instrument:'Другое'},original['2026-09-30'][1]],'2026-10-01':[{...original['2026-10-01'][0],instrument:'Другое'},original['2026-10-01'][1]]});
 assert.deepEqual(categoryRemovalTargets(records,'Другое',()=>true),[]);
});
test('a label edit or deletion during removal is preserved and never recreates a record',()=>{
 const records={'2026-10-01':[{id:'a',instrument:'Сок',pnl:-80},{id:'b',instrument:'Сок',pnl:-30}]};
 const targets=categoryRemovalTargets(records,'Сок',()=>true),latest={'2026-10-01':[{id:'a',instrument:'Кафе',pnl:-350}]};
 assert.deepEqual(detachCategoryLabels(latest,targets),latest);
 assert.deepEqual(forgetCategory({favorites:['Сок','Такси'],recent:['СОК','Кафе']},'сок'),{favorites:['Такси'],recent:['Кафе']});
});
