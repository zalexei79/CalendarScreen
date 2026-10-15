import {useEffect,useRef} from 'react';

// Safari releases the audio input asynchronously after abort(). Starting the
// next recognizer before its end event can produce a false audio-capture error.
export default function useVoiceRecognitionRelease(isIOS){
 const pending=useRef(null),mounted=useRef(true);
 function dispose(){const job=pending.current;if(!job)return;clearTimeout(job.timer);job.recognition.onend=null;pending.current=null;}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;dispose();};},[]);
 function retire(recognition,ended=false){
  dispose();if(ended)return;
  const job={recognition,after:null,timer:null};pending.current=job;
  const finish=()=>{if(pending.current!==job)return;clearTimeout(job.timer);recognition.onend=null;pending.current=null;if(mounted.current)job.after?.();};
  recognition.onend=finish;
  job.timer=setTimeout(finish,isIOS?800:350);
  try{recognition.abort();}catch{finish();}
 }
 function defer(callback){if(!pending.current)return false;pending.current.after=callback;return true;}
 return {retire,defer};
}
