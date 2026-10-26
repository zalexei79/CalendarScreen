import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { readAndUpdateActivityStreak } from './activityStreak.js';
import { readAccountStreakCache, syncAccountActivityStreak } from './accountActivityStreak.js';

export default function useAccountActivityStreak(ownerId) {
  const owner = ownerId || 'guest';
  const [state, setState] = useState({ owner: '', streak: null, status: 'loading' });
  const refreshRef = useRef(() => {});
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let repeat = false;
    let controller;
    let storage;
    try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
    const cached = ownerId ? readAccountStreakCache(storage, ownerId) : null;
    setState({ owner, streak: cached, status: ownerId ? 'loading' : 'ready' });
    async function refresh() {
      if (disposed) return;
      if (pending) { repeat = true; return; }
      if (!ownerId) {
        const next = { ...readAndUpdateActivityStreak(storage, 'dayris_activity_streak:guest'), ownerId: 'guest' };
        setState({ owner, streak: next, status: 'ready' });
        return;
      }
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const next = await syncAccountActivityStreak({ client: supabase, storage, ownerId, signal: controller.signal });
        if (!disposed) setState(previous => ({ owner,
          streak: previous.owner === owner && JSON.stringify(previous.streak) === JSON.stringify(next) ? previous.streak : next,
          status: 'ready' }));
      } catch {
        if (!disposed) setState(previous => ({ owner, streak: previous.owner === owner ? previous.streak : null, status: 'offline' }));
      } finally {
        window.clearTimeout(timeout);
        pending = false;
        if (repeat && !disposed) { repeat = false; queueMicrotask(refresh); }
      }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    refreshRef.current = refresh;
    refresh();
    const channel = ownerId ? supabase.channel(`account-streak:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_activity_streaks', filter: `user_id=eq.${ownerId}` }, refreshVisible)
      .subscribe(status => { if (status === 'SUBSCRIBED') refreshVisible(); }) : null;
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refreshVisible, 60000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      document.removeEventListener('visibilitychange', refreshVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [ownerId, owner]);
  return { streak: state.owner === owner ? state.streak : null,
    status: state.owner === owner ? state.status : 'loading', refresh: () => refreshRef.current() };
}
