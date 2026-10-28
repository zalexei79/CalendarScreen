import assert from 'node:assert/strict';
import {glassTiltVector as goldTiltVector,glassDepthProfile} from '../src/shared/ui/glassTilt.js';
const neutral={alpha:0,beta:0,gamma:0};
assert.deepEqual(goldTiltVector(neutral,neutral),{x:-0,y:-0});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} should equal ${b}`);
assert.deepEqual(glassDepthProfile('gold'),{x:32,y:24,plane:5,rotation:2.2},'Preserve the approved desktop response');
for(const theme of ['gold','emerald']) {
 const gentle=goldTiltVector({beta:0,gamma:8},neutral,0,theme);
 const medium=goldTiltVector({beta:0,gamma:20},neutral,0,theme);
 const deep=goldTiltVector({beta:0,gamma:35},neutral,0,theme);
 assert.ok(gentle.x < -15,'A small phone turn visibly moves the material');
 assert.ok(deep.x < medium.x && medium.x < gentle.x,'Travel continues beyond twelve degrees');
 near(goldTiltVector({beta:0,gamma:-20},neutral,0,theme).x,-medium.x);
 const upright={alpha:0,beta:90,gamma:0};
 const yaw=goldTiltVector({alpha:18,beta:90,gamma:0},upright,0,theme);
 assert.ok(yaw.x < -25,'Turning an upright phone must work even when gamma stays zero');
 near(yaw.y,0);
 const equivalent=goldTiltVector({alpha:10,beta:90,gamma:8},upright,0,theme);
 near(equivalent.x,yaw.x);near(equivalent.y,yaw.y);
 const flat=goldTiltVector({beta:18,gamma:0},neutral,0,theme);
 const landscape=goldTiltVector({beta:18,gamma:0},neutral,90,theme);
 near(landscape.x/glassDepthProfile(theme,'sensor').x,flat.y/glassDepthProfile(theme,'sensor').y);
 near(landscape.y,0);
}
for(const theme of ['gold','emerald']) for(const angle of [0,90,180,270,-90]) for(const beta of [-180,-90,0,90,180]) for(const gamma of [-90,0,90]) {
 const point=goldTiltVector({beta,gamma},neutral,angle,theme),depth=glassDepthProfile(theme,'sensor');
 assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));assert.ok(Math.abs(point.x)<=depth.x&&Math.abs(point.y)<=depth.y);
}
assert.ok(Math.abs(goldTiltVector({beta:-179,gamma:0},{beta:179,gamma:0}).y)<5);
assert.ok(Math.abs(goldTiltVector({alpha:1,beta:90,gamma:0},{alpha:359,beta:90,gamma:0}).x)<6);
for(const reading of [{beta:null,gamma:0},{beta:NaN,gamma:0},{beta:1,gamma:Infinity},{}]) assert.equal(goldTiltVector(reading,neutral),null);
console.log('PASS: physical screen frames, upright yaw, progressive depth, unchanged desktop, portrait/landscape, wraparound, strict bounds and invalid data.');
