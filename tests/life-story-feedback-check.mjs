import assert from 'node:assert/strict';
import {createLifeStoryFeedback,LIFE_WEEKS_AUDIO} from '../src/features/onboarding/lifeStoryFeedback.js';
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
function fixture({deferred=false,bad=false}={}){
 let now=0,gesture=false,reduced=false,hidden=false,resolve;
 const sources=[],contexts=[],pulses=[],listeners=new Map(),motionListeners=new Map(),requests=[];
 const param=()=>({value:1,setValueAtTime(){},linearRampToValueAtTime(){}});
 class Audio{
  constructor(){assert.ok(gesture);this.state='suspended';this.sampleRate=48000;this.currentTime=0;this.destination={};contexts.push(this)}
  resume(){this.state='running';return Promise.resolve()}
  close(){this.state='closed';return Promise.resolve()}
  createBuffer(){return {length:1}}
  decodeAudioData(){return Promise.resolve({length:384000,duration:8})}
  createGain(){return {gain:param(),connect(){},disconnect(){}}}
  createBufferSource(){const s={buffer:null,playbackRate:param(),connect(){},disconnect(){},start(time,offset,duration){this.started={time,offset,duration}},stop(time){if(time===undefined){this.stopped=true;this.onended?.()}}};sources.push(s);return s}
 }
 const motion={get matches(){return reduced},addEventListener:(n,f)=>motionListeners.set(n,f),removeEventListener:n=>motionListeners.delete(n)};
 const response={ok:!bad,arrayBuffer:async()=>new ArrayBuffer(4)};
 const env={window:{AudioContext:Audio,matchMedia:q=>q.includes('reduced')?motion:{matches:true}},performance:{now:()=>now},document:{get hidden(){return hidden},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},navigator:{maxTouchPoints:5,vibrate:n=>pulses.push({n,now})},fetch:(url,options)=>{requests.push({url,options});return deferred?new Promise(r=>resolve=r):Promise.resolve(response)}};
 const f=createLifeStoryFeedback(env);
 return {f,sources,contexts,requests,pulses,listeners,motionListeners,env,tracks:()=>sources.filter(s=>s.buffer?.length>1),prepare(){gesture=true;f.prepare();gesture=false},tick(t){now=t;f.tick(Math.floor(t/3),t)},hide(){hidden=true;listeners.get('visibilitychange')()},reduce(){reduced=true;motionListeners.get('change')()},resolve(){resolve(response)}};
}
const a=fixture();a.tick(0);assert.equal(a.sources.length,0);assert.equal(a.requests.length,0);
a.prepare();await flush();assert.equal(a.sources.length,1,'Silent activation only before counter');assert.equal(a.requests[0].url,LIFE_WEEKS_AUDIO);
a.tick(0);assert.equal(a.tracks().length,1);assert.equal(a.tracks()[0].started.duration,8);
for(let t=16;t<3000;t+=16)a.tick(t);assert.equal(a.tracks().length,1,'One supplied track, no per-week sounds');
a.f.setMuted(true);assert.ok(a.tracks()[0].stopped);a.tick(3200);a.f.setMuted(false);assert.equal(a.tracks().length,2);assert.equal(a.tracks()[1].started.offset,3.2);assert.equal(a.tracks()[1].started.duration,4.8);
a.tick(8000);assert.ok(a.tracks()[1].stopped);a.f.setMuted(false);assert.equal(a.tracks().length,2);
const taps=a.pulses.filter(p=>p.n===4);assert.ok(taps.length>=5);assert.ok(taps.every((p,i)=>!i||p.now-taps[i-1].now>=450));
a.f.stop();a.prepare();a.tick(0);assert.equal(a.tracks().length,3);a.hide();assert.ok(a.tracks()[2].stopped);a.f.dispose();assert.equal(a.contexts[0].state,'closed');assert.equal(a.listeners.size,0);assert.equal(a.motionListeners.size,0);
const b=fixture();b.prepare();await flush();b.tick(0);b.reduce();assert.ok(b.tracks()[0].stopped,'Reduced motion change stops audio even without subsequent ticks');b.f.dispose();
const c=fixture({deferred:true});c.prepare();await flush();c.tick(2000);c.resolve();await flush();assert.equal(c.tracks()[0].started.offset,2,'Late decode follows visual clock');c.f.dispose();
for(const mode of ['stop','dispose','end']){const d=fixture({deferred:true});d.prepare();await flush();d.tick(1000);if(mode==='end')d.tick(8000);else d.f[mode]();d.resolve();await flush();assert.equal(d.tracks().length,0,mode+' prevents late playback');d.f.dispose()}
const e=fixture({bad:true});e.prepare();await flush();e.tick(1000);assert.equal(e.tracks().length,0);e.f.dispose();
const unsupported=createLifeStoryFeedback({window:{matchMedia:()=>({matches:false})},performance:{now:()=>0},navigator:{}});assert.doesNotThrow(()=>{unsupported.prepare();unsupported.tick(1,20);unsupported.dispose()});
console.log('Supplied counter track: gesture activation, timeline sync, mute/resume, one source, haptics, late decode, background, reduced motion and cleanup passed.');
