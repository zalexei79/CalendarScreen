import React,{useEffect,useRef,useState} from 'react';
import {Flame,ShieldCheck} from 'lucide-react';
import {supabase} from '../../supabaseClient';
import useAdminQuery from './useAdminQuery.js';
import {QueryStatus} from './AdminQueryUI.jsx';
import {adminError} from './adminUsersModel.js';
import './AdminStreak.css';

export function StreakSummary({userId,revision,onOpen}) {
 const state=useAdminQuery('admin_streak_state',{p_user_id:userId},true,revision);
 return <div className="admin-streak-summary"><Flame size={23}/><div><strong>{state.loading?'Проверяем огонёк…':state.error?'Огонёк недоступен':`Серия: ${state.data?.current_days??'—'} дней`}</strong><p>{state.data?.admin_adjusted_at?'Серия корректировалась администратором':'Продолжается за запись или отметку «без трат»'}</p></div><button onClick={onOpen}>Открыть огонёк</button></div>;
}
export default function AdminStreak({user,canEdit,revision,onChanged}) {
 const [refresh,setRefresh]=useState(0),[target,setTarget]=useState('1'),[note,setNote]=useState(''),[confirm,setConfirm]=useState(null),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const state=useAdminQuery('admin_streak_state',{p_user_id:user.id},true,`${revision}:${refresh}`);
 const dialog=useRef(null),alive=useRef(true),lock=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!confirm)return;const node=dialog.current,focus=document.activeElement;node?.showModal();return()=>{node?.close();focus?.focus();};},[confirm]);
 function prepare(action,value){const s=state.data;if(!s||busy)return;const next=action==='preserve'?Math.max(1,s.stored_days):action==='set'?Number(value):s.current_days+value;
   if(!Number.isInteger(next)||next<0||next>36500){setNotice('Укажите целое число дней от 0 до 36500.');return;}
   setNotice('');setConfirm({action,value:action==='preserve'?null:Number(value),next,expected:s,note:note.trim()});
 }
 async function save(){if(lock.current||!confirm)return;lock.current=true;setBusy(true);const request=confirm;
  try{const {error}=await supabase.rpc('admin_change_streak',{p_user_id:user.id,p_action:request.action,p_value:request.value,p_expected:request.expected,p_note:request.note||null});if(error)throw error;if(alive.current){setConfirm(null);setNotice('Огонёк обновлён. Изменение записано в журнал.');setRefresh(n=>n+1);onChanged?.();}}
  catch(error){if(alive.current){setConfirm(null);setNotice(adminError(error));setRefresh(n=>n+1);}}
  finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 const s=state.data;
 return <section className="admin-streak"><div className="people-feed-heading"><div><span className="people-eyebrow"><ShieldCheck size={13}/> СЕРИЯ АКТИВНОСТИ</span><h2>Огонёк пользователя</h2></div><button disabled={busy} onClick={()=>setRefresh(n=>n+1)}>Обновить огонёк</button></div><QueryStatus query={state}/>{notice&&<p role="status">{notice}</p>}
 {s&&!state.loading&&!state.error&&<><div className="admin-streak-meter"><Flame size={36}/><div><strong>{s.current_days}</strong><span>дней в текущей серии</span></div><p>{s.expired?'Серия истекла из-за пропуска.':s.completed_today?'Сегодня есть зачтённая активность.':'Сегодня активность ещё не зачтена.'}</p></div>
 <dl className="admin-record-fields"><dt>Сохранено в счётчике</dt><dd>{s.stored_days} дней</dd><dt>Последняя активность</dt><dd>{s.last_entry_date||'Пока нет'}</dd><dt>Часовой пояс / сегодня</dt><dd>{s.time_zone} · {s.server_date}</dd><dt>Последняя ручная правка</dt><dd>{s.admin_adjusted_at?new Date(s.admin_adjusted_at).toLocaleString('ru'):'Не было'}</dd></dl>
 <p className="admin-hint">Огонёк отражает регулярность записей или отметок «без трат», не просто входы в приложение. Ручные начисления не доказывают заинтересованность пользователя.</p>
 {canEdit?<fieldset disabled={busy}><legend>Изменить огонёк</legend><div className="admin-actions"><button disabled={s.current_days<=0} onClick={()=>prepare('adjust',-1)}>−1 день</button><button disabled={s.current_days>=36500} onClick={()=>prepare('adjust',1)}>+1 день</button><button onClick={()=>prepare('preserve',null)}>Сохранить / восстановить серию</button></div>
 <div className="admin-streak-set"><label className="admin-field"><span>Установить число дней</span><input type="number" min="0" max="36500" step="1" value={target} onChange={e=>setTarget(e.target.value)}/></label><button onClick={()=>{if(target.trim()===''){setNotice('Укажите число дней.');return;}prepare('set',target);}}>Установить огонёк</button></div><label className="admin-field"><span>Заметка к огоньку · необязательно</span><textarea value={note} maxLength={500} onChange={e=>setNote(e.target.value)}/></label>
 <p className="admin-hint">Правка применяется на сегодня в часовом поясе аккаунта. Сохранение восстанавливает сохранённое число дней (минимум 1). Дальше действуют обычные правила пропусков — это не вечная заморозка. Для аккаунта без истории используется UTC.</p></fieldset>:<p>Только просмотр: изменение огоньков требует прав редактирования пользователей.</p>}
 </>}
 {confirm&&<dialog ref={dialog} className="admin-pro-confirm" aria-labelledby="streak-confirm-title" onCancel={e=>{e.preventDefault();if(!busy)setConfirm(null);}}><h2 id="streak-confirm-title">Изменить огонёк?</h2><p>{user.name} · {user.email||user.id}</p><code>{user.id}</code><p>Текущая серия: {confirm.expected.current_days} → {confirm.next} дней.</p><p>На дату {confirm.expected.server_date} · {confirm.expected.time_zone}. День фактической записи и отметка «без трат» не начисляются.</p>{confirm.note&&<p>{confirm.note}</p>}<div className="admin-actions"><button disabled={busy} onClick={()=>setConfirm(null)}>Отмена</button><button className="admin-primary" disabled={busy} onClick={save}>{busy?'Сохраняем…':'Подтвердить изменение огонька'}</button></div></dialog>}
 </section>;
}
