// The supplied eight-second track follows the actual counter clock, not an independent timer.
export const LIFE_WEEKS_AUDIO = '/onboarding/life-weeks-cue.mp3';
export function createLifeStoryFeedback(env = globalThis) {
  const win=env.window||env,doc=env.document,nav=env.navigator;
  const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const clock=()=> (env.performance||performance).now();
  let context,buffer,track=null,loading=null,abort=null,generation=0;
  let armed=false,muted=false,listening=false,finished=false,anchor=null;
  let lastValue=null,lastPulse=-Infinity;
  const disconnect=record=>{record.source.disconnect();record.gain.disconnect()};
  const stopTrack=()=>{const record=track;track=null;if(record){try{record.source.stop()}catch{}disconnect(record)}};
  const stop=()=>{
    stopTrack();anchor=null;finished=false;lastValue=null;
    if(clock()-lastPulse<5){try{nav?.vibrate?.(0)}catch{}}
    lastPulse=-Infinity;
  };
  const hidden=()=>{if(doc.hidden)stop()};
  const motionChanged=()=>{if(motion.matches)stop()};
  const playTrack=()=>{
    if(!armed||muted||doc?.hidden||motion?.matches||!buffer||track||finished||anchor===null||context?.state!=='running')return;
    const offset=Math.max(0,(clock()-anchor)/1000),end=Math.min(8,buffer.duration),remaining=end-offset;
    if(remaining<=.005)return;
    try{
      const source=context.createBufferSource(),gain=context.createGain(),time=context.currentTime;
      source.buffer=buffer;source.playbackRate.value=1;
      const attack=Math.min(.06,remaining/3),release=Math.min(.16,remaining/3);
      gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.7,time+attack);
      gain.gain.setValueAtTime(.7,time+remaining-release);gain.gain.linearRampToValueAtTime(0,time+remaining);
      source.connect(gain);gain.connect(context.destination);
      const record={source,gain};track=record;
      source.onended=()=>{disconnect(record);if(track===record){track=null;finished=true}};
      // Late loading or unmuting resumes at the visual timeline's current position.
      source.start(time,offset,remaining);source.stop(time+remaining+.01);
    }catch{stopTrack()}
  };
  const loadTrack=()=>{
    if(buffer||loading)return;
    const current=context,ticket=++generation;
    const fetcher=env.fetch||win.fetch||globalThis.fetch;
    if(typeof fetcher!=='function')return;
    abort=typeof AbortController==='function'?new AbortController():null;
    loading=Promise.resolve().then(()=>fetcher.call(win,LIFE_WEEKS_AUDIO,{cache:'force-cache',signal:abort?.signal}))
      .then(response=>{if(!response.ok)throw Error('Counter audio unavailable');return response.arrayBuffer()})
      .then(bytes=>current.decodeAudioData(bytes))
      .then(decoded=>{if(ticket!==generation||context!==current)return;buffer=decoded;loading=null;playTrack()})
      .catch(()=>{if(ticket===generation)loading=null});
  };
  const prepare=()=>{
    armed=true;
    if(!listening&&doc){doc.addEventListener('visibilitychange',hidden);motion?.addEventListener?.('change',motionChanged);listening=true}
    if(muted||motion?.matches)return;
    try{
      const Audio=win.AudioContext||win.webkitAudioContext;if(!Audio)return;
      if(!context||context.state==='closed'){
        context=new Audio();buffer=null;finished=false;
        // Keep iPhone audio activation in the initiating click, before fetch/decode.
        const unlock=context.createBufferSource();unlock.buffer=context.createBuffer(1,1,context.sampleRate);
        unlock.connect(context.destination);unlock.onended=()=>unlock.disconnect();unlock.start();
      }
      context.resume()?.then(playTrack).catch(()=>{});loadTrack();playTrack();
    }catch{/* Audio restrictions must never block the counter or calendar. */}
  };
  return {
    prepare,
    setMuted(value){muted=Boolean(value);if(muted)stopTrack();else playTrack()},
    tick(value,elapsed){
      if(!armed||doc?.hidden||motion?.matches||elapsed<0)return;
      if(elapsed>=8000){anchor=null;stopTrack();return}
      anchor=clock()-elapsed;playTrack();
      if(value===lastValue)return;lastValue=value;
      const touch=nav?.maxTouchPoints>0||win.matchMedia?.('(pointer: coarse)').matches;
      if(touch&&typeof nav?.vibrate==='function'&&clock()-lastPulse>=450){lastPulse=clock();try{nav.vibrate(4)}catch{}}
    },
    stop,
    dispose(){
      stop();armed=false;++generation;abort?.abort();abort=null;loading=null;
      if(listening){doc.removeEventListener('visibilitychange',hidden);motion?.removeEventListener?.('change',motionChanged)}
      listening=false;
      if(context&&context.state!=='closed'){try{context.close()?.catch(()=>{})}catch{}}
      context=buffer=null;
    },
  };
}
