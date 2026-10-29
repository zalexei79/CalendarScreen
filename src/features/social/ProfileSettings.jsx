import React,{useEffect,useRef,useState} from 'react';
import {Camera} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import SocialAvatar from './SocialAvatar.jsx';
import {socialCopy,socialError} from './socialCopy.js';
import {socialProfileChanged} from './useSocialProfile.js';
async function preparePhoto(file,t){
 if(file.size>10*1024*1024)throw new Error(t.tooLarge);
 if(!/^image\/(jpeg|png|webp|heic|heif|avif)$/i.test(file.type))throw new Error(t.formatError);
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const context=canvas.getContext('2d');context.fillStyle='#f4f4f5';context.fillRect(0,0,512,512);const side=Math.min(image.naturalWidth,image.naturalHeight);if(!side)throw new Error();context.drawImage(image,(image.naturalWidth-side)/2,(image.naturalHeight-side)/2,side,side,0,0,512,512);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.86));if(!blob)throw new Error();return blob;}catch(error){throw new Error(error?.message===t.tooLarge?t.tooLarge:t.formatError);}finally{URL.revokeObjectURL(url);}
}
export default function ProfileSettings({userId,profile,language}){
 const t=socialCopy(language),[name,setName]=useState(''),[handle,setHandle]=useState(''),[discover,setDiscover]=useState(false),[busy,setBusy]=useState(false),[photoBusy,setPhotoBusy]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true),initialized=useRef(false),input=useRef(null),locked=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(profile&&!initialized.current){initialized.current=true;setName(profile.display_name);setHandle(profile.handle);setDiscover(profile.discoverable);}},[profile]);
 async function save(e){e.preventDefault();if(locked.current)return;locked.current=true;setBusy(true);setNotice('');try{const {error}=await supabase.rpc('social_update_profile',{p_display_name:name,p_handle:handle.replace(/^@/,''),p_discoverable:discover,p_owner:userId});if(error)throw error;socialProfileChanged(userId);if(alive.current)setNotice(t.saved);}catch(error){if(alive.current)setNotice(socialError(error,t));}finally{locked.current=false;if(alive.current)setBusy(false);}}
 async function photo(file,remove=false){if(locked.current||!profile||(!file&&!remove))return;locked.current=true;setPhotoBusy(true);setNotice('');let uploaded=null,committed=false;try{
  if(file){const blob=await preparePhoto(file,t);uploaded=userId+'/'+crypto.randomUUID()+'.jpg';const {error}=await supabase.storage.from('profile-avatars').upload(uploaded,blob,{contentType:'image/jpeg',upsert:false});if(error)throw error;}
  const {error}=await supabase.rpc('social_set_avatar',{p_path:uploaded,p_owner:userId});if(error)throw error;committed=true;socialProfileChanged(userId);if(profile.avatar_path&&profile.avatar_path!==uploaded)await supabase.storage.from('profile-avatars').remove([profile.avatar_path]).catch(()=>{});if(alive.current)setNotice(t.saved);
 }catch(error){if(uploaded&&!committed)await supabase.storage.from('profile-avatars').remove([uploaded]).catch(()=>{});if(alive.current)setNotice([t.tooLarge,t.formatError].includes(error?.message)?error.message:t.error);}finally{locked.current=false;if(alive.current)setPhotoBusy(false);}}
 return <section className="social-profile-editor">
  <div className="social-photo-editor"><SocialAvatar userId={userId} name={profile?.display_name} path={profile?.avatar_path} className="social-avatar-large"/><input ref={input} className="social-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif" aria-label={t.photo} onChange={e=>{const file=e.target.files?.[0];e.target.value='';photo(file);}}/><button type="button" className="social-button" disabled={busy||photoBusy||!profile} onClick={()=>input.current?.click()}><Camera size={16}/>{photoBusy?t.uploading:t.photo}</button>{profile?.avatar_path&&<button type="button" className="social-text-button" disabled={busy||photoBusy} onClick={()=>photo(null,true)}>{t.removePhoto}</button>}<p>{t.photoHint}</p></div>
  <form onSubmit={save}><label className="social-field"><span>{t.profileName}</span><input maxLength={60} value={name} onChange={e=>setName(e.target.value)} required disabled={busy||photoBusy||!profile}/></label><label className="social-field"><span>{t.handle}</span><input readOnly aria-readonly="true" maxLength={24} autoCapitalize="none" autoCorrect="off" spellCheck={false} value={handle} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/^@/,''))}  required disabled={busy||photoBusy||!profile}/></label><label className="social-check"><input type="checkbox" checked={discover} onChange={e=>setDiscover(e.target.checked)} disabled={busy||photoBusy||!profile}/><span>{t.discovery}</span></label><p className="social-note">{t.discoveryHint}</p><button className="social-button social-primary" disabled={busy||photoBusy||!profile}>{busy?t.saving:t.save}</button></form>{notice&&<p className="social-note" role="status">{notice}</p>}
 </section>;
}
