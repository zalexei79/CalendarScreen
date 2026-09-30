import React, { useEffect, useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '../../supabaseClient';

export default function ProGrantNotice({ userId, active, until, language = 'ru', isLight }) {
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const acknowledged = useRef(new Set());
  useEffect(() => {
    setNotice(null);
    setError(false);
    if (!userId || !active) return undefined;
    let live = true;
    let busy = false;
    async function refresh() {
      if (busy || document.visibilityState === 'hidden') return;
      busy = true;
      try {
        const { data, error: fetchError } = await supabase.rpc('dayris_get_pro_notifications');
        if (live && !fetchError) {
          const unread = (data || []).filter(n => !acknowledged.current.has(n.id));
          setNotice(unread.length ? { owner: userId, ids: unread.map(n => n.id) } : null);
        }
      } catch { /* Retry on focus or the next poll after a network interruption. */ }
      finally { busy = false; }
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [userId, active, until]);

  const days = Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86400000));
  if (!active || !notice || notice.owner !== userId || !Number.isFinite(days) || days <= 0) return null;
  const copy = language === 'en'
    ? ['Congratulations! PRO is active', 'Days remaining', 'Thank you!', 'Could not save. Please try again.']
    : language === 'md'
      ? ['Felicitări! PRO este activ', 'Zile rămase', 'Mulțumesc!', 'Nu s-a putut salva. Încearcă din nou.']
      : ['Поздравляем! У вас PRO', 'Осталось дней', 'Спасибо!', 'Не удалось сохранить. Попробуйте ещё раз.'];
  async function dismiss() {
    if (saving) return;
    setSaving(true);
    setError(false);
    try {
      const { error: ackError } = await supabase.rpc('dayris_ack_pro_notifications', { p_ids: notice.ids });
      if (ackError) setError(true);
      else {
        notice.ids.forEach(id => acknowledged.current.add(id));
        setNotice(current => {
          if (current?.owner !== notice.owner) return current;
          const ids = current.ids.filter(id => !acknowledged.current.has(id));
          return ids.length ? { ...current, ids } : null;
        });
      }
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  return (
    <aside role="status" aria-live="polite" className={`fixed bottom-24 left-4 right-4 z-[200] mx-auto max-w-sm rounded-3xl border p-5 shadow-2xl ${isLight ? 'border-amber-200 bg-white text-zinc-900' : 'border-amber-400/30 bg-zinc-900 text-white'}`}>
      <div className="flex items-center gap-3"><Gift className="shrink-0 text-amber-500" size={26} /><h2 className="text-lg font-semibold">{copy[0]}</h2></div>
      <p className="mt-3 text-sm">{copy[1]}: <strong className="text-amber-500">{days}</strong></p>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{copy[3]}</p>}
      <button type="button" disabled={saving} onClick={dismiss} className="mt-4 w-full rounded-xl bg-amber-400 px-4 py-3 font-semibold text-zinc-950 disabled:opacity-50">{copy[2]}</button>
    </aside>
  );
}
