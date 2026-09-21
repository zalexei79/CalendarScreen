import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { enablePush, disablePush, pushAvailability, reconcilePushOwner } from './pushClient';

function initialTime() {
  const date = new Date(Date.now() + 5 * 60000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16);
}

export default function ReminderPocPanel() {
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('Тест DAYRIS');
  const [time, setTime] = useState(initialTime);
  const [notice, setNotice] = useState('Войди через обычный экран DAYRIS.');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('push-test') === '1');
  const pending = useRef(null);
  const owner = useRef(null);
  const focusId = new URLSearchParams(location.search).get('reminder');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let live = true;
    const update = session => {
      if (!live) return;
      const next = session?.user || null;
      if ((next?.id || null) === owner.current) return;
      owner.current = next?.id || null;
      setUser(next); setRows([]); setEnabled(false); pending.current = null;
      setNotice(next ? 'Нажми «Включить уведомления» для проверки подписки.' : 'Войди через обычный экран DAYRIS.');
      reconcilePushOwner(next?.id || null).catch(() => setNotice('Не удалось отключить старую подписку. Нажми «Отключить».'));
    };
    supabase.auth.getSession().then(({data}) => update(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => queueMicrotask(() => update(session)));
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);

  async function refresh() {
    if (!user) throw new Error('Сначала войди.');
    const uid = user.id;
    const { data, error } = await supabase.from('reminders')
      .select('id,title,scheduled_at,status,reminder_deliveries(status,error_code)')
      .eq('user_id',uid).order('created_at',{ascending:false}).limit(20);
    if (error) throw error;
    if (owner.current === uid) setRows(data || []);
  }

  async function action(fn) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch(e) { setNotice(e.message || 'Ошибка'); }
    finally { setBusy(false); }
  }

  async function create() {
    if (!enabled || !user) throw new Error('Сначала включи уведомления на этом устройстве.');
    const date = new Date(time);
    if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new Error('Выбери будущее время.');
    const local = new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
    if (local !== time) throw new Error('Такого локального времени нет из-за перехода часов. Выбери другое.');
    const signature = JSON.stringify([title,time,user.id]);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const { data, error } = await supabase.rpc('dayris_create_reminder', { p_id: pending.current.id,
      p_title: title.trim(), p_local_at: time+':00', p_timezone: timezone, p_scheduled_at: date.toISOString() });
    if (error) throw error;
    setNotice(`Сохранено: ${data}. Теперь закрой DAYRIS и заблокируй iPhone.`);
    await refresh();
  }

  const style = { background:'#18181b', color:'#fff', border:'1px solid #52525b', borderRadius:10, padding:10, width:'100%', marginTop:8 };
  if (!open) return <button style={{...style,position:'fixed',bottom:15,right:15,width:'auto',zIndex:9999}} onClick={()=>setOpen(true)}>Push-тест</button>;
  return <aside style={{position:'fixed',inset:'auto 12px 12px',maxWidth:460,margin:'auto',zIndex:9999,background:'#09090b',color:'#fff',padding:18,border:'1px solid #fbbf24',borderRadius:16,maxHeight:'80dvh',overflowY:'auto'}}>
    <button onClick={()=>setOpen(false)} style={{float:'right'}}>Свернуть</button>
    <h2>DAYRIS · тест напоминаний</h2>
    <p style={{fontSize:12}}>Часовой пояс: {timezone}. Одноразовые напоминания, до 31 дня.</p>
    <p role="status" style={{fontSize:13,marginTop:8,overflowWrap:'anywhere'}}>{notice}</p>
    {pushAvailability() && <p style={{color:'#fbbf24'}}>{pushAvailability()}</p>}
    <button style={style} disabled={busy||!user||!!pushAvailability()} onClick={()=>action(async()=>{const uid=user.id; await enablePush(uid); if(owner.current!==uid){await disablePush();return;} setEnabled(true);setNotice('Подписка сохранена. Можно создать тест.');})}>Включить уведомления</button>
    <button style={style} disabled={busy} onClick={()=>action(async()=>{await disablePush();setEnabled(false);setNotice('Уведомления на этом устройстве отключены.');})}>Отключить на этом устройстве</button>
    <label>Название<input style={style} maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label>
    <label>Дата и время<input style={style} type="datetime-local" value={time} onChange={e=>setTime(e.target.value)}/></label>
    <button style={{...style,background:'#a16207'}} disabled={busy||!enabled} onClick={()=>action(create)}>Создать напоминание</button>
    <button style={style} disabled={busy||!user} onClick={()=>action(refresh)}>Проверить статус</button>
    <p style={{fontSize:12,marginTop:8}}>accepted — принято push-сервисом, ещё не подтверждение показа на телефоне. uncertain — результат неизвестен, автоматического повтора нет.</p>
    {rows.map(r=><div key={r.id} style={{...style,borderColor:focusId===r.id?'#fbbf24':'#52525b'}}>
      <strong>{r.title}</strong><div>{new Date(r.scheduled_at).toLocaleString()}</div>
      <small>{r.status}: {r.reminder_deliveries.map(d=>`${d.status}${d.error_code?' ('+d.error_code+')':''}`).join(', ') || 'Нет устройств'}</small>
      {r.status==='active'&&<button style={style} disabled={busy} onClick={()=>action(async()=>{const {error}=await supabase.rpc('dayris_cancel_reminder',{p_id:r.id});if(error)throw error;await refresh();})}>Отменить</button>}
    </div>)}
  </aside>;
}
