import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {UsersRound,X,ArrowLeft} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import FriendsPanel from './FriendsPanel.jsx';
import ProfileSettings from './ProfileSettings.jsx';
import useSocialProfile from './useSocialProfile.js';
import {socialCopy} from './socialCopy.js';
import '../messages/CreatorMessages.css';
export function HomeFriendsButton({userId,language}){
 const t=socialCopy(language),[count,setCount]=useState(0);
 useEffect(()=>{if(!userId)return;let alive=true;async function refresh(){if(document.visibilityState==='hidden')return;try{const {data,error}=await supabase.rpc('social_friend_count');if(alive&&!error)setCount(Number(data)||0);}catch{}}refresh();const timer=setInterval(refresh,15000);return()=>{alive=false;clearInterval(timer);};},[userId]);
 if(!userId)return null;
 return <button className="home-friends-button" type="button" aria-label={t.friends} title={t.friends} onClick={()=>window.dispatchEvent(new CustomEvent('dayris:friends-home',{detail:{userId}}))}><UsersRound size={18}/><span>{t.friends}</span>{count>0&&<b>{count}</b>}</button>;
}
function Content({userId,language,onClose}){const profile=useSocialProfile(userId),[page,setPage]=useState('friends'),t=socialCopy(language);return <><header className="social-home-heading">{page==='profile'&&<button type="button" aria-label={t.friends} onClick={()=>setPage('friends')}><ArrowLeft size={18}/></button>}<h2 id="friends-home-title">{page==='profile'?t.profile:t.friends}</h2><button type="button" aria-label={t.cancel} onClick={onClose}><X size={19}/></button></header><div className="social-home-content">{page==='profile'?<ProfileSettings userId={userId} profile={profile.data} language={language}/>:<FriendsPanel userId={userId} profile={profile.data} language={language} onProfile={()=>setPage('profile')} onClose={onClose}/>}</div></>;}
export default function HomeFriends({userId,language}){
 const [owner,setOwner]=useState(null),dialog=useRef(null),visible=Boolean(userId&&owner===userId);
 useEffect(()=>{const open=e=>{if(e.detail?.userId===userId)setOwner(userId);};window.addEventListener('dayris:friends-home',open);return()=>window.removeEventListener('dayris:friends-home',open);},[userId]);
 useEffect(()=>{if(!visible)return;const node=dialog.current,previous=document.activeElement;node?.showModal();return()=>{node?.close();if(previous?.isConnected)previous.focus?.();};},[visible]);
 if(!visible)return null;
 return createPortal(<dialog ref={dialog} className="creator-inbox social-home-dialog" aria-labelledby="friends-home-title" onCancel={e=>{e.preventDefault();setOwner(null);}}><Content key={userId} userId={userId} language={language} onClose={()=>setOwner(null)}/></dialog>,document.body);
}
