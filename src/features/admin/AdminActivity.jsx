import React,{useState} from 'react';
import {CalendarDays,Wallet,Clock3,FileText,ArrowUpRight} from 'lucide-react';
import useAdminQuery from './useAdminQuery.js';
import {Pagination,QueryStatus} from './AdminQueryUI.jsx';
const TYPES={trades:'Календарь',wallet_transactions:'Кошелёк',reminders:'Планы',trading_day_notes:'Заметки'};
const ICONS={trades:CalendarDays,wallet_transactions:Wallet,reminders:Clock3,trading_day_notes:FileText};
export default function AdminActivity({userId=null,revision=0,onSelect,onOpenRecord,compact=false}) {
 const [days,setDays]=useState('0'),[dataset,setDataset]=useState('all'),[offset,setOffset]=useState(0);
 const limit=compact?5:20;
 const query=useAdminQuery('admin_recent_entries',{p_user_id:userId,p_days:Number(days),p_dataset:dataset,p_limit:limit,p_offset:offset},true,revision);
 const rows=query.data?.rows||[];
 return <section className={`admin-activity${compact?' people-activity-compact':''}`}>
   {!compact&&<><div className="people-feed-heading"><div><span className="people-eyebrow">{userId?'АКТИВНОСТЬ АККАУНТА':'ОБЩАЯ ЛЕНТА'}</span><h2>Последние записи{userId?' пользователя':''}</h2></div><span className="people-feed-count">{query.data?.total??'—'}</span></div><p className="admin-hint">Новые и изменённые облачные записи. Вход в аккаунт и присутствие онлайн здесь не учитываются.</p><div className="people-feed-filters"><label className="admin-field"><span>Период ленты</span><select aria-label="Период ленты" value={days} onChange={e=>{setDays(e.target.value);setOffset(0);}}><option value="0">За всё время</option><option value="1">За 24 часа</option><option value="7">За 7 дней</option><option value="30">За 30 дней</option></select></label><label className="admin-field"><span>Тип записи</span><select aria-label="Тип записи" value={dataset} onChange={e=>{setDataset(e.target.value);setOffset(0);}}><option value="all">Все записи</option>{Object.entries(TYPES).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div></>}
   <QueryStatus query={query}/>
   <div className="admin-records people-feed-records">{rows.map(row=>{const Icon=ICONS[row.dataset]||FileText;const account={id:row.user_id,name:row.name,email:row.email};return <article className="admin-record people-feed-record" key={`${row.user_id}:${row.dataset}:${row.record_key}`}>
     <span className={`people-event-icon event-${row.dataset}`} aria-hidden="true"><Icon size={19}/></span><div className="people-event-content">
       {!userId&&<button className="people-event-author" onClick={()=>onSelect?.(account)}>{row.name}<ArrowUpRight size={13}/></button>}
       <div className="admin-record-heading"><strong>{row.title||TYPES[row.dataset]||'Запись'}</strong>{row.amount!=null&&<span>{new Intl.NumberFormat('ru',{maximumFractionDigits:2}).format(Number(row.amount))} {row.currency}</span>}</div>
       <div className="people-event-meta"><span>{TYPES[row.dataset]}</span><time>{row.event_at?new Date(row.event_at).toLocaleString('ru'):'Время сохранения неизвестно'}</time></div>
       {row.record_date&&<p className="people-event-date">В календаре: {row.record_date.slice(0,10)}</p>}
       <details className="people-event-details"><summary>Подробности</summary><p>{row.email||row.user_id}</p>{row.platform&&<p>Источник: {row.platform}</p>}<p>ID записи: {row.record_key}</p></details>
       {(onOpenRecord||onSelect)&&<button className="people-event-open" onClick={()=>onOpenRecord?onOpenRecord(row):onSelect(account,row)}>Открыть запись <ArrowUpRight size={13}/></button>}
     </div></article>;})}</div>
   {!query.loading&&!query.error&&!rows.length&&<div className="people-feed-empty"><FileText size={30}/><h3>Пока нет записей</h3><p>За выбранный период записей нет.</p><small>Здесь появятся записи после синхронизации календаря, кошелька, планов или заметок.</small></div>}
   {compact?<p className="people-feed-footnote">{query.loading?'Загрузка…':query.error?'Не удалось загрузить записи':`Последние ${rows.length} из ${query.data?.total??0} записей`}</p>:<Pagination offset={offset} limit={limit} total={query.data?.total||0} disabled={query.loading} onChange={setOffset}/>}
 </section>;
}
