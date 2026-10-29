import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Mail,Gift} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import {creatorCopy} from './creatorCopy.js';
import './CreatorMessages.css';
const OPEN='dayris:creator-open',COUNT='dayris:creator-count';
const date=value=>new Date(value).toLocaleString();
function requestOpen(userId,onOpen){onOpen?.();setTimeout(()=>window.dispatchEvent(new CustomEvent(OPEN,{detail:{userId}})),0);}
export function CreatorMessagesButton({userId,language,onOpen}){
 const [count,setCount]=useState({owner:null,value:0});
 useEffect(()=>{if(!userId)return;let alive=true;const update=e=>{if(e.detail?.userId===userId)setCount({owner:userId,value:e.detail.count});};window.addEventListener(COUNT,update);
 supabase.rpc('creator_inbox',{p_limit:1,p_offset:0}).then(({data,error})=>{if(alive&&!error)setCount({owner:userId,value:data?.unread_count||0});}).catch(()=>{});
 return()=>{alive=false;window.removeEventListener(COUNT,update);};},[userId]);
 if(!userId)return null;const t=creatorCopy(language);
 return <button type="button" className="creator-messages-button" onClick={()=>requestOpen(userId,onOpen)}><Mail size={16}/>{t.inbox}{count.owner===userId&&count.value>0&&<span>{count.value}</span>}</button>;
}
export function CreatorGiftNote({userId,language,onOpen}){
 const [state,setState]=useState({owner:null,data:null});const t=creatorCopy(language);
 useEffect(()=>{if(!userId)return;let alive=true;supabase.rpc('creator_latest_gift').then(({data,error})=>{if(alive&&!error)setState({owner:userId,data});}).catch(()=>{});return()=>{alive=false;};},[userId]);
 const message=state.owner===userId?state.data:null;if(!message)return null;
 return <section className="creator-gift-note"><span><Gift size={16}/>{t.from}</span><strong>{message.title}</strong><p>{message.body.length>300?message.body.slice(0,300)+'…':message.body}</p><button type="button" onClick={()=>requestOpen(userId,onOpen)}>{t.inbox}</button></section>;
}
export default function CreatorMessages({userId,language,isLight}){
 const [state,setState]=useState({owner:null,data:null,error:false}),[openFor,setOpenFor]=useState(null),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[focused,setFocused]=useState(null),[saving,setSaving]=useState(false);
 const current=useRef(userId);current.current=userId;const announced=useRef(new Set()),dialog=useRef(null);
 const t=creatorCopy(language),own=state.owner===userId?state:{data:null,error:false};
 useEffect(()=>{announced.current=new Set();setFocused(null);setOpenFor(null);setOffset(0);setSaving(false);},[userId]);
 useEffect(()=>{if(!userId)return;let alive=true,busy=false;
  async function refresh(){if(busy||document.visibilityState==='hidden')return;busy=true;try{
   const {data,error}=await supabase.rpc('creator_inbox',{p_limit:20,p_offset:offset});if(!alive)return;
   if(error){setState({owner:userId,data:null,error:true});return;}setState({owner:userId,data,error:false});window.dispatchEvent(new CustomEvent(COUNT,{detail:{userId,count:data?.unread_count||0}}));
   const unread=(data?.messages||[]).find(m=>!m.read_at&&!announced.current.has(m.id));
   if(unread&&!document.querySelector('dialog[open],[aria-modal="true"]')){announced.current.add(unread.id);setFocused(unread);setOpenFor(userId);if(unread.pro_until)window.dispatchEvent(new Event('dayris:pro-refresh'));}
  }catch{if(alive)setState({owner:userId,data:null,error:true});}finally{busy=false;}}
  function open(e){if(e.detail?.userId!==userId)return;setOpenFor(userId);refresh();}
  async function deepLink(){const id=new URLSearchParams(location.search).get('creatorMessage');if(!id)return;const {data}=await supabase.rpc('creator_message',{p_id:id});if(alive&&data){const url=new URL(location.href);if(url.searchParams.get('creatorMessage')===id){url.searchParams.delete('creatorMessage');history.replaceState(history.state,'',url);}setFocused(data);setOpenFor(userId);announced.current.add(id);if(data.pro_until)window.dispatchEvent(new Event('dayris:pro-refresh'));}}
  refresh();deepLink().catch(()=>{});const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener(OPEN,open);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener(OPEN,open);};
 },[userId,offset,revision]);
 const visible=Boolean(userId&&openFor===userId);
 useEffect(()=>{if(!visible)return;const node=dialog.current,previous=document.activeElement;node?.showModal();return()=>{node?.close();if(previous?.isConnected)previous.focus?.();};},[visible]);
 async function mark(message){if(saving)return;const owner=userId;setSaving(true);try{const {error}=await supabase.rpc('creator_ack_message',{p_id:message.id});if(current.current!==owner)return;if(error){setState(s=>({...s,error:true}));return;}setFocused(m=>m?.id===message.id?{...m,read_at:new Date().toISOString()}:m);setRevision(n=>n+1);}catch{if(current.current===owner)setState(s=>({...s,error:true}));}finally{if(current.current===owner)setSaving(false);}}
 if(!visible)return null;
 const messages=own.data?.messages||[];const selected=focused&&messages.every(m=>m.id!==focused.id)?[focused,...messages]:messages;
 return createPortal(<dialog ref={dialog} className={`creator-inbox${isLight?' creator-inbox-light':''}`} aria-labelledby="creator-inbox-title" onCancel={e=>{e.preventDefault();if(!saving)setOpenFor(null);}}><header><div><span>DAYRIS</span><h2 id="creator-inbox-title">{t.inbox}</h2></div><button type="button" disabled={saving} onClick={()=>setOpenFor(null)}>{t.close}</button></header><div className="creator-inbox-tools"><button type="button" onClick={()=>setRevision(n=>n+1)}>{t.refresh}</button><span>{own.data?.unread_count??'—'}</span></div>{own.error&&<p role="alert">{t.error}</p>}{selected.map(m=><article key={m.id} className={!m.read_at?'creator-unread':''}><span className="creator-from"><Mail size={15}/>{t.from}</span><h3>{m.title}</h3><p className="creator-message-body">{m.body}</p>{m.pro_until&&<p className="creator-pro-gift"><Gift size={16}/>{m.pro_until==='infinity'?t.forever:`${t.gift} ${date(m.pro_until)}`}</p>}<time>{date(m.created_at)}</time>{!m.read_at&&<button type="button" disabled={saving} onClick={()=>mark(m)}>{t.read}</button>}</article>)}{own.data&&!selected.length&&<p>{t.empty}</p>}<footer><button type="button" disabled={offset===0||saving} onClick={()=>{setFocused(null);setOffset(n=>Math.max(0,n-20));}}>←</button><span>{own.data?.total??'—'}</span><button type="button" disabled={!own.data||offset+20>=own.data.total||saving} onClick={()=>{setFocused(null);setOffset(n=>n+20);}}>{t.more} →</button></footer></dialog>,document.body);
}
