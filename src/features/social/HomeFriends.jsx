import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {UsersRound,X,ArrowLeft,MessageCircle,CalendarDays,Flame,LockKeyhole} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import FriendsPanel from './FriendsPanel.jsx';
import ProfileSettings from './ProfileSettings.jsx';
import useSocialProfile from './useSocialProfile.js';
import {socialCopy} from './socialCopy.js';
import MessageChat from '../messages/MessageChat.jsx';
import {friendMessengerCopy} from '../messages/friendMessengerCopy.js';
import '../messages/CreatorMessages.css';
export function HomeFriendsButton({userId,language}){
 const t=socialCopy(language),[count,setCount]=useState(0);
 useEffect(()=>{if(!userId)return;let alive=true;async function refresh(){if(document.visibilityState==='hidden')return;try{const {data,error}=await supabase.rpc('social_friend_count');if(alive&&!error)setCount(Number(data)||0);}catch{}}refresh();const timer=setInterval(refresh,15000);return()=>{alive=false;clearInterval(timer);};},[userId]);
 if(!userId)return null;
 return <button className="home-friends-button" type="button" aria-label={t.friends} title={t.friends} onClick={()=>window.dispatchEvent(new CustomEvent('dayris:friends-home',{detail:{userId}}))}><UsersRound size={18}/><span>{t.friends}</span>{count>0&&<b>{count}</b>}</button>;
}
function Content({userId,language,onClose}){
 const profile=useSocialProfile(userId),[page,setPage]=useState('friends'),[active,setActive]=useState(null),t=socialCopy(language),m=friendMessengerCopy(language);
 function openChat(peer,shareDay=false){setActive(previous=>previous?.peer.user_id===peer.user_id&&!shareDay?previous:{peer,shareDay,revision:(previous?.revision||0)+1});}
 return <><header className={`social-home-heading${active&&page==='friends'?' has-conversation':''}`}>{page==='profile'&&<button type="button" aria-label={t.friends} onClick={()=>setPage('friends')}><ArrowLeft size={18}/></button>}<span className="social-home-symbol"><UsersRound size={18}/></span><h2 id="friends-home-title">{page==='profile'?t.profile:t.friends}</h2><span className="social-home-brand">DAYRIS</span><button type="button" aria-label={t.cancel} onClick={onClose}><X size={19}/></button></header>
  {page==='profile'?<div className="social-home-content"><ProfileSettings userId={userId} profile={profile.data} language={language}/></div>:<div className={`social-home-content social-workspace${active?' is-thread':''}`}>
   <aside className="social-workspace-sidebar"><FriendsPanel userId={userId} profile={profile.data} language={language} onProfile={()=>setPage('profile')} onClose={onClose} onOpenChat={openChat} activePeerId={active?.peer.user_id}/></aside>
   <main className="social-workspace-main">{active?<MessageChat key={`${userId}:${active.peer.user_id}:${active.revision}`} friend userId={userId} peer={active.peer} language={language} initialShareDay={active.shareDay} onBack={()=>setActive(null)}/>:<div className="social-workspace-welcome"><div className="social-workspace-art" aria-hidden="true"><span><MessageCircle size={34}/></span><span><CalendarDays size={22}/></span><span><Flame size={22}/></span><i/></div><span className="social-hub-eyebrow">DAYRIS · {t.friends}</span><h3>{m.chooseChat}</h3><p>{m.chooseChatHint}</p><small><LockKeyhole size={13}/>{t.privacy}</small></div>}</main>
  </div>}
 </>;
}
export default function HomeFriends({userId,language}){
 const [owner,setOwner]=useState(null),dialog=useRef(null),visible=Boolean(userId&&owner===userId);
 useEffect(()=>{const open=e=>{if(e.detail?.userId===userId)setOwner(userId);};window.addEventListener('dayris:friends-home',open);return()=>window.removeEventListener('dayris:friends-home',open);},[userId]);
 useEffect(()=>{if(!visible)return;const node=dialog.current,previous=document.activeElement;node?.showModal();return()=>{node?.close();if(previous?.isConnected)previous.focus?.();};},[visible]);
 if(!visible)return null;
 return createPortal(<dialog ref={dialog} className="creator-inbox social-home-dialog social-home-workspace" aria-labelledby="friends-home-title" onCancel={e=>{e.preventDefault();setOwner(null);}}><Content key={userId} userId={userId} language={language} onClose={()=>setOwner(null)}/></dialog>,document.body);
}
