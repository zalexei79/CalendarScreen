import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createMonthShakeDetector} from '../src/shared/ui/monthShakeModel.js';

function fixture(angle=0,gravity=false) {
  const detector=createMonthShakeDetector();let time=0;const changes=[];
  function sample(x=0,y=0,z=0,dt=20,rates=null) {
    time+=dt;const r=angle*Math.PI/180;
    const native={x:x*Math.cos(r)+y*Math.sin(r),y:-x*Math.sin(r)+y*Math.cos(r),z};
    const vector=gravity?{accelerationIncludingGravity:{x:native.x,y:native.y+9.8,z:native.z}}:{acceleration:native};
    const result=detector.push({...vector,rotationRate:rates},time,angle);
    if(result)changes.push(result);return result;
  }
  const quiet=()=>{for(let i=0;i<20;i++)sample();};
  function flick(direction) { quiet();sample(3*direction);sample(6*direction);sample(11*direction);sample(9*direction);sample(0);sample(-8*direction); }
  return {detector,sample,quiet,flick,changes,setAngle:value=>{angle=value;},get time(){return time;}};
}
test('left/right gestures follow the first impulse, one month per rebound',()=>{
  for(const sign of [-1,1]) { const f=fixture();f.flick(sign);assert.deepEqual(f.changes,[sign<0?'prev':'next']);
    for(let i=0;i<40;i++)f.sample(i%2?11:-11);assert.equal(f.changes.length,1);
    for(let i=0;i<80;i++)f.sample();f.flick(-sign);assert.deepEqual(f.changes,[sign<0?'prev':'next',sign<0?'next':'prev']);
  }
});
test('screen direction stays correct in both landscape orientations and upside down',()=>{
  for(const angle of [0,90,-90,180,270])for(const sign of [-1,1]) {const f=fixture(angle);f.flick(sign);assert.deepEqual(f.changes,[sign<0?'prev':'next']);}
});
test('walking, ordinary tilt/noise and rapid rotation do not change months',()=>{
  for(const walk of [false,true]) {const f=fixture();f.quiet();for(let i=0;i<200;i++)f.sample(1.5*Math.sin(i),walk?8*Math.cos(i):.5,walk?4*Math.sin(i):.5);assert.deepEqual(f.changes,[]);}
  const f=fixture();f.quiet();f.sample(12,0,0,20,{beta:150});f.sample(-12,0,0,100,{beta:-150});assert.deepEqual(f.changes,[]);
});
test('a single bump, slow movement, vertical shakes and stale samples are rejected',()=>{
  const f=fixture();f.quiet();f.sample(11);for(let i=0;i<40;i++)f.sample();assert.deepEqual(f.changes,[]);
  f.sample(-11,0,0,400);f.sample(11,0,0,100);assert.deepEqual(f.changes,[]);
  f.quiet();f.sample(1,12);f.sample(-1,-12,0,100);assert.deepEqual(f.changes,[]);
});
test('reset discards half a gesture and preserves its cooldown',()=>{
  const f=fixture();f.quiet();f.sample(11);f.detector.reset();f.sample(-11,0,0,100);assert.deepEqual(f.changes,[]);
  f.flick(1);assert.deepEqual(f.changes,['next']);f.detector.reset();f.flick(-1);assert.equal(f.changes.length,1);
});
test('gravity fallback removes a stationary holding angle and supports deliberate gestures',()=>{
  for(const angle of [0,90,-90])for(const sign of [-1,1]){const f=fixture(angle,true);f.flick(sign);assert.deepEqual(f.changes,[sign<0?'prev':'next']);}
  // Native DeviceMotionEventAcceleration fields can be prototype getters.
  class NativeVector {constructor(x=0){this.value=x;}get x(){return this.value;}get y(){return 9.8;}get z(){return 0;}}
  const detector=createMonthShakeDetector();for(let time=0;time<2000;time+=20)assert.equal(detector.push({accelerationIncludingGravity:new NativeVector()},time),null);
  assert.equal(detector.push({accelerationIncludingGravity:new NativeVector(12)},2000),null);
  assert.equal(detector.push({accelerationIncludingGravity:new NativeVector(-9)},2100),'next');
});
test('null/NaN/partial input and impossible impacts cannot complete a gesture',()=>{
  const f=fixture();f.quiet();f.sample(11);
  for(const input of [{},{acceleration:{x:null,y:0,z:0}},{acceleration:{x:NaN,y:0,z:0}},{acceleration:{x:100,y:0,z:0}}])assert.equal(f.detector.push(input,f.time+40),null);
  assert.equal(f.detector.push({acceleration:{x:-11,y:0,z:0}},f.time+140),null);
});
