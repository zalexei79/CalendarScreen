import {useEffect,useRef,useState} from 'react';
import {readVoiceLaunch,consumeVoiceLaunch} from '../lib/voiceLaunch.js';
const storage=()=>{try{return window.sessionStorage;}catch{return null;}};
export default function useVoiceLaunch(){
 const [request,setRequest]=useState(()=>readVoiceLaunch(window.location,storage()));
 const current=useRef(request);current.current=request;
 useEffect(()=>{
  const update=()=>setRequest(readVoiceLaunch(window.location,storage()));
  window.addEventListener('popstate',update);window.addEventListener('pageshow',update);
  return ()=>{window.removeEventListener('popstate',update);window.removeEventListener('pageshow',update);};
 },[]);
 function handled(id){
  if(current.current?.id!==id)return;
  consumeVoiceLaunch(window.location,window.history,storage());current.current=null;setRequest(null);
 }
 return {request,handled};
}
