// Prepare in a user gesture; signal only after recognition actually starts.
export function prepareVoiceCue(){
 const Audio=window.AudioContext||window.webkitAudioContext;
 if(!Audio)return null;
 try{const context=new Audio();context.resume().catch(()=>{});return context;}catch{return null;}
}
export function playVoiceCue(context){
 if(!context||context.state!=='running')return;
 try{
  const tone=context.createOscillator(),gain=context.createGain(),time=context.currentTime;
  tone.frequency.value=740;gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(.035,time+.012);gain.gain.exponentialRampToValueAtTime(.0001,time+.09);
  tone.connect(gain);gain.connect(context.destination);tone.start(time);tone.stop(time+.1);tone.onended=()=>{tone.disconnect();gain.disconnect();};
 }catch{/* The visible ready state also signals that listening has started. */}
}
