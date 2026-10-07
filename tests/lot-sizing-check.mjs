import assert from 'node:assert/strict';
import { calculateLotSize, parseLotNumber } from '../src/features/trading/lotSizing.js';
const base = { balance: '10000', risk: '1', stop: '20', tickValue: '10', minimum: '0.01', step: '0.01', maximum: '100', commission: '0' };
assert.equal(calculateLotSize(base).lots, .5);
assert.equal(calculateLotSize(base).loss, 100);
assert.equal(calculateLotSize({...base, stop:'30'}).lots, .33);
assert.equal(calculateLotSize({...base, commission:'7'}).lots, .48);
assert.equal(calculateLotSize({...base, maximum:'.25'}).lots, .25);
assert.equal(calculateLotSize({...base, maximum:'.25'}).capped, true);
assert.equal(calculateLotSize({...base, balance:'10'}).error, 'belowMinimum');
assert.equal(calculateLotSize({...base, minimum:'1', step:'1', maximum:'10'}).error, 'belowMinimum');
assert.equal(calculateLotSize({...base, stop:'2', tickValue:'1', step:'.25', minimum:'.25'}).lots, 50);
assert.equal(parseLotNumber('0,25'), .25);
for(const value of ['', '-1', 'Infinity', '1foo', '0x10', '1,2,3']) assert.ok(Number.isNaN(parseLotNumber(value)));
for(const key of ['balance','risk','stop','tickValue','minimum','step']) assert.equal(calculateLotSize({...base,[key]:'0'}).error,'invalid');
assert.equal(calculateLotSize({...base,risk:'101'}).error,'invalid');
assert.equal(calculateLotSize({...base,maximum:'.001'}).error,'invalid');
assert.equal(calculateLotSize({...base,tickValue:''}).error,'incomplete');
for(const step of [.001,.01,.1,.25,1]) for(const balance of [10,500,10000,12345.67]) for(const stop of [1,23.6,100]) {
  const result=calculateLotSize({...base,balance,stop,step,minimum:step});
  if(!result.error) { assert.ok(result.loss<=result.budget+1e-8); assert.ok(Math.abs(result.lots/step-Math.round(result.lots/step))<1e-7); }
}
console.log('PASS: lot sizing, commission, broker limits, comma decimals, invalid input and risk-preserving rounding.');
