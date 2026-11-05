import React,{useRef,useState} from 'react';
import {supabase} from '../../supabaseClient';
import useAdminQuery from './useAdminQuery.js';
import {VerifiedMark} from '../social/VerifiedBadge.jsx';
export default function AdminVerification({userId,canEdit}){
 const [revision,setRevision]=useState(0),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),lock=useRef(false);
 const state=useAdminQuery('admin_user_verification',{p_user_id:userId},true,revision);
 async function change(value){if(lock.current)return;lock.current=true;setBusy(true);setNotice('');try{const {error}=await supabase.rpc('admin_set_user_verification',{p_user_id:userId,p_verified:value});if(error)throw error;setRevision(n=>n+1);setNotice(value?'Профиль подтверждён.':'Подтверждение снято.');window.dispatchEvent(new Event('dayris:verification-changed'));}catch{setNotice('Не удалось изменить верификацию. Попробуйте ещё раз.');}finally{lock.current=false;setBusy(false);}}
 return <section className="admin-verification"><VerifiedMark/><label><input type="checkbox" checked={state.data?.verified===true} disabled={!canEdit||busy||state.loading||Boolean(state.error)} onChange={e=>change(e.target.checked)}/>Официальный подтверждённый профиль</label><p>Галочка видна в друзьях и переписках. Выдача и снятие записываются в историю действий.</p>{(notice||state.error)&&<p role="status">{notice||state.error}</p>}</section>;
}
