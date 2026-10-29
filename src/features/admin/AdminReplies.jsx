import React,{useEffect,useRef,useState} from 'react';
import {Inbox,MessageCircle} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import useAdminQuery from './useAdminQuery.js';
import {QueryStatus,Pagination} from './AdminQueryUI.jsx';
import {adminError} from './adminUsersModel.js';
import './AdminMessages.css';
function useInboxRefresh(enabled=true){const [revision,setRevision]=useState(0);useEffect(()=>{if(!enabled)return;const refresh=()=>{if(document.visibilityState!=='hidden')setRevision(n=>n+1);};const timer=setInterval(refresh,30000);window.addEventListener('focus',refresh);window.addEventListener('dayris:admin-replies-refresh',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('dayris:admin-replies-refresh',refresh);};},[enabled]);return [revision,()=>setRevision(n=>n+1)];}
export function ReplyBadge({enabled}){const [revision]=useInboxRefresh(enabled);const count=useAdminQuery('admin_reply_unread',{},enabled,revision);return enabled&&Number(count.data)>0?<span className="admin-reply-badge">{count.data}</span>:null;}
export default function AdminReplies({canEdit,onReplyUser}){
 const [unread,setUnread]=useState(false),[offset,setOffset]=useState(0),[revision,refresh]=useInboxRefresh(),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const inbox=useAdminQuery('admin_reply_inbox',{p_unread:unread,p_limit:20,p_offset:offset},true,revision);
 async function ack(id){if(busy)return;setBusy(true);setNotice('');try{const {error}=await supabase.rpc('admin_ack_reply',{p_id:id});if(error)throw error;if(alive.current){refresh();window.dispatchEvent(new Event('dayris:admin-replies-refresh'));}}catch(e){if(alive.current)setNotice(adminError(e));}finally{if(alive.current)setBusy(false);}}
 return <main className="admin-page admin-messages admin-replies"><div className="admin-page-title"><div><span className="people-eyebrow"><Inbox size={15}/> СООБЩЕНИЯ ПОЛЬЗОВАТЕЛЕЙ</span><h1>Входящие</h1><p>Ответы на ваши сообщения. Новых: {inbox.data?.unread_count??'…'}</p></div><button onClick={refresh}>Обновить</button></div>
  <div className="admin-inbox-filters"><button aria-pressed={!unread} onClick={()=>{setUnread(false);setOffset(0);}}>Все сообщения</button><button aria-pressed={unread} onClick={()=>{setUnread(true);setOffset(0);}}>Непрочитанные</button></div>
  {notice&&<p role="alert">{notice}</p>}<QueryStatus query={inbox}/>
  {!inbox.loading&&!inbox.error&&!inbox.data?.rows?.length&&<div className="admin-message-empty"><MessageCircle size={28}/><div><strong>{unread?'Всё прочитано':'Пока нет ответов'}</strong><p>Когда пользователь нажмёт «Ответить», его сообщение появится здесь.</p></div></div>}
  <div className="admin-replies-list">{(inbox.data?.rows||[]).map(r=><article className={`admin-record admin-reply-record${r.read_at?'':' is-new'}`} key={r.id}>
   <header><div><strong>{r.name}</strong><p>{r.email||r.user_id}</p></div><span>{r.read_at?'Прочитано':'Новое'}</span></header>
   <p className="admin-reply-body">{r.body}</p><time>{new Date(r.created_at).toLocaleString('ru',{dateStyle:'medium',timeStyle:'short'})}</time>
   <details><summary>В ответ на: {r.message_title}</summary><p className="admin-message-body">{r.message_body}</p></details>
   {canEdit&&<div className="admin-reply-actions"><button className="admin-primary" onClick={()=>onReplyUser({id:r.user_id,name:r.name,email:r.email,messageTitle:'Ответ на ваше сообщение'})}>Ответить пользователю</button>{!r.read_at&&<button disabled={busy} onClick={()=>ack(r.id)}>Отметить прочитанным</button>}</div>}
  </article>)}</div>
  {Boolean(inbox.data?.total)&&<Pagination offset={offset} limit={20} total={inbox.data.total} disabled={inbox.loading} onChange={setOffset}/>}
 </main>;
}
