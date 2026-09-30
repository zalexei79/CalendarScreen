import React, { useEffect, useRef, useState } from 'react';
import { Gift } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import './ProGrantNotice.css';

function yearsLabel(days, language) {
  if (days <= 365) return '';
  const years = Math.round(days / 365.25 * 10) / 10;
  const locale = language === 'en' ? 'en-US' : language === 'md' ? 'ro-RO' : 'ru-RU';
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(years);
  if (language === 'en') return `${number} ${years === 1 ? 'year' : 'years'}`;
  if (language === 'md') return `${number} ${years === 1 ? 'an' : 'ani'}`;
  const plural = new Intl.PluralRules('ru').select(years);
  return `${number} ${{ one: 'год', few: 'года', many: 'лет', other: 'года' }[plural]}`;
}

export default function ProGrantNotice({ userId, active, until, language = 'ru', isLight }) {
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const acknowledged = useRef(new Set());
  const confirmButton = useRef(null);
  const visible = active && notice?.owner === userId && Number.isFinite(new Date(until).getTime()) && new Date(until).getTime() > Date.now();
  useEffect(() => {
    if (!visible) return undefined;
    const previous = document.activeElement;
    confirmButton.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function keepFocus(event) {
      if (event.key === 'Tab') { event.preventDefault(); confirmButton.current?.focus(); }
    }
    document.addEventListener('keydown', keepFocus);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', keepFocus);
      if (previous?.isConnected) previous.focus?.();
    };
  }, [visible]);
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
    <div className={`pro-celebration ${isLight ? 'pro-celebration-light' : ''}`}>
      <div className="pro-celebration-confetti" aria-hidden="true">
        {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--x': `${(i * 37 + 9) % 100}%`, '--delay': `${(i % 12) * 0.09}s`, '--drift': `${((i * 29) % 180) - 90}px`, '--spin': `${(i % 2 ? 1 : -1) * (360 + i * 17)}deg`, '--color': ['#fbbf24', '#fef3c7', '#34d399', '#f59e0b', '#a78bfa'][i % 5] }} />)}
      </div>
      <section role="dialog" aria-modal="true" aria-labelledby="pro-celebration-title" aria-describedby="pro-celebration-days" className="pro-celebration-card">
      <div className="pro-celebration-gift" aria-hidden="true"><Gift size={40} strokeWidth={1.5} /></div>
      <span className="pro-celebration-badge">DAYRIS PRO</span>
      <h2 id="pro-celebration-title">{copy[0]}</h2>
      <p id="pro-celebration-days" className="pro-celebration-duration">{copy[1]}: <strong>{days}</strong>{days > 365 && <span className="pro-celebration-years"> ({yearsLabel(days, language)})</span>}</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-500">{copy[3]}</p>}
      <button ref={confirmButton} type="button" aria-disabled={saving} onClick={dismiss} className="pro-celebration-confirm">{copy[2]}</button>
      </section>
    </div>
  );
}
