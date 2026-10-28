import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabaseClient.js';
import { entryStreakState, ENTRY_SAVED_EVENT } from './entryActivityStreak.js';
import { readAccountStreakCache, syncAccountActivityStreak } from './accountActivityStreak.js';

export default function useAccountActivityStreak(ownerId) {
  const owner = ownerId || 'guest';
  const [state, setState] = useState({ owner: '', streak: null, status: 'loading' });
  const [celebration, setCelebration] = useState(null);
  const refreshRef = useRef(() => {});
  useEffect(() => {
    setCelebration(null);
    let disposed = false;
    let pending = false;
    let repeat = false;
    let controller;
    let initialized = false;
    let seenEntry = null;
    let seenCount = 0;
    let guestState = null;
    let storage;
    try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => {} }; }
    const cached = ownerId ? readAccountStreakCache(storage, ownerId) : null;
    setState({ owner, streak: cached, status: ownerId ? 'loading' : 'ready' });
    function accept(next) {
      if (initialized && next.completedToday && next.entryDate !== seenEntry) {
        setCelebration({ owner, day: next.entryDate, started: seenCount === 0 });
      }
      initialized = true;
      seenEntry = next.entryDate;
      seenCount = next.currentStreak;
      if (!ownerId) guestState = next;
      setState(previous => ({ owner,
        streak: previous.owner === owner && JSON.stringify(previous.streak) === JSON.stringify(next) ? previous.streak : next,
        status: 'ready' }));
    }
    async function refresh() {
      if (disposed) return;
      if (pending) { repeat = true; return; }
      if (!ownerId) {
        let previous = guestState;
        try { previous = JSON.parse(storage.getItem('dayris_activity_streak:guest')) || guestState; } catch { /* unavailable cache */ }
        accept({ ...entryStreakState(previous), ownerId: 'guest' });
        return;
      }
      pending = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const next = await syncAccountActivityStreak({ client: supabase, storage, ownerId, signal: controller.signal });
        if (!disposed) accept(next);
      } catch {
        if (!disposed) setState(previous => ({ owner, streak: previous.owner === owner ? previous.streak : null, status: 'offline' }));
      } finally {
        window.clearTimeout(timeout);
        pending = false;
        if (repeat && !disposed) { repeat = false; queueMicrotask(refresh); }
      }
    }
    const refreshVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const entrySaved = event => {
      if (event.detail?.ownerId !== owner) return;
      if (!ownerId) {
        let previous = guestState;
        try { previous = JSON.parse(storage.getItem('dayris_activity_streak:guest')) || guestState; } catch { /* unavailable cache */ }
        const next = entryStreakState(previous, undefined, true);
        try { storage.setItem('dayris_activity_streak:guest', JSON.stringify(next)); } catch { /* private mode */ }
        accept({ ...next, ownerId: 'guest' });
      } else refresh();
    };
    refreshRef.current = refresh;
    refresh();
    const channel = ownerId ? supabase.channel(`account-streak:${ownerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'account_activity_streaks', filter: `user_id=eq.${ownerId}` }, refreshVisible)
      .subscribe(status => { if (status === 'SUBSCRIBED') refreshVisible(); }) : null;
    window.addEventListener('focus', refreshVisible);
    window.addEventListener('online', refreshVisible);
    window.addEventListener(ENTRY_SAVED_EVENT, entrySaved);
    document.addEventListener('visibilitychange', refreshVisible);
    const timer = window.setInterval(refreshVisible, 60000);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshVisible);
      window.removeEventListener('online', refreshVisible);
      window.removeEventListener(ENTRY_SAVED_EVENT, entrySaved);
      document.removeEventListener('visibilitychange', refreshVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [ownerId, owner]);
  useEffect(() => {
    if (!celebration) return;
    const timer = window.setTimeout(() => setCelebration(null), 2600);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  return { streak: state.owner === owner ? state.streak : null,
    status: state.owner === owner ? state.status : 'loading', refresh: () => refreshRef.current(),
    celebration: celebration?.owner === owner ? celebration : null };
}
