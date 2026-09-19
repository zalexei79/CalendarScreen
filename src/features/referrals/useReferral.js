import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import { getValidUserId } from '../../shared/lib/formatters';

const PENDING_REFERRAL_KEY = 'atj_pending_referral_code';

function normalizeReferralCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,32}$/.test(code) ? code : '';
}

function readPendingReferral() {
  try {
    return normalizeReferralCode(window.localStorage.getItem(PENDING_REFERRAL_KEY));
  } catch {
    return '';
  }
}

function clearPendingReferral() {
  try {
    window.localStorage.removeItem(PENDING_REFERRAL_KEY);
  } catch {
    // ignore storage failures
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
 * Referral flow:
 * 1) src/main.jsx stores ?ref=CODE immediately.
 * 2) Google OAuth may leave the site and come back.
 * 3) Once Supabase restores the user, this hook claims the saved code.
 * 4) Supabase trigger rewards the inviter only after the referred user
 *    creates their first real trade/entry.
 */
export function useReferral({ user }) {
  const userId = getValidUserId(user);
  const [referralCode, setReferralCode] = useState('');
  const [claimStatus, setClaimStatus] = useState('idle');

  useEffect(() => {
    let cancelled = false;

    async function loadOwnCode() {
      if (!userId) {
        setReferralCode('');
        return;
      }

      const { data, error } = await supabase
        .from('referral_profiles')
        .select('referral_code')
        .eq('user_id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('[referral] failed to load referral code:', error.message);
        return;
      }

      setReferralCode(normalizeReferralCode(data?.referral_code));
    }

    loadOwnCode();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function claimPendingReferral() {
      if (!userId) return;

      const code = readPendingReferral();
      if (!code) return;

      setClaimStatus('claiming');

      const { data, error } = await supabase.rpc('claim_referral', { code });

      if (cancelled) return;

      if (!error) {
        clearPendingReferral();
        setClaimStatus(data?.already_claimed ? 'already_claimed' : 'claimed');
        return;
      }

      if (isPermanentClaimError(error)) {
        clearPendingReferral();
        setClaimStatus('rejected');
        console.info('[referral] referral was not claimable:', error.message);
        return;
      }

      // Network/transient errors keep the code for the next app launch.
      setClaimStatus('retry');
      console.warn('[referral] claim deferred:', error.message);
    }

    claimPendingReferral();
    return () => { cancelled = true; };
  }, [userId]);

  return {
    referralCode,
    claimStatus,
  };
}
