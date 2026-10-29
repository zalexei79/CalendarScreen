import React,{useEffect,useRef,useState} from 'react';
import {Share2,Link,Download} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import {createQrMatrix,drawQrToCanvas} from '../../../qrCode.js';
import SocialAvatar from './SocialAvatar.jsx';
import {socialInviteCopy} from './socialInviteCopy.js';
export default function FriendInviteQr({userId,language}){
 const t=socialInviteCopy(language),[state,setState]=useState({owner:null,data:null,error:false}),[revision,setRevision]=useState(0),[notice,setNotice]=useState(''),canvas=useRef(null);
 useEffect(()=>{let alive=true;supabase.rpc('social_friend_invite',{p_owner:userId}).then(({data,error})=>{if(alive)setState({owner:userId,data:data?.owner_id===userId?data:null,error:Boolean(error)||data?.owner_id!==userId});}).catch(()=>{if(alive)setState({owner:userId,data:null,error:true});});return()=>{alive=false;};},[userId,revision]);
 const data=state.owner===userId?state.data:null,url=data?new URL('/',location.origin):null;if(url){url.searchParams.set('friend',data.token);url.searchParams.set('ref',data.referral_code);}
 const href=url?.href||'';
 useEffect(()=>{if(!href||!canvas.current)return;try{const node=canvas.current;drawQrToCanvas(node.getContext('2d'),createQrMatrix(href),0,0,424);}catch{setNotice(t.error);}},[href,t.error]);
 async function copy(){try{await navigator.clipboard.writeText(href);setNotice(t.copied);}catch{setNotice(t.error);}}
 async function png(){return new Promise(resolve=>canvas.current?canvas.current.toBlob(resolve,'image/png'):resolve(null));}
 async function download(){const blob=await png();if(!blob)return;const src=URL.createObjectURL(blob),link=document.createElement('a');link.href=src;link.download='dayris-friend-qr.png';link.click();setTimeout(()=>URL.revokeObjectURL(src),1000);}
 async function share(){try{const blob=await png(),file=blob?new File([blob],'dayris-friend-qr.png',{type:'image/png'}):null;if(file&&navigator.canShare?.({files:[file]}))await navigator.share({title:'DAYRIS',text:t.bonus,url:href,files:[file]});else if(navigator.share)await navigator.share({title:'DAYRIS',text:t.bonus,url:href});else await copy();}catch(error){if(error?.name!=='AbortError')setNotice(t.error);}}
 return <div className="social-qr-card">{data?<><SocialAvatar userId={userId} path={data.avatar_path} name={data.display_name} className="social-avatar-large"/><h3>{data.display_name}</h3><p>{data.handle}</p><canvas ref={canvas} width={424} height={424} aria-label={t.qr} role="img"/><p>{t.qrHint}</p><strong className="social-qr-bonus">{t.bonus}</strong><div className="social-qr-actions"><button className="social-button social-primary" onClick={share}><Share2 size={15}/>{t.share}</button><button className="social-button" onClick={copy}><Link size={15}/>{t.copyLink}</button><button className="social-button" onClick={download}><Download size={15}/>{t.download}</button></div><p>{t.privacy}</p></>:<button className="social-button" onClick={()=>setRevision(n=>n+1)}>{state.error?t.retry:'…'}</button>}{(notice||state.error)&&<p role="status">{notice||t.error}</p>}</div>;
}
