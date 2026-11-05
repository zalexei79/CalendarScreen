import React,{useEffect,useId,useRef,useState} from 'react';
import {Search,UserPlus,Copy,Check,QrCode,X,MessageCircle,LoaderCircle,ArrowUpRight} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import SocialAvatar from './SocialAvatar.jsx';
import FriendInviteQr from './FriendInviteQr.jsx';
import {socialCopy,socialError} from './socialCopy.js';
import {socialInviteCopy} from './socialInviteCopy.js';
import {friendFinderCopy} from './friendFinderCopy.js';
import {friendMessengerCopy} from '../messages/friendMessengerCopy.js';

export function friendNumberQuery(search){
 const text=search.trim(),number=text.replace(/^[#@№-]+\s*/,'');
 if(!text||(!/^\d+$/.test(number)&&!/^[@#№]/.test(text)))return null;
 return /^[1-9][0-9]{0,18}$/.test(number)?number:'';
}

export function FriendConnectionCard({person,userId,language,busy,onAction,onChat}){
 const t=socialCopy(language),f=friendFinderCopy(language),q=socialInviteCopy(language),state=person.relationship;
 const incoming=state==='pending'&&person.requested_by!==userId,sent=state==='pending'&&!incoming;
 async function accept(){const data=await onAction(person,'accept');const friend=data?.friends?.find(p=>p.user_id===person.user_id);if(friend)onChat(friend);}
 return <article className="social-connect-card">
  <div className="social-connect-identity"><SocialAvatar userId={person.user_id} name={person.display_name} path={person.avatar_path||null}/><div><strong>{person.display_name}</strong><small>№ {person.handle}</small></div>{state==='accepted'&&<Check size={17} aria-label={t.already}/>}</div>
  {incoming&&<p>{f.incoming}</p>}
  {sent?<div className="social-connect-sent" role="status"><span><Check size={16}/>{f.sent}</span><p>{f.waiting}</p></div>:<button type="button" className="social-connect-action" disabled={busy} onClick={()=>state==='accepted'?onChat(person):incoming?accept():onAction(person,'request')}>{state==='accepted'?<MessageCircle size={17}/>:incoming?<ArrowUpRight size={17}/>:<UserPlus size={17}/>}<span>{state==='accepted'?q.write:incoming?f.acceptChat:t.invite}</span></button>}
 </article>;
}

export default function FriendFinder({userId,profile,language,search,onSearch,inputRef,workspace,busy,onAction,onChat}){
 const t=socialCopy(language),f=friendFinderCopy(language),m=friendMessengerCopy(language),number=friendNumberQuery(search),own=number!==null&&number===profile?.handle;
 const [lookup,setLookup]=useState({number:null,status:'idle',person:null}),[retry,setRetry]=useState(0),[qr,setQr]=useState(false),[copyNotice,setCopyNotice]=useState('');
 const request=useRef(0),invite=useRef(null),hintId=useId(),qrId=useId();
 useEffect(()=>{
  const id=++request.current;
  if(!number||own)return;
  let alive=true;
  setLookup(previous=>previous.number===number&&previous.person?previous:{number,status:'loading',person:null});
  const timer=setTimeout(async()=>{
   try{const {data,error}=await supabase.rpc('social_find',{p_handle:number});if(!alive||id!==request.current)return;if(error)throw error;setLookup({number,status:'ready',person:data?.viewer_id===userId?data:null});}
   catch(error){if(alive&&id===request.current)setLookup({number,status:'error',person:null,error:socialError(error,t)});}
  },300);
  return()=>{alive=false;clearTimeout(timer);};
 },[number,own,userId,retry,workspace,language]);
 useEffect(()=>{if(!qr)return;const outside=e=>{if(!invite.current?.contains(e.target))setQr(false);};const escape=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setQr(false);invite.current?.querySelector('[aria-controls]')?.focus();}};document.addEventListener('pointerdown',outside,true);document.addEventListener('click',outside,true);document.addEventListener('keydown',escape,true);return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('click',outside,true);document.removeEventListener('keydown',escape,true);};},[qr]);
 useEffect(()=>{if(!copyNotice)return;const timer=setTimeout(()=>setCopyNotice(''),2000);return()=>clearTimeout(timer);},[copyNotice]);
 async function copy(){try{await navigator.clipboard.writeText(profile.handle);setCopyNotice(t.copied);}catch{setCopyNotice(t.error);}}
 const current=lookup.number===number?lookup:{status:'loading',person:null};
 const relation=current.person&&[...(workspace?.friends||[]),...(workspace?.incoming||[]),...(workspace?.outgoing||[])].find(p=>p.user_id===current.person.user_id);
 const person=current.person&&{...current.person,...relation,relationship:relation?.state||current.person.relationship};
 async function action(p,kind){
  ++request.current;
  const data=await onAction(p,kind);
  if(data?.owner_id===userId){const next=[...(data.friends||[]),...(data.incoming||[]),...(data.outgoing||[])].find(row=>row.user_id===p.user_id);setLookup(previous=>previous.person?.user_id===p.user_id?{...previous,person:{...previous.person,relationship:next?.state||null,requested_by:next?.requested_by||null}}:previous);}
  return data;
 }
 return <section className="social-finder" aria-label={f.add}>
  <div className="social-hub-search"><Search size={17}/><input ref={inputRef} aria-label={f.placeholder} aria-describedby={hintId} placeholder={f.placeholder} value={search} maxLength={100} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={e=>onSearch(e.target.value)}/>{search?<button type="button" aria-label={m.clear} className="social-finder-clear" onClick={()=>{onSearch('');inputRef.current?.focus();}}><X size={16}/></button>:<UserPlus size={17} className="social-finder-search-mark"/>}</div>
  <p id={hintId} className="social-finder-hint">{f.hint}</p>
  <div ref={invite} className="social-finder-invite">
   <div className="social-finder-own"><button type="button" disabled={!profile?.handle} aria-label={t.copy} onClick={copy}><span>{f.myNumber}</span><strong>№ {profile?.handle||'…'}</strong>{copyNotice===t.copied?<Check size={14}/>:<Copy size={14}/>}</button><button type="button" aria-expanded={qr} aria-controls={qrId} onClick={()=>setQr(value=>!value)}><QrCode size={15}/>{f.qr}</button></div>
   {copyNotice&&<p className="social-finder-copy" role="status">{copyNotice}</p>}
   {qr&&<div id={qrId} className="social-finder-qr"><FriendInviteQr key={userId} userId={userId} language={language}/>{profile&&!profile.discoverable&&<p>{t.enableDiscovery}</p>}</div>}
  </div>
  {number!==null&&<div className="social-finder-results" aria-label={f.result} aria-live="polite" aria-busy={!own&&Boolean(number)&&current.status==='loading'}>
   {own?<p className="social-finder-note">{f.own}</p>:!number?<p className="social-finder-note">{f.invalid}</p>:current.status==='loading'?<p className="social-finder-note social-finder-loading"><LoaderCircle size={17}/>{f.searching}</p>:current.status==='error'?<div className="social-finder-note"><p>{current.error}</p><button type="button" className="social-text-button" onClick={()=>setRetry(value=>value+1)}>{f.retry}</button></div>:person?<FriendConnectionCard person={person} userId={userId} language={language} busy={busy} onAction={action} onChat={onChat}/>:<p className="social-finder-note">{t.notFound}</p>}
  </div>}
 </section>;
}
