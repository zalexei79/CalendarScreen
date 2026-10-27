import assert from 'node:assert/strict';
import {glassTiltVector as goldTiltVector,glassDepthProfile} from '../src/shared/ui/glassTilt.js';
const neutral={beta:45,gamma:-5};
assert.deepEqual(goldTiltVector(neutral,neutral),{x:-0,y:-0});
assert.deepEqual(goldTiltVector({beta:63,gamma:13},neutral),{x:-32,y:-24});
assert.deepEqual(goldTiltVector({beta:27,gamma:-23},neutral),{x:32,y:24});
assert.deepEqual(goldTiltVector({beta:51,gamma:1},neutral),{x:-16,y:-12},'A gentle six-degree tilt must be clearly visible');
assert.deepEqual(goldTiltVector({beta:51,gamma:1},neutral,0,'emerald'),{x:-22,y:-16});
for(const theme of ['gold','emerald']) for(const angle of [0,90,180,270,-90]) for(const beta of [-180,-90,0,90,180]) for(const gamma of [-90,0,90]) {
 const point=goldTiltVector({beta,gamma},neutral,angle,theme),depth=glassDepthProfile(theme);
 assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.ok(Math.abs(point.x)<=depth.x&&Math.abs(point.y)<=depth.y);
}
const landscape=goldTiltVector({beta:63,gamma:-5},neutral,90);
assert.equal(landscape.x,-32);assert.ok(Math.abs(landscape.y)<1e-10);
assert.ok(Math.abs(goldTiltVector({beta:-179,gamma:0},{beta:179,gamma:0}).y)<5);
for(const reading of [{beta:null,gamma:0},{beta:NaN,gamma:0},{beta:1,gamma:Infinity},{}]) assert.equal(goldTiltVector(reading,neutral),null);
console.log('PASS: calibrated tilt vectors, portrait/landscape, wraparound, strict bounds and invalid sensor data.');
