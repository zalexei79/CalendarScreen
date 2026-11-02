import {useEffect,useMemo,useRef,useState} from 'react';
import {supabase} from '../../supabaseClient';
import {createAutomaticChat} from './automaticChatSession.js';
import {automaticEpoch,isAutomaticMessage} from './automaticChatCrypto.js';
export default function useAutomaticChat({owner,peer,enabled,rows}){
 const session=useMemo(()=>enabled?createAutomaticChat(supabase,owner,peer):null,[enabled,owner,peer]),[state,setState]=useState({ready:false,status:'loading',devices:0}),[decrypted,setDecrypted]=useState({}),[revision,setRevision]=useState(0),cache=useRef(new Map()),activeSession=useRef(null),currentRows=useRef(rows);currentRows.current=rows;
 const epochKey=[...new Set(rows.map(m=>automaticEpoch(m.body)).filter(Boolean))].sort().join(',');
 const messageKey=rows.filter(m=>isAutomaticMessage(m.body)).map(m=>m.entry_key+':'+m.body).join('|');
 useEffect(()=>{
  if(!session){cache.current.clear();activeSession.current=null;setDecrypted({});setState({ready:false,status:'loading',devices:0});return;}let alive=true,busy=false;if(activeSession.current!==session){activeSession.current=session;cache.current.clear();setDecrypted({});setState({ready:false,status:'loading',devices:0});}
  async function refresh(){if(busy||document.visibilityState==='hidden')return;busy=true;try{const next=await session.sync(epochKey?epochKey.split(','):[]);if(!alive)return;const values=await Promise.all(currentRows.current.filter(m=>isAutomaticMessage(m.body)).map(async message=>{const cached=cache.current.get(message.entry_key);let text=cached?.body===message.body?cached.text:undefined;if(text===undefined){try{text=await session.decrypt(message);cache.current.set(message.entry_key,{body:message.body,text});}catch{text=null;}}return [message.entry_key,text];}));if(alive){setState(next);setDecrypted(Object.fromEntries(values));}}catch(error){if(alive)setState({ready:false,status:'error',devices:0,error});}finally{busy=false;}}
  refresh();const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};
 },[session,epochKey,messageKey,revision]);
 useEffect(()=>()=>{session?.forget();cache.current.clear();},[session]);
 return {session,...state,decrypted,retry:()=>setRevision(n=>n+1)};
}
