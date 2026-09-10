import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient';

const TAGS = ['plan', 'rushed', 'tired', 'broke_rules'];
const COPY = {
  ru: ['Как торговалось?', 'По плану', 'Спешил', 'Устал', 'Нарушил правила', 'Что получилось? Что хочется сделать иначе?', 'Сохранить', 'Сохраняю…', 'Сохранено', 'Войдите, чтобы сохранять заметки между устройствами.', 'Войти', 'Не удалось загрузить заметку. Попробуйте ещё раз.', 'Повторить', 'Не удалось сохранить. Текст остаётся здесь — проверьте интернет и повторите.', 'Загрузка…', 'Есть несохранённые изменения', 'Личная заметка ко всему дню, независимо от счёта и фильтров.'],
  en: ['How did trading go?', 'Followed plan', 'Rushed', 'Tired', 'Broke rules', 'What worked? What would you do differently?', 'Save', 'Saving…', 'Saved', 'Sign in to keep your notes across devices.', 'Sign in', 'Could not load your note. Please try again.', 'Retry', 'Could not save. Your text is still here — check your connection and retry.', 'Loading…', 'Unsaved changes', 'A personal note for the whole day, independent of account and filters.'],
  md: ['Cum ai tranzacționat?', 'După plan', 'M-am grăbit', 'Obosit', 'Am încălcat regulile', 'Ce a mers bine? Ce ai face diferit?', 'Salvează', 'Se salvează…', 'Salvat', 'Autentifică-te pentru a păstra notițele pe toate dispozitivele.', 'Autentificare', 'Notița nu a putut fi încărcată. Încearcă din nou.', 'Reîncearcă', 'Salvarea a eșuat. Textul rămâne aici — verifică conexiunea și reîncearcă.', 'Se încarcă…', 'Modificări nesalvate', 'O notiță personală pentru întreaga zi, independentă de cont și filtre.'],
};

export default function DayNote({ userId, dateKey, isLight, language, onLogin }) {
  const c = COPY[language === 'ro' ? 'md' : language] || COPY.en;
  const [note, setNote] = useState('');
  const [tags, setTags] = useState([]);
  const [state, setState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const alive = useRef(false);
  const busy = useRef(false);
  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    if (userId) {
      setState('loading');
      (async () => {
        try {
          const { data, error } = await supabase.from('trading_day_notes').select('note,tags').eq('user_id', userId).eq('date_key', dateKey).maybeSingle();
          if (cancelled) return;
          if (error) throw error;
          setNote(data?.note || '');
          setTags((data?.tags || []).filter(t => TAGS.includes(t)));
          setState('ready');
        } catch { if (!cancelled) setState('load-error'); }
      })();
    }
    return () => { cancelled = true; alive.current = false; };
  }, [userId, dateKey, retry]);

  async function save() {
    if (busy.current || !userId) return;
    busy.current = true;
    setState('saving');
    try {
      const { error } = await supabase.from('trading_day_notes').upsert({ user_id: userId, date_key: dateKey, note, tags }, { onConflict: 'user_id,date_key' });
      if (error) throw error;
      if (alive.current) setState('saved');
    } catch { if (alive.current) setState('save-error'); }
    finally { busy.current = false; }
  }
  const disabled = state === 'saving';
  return <section className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900/40'}`}>
    <h3 className="text-sm font-semibold">{c[0]}</h3>
    {!userId ? <><p className="mt-2 text-xs opacity-60">{c[9]}</p><button onClick={onLogin} className="mt-3 text-sm text-amber-600">{c[10]}</button></>
      : state === 'loading' ? <p role="status" className="mt-3 text-xs opacity-60">{c[14]}</p>
      : state === 'load-error' ? <><p role="status" className="mt-3 text-xs opacity-70">{c[11]}</p><button onClick={() => setRetry(v => v + 1)} className="mt-2 min-h-10 text-sm text-amber-600">{c[12]}</button></>
      : <>
        <div className="mt-3 flex flex-wrap gap-2">{TAGS.map((tag, i) => <button key={tag} type="button" disabled={disabled} aria-pressed={tags.includes(tag)} onClick={() => { setTags(previous => previous.includes(tag) ? previous.filter(t => t !== tag) : [...previous, tag]); setState('dirty'); }} className={`min-h-10 rounded-xl border px-3 py-2 text-xs transition-colors disabled:opacity-50 ${tags.includes(tag) ? 'border-amber-400/50 bg-amber-400/10 text-amber-600' : isLight ? 'border-zinc-200 text-zinc-600' : 'border-zinc-700 text-zinc-400'}`}>{c[i + 1]}</button>)}</div>
        <textarea aria-label={c[0]} placeholder={c[5]} value={note} maxLength={2000} rows={3} disabled={disabled} onChange={e => { setNote(e.target.value); setState('dirty'); }} className={`mt-3 w-full resize-y rounded-xl border p-3 text-sm outline-none focus:border-amber-400/60 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950'}`} />
        <div className="mt-2 flex items-center justify-between gap-3"><span role="status" className="text-xs opacity-60">{state === 'saved' ? c[8] : state === 'dirty' ? c[15] : `${note.length}/2000`}</span><button type="button" onClick={save} disabled={disabled || state === 'ready' || state === 'saved'} className="min-h-10 shrink-0 rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-40">{disabled ? c[7] : c[6]}</button></div>
        {state === 'save-error' && <p role="alert" className="mt-2 text-xs text-amber-600">{c[13]}</p>}
        <p className="mt-3 text-[10px] leading-relaxed opacity-50">{c[16]}</p>
      </>}
  </section>;
}
