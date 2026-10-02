import {useEffect,useState} from 'react';
const key='dayris_voice_feedback',eventName='dayris-voice-feedback';
function read(){try{return localStorage.getItem(key)!=='off';}catch{return true;}}
export default function useVoiceFeedback(){
 const [enabled,setEnabled]=useState(read);
 useEffect(()=>{const refresh=()=>setEnabled(read());const update=event=>setEnabled(event.detail);window.addEventListener('storage',refresh);window.addEventListener(eventName,update);return()=>{window.removeEventListener('storage',refresh);window.removeEventListener(eventName,update);};},[]);
 function change(value){setEnabled(value);try{localStorage.setItem(key,value?'on':'off');}catch{/* Keep the session preference. */}window.dispatchEvent(new CustomEvent(eventName,{detail:value}));}
 return [enabled,change];
}
