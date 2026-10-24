import test from 'node:test';
import assert from 'node:assert/strict';
import {calculatePositions} from '../src/features/capital/decimal.js';
import {activityRows,partitionHoldings} from '../src/features/capital/portfolioSections.js';
const assets=[{id:'gold',name:'Gold',symbol:'XAU',currency:'USD'},{id:'apple',name:'Apple',symbol:'AAPL',currency:'USD'},{id:'empty',name:'Cancelled asset',currency:'USD'}];
const op=(id,asset_id,operation,quantity,unit_price,fee='0')=>({id,asset_id,operation,quantity,unit_price,fee,currency:'USD',occurred_on:'2026-10-20',created_at:`2026-10-20T${id}:00:00Z`});
const ops=[op('10','gold','buy','2','100','2'),op('11','gold','sell','2','130','1'),op('12','apple','buy','2','100')];
test('closed and cancelled positions disappear from current holdings without erasing sale results',()=>{
 const enriched=calculatePositions(assets,ops),{current,closed}=partitionHoldings(enriched);
 assert.deepEqual(current.map(a=>a.id),['apple']);assert.deepEqual(closed.map(a=>a.id),['gold']);
 assert.equal(enriched[0].realized,570000000000n);
 assert.equal(activityRows(enriched,ops,{kind:'sell'})[0].total,2590000000000n);
 const undone=calculatePositions(assets,ops.slice(0,1));assert.deepEqual(partitionHoldings(undone).current.map(a=>a.id),['gold']);
 assert.equal(partitionHoldings(calculatePositions(assets,[])).closed.length,0);
});
test('history search, chronology and exact cash amounts include fees and partial sales',()=>{
 const partial=[op('09','apple','buy','0.3','10','0.01'),op('10','apple','sell','0.1','12','0.02')];
 const enriched=calculatePositions(assets,partial),rows=activityRows(enriched,partial,{query:'aapl'});
 assert.deepEqual(rows.map(x=>x.row.operation),['sell','buy']);assert.equal(rows[0].total,11800000000n);
 assert.equal(rows[1].total,30100000000n);assert.equal(partitionHoldings(enriched).current.length,1);
 assert.equal(activityRows(enriched,partial,{kind:'sell',query:'Gold'}).length,0);
});
