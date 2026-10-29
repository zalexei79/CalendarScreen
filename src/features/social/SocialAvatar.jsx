import React,{useEffect,useState} from 'react';
import {supabase} from '../../supabaseClient';
import './Social.css';
export default function SocialAvatar({userId,name='DAYRIS',path,loadProfile=false,className=''}){
 const [image,setImage]=useState({key:'',src:''}),[revision,setRevision]=useState(0),key=userId+':'+String(path);
 useEffect(()=>{if(!userId)return;let alive=true;async function load(){try{let target=path;if(target===undefined&&loadProfile){const {data,error}=await supabase.rpc('social_profile',{p_user_id:userId});if(error)throw error;target=data?.avatar_path;}if(!target){if(alive)setImage({key,src:''});return;}const {data,error}=await supabase.storage.from('profile-avatars').createSignedUrl(target,300);if(alive)setImage({key,src:error?'':data?.signedUrl||''});}catch{if(alive)setImage({key,src:''});}}load();const timer=setInterval(load,240000);return()=>{alive=false;clearInterval(timer);};},[key,loadProfile,revision]);
 useEffect(()=>{const refresh=()=>setRevision(n=>n+1),changed=e=>{if(e.detail?.userId===userId)refresh();};window.addEventListener('focus',refresh);window.addEventListener('dayris:social-profile',changed);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('dayris:social-profile',changed);};},[userId]);
 const src=image.key===key?image.src:'';
 return <span className={`social-avatar ${className}`} aria-hidden="true">{src?<img src={src} alt="" onError={()=>setImage({key,src:''})}/>:Array.from(name||'?')[0].toUpperCase()}</span>;
}
