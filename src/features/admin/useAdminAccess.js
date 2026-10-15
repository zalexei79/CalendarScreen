import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';

export default function useAdminAccess(userId) {
  const [result, setResult] = useState({ userId: null, allowed: false });
  useEffect(() => {
    if (!userId) { setResult({ userId: null, allowed: false }); return; }
    let active = true;
    let revision = 0;
    async function refresh() {
      const request = ++revision;
      try {
        const { data, error } = await supabase.rpc('is_site_admin');
        if (active && request === revision) setResult({ userId, allowed: !error && data === true });
      } catch {
        if (active && request === revision) setResult({ userId, allowed: false });
      }
    }
    const focus = () => { if (!document.hidden) refresh(); };
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      setResult({ userId, allowed: false });
      if (session?.user?.id !== userId) return;
      // Auth callbacks must not await queries while the SDK holds its lock.
      queueMicrotask(() => { if (active) refresh(); });
    });
    refresh();
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => {
      active = false;
      revision++;
      listener.subscription.unsubscribe();
      window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', focus);
    };
  }, [userId]);
  // Never show the previous owner's link during sign-out or an account switch.
  return Boolean(userId && result.userId === userId && result.allowed);
}
