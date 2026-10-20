import React,{useEffect,useRef,useState} from 'react';
import useAdminQuery from './useAdminQuery.js';
import {Pagination,QueryStatus} from './AdminQueryUI.jsx';
import {remainingPro} from './adminProModel.js';
import ProDetail from './ProDetail.jsx';
import {PeopleHero,PersonAvatar,PeopleEmpty} from './AdminPeopleVisuals.jsx';
import './AdminPro.css';

export default function AdminPro({canEdit}) {
  const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[filter,setFilter]=useState('active'),[offset,setOffset]=useState(0),[user,setUser]=useState(null),[revision,setRevision]=useState(0);
  const detail=useRef(null);
  useEffect(()=>{if(user&&matchMedia("(max-width:760px)").matches)detail.current?.scrollIntoView({block:"start"});},[user?.id]);
  const list=useAdminQuery('admin_list_pro',{p_search:query,p_filter:filter,p_limit:30,p_offset:offset},true,revision);
  return <main className="admin-page admin-pro"><PeopleHero pro total={list.data?.total} loading={list.loading} canEdit={canEdit} onRefresh={()=>setRevision(n=>n+1)}/>
    {!canEdit&&<p>Режим просмотра. Для выдачи и отключения нужны права редактирования пользователей.</p>}
    <form className="admin-pro-search" onSubmit={e=>{e.preventDefault();setQuery(search.trim());setOffset(0);}}><label className="admin-field"><span>Поиск PRO-пользователя</span><input value={search} maxLength={200} placeholder="Имя, email или UUID Telegram-пользователя" onChange={e=>setSearch(e.target.value)}/></label><label className="admin-field"><span>Показать</span><select aria-label="Показать" value={filter} onChange={e=>{setFilter(e.target.value);setOffset(0);}}><option value="active">Активные PRO</option><option value="all">Все пользователи — выдать PRO</option></select></label><button type="submit">Найти</button></form>
    <div className="admin-users-layout"><aside className="admin-user-list"><QueryStatus query={list}/><div className="admin-user-cards">{(list.data?.users||[]).map(item=><button className="admin-user-card" key={item.id} aria-pressed={user?.id===item.id} onClick={()=>setUser(item)}><PersonAvatar name={item.name}/><span className="people-card-body"><strong>{item.name}</strong><span>{item.email||item.id}</span><small>{item.subscription_active&&(!item.active_until||Date.parse(item.active_until)<=Date.parse(list.data.server_now))?'Активный PRO · срок не передан провайдером':remainingPro(item.active_until,Date.parse(list.data.server_now))}</small></span></button>)}</div>{!list.loading&&!list.error&&!list.data?.users?.length&&<p>Пользователи не найдены. Для выдачи выберите «Все пользователи».</p>}<Pagination offset={offset} limit={30} total={list.data?.total||0} disabled={list.loading} onChange={setOffset}/></aside>
    <section ref={detail} className="admin-user-detail" aria-label="Управление подпиской">{user?<ProDetail key={user.id} user={user} canEdit={canEdit} revision={revision} onChanged={()=>setRevision(n=>n+1)}/>:<PeopleEmpty pro/>}</section></div>
  </main>;
}
