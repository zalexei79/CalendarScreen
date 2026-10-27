import assert from 'node:assert/strict';
import {glassTiltVector as goldTiltVector} from '../src/shared/ui/glassTilt.js';
const neutral={beta:45,gamma:-5};
assert.deepEqual(goldTiltVector(neutral,neutral),{x:-0,y:-0});
assert.deepEqual(goldTiltVector({beta:63,gamma:13},neutral),{x:-10,y:-8});
assert.deepEqual(goldTiltVector({beta:27,gamma:-23},neutral),{x:10,y:8});
for(const angle of [0,90,180,270,-90]) for(const beta of [-180,-90,0,90,180]) for(const gamma of [-90,0,90]) {
 const point=goldTiltVector({beta,gamma},neutral,angle);
 assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.ok(Math.abs(point.x)<=10&&Math.abs(point.y)<=8);
}
const landscape=goldTiltVector({beta:63,gamma:-5},neutral,90);
assert.equal(landscape.x,-10);assert.ok(Math.abs(landscape.y)<1e-10);
assert.ok(Math.abs(goldTiltVector({beta:-179,gamma:0},{beta:179,gamma:0}).y)<1);
for(const reading of [{beta:null,gamma:0},{beta:NaN,gamma:0},{beta:1,gamma:Infinity},{}]) assert.equal(goldTiltVector(reading,neutral),null);
console.log('PASS: calibrated tilt vectors, portrait/landscape, wraparound, strict bounds and invalid sensor data.');
