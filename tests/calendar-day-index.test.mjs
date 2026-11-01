import test from 'node:test';
import assert from 'node:assert/strict';
import {createCalendarDayIndex} from '../src/shared/lib/calendarDayIndex.js';
test('cached days retain filters, currency separation, source order and unmodified records',()=>{
 const source={'2026-11-01':[{id:'a',currency:' mdl ',pnl:-5,platform:'Manual'},{id:'b',currency:'USD',pnl:100,platform:'Manual'},{id:'c',currency:'MDL',pnl:20,platform:'cTrader'},{id:'d',pnl:3,platform:'Manual'}]};
 const snapshot=structuredClone(source),all=createCalendarDayIndex(source,{currency:'MDL'});
 assert.deepEqual(all.tradesForDayFiltered('2026-11-01').map(row=>row.id),['a','c']);assert.equal(all.totalPnlForDay('2026-11-01'),15);
 assert.equal(all.calendarRecordsForDay('2026-11-01').length,4);assert.equal(all.totalPnlForDay('2026-11-02'),0);
 const expense=createCalendarDayIndex(source,{platform:'Manual',type:'expense',currency:'MDL'});
 assert.equal(expense.totalPnlForDay('2026-11-01'),-5);assert.deepEqual(expense.tradesForDayFiltered('2026-11-01').map(row=>row.id),['a']);
 assert.equal(createCalendarDayIndex(source,{currency:'USD'}).totalPnlForDay('2026-11-01'),103);
 const changed={...source,'2026-11-01':[...source['2026-11-01'],{id:'e',currency:'MDL',pnl:7}]};
 assert.equal(createCalendarDayIndex(changed,{currency:'MDL'}).totalPnlForDay('2026-11-01'),22);assert.equal(all.totalPnlForDay('2026-11-01'),15);
 assert.deepEqual(source,snapshot);
});
