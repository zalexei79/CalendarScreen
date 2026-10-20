import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import useAdminQuery from './useAdminQuery.js';
import { adminError, calendarTotals, changesFor, DATASETS, editableFields, monthBounds, monthCells, moveMonth, recordKey } from './adminUsersModel.js';
import AdminAudit from './AdminAudit.jsx';
import {Pagination,QueryStatus} from './AdminQueryUI.jsx';
import ProDetail from './ProDetail.jsx';
import {PeopleHero,PersonAvatar,PeopleEmpty,UserProSummary} from './AdminPeopleVisuals.jsx';
import {CalendarDays,Wallet,Clock3} from 'lucide-react';
import './AdminPeople.css';

const LABELS = { date_key:'Дата', time:'Время', instrument:'Название / категория', direction:'Направление', pnl:'Сумма / PnL', currency:'Валюта', comment:'Комментарий', title:'Название', amount:'Сумма', kind:'Тип', note:'Заметка', user_id:'ID пользователя', id:'ID записи', created_at:'Создано', updated_at:'Обновлено', platform:'Источник', status:'Статус', outcome:'Результат', local_at:'Местная дата', scheduled_at:'Напоминание', ends_at:'Доступ до', starts_at:'Доступ с', source:'Источник', name:'Название', email:'Email', phone:'Телефон', last_sign_in_at:'Последний вход', profile:'Профиль', providers:'Способы входа' };
const formatAmount = (value, currency) => `${new Intl.NumberFormat('ru', { maximumFractionDigits: 2 }).format(Number(value))} ${currency || ''}`;
export function DataFields({ value }) {
  return <dl className="admin-record-fields">{Object.entries(value || {}).map(([key, item]) => <React.Fragment key={key}><dt>{LABELS[key] || key}</dt><dd>{item == null ? '—' : typeof item === 'object' ? <pre>{JSON.stringify(item, null, 2)}</pre> : String(item)}</dd></React.Fragment>)}</dl>;
}
export {Pagination,QueryStatus} from './AdminQueryUI.jsx';

export default function AdminUsers({ canEdit }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [user, setUser] = useState(null);
  const [revision, setRevision] = useState(0);
  const detail = useRef(null);
  useEffect(() => { if (user && matchMedia('(max-width:760px)').matches) detail.current?.scrollIntoView({ block:'start' }); },[user?.id]);
  const list = useAdminQuery('admin_list_users', { p_search: query, p_limit: 30, p_offset: offset }, true, revision);
  return <main className="admin-page people-page">
    <PeopleHero total={list.data?.total} loading={list.loading} canEdit={canEdit} onRefresh={()=>setRevision(n=>n+1)}/>
    <div className="admin-users-layout"><aside className="admin-user-list" id="people-user-list"><div className="people-list-heading"><strong>Все аккаунты</strong><span>{list.data?.total??"—"}</span></div><form onSubmit={event => { event.preventDefault(); setOffset(0); setQuery(search.trim()); }}><label className="admin-field"><span>Поиск пользователя</span><input value={search} maxLength={200} placeholder="Имя, email или UUID" onChange={event => setSearch(event.target.value)}/></label><button type="submit">Найти</button></form><QueryStatus query={list}/>
      <div className="admin-user-cards">{(list.data?.users || []).map(item => <button className="admin-user-card" key={item.id} aria-pressed={user?.id === item.id} onClick={() => setUser(item)}><PersonAvatar name={item.name}/><span className="people-card-body"><strong>{item.name}</strong><span>{item.email || item.id}</span><small>{item.last_sign_in_at ? `Вход: ${new Date(item.last_sign_in_at).toLocaleString('ru')}` : 'Ещё не входил'}</small></span></button>)}</div>
      {!list.loading && !list.error && !list.data?.users?.length && <p>Пользователи не найдены.</p>}
      <Pagination offset={offset} limit={30} total={list.data?.total || 0} disabled={list.loading} onChange={setOffset}/>
    </aside><section ref={detail} className="admin-user-detail" aria-label="Карточка пользователя">{user ? <UserDetail key={user.id} user={user} canEdit={canEdit} externalRevision={revision}/> : <PeopleEmpty/>}</section></div>
  </main>;
}

