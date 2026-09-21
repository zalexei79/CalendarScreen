import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { enablePush, disablePush, pushAvailability, reconcilePushOwner } from './pushClient';

function initialTime() {
  const date = new Date(Date.now() + 5 * 60000);
  date.setSeconds(0, 0);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const sheet = {
  width: 'min(560px, calc(100vw - 24px))',
  maxHeight: 'calc(100dvh - 24px)',
  overflowY: 'auto',
  background: 'linear-gradient(145deg, #18181b 0%, #0f0f11 100%)',
  color: '#fafafa',
  border: '1px solid rgba(251,191,36,.45)',
  borderRadius: 24,
  boxShadow: '0 24px 80px rgba(0,0,0,.55)',
  padding: 20,
};
const input = {
  display: 'block',
  width: '100%',
  marginTop: 7,
  padding: '12px 13px',
  borderRadius: 13,
  border: '1px solid #3f3f46',
  background: '#09090b',
  color: '#fafafa',
  fontSize: 15,
  outline: 'none',
  boxSizing: 'border-box',
};
const button = {
  width: '100%',
  border: 0,
  borderRadius: 13,
  padding: '12px 14px',
  marginTop: 10,
  fontSize: 14,
  fontWeight: 650,
  cursor: 'pointer',
};

export default function ReminderPocPanel() {
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState('Тест DAYRIS');
  const [time, setTime] = useState(initialTime);
  const [notice, setNotice] = useState('Войдите в DAYRIS, чтобы создать напоминание.');
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('push-test') === '1');
  const pending = useRef(null);
  const owner = useRef(null);
  const focusId = new URLSearchParams(location.search).get('reminder');
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const unavailable = pushAvailability();

  useEffect(() => {
    let live = true;
    const update = session => {
      if (!live) return;
      const next = session?.user || null;
      if ((next?.id || null) === owner.current) return;
      owner.current = next?.id || null;
      setUser(next); setRows([]); setEnabled(false); pending.current = null;
      setNotice(next ? 'Включите уведомления на этом устройстве.' : 'Войдите в DAYRIS, чтобы создать напоминание.');
      reconcilePushOwner(next?.id || null).catch(() => setNotice('Не удалось отключить старую подписку.'));
    };
    supabase.auth.getSession().then(({ data }) => update(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => queueMicrotask(() => update(session)));
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);

  async function refresh() {
    if (!user) throw new Error('Сначала войдите в DAYRIS.');
    const uid = user.id;
    const { data, error } = await supabase.from('reminders')
      .select('id,title,scheduled_at,status,reminder_deliveries(status,error_code)')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(20);
    if (error) throw error;
    if (owner.current === uid) setRows(data || []);
  }

  async function action(fn) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (error) { setNotice(error.message || 'Не удалось выполнить действие.'); }
    finally { setBusy(false); }
  }

  async function create() {
    if (!enabled || !user) throw new Error('Сначала включите уведомления на этом устройстве.');
    const date = new Date(time);
    if (!Number.isFinite(date.getTime()) || date <= new Date()) throw new Error('Выберите будущее время.');
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    if (local !== time) throw new Error('Такого локального времени нет из-за перехода часов.');
    const signature = JSON.stringify([title, time, user.id]);
    if (pending.current?.signature !== signature) pending.current = { signature, id: crypto.randomUUID() };
    const { data, error } = await supabase.rpc('dayris_create_reminder', {
      p_id: pending.current.id,
      p_title: title.trim(),
      p_local_at: time + ':00',
      p_timezone: timezone,
      p_scheduled_at: date.toISOString(),
    });
    if (error) throw error;
    setNotice('Напоминание сохранено. Можно закрыть DAYRIS и заблокировать iPhone.');
    await refresh();
  }

  if (!open) return (
    <button
      type="button"
      aria-label="Открыть напоминания"
      style={{ ...button, position: 'fixed', right: 16, bottom: 16, width: 'auto', zIndex: 9999, margin: 0, padding: '12px 16px', background: '#fbbf24', color: '#18181b', boxShadow: '0 8px 28px rgba(0,0,0,.35)' }}
      onClick={() => setOpen(true)}
    >
      ◷ Напоминания
    </button>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12, background: 'rgba(0,0,0,.58)', backdropFilter: 'blur(5px)' }}>
      <aside role="dialog" aria-modal="true" aria-label="Напоминания" style={sheet}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 14, background: 'rgba(251,191,36,.14)', color: '#fbbf24', fontSize: 23 }}>◷</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, letterSpacing: '.16em' }}>DAYRIS</div>
            <h2 style={{ margin: '2px 0 0', fontSize: 22, letterSpacing: '-.02em' }}>Напоминания</h2>
          </div>
          <button type="button" aria-label="Закрыть" onClick={() => setOpen(false)} style={{ ...button, width: 38, height: 38, margin: 0, padding: 0, background: '#27272a', color: '#d4d4d8', fontSize: 21 }}>×</button>
        </header>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 13 }}>
          <span style={{ padding: '6px 10px', borderRadius: 999, background: '#27272a', color: '#d4d4d8', fontSize: 12 }}>Одноразовое</span>
          <span style={{ padding: '6px 10px', borderRadius: 999, background: '#27272a', color: '#d4d4d8', fontSize: 12 }}>{timezone}</span>
        </div>

        <p role="status" style={{ margin: '0 0 14px', padding: '11px 12px', borderRadius: 13, background: notice.includes('сохранено') ? 'rgba(34,197,94,.12)' : '#27272a', color: notice.includes('сохранено') ? '#86efac' : '#d4d4d8', fontSize: 13, lineHeight: 1.45 }}>{notice}</p>

        {unavailable && <p style={{ margin: '0 0 12px', color: '#fbbf24', fontSize: 13 }}>{unavailable}</p>}

        <button type="button" disabled={busy || !user || !!unavailable} style={{ ...button, background: '#fbbf24', color: '#18181b', opacity: busy || !user || !!unavailable ? .55 : 1 }} onClick={() => action(async () => { const uid = user.id; await enablePush(uid); if (owner.current !== uid) { await disablePush(); return; } setEnabled(true); setNotice('Уведомления включены. Теперь задайте время.'); })}>
          {enabled ? 'Уведомления включены' : 'Включить уведомления'}
        </button>
        <button type="button" disabled={busy} style={{ ...button, background: 'transparent', color: '#d4d4d8', border: '1px solid #3f3f46' }} onClick={() => action(async () => { await disablePush(); setEnabled(false); setNotice('Уведомления отключены на этом устройстве.'); })}>
          Отключить на устройстве
        </button>

        <div style={{ height: 1, background: '#27272a', margin: '18px 0' }} />
        <label style={{ display: 'block', color: '#d4d4d8', fontSize: 13, fontWeight: 600 }}>Название<input style={input} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label style={{ display: 'block', marginTop: 13, color: '#d4d4d8', fontSize: 13, fontWeight: 600 }}>Дата и время<input style={input} type="datetime-local" value={time} onChange={event => setTime(event.target.value)} /></label>
        <button type="button" disabled={busy || !enabled} style={{ ...button, marginTop: 16, background: enabled ? '#a16207' : '#3f3f46', color: '#fff', opacity: busy ? .55 : 1 }} onClick={() => action(create)}>Сохранить напоминание</button>
        <button type="button" disabled={busy || !user} style={{ ...button, background: 'transparent', color: '#a1a1aa', border: 0 }} onClick={() => action(refresh)}>Проверить историю</button>

        {rows.length > 0 && <section style={{ marginTop: 8 }}>
          <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 8 }}>Последние напоминания</div>
          {rows.map(row => <div key={row.id} style={{ padding: 12, marginTop: 8, borderRadius: 14, border: `1px solid ${focusId === row.id ? '#fbbf24' : '#27272a'}`, background: '#18181b' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong style={{ fontSize: 14 }}>{row.title}</strong><span style={{ color: '#a1a1aa', fontSize: 12 }}>{row.status}</span></div>
            <div style={{ marginTop: 5, color: '#a1a1aa', fontSize: 12 }}>{new Date(row.scheduled_at).toLocaleString()}</div>
            <div style={{ marginTop: 6, color: '#71717a', fontSize: 11 }}>{row.reminder_deliveries.map(delivery => `${delivery.status}${delivery.error_code ? ` (${delivery.error_code})` : ''}`).join(', ') || 'Нет устройств'}</div>
            {row.status === 'active' && <button type="button" style={{ ...button, marginTop: 9, padding: '8px 10px', background: '#27272a', color: '#fca5a5' }} disabled={busy} onClick={() => action(async () => { const { error } = await supabase.rpc('dayris_cancel_reminder', { p_id: row.id }); if (error) throw error; await refresh(); })}>Отменить</button>}
          </div>)}
        </section>}
      </aside>
    </div>
  );
}
