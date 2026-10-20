import React from 'react';
import {UsersRound,Crown,CalendarDays,ShieldCheck,ArrowUpRight} from 'lucide-react';
import useAdminQuery from './useAdminQuery.js';
import {combinedPro,remainingPro} from './adminProModel.js';
import './AdminPeople.css';

export function PersonAvatar({name,large=false}) {
 const initials=String(name||'?').trim().split(/\s+/).slice(0,2).map(p=>Array.from(p)[0]).join('').toUpperCase();
 return <span className={`people-avatar${large?' people-avatar-large':''}`} aria-hidden="true">{initials}</span>;
}
export function PeopleHero({pro=false,total,loading,onRefresh,canEdit}) {
 const Icon=pro?Crown:UsersRound;
 return <div className="people-hero"><div className="people-hero-title"><span className="people-eyebrow"><Icon size={15}/> DAYRIS · {pro?'ДОСТУП И ПОДПИСКИ':'ПОЛЬЗОВАТЕЛИ'}</span><h1>{pro?'Управление PRO':'Пользователи'}</h1><p>{pro?'Кому открыт доступ, до какой даты и что нужно изменить — всё на одной странице.':'Сначала человек. Затем его календарь, данные и подписка — без лишних переходов.'}</p><button className="people-refresh" onClick={onRefresh}>{pro?'Обновить PRO':'Обновить'}</button></div><div className="people-hero-stats"><div><Icon size={22}/><strong>{loading?'…':total==null?'—':total}</strong><span>{pro?'аккаунтов в выборке':'пользователей найдено'}</span></div><div><ShieldCheck size={22}/><strong>{canEdit?'Управление':'Просмотр'}</strong><span>ваши права доступа</span></div></div></div>;
}
export function PeopleEmpty({pro=false}) {
 return <div className="admin-empty people-empty"><svg viewBox="0 0 320 180" aria-hidden="true"><rect x="26" y="24" width="165" height="132" rx="16" fill="#1b2a35" stroke="#4b7069"/><path d="M26 61h165" stroke="#4b7069"/><circle cx="48" cy="43" r="4" fill="#9ddac4"/><circle cx="63" cy="43" r="4" fill="#617f79"/>{Array.from({length:12},(_,i)=><rect key={i} x={43+(i%4)*34} y={76+Math.floor(i/4)*23} width="23" height="13" rx="4" fill={i===5?'#a2dac5':'#30424f'}/>)}<path d="M191 91h29v-9h12" fill="none" stroke="#81b5a5" strokeDasharray="4 4"/><rect x="225" y="51" width="71" height="68" rx="18" fill="#352e1e" stroke="#ae8a45"/><path d="m240 77 7 14h28l7-14-12 7-9-14-9 14z" fill="none" stroke="#ebcb81" strokeWidth="2"/></svg><h2>Выберите пользователя</h2><p>{pro?'Слева — список аккаунтов. Откройте человека, чтобы посмотреть срок или изменить доступ.':'Откройте карточку слева: здесь появятся календарь, профиль и управление PRO.'}</p><div className="people-empty-path"><span><UsersRound size={16}/> Человек</span><span>→</span><span><CalendarDays size={16}/> Календарь</span><span>→</span><span><Crown size={16}/> PRO</span></div></div>;
}
export function UserProSummary({userId,revision,onOpen}) {
 const query=useAdminQuery('admin_pro_state',{p_user_id:userId},true,revision);
 const now=query.data?.server_now?Date.parse(query.data.server_now):Date.now();
 const access=combinedPro(query.data?.grants,query.data?.subscriptions,now);
 const status=query.loading?'Проверяем доступ…':query.error?'Статус PRO недоступен':access.active?'PRO активен':'Базовый доступ';
 return <div className={`people-pro-summary${query.data&&access.active?' is-pro':''}`}><span className="people-pro-symbol"><Crown size={25}/></span><div><strong>{status}</strong><p>{query.error?'Откройте PRO, чтобы повторить проверку.':query.loading?'Подключаем данные подписки':access.active?(access.expiry<=now?'Срок не передан платёжным провайдером':remainingPro(access.expiry,now)):'Можно выдать доступ или посмотреть его историю.'}</p></div><button onClick={onOpen}>Открыть PRO <ArrowUpRight size={16}/></button></div>;
}
