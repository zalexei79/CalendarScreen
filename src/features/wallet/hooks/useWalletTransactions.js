import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { getValidUserId } from '../../../shared/lib/formatters';

const CACHE_PREFIX = 'dayris_wallet_';

function cacheKey(userId) { return `${CACHE_PREFIX}${userId || 'guest'}`; }
function normalize(row) {
  return {
    id: row.id,
    dateKey: row.date_key,
    time: row.time || '00:00',
    title: row.title || '',
    amount: Number(row.amount) || 0,
    kind: row.kind === 'expense' ? 'expense' : 'income',
    currency: /^[A-Z]{3}$/.test(String(row.currency || '').toUpperCase()) ? String(row.currency).toUpperCase() : 'USD',
    comment: row.comment || '',
  };
}

function payload(item, userId) {
  return { user_id: userId, date_key: item.dateKey, time: item.time || '00:00', title: String(item.title || '').trim(), amount: Number(item.amount), kind: item.kind, currency: String(item.currency || 'USD').toUpperCase(), comment: item.comment || '' };
}

export function useWalletTransactions({ user }) {
  const userId = getValidUserId(user);
  const owner = userId || 'guest';
  const [transactions, setTransactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cacheKey(owner)) || '[]') || []; } catch { return []; }
  });
  const [loading, setLoading] = useState(Boolean(userId));
  const [ready, setReady] = useState(!userId);
  const [error, setError] = useState('');
  const [transfers, setTransfers] = useState([]);
  const refreshVersion = useRef(0);

  const cache = useCallback((next) => {
    try { localStorage.setItem(cacheKey(owner), JSON.stringify(next)); } catch { /* guest cache is best effort */ }
  }, [owner]);

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); setReady(true); return []; }
    const version = ++refreshVersion.current;
    setLoading(true);
    const [{ data, error: queryError }, { data: transferRows, error: transferError }] = await Promise.all([
      supabase.from('wallet_transactions').select('*').eq('user_id', userId).order('date_key', { ascending: false }).order('time', { ascending: false }),
      supabase.from('wallet_transfers').select('*').eq('user_id', userId).order('date_key', { ascending: false }),
    ]);
    if (version !== refreshVersion.current) return [];
    setLoading(false);
    if (queryError || transferError) {
      setReady(false);
      setError(queryError.code === 'PGRST205' ? 'WALLET_MIGRATION_REQUIRED' : (queryError.message || 'WALLET_LOAD_FAILED'));
      return [];
    }
    const next = (data || []).map(normalize);
    setTransactions(next); setTransfers(transferRows || []); cache(next); setError(''); setReady(true); return next;
  }, [userId, cache]);

  useEffect(() => {
    setReady(!userId);
    try { setTransactions(JSON.parse(localStorage.getItem(cacheKey(owner)) || '[]') || []); } catch { setTransactions([]); }
    refresh().catch(() => {});
  }, [owner, refresh]);

  useEffect(() => {
    if (!userId) return undefined;
    const refreshOnChange = () => { refresh(); };
    const channel = supabase.channel(`wallet-sync-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${userId}` }, refreshOnChange).subscribe();
    window.addEventListener('focus', refreshOnChange);
    window.addEventListener('online', refreshOnChange);
    return () => { window.removeEventListener('focus', refreshOnChange); window.removeEventListener('online', refreshOnChange); supabase.removeChannel(channel); };
  }, [userId, refresh]);

  const saveTransaction = useCallback(async (item) => {
    const local = { ...item, id: item.id || `wallet-local-${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const next = item.id ? transactions.map((row) => row.id === item.id ? local : row) : [local, ...transactions];
    setTransactions(next); cache(next);
    if (!userId) return local;
    const result = item.id
      ? await supabase.from('wallet_transactions').update(payload(local, userId)).eq('id', item.id).eq('user_id', userId).select().single()
      : await supabase.from('wallet_transactions').insert(payload(local, userId)).select().single();
    if (result.error) { await refresh(); throw result.error; }
    await refresh(); return normalize(result.data);
  }, [transactions, userId, cache, refresh]);

  const deleteTransaction = useCallback(async (id) => {
    const next = transactions.filter((row) => row.id !== id); setTransactions(next); cache(next);
    if (!userId || String(id).startsWith('wallet-local-')) return;
    const { error: deleteError } = await supabase.from('wallet_transactions').delete().eq('id', id).eq('user_id', userId);
    if (deleteError) { await refresh(); throw deleteError; }
  }, [transactions, userId, cache, refresh]);

  const createTransfer = useCallback(async ({ amount, currency, fromAccount, toAccount, dateKey, comment = '' }) => {
    if (!userId) throw new Error('AUTH_REQUIRED');
    const { error: transferError } = await supabase.from('wallet_transfers').insert({ user_id: userId, amount: Number(amount), currency, from_account: fromAccount, to_account: toAccount, date_key: dateKey, comment });
    if (transferError) { setError(transferError.code === 'PGRST205' ? 'WALLET_TRANSFERS_MIGRATION_REQUIRED' : (transferError.message || 'WALLET_TRANSFER_FAILED')); throw transferError; }
    await refresh();
  }, [userId, refresh]);

  const balanceByCurrency = useMemo(() => {
    const result = transactions.reduce((output, item) => {
      const code = item.currency || 'USD';
      output[code] = (output[code] || 0) + (item.kind === 'expense' ? -item.amount : item.amount);
      return output;
    }, {});
    for (const transfer of transfers) {
      const code = transfer.currency || 'USD';
      const amount = Number(transfer.amount || 0);
      if (transfer.to_account === 'wallet') result[code] = (result[code] || 0) + amount;
      if (transfer.from_account === 'wallet') result[code] = (result[code] || 0) - amount;
    }
    return result;
  }, [transactions, transfers]);

  return { transactions, transfers, balanceByCurrency, loading: loading || !ready, error, refresh, saveTransaction, deleteTransaction, createTransfer };
}
