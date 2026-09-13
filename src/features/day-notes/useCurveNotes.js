import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export function useCurveNotes(userId, from, to) {
  const [result, setResult] = useState({ key: '', notes: {}, state: 'idle' });
  const key = `${userId || ''}:${from || ''}:${to || ''}`;
  useEffect(() => {
    let cancelled = false;
    if (!userId || !from || !to) return;
    setResult({ key, notes: {}, state: 'loading' });
    (async () => {
      try {
        const notes = {};
        for (let offset = 0; ; offset += 500) {
          const { data, error } = await supabase.from('trading_day_notes')
            .select('date_key,note,tags').eq('user_id', userId)
            .gte('date_key', from).lte('date_key', to)
            .order('date_key').range(offset, offset + 499);
          if (cancelled) return;
          if (error) throw error;
          for (const entry of data || []) {
            if (entry.note?.trim() || entry.tags?.length) notes[entry.date_key] = entry;
          }
          if (!data || data.length < 500) break;
        }
        setResult({ key, notes, state: 'ready' });
      } catch { if (!cancelled) setResult({ key, notes: {}, state: 'error' }); }
    })();
    return () => { cancelled = true; };
  }, [userId, from, to, key]);
  return result.key === key ? result : { notes: {}, state: userId && from && to ? 'loading' : 'idle' };
}
