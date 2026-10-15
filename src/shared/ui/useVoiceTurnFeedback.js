import {useEffect,useRef,useState} from 'react';

// Let the processing color settle even for a local, synchronous command.
// Work starts immediately; only speech playback / the next listening turn waits.
const MIN_FEEDBACK_MS=520;
export default function useVoiceTurnFeedback(){
 const [processing,setProcessing]=useState(false);
 const current=useRef(null),timer=useRef(null),mounted=useRef(true);
 function cancel(){clearTimeout(timer.current);timer.current=null;current.current=null;if(mounted.current)setProcessing(false);}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancel();};},[]);
 async function run(work){
  if(current.current)return;
  const turn={started:performance.now(),after:null};current.current=turn;setProcessing(true);
  try{await work();}
  finally{
   if(current.current===turn&&mounted.current){
    const finish=()=>{if(current.current!==turn||!mounted.current)return;current.current=null;timer.current=null;setProcessing(false);turn.after?.();};
    const remaining=MIN_FEEDBACK_MS-(performance.now()-turn.started);
    if(remaining>0)timer.current=setTimeout(finish,remaining);else finish();
   }
  }
 }
 function defer(callback,replace=true){if(!current.current)return false;if(replace||!current.current.after)current.current.after=callback;return true;}
 return {processing,run,defer,cancel,active:()=>Boolean(current.current)};
}
