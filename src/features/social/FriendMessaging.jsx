import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,UserPlus} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import MessageChat from '../messages/MessageChat.jsx';
import SocialAvatar from './SocialAvatar.jsx';
import {socialInviteCopy} from './socialInviteCopy.js';
import {socialProfileChanged} from './useSocialProfile.js';
import {readSocialPending,clearSocialPending,rememberSocialReferral,clearSocialReferral,openFriendChat} from './socialLinks.js';
import '../messages/CreatorMessages.css';
import './Social.css';
function useSocialDialog(ref,visible,blocked){useEffect(()=>{if(!visible||blocked)return;const previous=document.activeElement,node=ref.current;const show=()=>{if(node&&!node.open&&!document.querySelector('dialog[open],[aria-modal="true"]'))node.showModal();};show();const timer=setInterval(show,500);return()=>{clearInterval(timer);node?.close();if(previous?.isConnected)previous.focus?.();};},[visible,blocked]);}
export function FriendChatDialog({userId,language,blocked=false}){
 const t=socialInviteCopy(language),[request,setRequest]=useState({owner:null,peerId:''}),[state,setState]=useState({key:'',peer:null,error:false}),[revision,setRevision]=useState(0),dialog=useRef(null);
 const key=request.owner===userId&&userId?userId+':'+request.peerId:'',own=state.key===key?state:{peer:null,error:false};
 useEffect(()=>{if(!userId)return;const pending=readSocialPending('chat');if(pending)setRequest({owner:userId,peerId:pending});const open=e=>{if(e.detail?.userId===userId&&e.detail.peerId)setRequest({owner:userId,peerId:e.detail.peerId});};window.addEventListener('dayris:friend-chat-open',open);return()=>window.removeEventListener('dayris:friend-chat-open',open);},[userId]);
 useEffect(()=>{if(!key)return;let alive=true;supabase.rpc('friend_chat_peer',{p_peer:request.peerId}).then(({data,error})=>{if(!alive)return;setState({key,peer:error?null:data,error:Boolean(error)||!data});if(!error||['42501','P0002','22P02'].includes(error.code))clearSocialPending('chat',request.peerId);}).catch(()=>{if(alive)setState({key,peer:null,error:true});});return()=>{alive=false;};},[key,revision]);
 const visible=Boolean(key);useSocialDialog(dialog,visible,blocked);
 if(!visible)return null;
 const close=()=>{clearSocialPending('chat',request.peerId);setRequest({owner:null,peerId:''});};
 return createPortal(<dialog ref={dialog} className="creator-inbox creator-inbox-chat" aria-labelledby="friend-chat-title" onCancel={e=>{e.preventDefault();close();}}>{own.peer?<MessageChat key={key} friend userId={userId} peer={own.peer} language={language} onBack={close}/>:<div className="social-chat-status"><button className="creator-close" aria-label={t.close} onClick={close}><X size={18}/></button><h2 id="friend-chat-title">{own.error?t.unavailable:'…'}</h2>{own.error&&<button className="social-button" onClick={()=>setRevision(n=>n+1)}>{t.retry}</button>}</div>}</dialog>,document.body);
}
export function FriendInvitePrompt({userId,language,blocked=false}){
 const t=socialInviteCopy(language),[token,setToken]=useState(''),[state,setState]=useState({key:'',peer:null,reward:null,error:false}),[revision,setRevision]=useState(0),[submitting,setSubmitting]=useState(false),[notice,setNotice]=useState('');
 const dialog=useRef(null),alive=useRef(true),lock=useRef(false);const key=userId&&token?userId+':'+token:'',own=state.key===key?state:{peer:null,reward:null,error:false};
 useEffect(()=>{alive.current=true;setToken(userId?readSocialPending('invite'):'');setSubmitting(false);lock.current=false;setNotice('');return()=>{alive.current=false;};},[userId]);
 useEffect(()=>{if(!key)return;let current=true;(async()=>{try{const {data:peer,error}=await supabase.rpc('social_invite_lookup',{p_token:token});if(error)throw error;if(!current||peer?.viewer_id!==userId)return;let reward=null;if(!peer.self){rememberSocialReferral(peer.referral_code);const result=await supabase.rpc('social_invite_claim',{p_token:token,p_owner:userId});if(result.error)throw result.error;reward=result.data;clearSocialReferral(peer.referral_code);window.dispatchEvent(new Event('dayris:referral-refresh'));window.dispatchEvent(new Event('dayris:pro-refresh'));}if(current)setState({key,peer,reward,error:false});}catch{if(current)setState({key,peer:null,reward:null,error:true});}})();return()=>{current=false;};},[key,revision]);
 const visible=Boolean(key);useSocialDialog(dialog,visible,blocked);
 if(!visible)return null;
 const close=()=>{if(lock.current)return;clearSocialPending('invite',token);setToken('');};
 async function add(){if(lock.current||!own.peer)return;const actor=userId,invite=token,peer=own.peer;lock.current=true;setSubmitting(true);setNotice('');try{const incoming=peer.relationship==='pending'&&peer.requested_by!==userId;const {data,error}=await supabase.rpc(incoming?'social_friend_action':'social_invite_request',incoming?{p_user_id:peer.user_id,p_action:'accept',p_owner:userId}:{p_token:invite,p_owner:userId});if(error)throw error;if(!alive.current)return;setState(s=>s.key===actor+':'+invite?{...s,peer:{...s.peer,relationship:incoming?'accepted':data.state,requested_by:actor}}:s);socialProfileChanged(peer.user_id);window.dispatchEvent(new CustomEvent('dayris:friends-messages',{detail:{userId:actor}}));}catch{if(alive.current)setNotice(t.error);}finally{lock.current=false;if(alive.current)setSubmitting(false);}}
 const peer=own.peer,incoming=peer?.relationship==='pending'&&peer.requested_by!==userId,accepted=peer?.relationship==='accepted',pending=peer?.relationship==='pending'&&!incoming;
 return createPortal(<dialog ref={dialog} className="creator-inbox social-invite-modal" aria-labelledby="friend-invite-title" onCancel={e=>{e.preventDefault();close();}}><button className="creator-close" aria-label={t.close} disabled={submitting} onClick={close}><X size={18}/></button>
  {peer?<><SocialAvatar userId={peer.user_id} path={peer.self||['pending','accepted'].includes(peer.relationship)?peer.avatar_path:null} name={peer.display_name} className="social-avatar-large"/><h2 id="friend-invite-title">{peer.self?t.own:accepted?t.already:pending?t.requested:t.inviteTitle}</h2><strong>{peer.display_name}</strong><p>@{peer.handle}</p>{!peer.self&&<p className="social-qr-bonus">{own.reward?.eligible?own.reward.status==='rewarded'?t.rewarded:t.pending:t.notEligible}</p>}
   {accepted?<button className="social-button social-primary" onClick={()=>{close();openFriendChat(userId,peer.user_id);}}>{t.openChat}</button>:!peer.self&&!pending&&<button className="social-button social-primary" disabled={submitting} onClick={add}><UserPlus size={16}/>{incoming?t.accept:t.add}</button>}<button className="social-text-button" disabled={submitting} onClick={close}>{t.done}</button>
  </>:<><h2 id="friend-invite-title">{own.error?t.unavailable:'…'}</h2>{own.error&&<button className="social-button" onClick={()=>setRevision(n=>n+1)}>{t.retry}</button>}</>}{notice&&<p role="status">{notice}</p>}
 </dialog>,document.body);
}
