import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowDown,Send,Check,CheckCheck,Gift,MessageCircle,CalendarDays,Flame,Search,X,LockKeyhole,Reply,Copy,Bookmark,MoreHorizontal,Plus,Smile} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import {chatCopy,chatLocale} from './chatCopy.js';
import './MessageChat.css';
import SocialAvatar from '../social/SocialAvatar.jsx';
import VerifiedBadge from '../social/VerifiedBadge.jsx';
import {socialInviteCopy} from '../social/socialInviteCopy.js';
import ShareCalendarDay,{dayShareCopy} from '../social/ShareCalendarDay.jsx';
import DayHistoryCard from '../social/DayHistoryCard.jsx';
import {sharedDayMessage,readSharedDay,sharedStreakMessage,readSharedStreak} from '../social/sharedDayMessage.js';
import StreakShareCard from '../social/StreakShareCard.jsx';
import {syncAccountActivityStreak} from '../../shared/lib/accountActivityStreak.js';
import {momentShareCopy} from '../social/momentShareCopy.js';
import {friendMessengerCopy} from './friendMessengerCopy.js';
import {friendNote,readFriendNote,friendMessagePreview,isLockedMessage,friendWireSize,unlockFriendMessage} from './friendMessage.js';
import {readFriendDraft,saveFriendDraft,readSavedMessages,toggleSavedMessage} from '../social/friendWorkspace.js';
import FriendKeyPanel from './FriendKeyPanel.jsx';
import './FriendMessenger.css';
import useAutomaticChat from './useAutomaticChat.js';
import AutomaticChatPanel from './AutomaticChatPanel.jsx';
import {automaticChatCopy} from './automaticChatCopy.js';
import {isAutomaticMessage} from './automaticChatCrypto.js';
const merge=(a,b)=>[...new Map([...a,...b].map(m=>[m.entry_key,m])).values()].sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.entry_key.localeCompare(b.entry_key));
export default function MessageChat({userId,peer=null,admin=false,friend=false,canEdit=true,language='ru',onBack,onCampaign,previewMessages=null,initialShareDay=false}){
 const t=chatCopy(language),f=friendMessengerCopy(language),locale=chatLocale(language),[rows,setRows]=useState(previewMessages||[]),[body,setBody]=useState(()=>friend&&!previewMessages?readFriendDraft(userId,peer?.user_id):''),[error,setError]=useState(''),[sendFailed,setSendFailed]=useState(false),[loading,setLoading]=useState(!previewMessages),[sending,setSending]=useState(false),[more,setMore]=useState(false),[older,setOlder]=useState(false),[hasNew,setHasNew]=useState(false);
 const alive=useRef(true),list=useRef(null),nearBottom=useRef(true),scrollPlan=useRef(null),pendingLatest=useRef(null),fetching=useRef(false),reading=useRef(false),locked=useRef(false),request=useRef(null),known=useRef(new Set()),initialized=useRef(false),refreshRef=useRef(null),rowsRef=useRef(rows);rowsRef.current=rows;
 const [unavailable,setUnavailable]=useState(false),accessDenied=useRef(false),selfDirection=friend?'self':admin?'admin':'user',peerId=friend?peer?.user_id:peer?.id,peerName=friend?peer?.display_name:peer?.name;
 const [secret,setSecret]=useState(null),[keyPanel,setKeyPanel]=useState(false),[legacyPanel,setLegacyPanel]=useState(false),[decrypted,setDecrypted]=useState({}),[reply,setReply]=useState(null),[messageSearch,setMessageSearch]=useState(''),[showSearch,setShowSearch]=useState(false),[messageFilter,setMessageFilter]=useState('all'),[savedMessages,setSavedMessages]=useState(()=>friend?readSavedMessages(userId,peer?.user_id):[]),[toolNotice,setToolNotice]=useState(''),textarea=useRef(null),decryptionCache=useRef(new Map());
 const chatSurface=useRef(null);
 useEffect(()=>{
  if(!friend)return;
  const selector='details.friend-message-actions,details.friend-share-menu',openMenus=()=>[...(chatSurface.current?.querySelectorAll(selector)||[])].filter(node=>node.open);
  const outside=event=>{if(event.button>0)return;for(const menu of openMenus())if(!menu.contains(event.target))menu.open=false;};
  const toggle=event=>{const menu=event.target;if(!menu.matches?.(selector)||!menu.open||!chatSurface.current?.contains(menu))return;for(const other of openMenus())if(other!==menu)other.open=false;};
  const escape=event=>{if(event.key!=='Escape')return;const menus=openMenus();if(!menus.length)return;event.preventDefault();event.stopPropagation();for(const menu of menus)menu.open=false;menus.at(-1).querySelector('summary')?.focus({preventScroll:true});};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('click',outside,true);document.addEventListener('toggle',toggle,true);document.addEventListener('keydown',escape,true);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('click',outside,true);document.removeEventListener('toggle',toggle,true);document.removeEventListener('keydown',escape,true);};
 },[friend]);
 const a=automaticChatCopy(language),automatic=useAutomaticChat({owner:userId,peer:peerId,enabled:friend&&!unavailable&&!previewMessages,rows}),draftTouched=useRef(false);
 const encryptedRows=friend?rows.filter(m=>isLockedMessage(m.body)):[],needsKey=friend&&!automatic.ready;
 const wireSize=body.length;
 useEffect(()=>{if(!friend)return;let current=true;const cache=decryptionCache.current;if(!secret){cache.clear();setDecrypted({});return;}Promise.all(rows.filter(m=>isLockedMessage(m.body)).map(async m=>{const cached=cache.get(m.entry_key);if(cached?.body===m.body)return [m.entry_key,cached.text];let text=null;try{text=await unlockFriendMessage(m.body,secret.key,{owner:userId,peer:peerId,sender:m.sender_id||(m.direction==='self'?userId:peerId),id:m.id});}catch{/* A different key or a changed envelope stays locked. */}if(current)cache.set(m.entry_key,{body:m.body,text});return [m.entry_key,text];})).then(entries=>{if(current)setDecrypted(Object.fromEntries(entries));});return()=>{current=false;};},[friend,rows,secret,userId,peerId]);
 useEffect(()=>{if(!friend||previewMessages||!automatic.session)return;let current=true;const legacyDraft=readFriendDraft(userId,peerId);automatic.session.loadDraft().then(value=>{if(current&&!draftTouched.current&&!legacyDraft)setBody(value);}).catch(()=>{});if(legacyDraft)automatic.session.saveDraft(legacyDraft).then(()=>saveFriendDraft(userId,peerId,'')).catch(()=>{});return()=>{current=false;};},[friend,previewMessages,automatic.session,userId,peerId]);
 useEffect(()=>{if(friend&&nearBottom.current&&(Object.keys(decrypted).length||Object.keys(automatic.decrypted).length))markRead(rowsRef.current);},[decrypted,automatic.decrypted]);
 useLayoutEffect(()=>{if(!friend||!textarea.current)return;textarea.current.style.height='auto';textarea.current.style.height=Math.min(textarea.current.scrollHeight,130)+'px';},[body,friend,keyPanel]);
 function changeBody(value){draftTouched.current=true;setBody(value);setSendFailed(false);setToolNotice('');if(friend&&!previewMessages)automatic.session?.saveDraft(value).catch(()=>{if(alive.current)setToolNotice(a.error);});}
 function enableKey(value){decryptionCache.current.clear();setDecrypted({});setSecret(value);setLegacyPanel(false);setError('');setToolNotice('');}
 function lockKey(){setSecret(null);setDecrypted({});decryptionCache.current.clear();setLegacyPanel(false);setToolNotice('');}
 function messageBody(m){return isAutomaticMessage(m.body)?automatic.decrypted[m.entry_key]??null:isLockedMessage(m.body)?decrypted[m.entry_key]??null:m.body;}
 function messageText(m){const content=messageBody(m);return content===null?f.lockedMessage:m.day_share?f.day:friendMessagePreview(content,f);}
 function quote(m){const content=messageBody(m);if(content===null)return;setReply({id:m.entry_key,sender:m.sender_id||(m.direction===selfDirection?userId:peerId),text:messageText(m).slice(0,160)});setToolNotice('');textarea.current?.focus();}
 async function copyMessage(m){try{await navigator.clipboard.writeText(messageText(m));if(alive.current)setToolNotice(f.copied);}catch{if(alive.current)setToolNotice(t.loadError);}}
 function saved(m){setSavedMessages(toggleSavedMessage(userId,peerId,m.entry_key));}
 function positionMessageMenu(event){const node=event.currentTarget;if(!node.open||!list.current)return;const menu=node.querySelector('div'),bounds=list.current.getBoundingClientRect(),anchor=node.getBoundingClientRect();node.dataset.up=String(bounds.bottom-anchor.bottom<menu.offsetHeight+18&&anchor.top-bounds.top>menu.offsetHeight+8);menu.style.setProperty('--message-menu-shift','0px');const rect=menu.getBoundingClientRect(),shift=rect.left<bounds.left+7?bounds.left+7-rect.left:rect.right>bounds.right-7?bounds.right-7-rect.right:0;menu.style.setProperty('--message-menu-shift',shift+'px');}
 function jumpTo(id){setMessageFilter('all');setMessageSearch('');requestAnimationFrame(()=>document.getElementById('friend-message-'+id)?.scrollIntoView({block:'center',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));}
 async function protect(body,holder){const signature='auto:'+body;if(holder.current?.signature!==signature)holder.current={signature,id:crypto.randomUUID(),body,wire:null};const pending=holder.current;if(!pending.wire)pending.wire=await automatic.session.encrypt(body,pending.id);return pending;}
 const [shareDay,setShareDay]=useState(initialShareDay==='streak'?'streak':initialShareDay?'day':''),[daySent,setDaySent]=useState(false),closeShareTimer=useRef(null);
 useLayoutEffect(()=>{if(friend&&!shareDay&&!keyPanel&&!legacyPanel&&nearBottom.current&&list.current)list.current.scrollTop=list.current.scrollHeight;},[friend,decrypted,automatic.decrypted,shareDay,keyPanel,legacyPanel]);
 useEffect(()=>()=>clearTimeout(closeShareTimer.current),[]);
 const dayRequest=useRef(null);
 async function sendDay(data){
  if(previewMessages||locked.current||!canEdit||!friend||unavailable||daySent||loading||!initialized.current)return;if(needsKey){setShareDay('');setKeyPanel(true);return;}locked.current=true;setSending(true);setError('');
  try{
   let body=data.kind==='streak'||data.shareDetails?null:sharedDayMessage(data,data.shareAmounts);
   if(data.kind==='streak'){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{const state=await syncAccountActivityStreak({client:supabase,storage:localStorage,ownerId:userId,signal:controller.signal});if(!state.currentStreak)throw new Error('Empty streak');body=sharedStreakMessage(state);}finally{clearTimeout(timeout);}
    if(!alive.current)return;
   }
   if(!body)throw new Error('Encrypted cards require a client summary');
   const pending=await protect(body,dayRequest);
   const args={p_peer:peerId,p_request_id:pending.id,p_owner:userId,p_body:pending.wire};
   const {error}=await supabase.rpc('friend_chat_send',args);if(error)throw error;if(!alive.current)return;
   dayRequest.current=null;setDaySent(true);nearBottom.current=true;notify();
   closeShareTimer.current=setTimeout(()=>{if(alive.current){setShareDay('');setDaySent(false);}},window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:420);
   await refreshRef.current?.();
  }catch{if(alive.current)setError(t.sendError);}finally{locked.current=false;if(alive.current)setSending(false);}
 }
 const notify=()=>window.dispatchEvent(friend?new CustomEvent('dayris:friends-messages',{detail:{userId,peerId}}):admin?new Event('dayris:admin-replies-refresh'):new CustomEvent('dayris:creator-count',{detail:{userId}}));
 function deny(){accessDenied.current=true;setUnavailable(true);setShareDay('');setSendFailed(false);setRows([]);setMore(false);setHasNew(false);setSecret(null);setDecrypted({});decryptionCache.current.clear();setReply(null);setBody('');setKeyPanel(false);setLegacyPanel(false);request.current=null;dayRequest.current=null;pendingLatest.current=null;known.current=new Set();initialized.current=false;setError(socialInviteCopy(language).unavailable);}
 async function markRead(items){
  if(previewMessages||accessDenied.current||reading.current||!canEdit||document.visibilityState==='hidden')return;
  const ids=items.filter(m=>m.direction!==selfDirection&&!m.read_at&&(!friend||(!isLockedMessage(m.body)&&!isAutomaticMessage(m.body))||Boolean(messageBody(m)))).slice(-100).map(m=>m.id);if(!ids.length)return;reading.current=true;
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
 async function send(e,overrideText=null){e?.preventDefault();const text=(overrideText??body).trim();if(previewMessages||locked.current||!canEdit||unavailable||!text||(friend&&(loading||!initialized.current)))return;if(friend&&needsKey){setKeyPanel(true);return;}const payload=friend?friendNote(text,reply):text;if(friend?text.length>2000||payload.length>2600:friendWireSize(payload)>2000){setError(f.limit);return;}locked.current=true;setSending(true);setSendFailed(false);setError('');
  try{let pending;if(friend)pending=await protect(payload,request);else{if(request.current?.body!==text)request.current={id:crypto.randomUUID(),body:text,wire:text};pending=request.current;}if(!alive.current)return;const args={p_body:pending.wire,p_request_id:pending.id};if(friend){args.p_peer=peerId;args.p_owner=userId;}else if(admin)args.p_user_id=peer.id;const {error}=await supabase.rpc(friend?'friend_chat_send':admin?'chat_admin_send':'chat_user_send',args);if(!alive.current)return;if(error)throw error;
   request.current=null;setBody('');setReply(null);setToolNotice('');if(friend){saveFriendDraft(userId,peerId,'');automatic.session?.saveDraft('').catch(()=>{});}nearBottom.current=true;await refreshRef.current?.();notify();
  }catch(error){if(alive.current){if(friend&&error?.code==='42501')deny();else setSendFailed(true);}}finally{locked.current=false;if(alive.current)setSending(false);}
 }
 const date=value=>new Date(value).toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'});
 const time=value=>new Date(value).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'});
 function bottom(){nearBottom.current=true;setHasNew(false);if(pendingLatest.current){const next=pendingLatest.current;pendingLatest.current=null;known.current=new Set(next.rows.map(m=>m.entry_key));scrollPlan.current={mode:'bottom'};setRows(next.rows);setMore(next.more);markRead(next.rows);}else{const node=list.current;if(node)node.scrollTop=node.scrollHeight;markRead(rowsRef.current);}}
 const needle=messageSearch.trim().toLocaleLowerCase(),visibleRows=friend?rows.filter(m=>{
  const content=messageBody(m);return (messageFilter!=='saved'||savedMessages.includes(m.entry_key))&&(messageFilter!=='moments'||Boolean(m.day_share||readSharedDay(content)||readSharedStreak(content)))&&(!needle||(content!==null&&messageText(m).toLocaleLowerCase().includes(needle)));
 }):rows;
 return <section ref={chatSurface} className={'dayris-chat'+(admin?' dayris-chat-admin':'')+(friend?' dayris-chat-friend':'')} aria-label={admin||friend?peerName:t.title}>
  <header className="chat-peer-header">
   {onBack&&<button type="button" className="chat-back" aria-label={t.back} onClick={onBack}><ArrowLeft size={20}/></button>}
   {admin||friend?<SocialAvatar userId={peerId} name={peerName} path={friend?peer.avatar_path:undefined} loadProfile={!friend} className="chat-peer-avatar"/>:<span className="chat-peer-avatar">D</span>}
   <div className="chat-peer-label"><div className="chat-peer-verified-name"><h2 id={friend?'friend-chat-title':admin?'admin-chat-title':'creator-inbox-title'}>{admin||friend?peerName:t.title}</h2>{friend&&<VerifiedBadge userId={peerId} viewerId={userId} language={language}/>}</div><p>{friend?automatic.ready?<><LockKeyhole size={10}/>{a.active}</>:peer.handle:admin?peer.email||peer.id:t.subtitle}</p></div>
   {friend&&<div className="friend-header-actions"><button type="button" aria-label={f.searchMessages} title={f.searchMessages} aria-pressed={showSearch} onClick={()=>{setShowSearch(v=>!v);setMessageSearch('');}}><Search size={18}/></button><button type="button" aria-label={a.title} title={a.title} className={automatic.ready?'is-protected':''} disabled={unavailable||sending||loading||!initialized.current} aria-pressed={keyPanel} onClick={()=>{setKeyPanel(v=>!v);setLegacyPanel(false);setShareDay('');}}><LockKeyhole size={18}/></button></div>}
   {onCampaign&&canEdit&&<button type="button" className="chat-gift-action" aria-label={t.giftAction} title={t.giftAction} onClick={onCampaign}><Gift size={20}/></button>}
  </header>
  {friend&&!keyPanel&&!legacyPanel&&!shareDay&&<div className="friend-chat-toolbar" role="group" aria-label={f.conversationTitle}>{[['all',MessageCircle,f.all],['moments',CalendarDays,f.moments],['saved',Bookmark,f.saved]].map(([id,Icon,label])=><button type="button" key={id} aria-pressed={messageFilter===id} onClick={()=>setMessageFilter(id)}><Icon size={13}/>{label}{id==='saved'&&savedMessages.length>0&&<span>{savedMessages.length}</span>}</button>)}</div>}
  {friend&&showSearch&&!keyPanel&&!legacyPanel&&!shareDay&&<div className="friend-message-search"><label><Search size={16}/><input autoFocus aria-label={f.searchMessages} placeholder={f.searchMessages} maxLength={100} value={messageSearch} onChange={e=>setMessageSearch(e.target.value)}/><small>{visibleRows.length}</small><button type="button" aria-label={f.close} onClick={()=>{setShowSearch(false);setMessageSearch('');}}><X size={16}/></button></label><p>{f.searchHint}</p></div>}
  {friend&&keyPanel&&!unavailable&&<AutomaticChatPanel copy={a} security={automatic} onClose={()=>setKeyPanel(false)} legacy={encryptedRows.length>0} onLegacy={()=>{setKeyPanel(false);setLegacyPanel(true);}} retryLabel={t.retry} closeLabel={f.close}/>}
  {friend&&legacyPanel&&!unavailable&&<FriendKeyPanel legacyOnly copy={{...f,keyTitle:a.legacy,keyHint:a.legacyHint,keyActive:a.legacy,keyProtected:a.legacyHint,keyMeta:a.storage,keyLock:f.close}} owner={userId} peer={peerId} sample={encryptedRows.at(-1)} samples={encryptedRows} secret={secret} onEnable={enableKey} onLock={lockKey} onClose={()=>setLegacyPanel(false)}/>}
  <div className="chat-timeline-wrap" hidden={Boolean(friend&&(shareDay||keyPanel||legacyPanel))}><div ref={list} className="chat-timeline" tabIndex={0} aria-label={t.subtitle} onScroll={()=>{const node=list.current;nearBottom.current=node.scrollHeight-node.scrollTop-node.clientHeight<80;if(nearBottom.current){if(pendingLatest.current)bottom();else{setHasNew(false);markRead(rowsRef.current);}}}}>
   {more&&<button type="button" className="chat-load-older" disabled={older} onClick={()=>refreshRef.current?.(rows[0])}>{older?t.loading:t.older}</button>}
   {loading&&!rows.length?<p className="chat-empty-note" role="status">{t.loading}</p>:!rows.length&&!error?<div className="chat-welcome"><MessageCircle size={32}/><strong>{t.empty}</strong><p>{friend?f.chooseChatHint:t.emptyHint}</p></div>:friend&&!visibleRows.length?<p className="chat-empty-note">{f.emptyFiltered}</p>:null}
   {visibleRows.map((m,index)=>{
    const mine=m.direction===selfDirection,newDay=index===0||date(visibleRows[index-1].created_at)!==date(m.created_at),generic=['Сообщение','Сообщение от создателя','Сообщения от создателя'].includes(m.title),content=friend?messageBody(m):m.body,note=friend?readFriendNote(content):null,streak=friend?readSharedStreak(content):null,day=m.day_share||(friend?readSharedDay(content):null),encrypted=friend&&(isLockedMessage(m.body)||isAutomaticMessage(m.body)),bookmarked=savedMessages.includes(m.entry_key);
    return <React.Fragment key={m.entry_key}>
     {newDay&&<div className="chat-day-divider"><span>{date(m.created_at)}</span></div>}
     <div id={friend?'friend-message-'+m.entry_key:undefined} className={'chat-message-row'+(mine?' is-mine':'')}>
      <div className={'chat-bubble'+(m.pro_until?' has-gift':'')+(bookmarked?' is-bookmarked':'')}>
       {m.kind==='notice'&&m.title&&!generic&&<strong className="chat-notice-title">{m.title}</strong>}
       {note?.reply&&<button type="button" className="friend-quote" disabled={!rows.some(row=>row.entry_key===note.reply.id)} onClick={()=>jumpTo(note.reply.id)}><strong>{note.reply.sender===userId?f.you:peerName}</strong><span>{note.reply.text}</span></button>}
       {encrypted&&content===null?<button type="button" className="friend-locked-message" onClick={()=>isAutomaticMessage(m.body)?setKeyPanel(true):setLegacyPanel(true)}><LockKeyhole size={21}/><span><strong>{isAutomaticMessage(m.body)?a.encrypted:f.lockedMessage}</strong><small>{isAutomaticMessage(m.body)?a.history:f.openKey}</small></span></button>:streak?<StreakShareCard data={streak} language={language}/>:day?<DayHistoryCard data={day} language={language}/>:<p>{friend?<FriendText text={note?.text??content}/>:content}</p>}
       {m.pro_until&&<div className="chat-pro-attachment"><Gift size={17}/><span><strong>{t.pro}</strong><span>{m.pro_until==='infinity'?t.forever:t.until+' '+date(m.pro_until)}</span></span></div>}
       <span className="chat-message-meta">{bookmarked&&<Bookmark size={10}/>} {encrypted&&<LockKeyhole size={10} aria-label={f.lockedMessage}/>}<time dateTime={m.created_at}>{time(m.created_at)}</time>{mine&&(m.read_at?<CheckCheck size={14} aria-label={t.read}/>:<Check size={14} aria-label={t.sent}/>)}</span>
      </div>
      {friend&&!unavailable&&<details className="friend-message-actions" onToggle={positionMessageMenu}><summary aria-label={f.actions} title={f.actions}><MoreHorizontal size={17}/></summary><div>
       {content!==null&&canEdit&&<button type="button" disabled={needsKey||sending} onClick={e=>{quote(m);e.currentTarget.closest('details').open=false;}}><Reply size={15}/>{f.reply}</button>}
       {content!==null&&<button type="button" onClick={e=>{copyMessage(m);e.currentTarget.closest('details').open=false;}}><Copy size={15}/>{f.copy}</button>}
       <button type="button" onClick={e=>{saved(m);e.currentTarget.closest('details').open=false;}}><Bookmark size={15}/>{bookmarked?f.unbookmark:f.bookmark}</button>
      </div></details>}
     </div>
    </React.Fragment>;
   })}
  </div>{hasNew&&<button type="button" className="chat-new-messages" onClick={bottom}><ArrowDown size={15}/>{t.newMessages}</button>}</div>
  {(error||sendFailed)&&<div className="chat-error" role="alert"><span>{sendFailed?t.sendError:error}</span>{(!unavailable||!friend)&&<button type="button" disabled={sending} onClick={()=>{accessDenied.current=false;sendFailed?send():refreshRef.current?.();}}>{t.retry}</button>}</div>}
  {toolNotice&&<p className="friend-tool-notice" role="status">{toolNotice}</p>}
  {friend&&shareDay&&!unavailable&&<ShareCalendarDay userId={userId} language={language} allowDetails={false} initialKind={shareDay} sending={sending||loading||!initialized.current} sent={daySent} recipientName={peerName} onCancel={()=>setShareDay('')} onSend={sendDay} onExternalShare={()=>{onBack?.();setTimeout(()=>window.dispatchEvent(new CustomEvent('dayris:streak-open',{detail:{ownerId:userId}})),0);}}/>}
  {friend&&(shareDay||keyPanel||legacyPanel)?null:canEdit&&!unavailable?needsKey?<div className="friend-key-required"><LockKeyhole size={19}/><p>{automatic.status==='waiting'?a.waiting:automatic.status==='error'?a.error:a.loading}</p><button type="button" className="friend-tool-button" onClick={automatic.retry}>{t.retry}</button></div>:<div className={friend?'friend-compose-area':undefined}>
   {friend&&reply&&<div className="friend-reply-draft"><Reply size={16}/><div><strong>{f.replying} · {reply.sender===userId?f.you:peerName}</strong><span>{reply.text}</span></div><button type="button" disabled={sending} aria-label={f.cancel} onClick={()=>setReply(null)}><X size={17}/></button></div>}
   <form className="chat-composer" onSubmit={send}>
    {friend&&<details className="friend-share-menu"><summary aria-label={f.share} title={f.share}><Plus size={21}/></summary><div><button type="button" disabled={sending} onClick={e=>{e.currentTarget.closest('details').open=false;setDaySent(false);setShareDay('day');}}><CalendarDays size={18}/>{dayShareCopy(language)[0]}</button><button type="button" disabled={sending} onClick={e=>{e.currentTarget.closest('details').open=false;setDaySent(false);setShareDay('streak');}}><Flame size={18}/>{momentShareCopy(language).streak}</button></div></details>}
    <textarea ref={textarea} aria-label={t.placeholder} placeholder={t.placeholder} maxLength={2000} rows={friend?1:2} value={body} readOnly={Boolean(previewMessages)} disabled={sending||(friend&&(loading||!initialized.current))} onChange={e=>changeBody(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&(!friend||!window.matchMedia('(pointer: coarse)').matches)){e.preventDefault();send(e);}}}/>
    <button type="submit" className="chat-send" aria-label={t.send} disabled={Boolean(previewMessages)||sending||(friend&&(loading||!initialized.current))||!body.trim()||wireSize>2000}><Send size={19}/></button>
   </form>
   {friend&&<div className="friend-compose-bottom"><div aria-label={f.support}><Smile size={12}/>{['🤍','🔥','👏'].map(emoji=><button type="button" key={emoji} aria-label={f.support+' '+emoji} disabled={sending||body.length+emoji.length>2000} onClick={()=>{changeBody(body+emoji);textarea.current?.focus();}}>{emoji}</button>)}</div>{wireSize>1400?<span className={wireSize>2000?'is-over-limit':''} role={wireSize>2000?'status':undefined}>{wireSize}/2000</span>:automatic.ready?<span><LockKeyhole size={10}/>{a.active}</span>:<span className="friend-keyboard-hint">{t.inputHint}</span>}</div>}
  </div>:<p className="chat-read-only">{unavailable?socialInviteCopy(language).unavailable:t.readOnly}</p>}
 </section>;
}
function FriendText({text}){
 return String(text||'').split(/(https?:\/\/[^\s<>]+)/g).map((part,index)=>/^https?:\/\//.test(part)?<a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>:part);
}