function UserDetail({ user, canEdit, externalRevision }) {
  const [section, setSection] = useState('calendar');
  const [month, setMonth] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}`; });
  const [dataset, setDataset] = useState('trades');
  const [selectedDay, setSelectedDay] = useState(null);
  const [offset, setOffset] = useState(0);
  const [allDates, setAllDates] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const profile = useAdminQuery('admin_user_profile', { p_user_id: user.id }, true, externalRevision);
  const period = monthBounds(month);
  const currentDataset = DATASETS.find(item => item.id === dataset);
  const data = useAdminQuery('admin_user_data', {
    p_user_id: user.id, p_dataset: dataset, p_from: allDates || !currentDataset.dated ? null : selectedDay || period.from,
    p_to: allDates || !currentDataset.dated ? null : selectedDay || period.to, p_limit: 50, p_offset: offset,
  }, section !== 'profile' && section !== 'audit' && section !== 'pro', `${externalRevision}:${revision}`);
  const calendar = useAdminQuery('admin_user_calendar', { p_user_id: user.id, p_month: period.from }, section === 'calendar', `${externalRevision}:${revision}`);
  const calendarRows = Array.isArray(calendar.data) ? calendar.data : [];
  const rows = Array.isArray(data.data?.rows) ? data.data.rows : [];
  function switchDataset(value) { setDataset(value); setOffset(0); setSelectedDay(null); setEditing(null); }
  function changeMonth(value) {
    try { monthBounds(value); setMonth(value); setSelectedDay(null); setOffset(0); } catch { /* incomplete month input */ }
  }
  function exportPage() {
    const blob = new Blob([JSON.stringify({ user_id: user.id, dataset, from: allDates ? null : selectedDay || period.from, to: allDates ? null : selectedDay || period.to, offset, total: data.data?.total, rows }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `dayris-${dataset}-${user.id}-page-${offset / 50 + 1}.json`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  return <>
    <button className="people-back-list" onClick={()=>document.getElementById("people-user-list")?.scrollIntoView({block:"start"})}>← К списку пользователей</button><div className="admin-subject"><div className="people-subject-top"><PersonAvatar name={user.name} large/><div><h2>{user.name}</h2><p>{user.email || "Аккаунт без email"}</p></div></div><div className="people-subject-meta"><span>{editMode && canEdit ? "Редактирование включено" : "Безопасный просмотр"}</span><details><summary>ID аккаунта</summary><code>{user.id}</code></details><span>{user.last_sign_in_at?`Последний вход: ${new Date(user.last_sign_in_at).toLocaleDateString("ru")}`:"Дата входа не указана"}</span></div></div>{section!=='pro'&&<UserProSummary userId={user.id} revision={`${externalRevision}:${revision}`} onOpen={()=>setSection("pro")}/>}
    <div className="admin-detail-tabs" role="group" aria-label="Разделы пользователя">{[['calendar','Календарь'],['data','Все данные'],['profile','Профиль'],['pro','PRO'],['audit','История действий']].map(([id,label]) => <button aria-pressed={section === id} key={id} onClick={() => setSection(id)}>{label}</button>)}</div>
    {notice && <p role="status" className="admin-notice">{notice}</p>}
    {section === 'pro' ? <ProDetail embedded user={user} canEdit={canEdit} revision={`${externalRevision}:${revision}`} onChanged={()=>setRevision(n=>n+1)}/> : section === 'profile' ? <><QueryStatus query={profile}/>{profile.data && <DataFields value={profile.data}/>}<p className="admin-hint">В панели доступны облачные данные. Изменения, которые ещё не синхронизировались с устройства пользователя, здесь не отображаются.</p></> : section === 'audit' ? <AdminAudit userId={user.id} compact/> : <>
      <div className="admin-data-toolbar"><label className="admin-field"><span>Раздел данных</span><select value={dataset} onChange={event => switchDataset(event.target.value)}>{DATASETS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="admin-field"><span>Месяц</span><input aria-label="Месяц календаря" type="month" min="1900-01" max="2200-12" value={month} onChange={event => changeMonth(event.target.value)}/></label><button onClick={() => { setRevision(value => value + 1); setNotice(''); }}>Обновить данные</button></div>
      {section === 'calendar' && <>
        <div className="admin-calendar-nav"><button aria-label="Предыдущий месяц пользователя" disabled={month === '1900-01'} onClick={() => changeMonth(moveMonth(month,-1))}>←</button><strong>{new Date(`${month}-01T12:00:00`).toLocaleDateString('ru',{ month:'long', year:'numeric' })}</strong><button aria-label="Следующий месяц пользователя" disabled={month === '2200-12'} onClick={() => changeMonth(moveMonth(month,1))}>→</button></div>
        <div className="admin-month-totals">{[['trades','Календарь'],['wallet_transactions','Кошелёк'],['reminders','Запланировано']].map(([id,label]) => <div key={id}>{id==="trades"?<CalendarDays size={21}/>:id==="wallet_transactions"?<Wallet size={21}/>:<Clock3 size={21}/>}<span>{label}</span><strong>{calendar.loading ? '…' : calendar.error ? 'Недоступно' : calendarTotals(calendarRows,id).map(item => formatAmount(item.amount,item.currency)).join(' · ') || 'Нет записей'}</strong></div>)}</div>
        <QueryStatus query={calendar}/><div className="people-calendar-legend"><span><i/>Календарь</span><span><i/>Кошелёк</span><span><i/>Планы</span></div><p className="admin-hint">Нажмите день — ниже появятся суммы и записи. Валюты и счета не смешиваются.</p>
        <div className="admin-user-calendar" aria-label="Календарь пользователя">{['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(day => <span className="admin-weekday" key={day}>{day}</span>)}{monthCells(month).map((day,index) => !day ? <div className="admin-day-empty" key={`empty-${index}`}/> : <button className="admin-user-day" data-has-entries={calendarRows.some(row=>row.day===day)} key={day} aria-label={`Открыть день ${day}`} aria-pressed={selectedDay === day} onClick={() => { setSelectedDay(selectedDay === day ? null : day); setAllDates(false); setOffset(0); }}><strong>{Number(day.slice(-2))}</strong>{calendarRows.filter(row => row.day === day).map(row => <span key={`${row.dataset}:${row.currency}`} className={`admin-day-value admin-day-${row.dataset}`} title={`${row.count} записей`}><i>{row.dataset === 'trades' ? 'К' : row.dataset === 'wallet_transactions' ? '₽' : 'П'}</i>{formatAmount(row.amount,row.currency)}</span>)}</button>)}</div>
        {selectedDay&&<div className="people-day-focus"><strong>{new Date(selectedDay+"T12:00:00").toLocaleDateString("ru",{day:"numeric",month:"long",year:"numeric"})}</strong>{calendarRows.filter(row=>row.day===selectedDay).map(row=><p key={`${row.dataset}:${row.currency}`}>{row.dataset==="trades"?"Календарь":row.dataset==="wallet_transactions"?"Кошелёк":"Планы"} · <b>{formatAmount(row.amount,row.currency)}</b> · записей: {row.count}</p>)}{!calendarRows.some(row=>row.day===selectedDay)&&<p>В этом дне нет синхронизированных записей календаря, кошелька или планов.</p>}</div>}
      </>}
      <div className="admin-data-actions"><label className="admin-check"><input type="checkbox" checked={allDates} onChange={event => { setAllDates(event.target.checked); setSelectedDay(null); setOffset(0); }}/>Все даты</label>{selectedDay && <button onClick={() => { setSelectedDay(null); setOffset(0); }}>Сбросить день {selectedDay}</button>}<button disabled={data.loading || !rows.length} onClick={exportPage}>Экспорт страницы JSON</button>{canEdit && <label className="admin-check"><input type="checkbox" checked={editMode} onChange={event => setEditMode(event.target.checked)}/>Разрешить редактирование</label>}</div>
      <h3>{currentDataset.label}{selectedDay && ` · ${selectedDay}`}</h3><QueryStatus query={data}/>
      {data.data?.available === false && <p>Этот раздел ещё не подключён в базе.</p>}
      {!data.loading && !data.error && !rows.length && data.data?.available !== false && <p>За выбранный период записей нет.</p>}
      <div className="admin-records">{rows.map((row,index) => <article className="admin-record" key={`${row.id || row.date_key || index}:${index}`}><div className="admin-record-heading"><strong>{row.instrument || row.title || row.name || row.date_key || row.id || currentDataset.label}</strong>{(row.pnl != null || row.amount != null) && <span>{formatAmount(row.pnl ?? row.amount,row.currency)}</span>}</div><p>{row.date_key || row.occurred_on || row.local_at || ''} {row.time || ''} {row.platform || row.kind || row.operation || ''}</p>{row.comment && <p>{row.comment}</p>}{row.note && <p>{row.note}</p>}<details><summary>Все поля записи</summary><DataFields value={row}/></details>{canEdit && editMode && currentDataset.editable && <button onClick={() => setEditing(row)}>Редактировать запись</button>}</article>)}</div>
      <Pagination offset={offset} limit={50} total={data.data?.total || 0} disabled={data.loading} onChange={setOffset}/>
      <p className="admin-hint">Редактирование доступно для записей календаря, операций кошелька и заметок. У импортированных сделок можно изменить комментарий; связанные с продажей капитала суммы защищены сервером.</p>
    </>}
    {editing && <EditRecord key={`${dataset}:${recordKey(dataset,editing)}`} userId={user.id} dataset={dataset} original={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setRevision(value => value + 1); setNotice('Изменения сохранены. Причина и значения до / после записаны в журнал.'); }}/>}
  </>;
}

function EditRecord({ userId, dataset, original, onClose, onSaved }) {
  const dialog = useRef(null);
  const [input,setInput] = useState({ ...original });
  const [reason,setReason] = useState('');
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');
  const alive = useRef(true);
  useEffect(() => { alive.current=true; const element=dialog.current; element.showModal(); return () => { alive.current=false; element.close(); }; },[]);
  async function save(event) {
    event.preventDefault(); if(busy) return;
    setError('');
    try {
      const changes = changesFor(dataset,original,input);
      if (!Object.keys(changes).length) { setError('Измените хотя бы одно поле.'); return; }
      if (reason.trim().length<5) { setError('Укажите причину изменения: минимум 5 символов.'); return; }
      setBusy(true);
      const result = await supabase.rpc('admin_update_user_record', { p_user_id:userId,p_dataset:dataset,p_key:recordKey(dataset,original),p_expected:original,p_changes:changes,p_reason:reason.trim() });
      if(result.error) throw result.error;
      if(alive.current) onSaved();
    } catch(problem) { if(alive.current) setError(problem?.code ? adminError(problem) : problem.message || adminError(problem)); }
    finally { if(alive.current) setBusy(false); }
  }
  return <dialog ref={dialog} className="admin-edit-dialog" aria-labelledby="admin-edit-title" onCancel={event => { event.preventDefault(); if(!busy) onClose(); }}><form onSubmit={save}><h2 id="admin-edit-title">Изменить запись пользователя</h2><code>{userId}</code><p>Запись {recordKey(dataset,original)} · {DATASETS.find(item=>item.id===dataset)?.label}</p><fieldset disabled={busy}>{editableFields(dataset,original).map(key => <label className="admin-field" key={key}><span>{LABELS[key]}</span>{key==='comment'||key==='note' ? <textarea maxLength={2000} value={input[key] || ''} onChange={event=>setInput({...input,[key]:event.target.value})}/> : key==='direction'||key==='kind' ? <select value={input[key]} onChange={event=>setInput({...input,[key]:event.target.value})}>{(key==='direction'?['LONG','SHORT']:['income','expense']).map(value=><option key={value}>{value}</option>)}</select> : <input required type={key==='date_key'?'date':key==='time'?'time':['amount','pnl'].includes(key)?'number':'text'} step={['amount','pnl'].includes(key)?'0.01':key==='time'?'1':undefined} maxLength={key==='currency'?3:120} value={input[key] ?? ''} onChange={event=>setInput({...input,[key]:event.target.value})}/>}</label>)}<label className="admin-field"><span>Причина изменения</span><textarea required minLength={5} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder="Например: исправление суммы по обращению пользователя"/></label></fieldset>{error&&<p role="alert" className="admin-error">{error}</p>}<div className="admin-actions"><button type="button" disabled={busy} onClick={onClose}>Отмена</button><button type="submit" className="admin-primary" disabled={busy}>{busy?'Сохранение…':'Сохранить изменения'}</button></div></form></dialog>;
}
