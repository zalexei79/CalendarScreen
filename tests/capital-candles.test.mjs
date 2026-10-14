import assert from 'node:assert/strict';
import test from 'node:test';
import {candleHistory,buildCandles} from '../src/features/capital/candleModel.js';
test('candles preserve true OHLC, validate bounds and reject close-only data',()=>{
 const row={date:'2026-10-14',open:'100',high:'115',low:'90',close:'110'};
 assert.equal(candleHistory([row])[0].price,'110');
 assert.equal(candleHistory([{date:row.date,price:'110'}]).length,0);
 assert.equal(candleHistory([{...row,high:'101'}]).length,0);
 assert.equal(candleHistory([{...row,low:'111'}]).length,0);
 assert.equal(candleHistory([{...row,open:'NaN'}]).length,0);
});
test('candles sort and deduplicate real dates; wicks contain bodies',()=>{
 const rows=candleHistory([{date:'2026-10-14',open:'110',high:'115',low:'90',close:'95'},{date:'2026-10-13',open:'100',high:'111',low:'99',close:'110'}]);
 const chart=buildCandles(rows);
 assert.equal(chart.points[0].up,true);assert.equal(chart.points[1].up,false);
 for(const p of chart.points){assert.ok(p.high<=Math.min(p.open,p.close));assert.ok(p.low>=Math.max(p.open,p.close));}
 assert.equal(candleHistory([...rows,rows[0]]).length,2);
});
