import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [status, setStatus] = useState({ userId, active: false, until: null, loading: Boolean(userId) });
  const currentUser = useRef(userId);
  currentUser.current = userId;
  const pending = useRef(null);
  // Never expose the previous account's entitlement, even before effects run.
  const ownStatus = status.userId === userId ? status : { active: false, until: null, loading: Boolean(userId) };
  const { active, until, loading } = ownStatus;

  const refresh = useCallback(() => {
    if (!userId) {
      setStatus({ userId, active: false, until: null, loading: false });
      return Promise.resolve(false);
    }
    if (pending.current?.userId === userId) return pending.current.promise;
    const request = { userId, promise: null };
    pending.current = request;
    request.promise = (async () => {
      try {
        const { data, error } = await supabase.rpc('get_my_pro_status');
        if (error) throw error;
        if (currentUser.current !== userId || pending.current !== request) return false;
        const expires = data?.until ? Date.parse(data.until) : null;
        const isActive = data?.active === true && (expires === null || expires > Date.now());
        setStatus({ userId, active: isActive, until: isActive ? data?.until || null : null, loading: false });
        return isActive;
      } catch (error) {
        console.warn('[pro] status refresh failed:', error?.message);
        if (currentUser.current !== userId || pending.current !== request) return false;
        // A transport failure is not a server revocation. Preserve the last
        // confirmed access until its expiry; backend PRO checks remain in force.
        setStatus(previous => {
          if (previous.userId !== userId) return { userId, active: false, until: null, loading: false };
          const expired = previous.until && !(Date.parse(previous.until) > Date.now());
          return { ...previous, active: previous.active && !expired, loading: false };
        });
        return false;
      } finally {
        if (pending.current === request) pending.current = null;
      }
    })();
    return request.promise;
  }, [userId]);

  useEffect(() => {
    refresh();
    return () => { pending.current = null; };
  }, [refresh]);

  useEffect(() => {
    if (!active || !until) return undefined;
    let timer;
    const expire = () => {
      const remaining = Date.parse(until) - Date.now();
      if (remaining > 0) timer = window.setTimeout(expire, Math.min(remaining, 2147483647));
      else setStatus(previous => previous.userId === userId && previous.until === until
        ? { ...previous, active: false } : previous);
    };
    expire();
    return () => window.clearTimeout(timer);
  }, [active, until, userId]);

  useEffect(() => {
    if (!userId) return undefined;

    const onFocus = () => refresh();
    const onOnline = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('dayris:pro-refresh', onFocus);
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    // If an inviter keeps the PWA open while a friend completes their first
    // entry, refresh quietly so the reward appears without a manual reload.
    const timer = window.setInterval(refresh, 120000);

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('dayris:pro-refresh', onFocus);
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
