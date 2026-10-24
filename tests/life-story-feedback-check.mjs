import assert from 'node:assert/strict';
import {createLifeStoryFeedback} from '../src/features/onboarding/lifeStoryFeedback.js';
let now=0,reduced=false,hidden=false,gesture=false;
const starts=[],pulses=[],levels=[],contexts=[],listeners=new Map();
const param=()=>({value:0,setValueAtTime(v){levels.push(v)},linearRampToValueAtTime(v){levels.push(v)},exponentialRampToValueAtTime(v){levels.push(v)}});
class Audio {
 constructor(){assert.ok(gesture,'Audio is created inside the initiating click');this.state='suspended';this.sampleRate=48000;this.currentTime=0;this.destination={};contexts.push(this)}
 resume(){this.state='running';return Promise.resolve()}
 close(){this.state='closed';return Promise.resolve()}
 createBuffer(channels,length){const data=new Float32Array(length);return{length,getChannelData:()=>data}}
 createBufferSource(){const audio=this;return{buffer:null,playbackRate:param(),connect(){},disconnect(){},start(){starts.push({time:now,length:this.buffer.length,source:this});},stop(){this.onended?.()}}}
 createGain(){return{gain:param(),connect(){},disconnect(){}}}
 createBiquadFilter(){return{frequency:param(),Q:param(),connect(){},disconnect(){}}}
}
const env={window:{AudioContext:Audio,matchMedia:q=>({matches:q.includes('reduced-motion')?reduced:true})},performance:{now:()=>now},document:{get hidden(){return hidden},addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)},navigator:{maxTouchPoints:5,vibrate:n=>{pulses.push({time:now,n});return true}}};
const feedback=createLifeStoryFeedback(env);
feedback.tick(1,0);assert.equal(starts.length,0);assert.equal(pulses.length,0);
gesture=true;feedback.prepare();gesture=false;assert.equal(contexts.length,1);assert.equal(starts.length,1,'One silent activation sample');
for(now=0;now<=8500;now+=16)feedback.tick(Math.floor(now/3),now);
const clicks=starts.filter(s=>s.length>1), taps=pulses.filter(p=>p.n>0);
assert.ok(clicks.length>20&&clicks.length<=54,'Counter clicks are bounded rather than one sound per week/frame');
assert.ok(clicks.every((n,i)=>n.time<8000&&(!i||n.time-clicks[i-1].time>=150)));
assert.ok(taps.length>5&&taps.length<=18&&taps.every((p,i)=>p.n===4&&(!i||p.time-taps[i-1].time>=450)));
assert.ok(Math.max(...levels)<=.055,'Low-gain attack and decay, no loud cue');
feedback.stop();feedback.setMuted(true);let count=starts.length;now+=500;feedback.tick(9000,1000);assert.equal(starts.length,count,'Mute silences the counter');
feedback.setMuted(false);gesture=true;feedback.prepare();gesture=false;now+=500;feedback.tick(9001,1200);assert.ok(starts.length>count,'Sound can be restored by a click');
hidden=true;listeners.get('visibilitychange')();count=starts.length;let pulseCount=pulses.length;now+=500;feedback.tick(9002,1400);assert.equal(starts.length,count);assert.equal(pulses.length,pulseCount,'Hidden pages have no feedback');
hidden=false;reduced=true;feedback.tick(9003,1500);assert.equal(starts.length,count);assert.equal(pulses.length,pulseCount,'Reduced motion disables rhythmic stimulation');
feedback.dispose();assert.equal(contexts[0].state,'closed');assert.equal(listeners.size,0);
const unsupported=createLifeStoryFeedback({window:{matchMedia:()=>({matches:false})},performance:{now:()=>0},document:env.document,navigator:{}});assert.doesNotThrow(()=>{unsupported.prepare();unsupported.tick(1,20);unsupported.dispose()});
console.log('Counter feedback: gesture activation, gentle envelopes, rate limits, mute, visibility, reduced motion, cleanup and unsupported devices passed.');
