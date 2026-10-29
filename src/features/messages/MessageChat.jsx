import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowDown,Send,Check,CheckCheck,Gift,MessageCircle,CalendarDays} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import {chatCopy,chatLocale} from './chatCopy.js';
import './MessageChat.css';
import SocialAvatar from '../social/SocialAvatar.jsx';
import {socialInviteCopy} from '../social/socialInviteCopy.js';
import ShareCalendarDay,{dayShareCopy} from '../social/ShareCalendarDay.jsx';
const merge=(a,b)=>[...new Map([...a,...b].map(m=>[m.entry_key,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.entry_key.localeCompare(b.entry_key));
export default function MessageChat({userId,peer=null,admin=false,friend=false,canEdit=true,language='ru',onBack,onCampaign,previewMessages=null}){
 const t=chatCopy(language),locale=chatLocale(language),[rows,setRows]=useState(previewMessages||[]),[body,setBody]=useState(''),[error,setError]=useState(''),[sendFailed,setSendFailed]=useState(false),[loading,setLoading]=useState(!previewMessages),[sending,setSending]=useState(false),[more,setMore]=useState(false),[older,setOlder]=useState(false),[hasNew,setHasNew]=useState(false);
 const alive=useRef(true),list=useRef(null),nearBottom=useRef(true),scrollPlan=useRef(null),pendingLatest=useRef(null),fetching=useRef(false),reading=useRef(false),locked=useRef(false),request=useRef(null),known=useRef(new Set()),initialized=useRef(false),refreshRef=useRef(null),rowsRef=useRef(rows);rowsRef.current=rows;
 const [unavailable,setUnavailable]=useState(false),accessDenied=useRef(false),selfDirection=friend?'self':admin?'admin':'user',peerId=friend?peer?.user_id:peer?.id,peerName=friend?peer?.display_name:peer?.name;
 const [shareDay,setShareDay]=useState(false);
 const notify=()=>window.dispatchEvent(friend?new CustomEvent('dayris:friends-messages',{detail:{userId,peerId}}):admin?new Event('dayris:admin-replies-refresh'):new CustomEvent('dayris:creator-count',{detail:{userId}}));
 function deny(){accessDenied.current=true;setUnavailable(true);setSendFailed(false);setRows([]);setMore(false);setHasNew(false);pendingLatest.current=null;known.current=new Set();initialized.current=false;setError(socialInviteCopy(language).unavailable);}
 async function markRead(items){
  if(previewMessages||accessDenied.current||reading.current||!canEdit||document.visibilityState==='hidden')return;
  const ids=items.filter(m=>m.direction!==selfDirection&&!m.read_at).slice(-100).map(m=>m.id);if(!ids.length)return;reading.current=true;
  try{const {error}=await supabase.rpc(friend?'friend_chat_read':admin?'chat_admin_read':'chat_user_read',friend?{p_peer:peerId,p_ids:ids,p_owner:userId}:admin?{p_user_id:peer.id,p_ids:ids}:{p_ids:ids});if(!alive.current)return;if(error){if(friend&&error.code==='42501')deny();return;}const now=new Date().toISOString();setRows(previous=>previous.map(m=>ids.includes(m.id)&&m.direction!==selfDirection?{...m,read_at:m.read_at||now}:m));notify();}catch{/* Retry on next visible refresh. */}finally{reading.current=false;}
 }
 useEffect(()=>{
  if(previewMessages){setRows(previewMessages);setLoading(false);return;}
  alive.current=true;
  async function refresh(before=null){
   if(fetching.current||accessDenied.current||document.visibilityState==='hidden')return;fetching.current=true;
   if(before)setOlder(true);
   try{
    const args={p_before_at:before?.created_at||null,p_before_key:before?.entry_key||null,p_limit:50};if(friend)args.p_peer=peerId;else if(admin)args.p_user_id=peer.id;
    const {data,error}=await supabase.rpc(friend?'friend_chat_thread':admin?'chat_admin_thread':'chat_user_thread',args);if(!alive.current)return;if(error)throw error;if(friend&&data?.owner_id!==userId)throw {code:'42501'};
    setUnavailable(false);
    const next=data?.rows||[],first=!initialized.current;
    const disconnected=!before&&!first&&next.length>0&&known.current.size>0&&!next.some(m=>known.current.has(m.entry_key));
    if(disconnected&&!nearBottom.current){pendingLatest.current={rows:next,more:Boolean(data?.has_more)};setHasNew(true);return;}
    if(!before&&nearBottom.current)pendingLatest.current=null;
    if(before&&list.current)scrollPlan.current={mode:'preserve',height:list.current.scrollHeight,top:list.current.scrollTop};
    else if(first||nearBottom.current)scrollPlan.current={mode:'bottom'};
    else if(next.some(m=>!known.current.has(m.entry_key)))setHasNew(true);
    if(!admin&&!friend&&next.some(m=>m.pro_until&&!known.current.has(m.entry_key)))window.dispatchEvent(new Event('dayris:pro-refresh'));
    if(disconnected)known.current=new Set();next.forEach(m=>known.current.add(m.entry_key));setRows(previous=>disconnected?next:merge(previous,next));if(first||before||disconnected)setMore(Boolean(data?.has_more));initialized.current=true;setError('');
    if(!before&&(first||nearBottom.current))markRead(next);
   }catch(error){if(alive.current){if(friend&&['42501','28000','P0002'].includes(error?.code))deny();else setError(t.loadError);}}finally{fetching.current=false;if(alive.current){setLoading(false);setOlder(false);}}
  }
  refreshRef.current=refresh;refresh();const poll=()=>refresh();const timer=setInterval(poll,3000);window.addEventListener('focus',poll);document.addEventListener('visibilitychange',poll);
  return()=>{alive.current=false;refreshRef.current=null;clearInterval(timer);window.removeEventListener('focus',poll);document.removeEventListener('visibilitychange',poll);};
 },[admin,friend,peerId,userId,canEdit,language,previewMessages]);
 useLayoutEffect(()=>{const node=list.current,plan=scrollPlan.current;if(!node||!plan)return;if(plan.mode==='bottom'){node.scrollTop=node.scrollHeight;nearBottom.current=true;setHasNew(false);}else node.scrollTop=plan.top+node.scrollHeight-plan.height;scrollPlan.current=null;},[rows]);
 async function send(e,overrideText=null){e?.preventDefault();const text=(overrideText??body).trim();if(previewMessages||locked.current||!canEdit||unavailable||!text)return;locked.current=true;setSending(true);setSendFailed(false);
  if(request.current?.body!==text)request.current={id:crypto.randomUUID(),body:text};
  try{const args={p_body:text,p_request_id:request.current.id};if(friend){args.p_peer=peerId;args.p_owner=userId;}else if(admin)args.p_user_id=peer.id;const {error}=await supabase.rpc(friend?'friend_chat_send':admin?'chat_admin_send':'chat_user_send',args);if(!alive.current)return;if(error)throw error;
   request.current=null;setBody('');nearBottom.current=true;await refreshRef.current?.();notify();
  }catch(error){if(alive.current){if(friend&&error?.code==='42501')deny();else setSendFailed(true);}}finally{locked.current=false;if(alive.current)setSending(false);}
 }
 const date=value=>new Date(value).toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'});
 const time=value=>new Date(value).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'});
 function bottom(){nearBottom.current=true;setHasNew(false);if(pendingLatest.current){const next=pendingLatest.current;pendingLatest.current=null;known.current=new Set(next.rows.map(m=>m.entry_key));scrollPlan.current={mode:'bottom'};setRows(next.rows);setMore(next.more);markRead(next.rows);}else{const node=list.current;if(node)node.scrollTop=node.scrollHeight;markRead(rowsRef.current);}}
 return <section className={`dayris-chat${admin?' dayris-chat-admin':''}`} aria-label={admin||friend?peerName:t.title}>
  <header className="chat-peer-header">{onBack&&<button type="button" className="chat-back" aria-label={t.back} onClick={onBack}><ArrowLeft size={20}/></button>}{admin||friend?<SocialAvatar userId={peerId} name={peerName} path={friend?peer.avatar_path:undefined} loadProfile={!friend} className="chat-peer-avatar"/>:<span className="chat-peer-avatar">D</span>}<div className="chat-peer-label"><h2 id={friend?'friend-chat-title':admin?'admin-chat-title':'creator-inbox-title'}>{admin||friend?peerName:t.title}</h2><p>{friend?'@'+peer.handle:admin?peer.email||peer.id:t.subtitle}</p></div>{onCampaign&&canEdit&&<button type="button" className="chat-gift-action" aria-label={t.giftAction} title={t.giftAction} onClick={onCampaign}><Gift size={20}/></button>}</header>
  <div className="chat-timeline-wrap"><div ref={list} className="chat-timeline" tabIndex={0} aria-label={t.subtitle} onScroll={()=>{const node=list.current;nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;if(nearBottom.current){if(pendingLatest.current)bottom();else{setHasNew(false);markRead(rowsRef.current);}}}}>
   {more&&<button type="button" className="chat-load-older" disabled={older} onClick={()=>refreshRef.current?.(rows[0])}>{older?t.loading:t.older}</button>}
   {loading&&!rows.length?<p className="chat-empty-note" role="status">{t.loading}</p>:!rows.length&&!error?<div className="chat-welcome"><MessageCircle size={32}/><strong>{t.empty}</strong><p>{t.emptyHint}</p></div>:null}
   {rows.map((m,index)=>{const mine=m.direction===selfDirection,newDay=index===0||date(rows[index-1].created_at)!==date(m.created_at),generic=['Сообщение','Сообщение от создателя','Сообщения от создателя'].includes(m.title);return <React.Fragment key={m.entry_key}>
    {newDay&&<div className="chat-day-divider"><span>{date(m.created_at)}</span></div>}
    <div className={`chat-message-row${mine?' is-mine':''}`}><div className={`chat-bubble${m.pro_until?' has-gift':''}`}>
     {m.kind==='notice'&&m.title&&!generic&&<strong className="chat-notice-title">{m.title}</strong>}<p>{m.body}</p>
     {m.pro_until&&<div className="chat-pro-attachment"><Gift size={17}/><span><strong>{t.pro}</strong><span>{m.pro_until==='infinity'?t.forever:`${t.until} ${date(m.pro_until)}`}</span></span></div>}
     <span className="chat-message-meta"><time dateTime={m.created_at}>{time(m.created_at)}</time>{mine&&(m.read_at?<CheckCheck size={14} aria-label={t.read}/>:<Check size={14} aria-label={t.sent}/>)}</span>
    </div></div>
   </React.Fragment>;})}
  </div>{hasNew&&<button type="button" className="chat-new-messages" onClick={bottom}><ArrowDown size={15}/>{t.newMessages}</button>}</div>
  {(error||sendFailed)&&<div className="chat-error" role="alert"><span>{sendFailed?t.sendError:error}</span><button type="button" disabled={sending} onClick={()=>{accessDenied.current=false;sendFailed?send():refreshRef.current?.();}}>{t.retry}</button></div>}
  {friend&&shareDay&&!unavailable&&<ShareCalendarDay userId={userId} language={language} onCancel={()=>setShareDay(false)} onSend={text=>{const message=body.trim()?body.trim()+'\n\n'+text:text;if(message.length>2000){setError(t.sendError);return;}setBody(message);setShareDay(false);send(null,message);}}/>}
  {canEdit&&!unavailable?<form className="chat-composer" onSubmit={send}>{friend&&<button type="button" className="chat-share-day-button" disabled={sending} aria-label={dayShareCopy(language)[0]} title={dayShareCopy(language)[0]} onClick={()=>setShareDay(value=>!value)}><CalendarDays size={20}/></button>}<textarea aria-label={t.placeholder} placeholder={t.placeholder} maxLength={2000} rows={2} value={body} readOnly={Boolean(previewMessages)} disabled={sending} onChange={e=>{setBody(e.target.value);setSendFailed(false);}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send(e);}}}/><button type="submit" className="chat-send" aria-label={t.send} disabled={Boolean(previewMessages)||sending||!body.trim()}><Send size={20}/></button></form>:<p className="chat-read-only">{unavailable?socialInviteCopy(language).unavailable:t.readOnly}</p>}
 </section>;
}
