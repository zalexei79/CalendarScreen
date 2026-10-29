import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Mail,Gift,X,ChevronLeft,ChevronRight} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import {creatorCopy} from './creatorCopy.js';
import MessageCard from './MessageCard.jsx';
import MessageReply from './MessageReply.jsx';
import {cardLabels,cardHeading,cardTheme} from './messageCardModel.js';
import './CreatorMessages.css';
const OPEN='dayris:creator-open',COUNT='dayris:creator-count';
const date=(value,language)=>new Date(value).toLocaleDateString(({ru:'ru-RU',uk:'uk-UA',md:'ro-RO',ro:'ro-RO','zh-CN':'zh-CN'})[language]||'en-US',{day:'numeric',month:'long',year:'numeric'});
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
 const c=cardLabels(message,t);
 return <section className="creator-gift-note">{c.sender&&<span><Gift size={16}/>{c.sender}</span>}<strong>{cardHeading(message,t)}</strong><p>{message.body.length>300?message.body.slice(0,300)+'…':message.body}</p><button type="button" onClick={()=>requestOpen(userId,onOpen)}>{t.inbox}</button></section>;
}
export default function CreatorMessages({userId,language,isLight}){
 const [state,setState]=useState({owner:null,data:null,error:false}),[openFor,setOpenFor]=useState(null),[offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[focused,setFocused]=useState(null),[saving,setSaving]=useState(false),[view,setView]=useState('message');
 const [replyBusy,setReplyBusy]=useState(false);
 const current=useRef(userId);current.current=userId;const announced=useRef(new Set()),refreshedGifts=useRef(new Set()),dialog=useRef(null),marking=useRef(null);
 const t=creatorCopy(language),own=state.owner===userId?state:{data:null,error:false};
 useEffect(()=>{announced.current=new Set();refreshedGifts.current=new Set();marking.current=null;setFocused(null);setOpenFor(null);setOffset(0);setSaving(false);setReplyBusy(false);setView('message');},[userId]);
 useEffect(()=>{if(!userId)return;let alive=true,busy=false;
  async function refresh(){if(busy||document.visibilityState==='hidden')return;busy=true;try{
   const {data,error}=await supabase.rpc('creator_inbox',{p_limit:20,p_offset:offset});if(!alive)return;
   if(error)throw error;setState({owner:userId,data,error:false});window.dispatchEvent(new CustomEvent(COUNT,{detail:{userId,count:data?.unread_count||0}}));
   const newGifts=(data?.messages||[]).filter(m=>m.pro_until&&!m.read_at&&!refreshedGifts.current.has(m.id));
   if(newGifts.length){newGifts.forEach(m=>refreshedGifts.current.add(m.id));window.dispatchEvent(new Event('dayris:pro-refresh'));}
   const unread=(data?.messages||[]).find(m=>!m.read_at&&!announced.current.has(m.id));
   if(unread&&!document.querySelector('dialog[open],[aria-modal="true"]')){
    (data.messages||[]).forEach(m=>announced.current.add(m.id));setFocused(unread);setView('message');setOpenFor(userId);
   }else if(dialog.current?.open)(data.messages||[]).forEach(m=>announced.current.add(m.id));
  }catch{if(alive)setState(s=>({owner:userId,data:s.owner===userId?s.data:null,error:true}));}finally{busy=false;}}
  function open(e){if(e.detail?.userId!==userId)return;setFocused(null);setView('message');setOpenFor(userId);refresh();}
  async function deepLink(){const id=new URLSearchParams(location.search).get('creatorMessage');if(!id)return;const {data}=await supabase.rpc('creator_message',{p_id:id});if(alive&&data){const url=new URL(location.href);if(url.searchParams.get('creatorMessage')===id){url.searchParams.delete('creatorMessage');history.replaceState(history.state,'',url);}setFocused(data);setView('message');setOpenFor(userId);announced.current.add(id);if(data.pro_until)window.dispatchEvent(new Event('dayris:pro-refresh'));}}
  refresh();deepLink().catch(()=>{});const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);window.addEventListener(OPEN,open);
  return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener(OPEN,open);};
 },[userId,offset,revision]);
 const visible=Boolean(userId&&openFor===userId);
 useEffect(()=>{if(!visible)return;const node=dialog.current,previous=document.activeElement;node?.showModal();return()=>{node?.close();if(previous?.isConnected)previous.focus?.();};},[visible]);
 async function mark(message){
  if(marking.current)return;
  if(message.read_at){setOpenFor(null);return;}
  const owner=userId,request={owner};marking.current=request;setSaving(true);
  try{
   const {error}=await supabase.rpc('creator_ack_message',{p_id:message.id});if(current.current!==owner||marking.current!==request)return;
   if(error)throw error;
   announced.current.add(message.id);setOpenFor(null);setFocused(null);setRevision(n=>n+1);
   if(message.pro_until)window.dispatchEvent(new Event('dayris:pro-refresh'));
  }catch{if(current.current===owner&&marking.current===request)setState(s=>({...s,error:true}));}
  finally{if(current.current===owner&&marking.current===request){marking.current=null;setSaving(false);}}
 }
 if(!visible)return null;
 const messages=own.data?.messages||[];
 const message=focused?(messages.find(m=>m.id===focused.id)||focused):(messages.find(m=>!m.read_at)||messages[0]);
 const showHistory=view==='history',c=cardLabels(message,t),locked=saving||replyBusy;
 function select(m){setFocused(m);setView('message');if(m.pro_until)window.dispatchEvent(new Event('dayris:pro-refresh'));}
 return createPortal(
  <dialog ref={dialog} className={`creator-inbox${cardTheme(message,isLight)?' creator-inbox-light':''}${showHistory?' creator-inbox-history':''}`} aria-labelledby="creator-inbox-title" onCancel={e=>{e.preventDefault();if(!locked)setOpenFor(null);}}>
   <button type="button" className="creator-close" aria-label={c.closeLabel} disabled={locked} onClick={()=>setOpenFor(null)}><X size={18} aria-hidden="true"/></button>
   {showHistory?<>
    <header className="creator-history-heading"><span>DAYRIS</span><h2 id="creator-inbox-title">{t.inbox}</h2></header>
    <div className="creator-history-list">{messages.map(m=><button type="button" key={m.id} className="creator-history-item" onClick={()=>select(m)}>
     <span className={`creator-history-icon${m.pro_until?' creator-history-gift':''}`}>{m.pro_until?<Gift size={19}/>:<Mail size={19}/>}</span>
     <span className="creator-history-content"><strong>{cardHeading(m,t)}</strong><span>{m.body}</span><time>{date(m.created_at,language)}</time></span>
     {!m.read_at&&<span className="creator-unread-dot" aria-label={t.unread}/>}<ChevronRight size={16} aria-hidden="true"/>
    </button>)}</div>
    {(offset>0||offset+20<(own.data?.total||0))&&<nav className="creator-history-pages" aria-label={t.more}>
     <button type="button" disabled={offset===0} aria-label={t.previous} onClick={()=>setOffset(n=>Math.max(0,n-20))}><ChevronLeft size={17}/></button>
     <button type="button" disabled={offset+20>=(own.data?.total||0)} onClick={()=>setOffset(n=>n+20)}>{t.more}<ChevronRight size={16}/></button>
    </nav>}
   </>:message?(view==='reply'?<MessageReply key={userId+':'+message.id} message={message} t={t} onBusy={setReplyBusy} onBack={()=>setView('message')} onClose={()=>setOpenFor(null)} onSent={()=>{announced.current.add(message.id);setRevision(n=>n+1);}}/>:
    <MessageCard message={message} t={t} dateLabel={message.pro_until&&message.pro_until!=='infinity'?date(message.pro_until,language):''} saving={saving} onPrimary={()=>mark(message)} onReply={c.allowReply?()=>{setFocused(message);setView('reply');}:undefined} onHistory={(own.data?.total||0)>1?()=>setView('history'):undefined}/>
   ):<div className="creator-empty"><Mail size={28} aria-hidden="true"/><h2 id="creator-inbox-title">{own.data?t.empty:t.loading}</h2></div>}
   {own.error&&<div className="creator-message-error" role="alert"><p>{t.error}</p><button type="button" disabled={saving} onClick={()=>setRevision(n=>n+1)}>{t.refresh}</button></div>}
  </dialog>,document.body);
}
