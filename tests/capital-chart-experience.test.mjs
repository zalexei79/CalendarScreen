import test from 'node:test';import assert from 'node:assert/strict';import {compareCandles,formatChartPercent} from '../src/features/capital/chartExperience.js';
test('candle comparison is exact, signed and distinct from portfolio profit',()=>{
 const a=compareCandles({close:'0.1',time:1},{close:'0.3',time:2});assert.equal(a.change,2000000000n);assert.equal(a.percent,20000n);assert.equal(formatChartPercent(a.percent,'ru'),'+200,00%');assert.equal(a.fromTime,1);assert.equal(a.toTime,2);
 const loss=compareCandles({close:'100'},{close:'75'});assert.equal(loss.change,-250000000000n);assert.equal(formatChartPercent(loss.percent,'en'),'-25.00%');assert.equal(formatChartPercent(0n,'en'),'0.00%');assert.equal(compareCandles({close:'0'},{close:'2'}),null);assert.equal(compareCandles({close:'bad'},{close:'2'}),null);assert.equal(compareCandles(null,null),null);
});
