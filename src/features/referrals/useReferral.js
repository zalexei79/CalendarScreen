import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { getValidUserId } from '../../shared/lib/formatters';

const PENDING_REFERRAL_KEY = 'atj_pending_referral_code';
const REFERRAL_CODE_TIMEOUT_MS = 12000;

function withTimeout(promise, timeoutMs = REFERRAL_CODE_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((_, reject) => window.setTimeout(() => reject(new Error('REFERRAL_CODE_TIMEOUT')), timeoutMs)),
  ]);
}

function normalizeReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,32}$/.test(code) ? code : '';
}

function readReferralCookie() {
  try {
    const prefix = `${PENDING_REFERRAL_KEY}=`;
    const item = String(document.cookie || '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));

    if (!item) return '';
    return normalizeReferralCode(decodeURIComponent(item.slice(prefix.length)));
  } catch {
    return '';
  }
}

function readPendingReferral() {
  try {
    const local = normalizeReferralCode(window.localStorage.getItem(PENDING_REFERRAL_KEY));
    if (local) return local;
  } catch {
    // cookie fallback below
  }

  return readReferralCookie();
}

function clearPendingReferral() {
  try {
    window.localStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // ignore storage failures
  }

  try {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PENDING_REFERRAL_KEY}=; Max-Age=0; Path=/; SameSite=Lax${secure}`;
  } catch {
    // ignore cookie failures
  }
}

function isPermanentClaimError(error) {
  const message = String(error?.message || error || '').toUpperCase();
  return [
    'SELF_REFERRAL_NOT_ALLOWED',
    'REFERRAL_TOO_LATE',
    'REFERRAL_CODE_NOT_FOUND',
    'INVALID_REFERRAL_CODE',
  ].some((code) => message.includes(code));
}

/**
 * Reliable referral lifecycle:
 * - main.jsx saves ?ref=CODE to localStorage AND a same-origin cookie.
 * - The cookie survives Safari -> iPhone Home Screen installation.
 * - After login the saved code is claimed exactly once.
 * - The hook also exposes live referral progress for UI/notifications.
 */
export function useReferral({ user }) {
  const userId = getValidUserId(user);

  const [referralCode, setReferralCode] = useState('');
  const [referralCodeLoading, setReferralCodeLoading] = useState(Boolean(userId));
  const [referralCodeError, setReferralCodeError] = useState('');
  const [claimStatus, setClaimStatus] = useState('idle');

  const [invitedCount, setInvitedCount] = useState(0);
  const [rewardedCount, setRewardedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentInvites, setRecentInvites] = useState([]);
  const [myReferralStatus, setMyReferralStatus] = useState(null);
  const [myReferralRewardedAt, setMyReferralRewardedAt] = useState(null);
  const [statusLoading, setStatusLoading] = useState(Boolean(userId));

  const refreshReferralStatus = useCallback(async () => {
    if (!userId) {
      setInvitedCount(0);
      setRewardedCount(0);
      setPendingCount(0);
      setRecentInvites([]);
      setMyReferralStatus(null);
      setMyReferralRewardedAt(null);
      setStatusLoading(false);
      return;
    }

    setStatusLoading(true);

    const [outgoingResult, incomingResult] = await Promise.all([
      supabase
        .from('referrals')
        .select('id,status,created_at,qualified_at,rewarded_at')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false }),

      supabase
        .from('referrals')
        .select('id,status,created_at,qualified_at,rewarded_at')
        .eq('referred_id', userId)
        .maybeSingle(),
    ]);

    if (!outgoingResult.error) {
      const outgoing = outgoingResult.data || [];
      setInvitedCount(outgoing.length);
      setRewardedCount(outgoing.filter((item) => item.status === 'rewarded').length);
      setPendingCount(outgoing.filter((item) => item.status === 'pending' || item.status === 'qualified').length);
      setRecentInvites(outgoing.slice(0, 20));
    } else {
      console.warn('[referral] outgoing status failed:', outgoingResult.error.message);
    }

    if (!incomingResult.error) {
      setMyReferralStatus(incomingResult.data?.status || null);
      setMyReferralRewardedAt(incomingResult.data?.rewarded_at || null);
    } else {
      console.warn('[referral] incoming status failed:', incomingResult.error.message);
    }

    setStatusLoading(false);
  }, [userId]);

  const ensureReferralCode = useCallback(async () => {
    if (!userId) {
      setReferralCode('');
      setReferralCodeLoading(false);
      return '';
    }

    setReferralCodeLoading(true);
    setReferralCodeError('');

    try {
      const { error: refreshError } = await withTimeout(supabase.auth.refreshSession());
      if (refreshError) throw refreshError;

      const { data, error } = await withTimeout(
        supabase.from('referral_profiles').select('referral_code').eq('user_id', userId).maybeSingle()
      );
      if (error) throw error;

      const code = normalizeReferralCode(data?.referral_code);

      if (!code) throw new Error('REFERRAL_PROFILE_MISSING');
      setReferralCode(code);
      return code;
    } catch (error) {
      console.warn('[referral] failed to prepare referral code:', error?.message || error);
      setReferralCodeError(error?.message || 'REFERRAL_CODE_FAILED');
      return '';
    } finally {
      setReferralCodeLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    ensureReferralCode();
  }, [ensureReferralCode]);

  useEffect(() => {
    let cancelled = false;

    async function claimPendingReferral() {
      if (!userId) return;

      const code = readPendingReferral();
      if (!code) {
        await refreshReferralStatus();
        return;
      }

      setClaimStatus('claiming');

      const { data, error } = await supabase.rpc('claim_referral', { code });

      if (cancelled) return;

      if (!error) {
        clearPendingReferral();
        setClaimStatus(data?.already_claimed ? 'already_claimed' : 'claimed');
        await refreshReferralStatus();
        return;
      }

      if (isPermanentClaimError(error)) {
        clearPendingReferral();
        setClaimStatus('rejected');
        console.info('[referral] referral was not claimable:', error.message);
        await refreshReferralStatus();
        return;
      }

      // Network/transient errors keep BOTH storage copies for the next launch.
      setClaimStatus('retry');
      console.warn('[referral] claim deferred:', error.message);
      await refreshReferralStatus();
    }

    claimPendingReferral();
    return () => { cancelled = true; };
  }, [userId, refreshReferralStatus]);

  useEffect(() => {
    if (!userId) return undefined;

    const refresh = () => { refreshReferralStatus(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    // Fast enough to make referral progress/rewards feel live without Realtime setup.
    const timer = window.setInterval(refresh, 30000);

    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [userId, refreshReferralStatus]);

  return {
    referralCode,
    referralCodeLoading,
    referralCodeError,
    ensureReferralCode,
    claimStatus,

    invitedCount,
    rewardedCount,
    pendingCount,
    recentInvites,

    myReferralStatus,
    myReferralRewardedAt,

    statusLoading,
    refreshReferralStatus,
  };
}
