import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { getValidUserId } from '../../shared/lib/formatters';

/**
 * Server-backed PRO entitlement.
 *
 * localStorage is deliberately not consulted here. Supabase is the source of
 * truth, so changing browser storage cannot unlock PRO.
 */
export function useProAccess({ user }) {
  const userId = getValidUserId(user);
  const [active, setActive] = useState(false);
  const [until, setUntil] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId));

  const refresh = useCallback(async () => {
    if (!userId) {
      setActive(false);
      setUntil(null);
      setLoading(false);
      return false;
    }

    setLoading(true);

    const { data, error } = await supabase.rpc('get_my_pro_status');

    if (error) {
      console.warn('[pro] status refresh failed:', error.message);
      setActive(false);
      setUntil(null);
      setLoading(false);
      return false;
    }

    const isActive = data?.active === true;
    setActive(isActive);
    setUntil(isActive && data?.until ? data.until : null);
    setLoading(false);
    return isActive;
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!userId) return undefined;

    const onFocus = () => refresh();
    const onOnline = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    // If an inviter keeps the PWA open while a friend completes their first
    // entry, refresh quietly so the reward appears without a manual reload.
    const timer = window.setInterval(refresh, 120000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [userId, refresh]);

  return {
    active,
    until,
    loading,
    refresh,
  };
}
