import React,{useEffect,useState} from 'react';
import {MessageCircle} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import useAdminQuery from './useAdminQuery.js';
import MessageChat from '../messages/MessageChat.jsx';
import './AdminMessages.css';
function useInboxRefresh(enabled=true){const [revision,setRevision]=useState(0);useEffect(()=>{if(!enabled)return;const refresh=()=>{if(document.visibilityState!=='hidden')setRevision(n=>n+1);};const timer=setInterval(refresh,5000);window.addEventListener('focus',refresh);window.addEventListener('dayris:admin-replies-refresh',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('dayris:admin-replies-refresh',refresh);};},[enabled]);return [revision,()=>setRevision(n=>n+1)];}
export function ReplyBadge({enabled}){const [revision]=useInboxRefresh(enabled);const count=useAdminQuery('admin_reply_unread',{},enabled,revision);return enabled&&Number(count.data)>0?<span className="admin-reply-badge">{count.data}</span>:null;}
export default function AdminReplies({canEdit,initialUser=null,onCampaignUser}){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[unread,setUnread]=useState(false),[offset,setOffset]=useState(0),[selected,setSelected]=useState(initialUser),[revision,refresh]=useInboxRefresh();
 const [state,setState]=useState({key:'',data:null,error:false});const key=JSON.stringify([query,unread,offset]);const own=state.key===key?state:{data:null,error:false};
 useEffect(()=>{if(initialUser)setSelected(initialUser);},[initialUser?.id]);
 useEffect(()=>{const timer=setTimeout(()=>{setQuery(search.trim());setOffset(0);},250);return()=>clearTimeout(timer);},[search]);
 useEffect(()=>{let alive=true;supabase.rpc('chat_admin_dialogs',{p_search:query,p_unread:unread,p_limit:30,p_offset:offset}).then(({data,error})=>{if(alive)setState(s=>({key,data:error?(s.key===key?s.data:null):data,error:Boolean(error)}));}).catch(()=>{if(alive)setState(s=>({key,data:s.key===key?s.data:null,error:true}));});return()=>{alive=false;};},[key,revision]);
 return <main className="admin-page admin-messages admin-messenger"><div className="admin-page-title"><div><span className="people-eyebrow"><MessageCircle size={15}/> ДИАЛОГИ С ПОЛЬЗОВАТЕЛЯМИ</span><h1>Переписка</h1><p>Один разговор с каждым пользователем. Все сообщения в общей ленте.</p></div><button onClick={refresh}>Обновить</button></div>
  <div className={`admin-chat-layout${selected?' is-thread':''}`}>
   <aside className="admin-chat-sidebar" aria-label="Диалоги"><div className="chat-dialog-search"><input aria-label="Поиск диалогов" placeholder="Поиск по имени, email или ID" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/><div className="chat-dialog-filters"><button aria-pressed={!unread} onClick={()=>{setUnread(false);setOffset(0);}}>Все чаты</button><button aria-pressed={unread} onClick={()=>{setUnread(true);setOffset(0);}}>Непрочитанные</button></div></div>
    <div className="chat-dialog-list">{own.error&&<p className="chat-sidebar-note" role="alert">Не удалось обновить диалоги.</p>}{!own.data&&!own.error&&<p className="chat-sidebar-note" role="status">Загрузка…</p>}{own.data&&!own.data.rows?.length&&<p className="chat-sidebar-note">{unread?'Всё прочитано':'Диалоги не найдены. Начать разговор можно из карточки пользователя.'}</p>}
     {(own.data?.rows||[]).map(u=><button className="chat-dialog-row" aria-pressed={selected?.id===u.id} key={u.id} onClick={()=>setSelected(u)}><span className="chat-dialog-avatar">{(u.name||'?').slice(0,1).toUpperCase()}</span><span className="chat-dialog-content"><span><strong>{u.name}</strong><time>{new Date(u.last_at).toLocaleDateString('ru',{day:'numeric',month:'short'})}</time></span><span className="chat-dialog-snippet"><span>{u.direction==='admin'?'Вы: ':''}{u.last_body}</span>{u.unread_count>0&&<b>{u.unread_count}</b>}</span></span></button>)}
    </div>{(offset>0||offset+30<(own.data?.total||0))&&<div className="chat-sidebar-pages"><button disabled={offset===0} onClick={()=>setOffset(n=>Math.max(0,n-30))}>← Назад</button><button disabled={!own.data||offset+30>=own.data.total} onClick={()=>setOffset(n=>n+30)}>Далее →</button></div>}
   </aside>
   <div className="admin-chat-main">{selected?<MessageChat key={selected.id} admin peer={selected} canEdit={canEdit} onBack={()=>setSelected(null)} onCampaign={()=>onCampaignUser?.(selected)}/>:<div className="chat-welcome"><MessageCircle size={38}/><strong>Выберите диалог</strong><p>Или откройте пользователя и нажмите «Написать пользователю».</p></div>}</div>
  </div>
 </main>;
}
