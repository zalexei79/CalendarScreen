import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { getValidUserId } from '../../../shared/lib/formatters';
import { getTradesCacheKey } from '../../../shared/config/constants';
import { fromSupabaseTradeRow, toSupabaseTradePayload, toSupabaseTradeUpdates } from '../lib/tradeMapper';
import { isRetryableNetworkError, useOfflineQueue } from './useOfflineQueue';

function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'USD';
}

function isTemporaryId(id) {
  const value = String(id || '');
  return value.startsWith('local-') || value.startsWith('guest-') || value.startsWith('offline-');
}

function groupRows(rows) {
  const grouped = {};
  for (const row of rows || []) {
    const trade = fromSupabaseTradeRow(row);
    const dateKey = row.date_key;
    if (!dateKey) continue;
    (grouped[dateKey] ||= []).push(trade);
  }
  return grouped;
}

/**
 * Local-first trade store with cloud reconciliation.
 * Cloud rows are authoritative for confirmed records; only unsynced temporary
 * records are preserved locally during a refresh. This prevents stale caches on
 * another device from resurrecting edited/deleted cloud records.
 */
export function useTrades({ user }) {
  const [manualTrades, setManualTrades] = useState({});
  const manualTradesRef = useRef({});
  const tradesCacheOwnerRef = useRef('__loading__');
  const [loadedOwner, setLoadedOwner] = useState(null);
  const refreshVersion = useRef(0);
  const cloudUserId = getValidUserId(user);
  const owner = cloudUserId || 'guest';
  const currentOwnerRef = useRef(owner);
  currentOwnerRef.current = owner;

  const readCachedTrades = useCallback((userId) => {
    try {
      const raw = window.localStorage.getItem(getTradesCacheKey(userId));
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }, []);

  const cacheTradesLocally = useCallback((trades, userId) => {
    try { window.localStorage.setItem(getTradesCacheKey(userId), JSON.stringify(trades)); } catch { /* ignore */ }
  }, []);

  const handleSyncedInsert = useCallback((dateKey, tempId, realId) => {
    setManualTrades((prev) => {
      const next = {
        ...prev,
        [dateKey]: (prev[dateKey] || []).map((t) => String(t.id) === String(tempId) ? { ...t, id: realId, pending: false } : t),
      };
      manualTradesRef.current = next;
      return next;
    });
  }, []);

  const { pendingSyncCount, enqueueOperation, amendPendingInsert, flushOfflineQueue } = useOfflineQueue({ user, onSyncedInsert: handleSyncedInsert });

  const reconcileCloudRows = useCallback((rows) => {
    const cloud = groupRows(rows);
    setManualTrades((prev) => {
      if (currentOwnerRef.current !== cloudUserId) return prev;
      const next = { ...cloud };
      // Preserve only records that do not exist on the server yet.
      for (const [dateKey, list] of Object.entries(prev || {})) {
        for (const trade of list || []) {
          if (isTemporaryId(trade.id)) (next[dateKey] ||= []).push(trade);
        }
      }
      manualTradesRef.current = next;
      cacheTradesLocally(next, cloudUserId);
      return next;
    });
  }, [cacheTradesLocally, cloudUserId]);

  const refreshFromCloud = useCallback(async () => {
    if (!cloudUserId || !navigator.onLine) return false;
    const version = ++refreshVersion.current;
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from('trades').select('*').eq('user_id', cloudUserId)
        .order('id').range(offset, offset + 999);
      if (error) {
        console.warn('[trades] cloud refresh failed:', error.message);
        return false;
      }
      rows.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    if (currentOwnerRef.current !== cloudUserId || version !== refreshVersion.current) return false;
    reconcileCloudRows(rows);
    return true;
  }, [cloudUserId, reconcileCloudRows]);

  useEffect(() => {
    tradesCacheOwnerRef.current = '__loading__';
    const cached = readCachedTrades(cloudUserId);
    manualTradesRef.current = cached;
    setManualTrades(cached);
    setLoadedOwner(owner);
    tradesCacheOwnerRef.current = owner;
  }, [cloudUserId, owner, readCachedTrades]);

  useEffect(() => {
    if (!cloudUserId || !navigator.onLine) return;

    let cancelled = false;
    (async () => {
      await flushOfflineQueue();
      if (!cancelled) await refreshFromCloud();
    })();
    return () => { cancelled = true; refreshVersion.current++; };
  }, [cloudUserId, flushOfflineQueue, refreshFromCloud]);

  useEffect(() => {
    manualTradesRef.current = manualTrades;
    // Hydration updates state asynchronously. Never write the previous user's
    // (or initial empty) state into the cache we have just read.
    if (loadedOwner === owner && tradesCacheOwnerRef.current === owner) cacheTradesLocally(manualTrades, cloudUserId);
  }, [manualTrades, cloudUserId, owner, loadedOwner, cacheTradesLocally]);

  // Device-to-device sync: realtime when available, plus refresh on focus/online
  // as a reliable fallback for browsers/PWA sessions that suspend sockets.
  useEffect(() => {
    if (!cloudUserId) return;
    const refresh = () => { refreshFromCloud(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisibility);

    const channel = supabase
      .channel(`trades-sync-${cloudUserId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trades', filter: `user_id=eq.${cloudUserId}` }, refresh)
      .subscribe();

    return () => {
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [cloudUserId, refreshFromCloud]);

  const saveTrade = useCallback(async (args) => {
    const { dateKey, isEditing, editingTradeId, time, instrument, direction, signedPnl, comment, platform, currency, takeProfit, stopLoss, traderMode } = args;
    const generatedId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localId = `local-${generatedId}`;
    const localTrade = {
      id: isEditing ? editingTradeId : localId,
      time, instrument, direction, pnl: signedPnl, comment, platform,
      currency: normalizeCurrency(currency),
      ...(traderMode ? { take_profit: takeProfit, stop_loss: stopLoss } : {}),
      pending: Boolean(cloudUserId),
    };

    setManualTrades((prev) => {
      const day = [...(prev[dateKey] || [])];
      const index = isEditing ? day.findIndex((t) => String(t.id) === String(editingTradeId)) : -1;
      if (index >= 0) day[index] = { ...day[index], ...localTrade };
      else day.push(localTrade);
      const next = { ...prev, [dateKey]: day };
      manualTradesRef.current = next;
      cacheTradesLocally(next, cloudUserId);
      return next;
    });

    if (!cloudUserId) return;
    const payload = toSupabaseTradePayload(localTrade, dateKey, cloudUserId);
    const updates = toSupabaseTradeUpdates(localTrade, dateKey);
    const temporary = isEditing && isTemporaryId(editingTradeId);

    if (temporary && amendPendingInsert({ action: 'update', user_id: cloudUserId, tradeId: editingTradeId, date_key: dateKey, updates })) return;

    const operation = isEditing
      ? { action: 'update', user_id: cloudUserId, tradeId: editingTradeId, date_key: dateKey, updates }
      : { action: 'insert', user_id: cloudUserId, tempId: localId, date_key: dateKey, trade: payload };

    if (!navigator.onLine || temporary) { enqueueOperation(operation); return; }

    try {
      if (isEditing) {
        const { error } = await supabase.from('trades').update(updates).eq('id', editingTradeId).eq('user_id', cloudUserId);
        if (error) throw error;
        // Targeted update: just clear pending flag — don't call refreshFromCloud which
        // can race and overwrite the already-correct optimistic state (fixes sign-change bug)
        setManualTrades((prev) => {
          const day = [...(prev[dateKey] || [])];
          const index = day.findIndex((t) => String(t.id) === String(editingTradeId));
          if (index >= 0) day[index] = { ...day[index], ...localTrade, pending: false };
          const next = { ...prev, [dateKey]: day };
          manualTradesRef.current = next;
          cacheTradesLocally(next, cloudUserId);
          return next;
        });
      } else {
        const { data, error } = await supabase.from('trades').insert(payload).select().single();
        if (error) throw error;
        setManualTrades((prev) => {
          const next = {
            ...prev,
            [dateKey]: (prev[dateKey] || []).map((t) => String(t.id) === String(localId) ? { ...t, id: data.id, pending: false } : t),
          };
          manualTradesRef.current = next;
          cacheTradesLocally(next, cloudUserId);
          return next;
        });
        await refreshFromCloud();
      }
    } catch (error) {
      console.warn('[cloud-sync] save deferred:', error?.message || error);
      if (isRetryableNetworkError(error)) enqueueOperation(operation);
      else throw error;
    }
  }, [cloudUserId, cacheTradesLocally, enqueueOperation, amendPendingInsert, refreshFromCloud]);

  const deleteTrade = useCallback(async (dateKey, tradeId) => {
    setManualTrades((prev) => {
      const next = { ...prev, [dateKey]: (prev[dateKey] || []).filter((t) => String(t.id) !== String(tradeId)) };
      manualTradesRef.current = next;
      cacheTradesLocally(next, cloudUserId);
      return next;
    });
    if (!cloudUserId || String(tradeId).startsWith('guest-')) return;
    const operation = { action: 'delete', user_id: cloudUserId, tradeId, date_key: dateKey };
    if (!navigator.onLine || isTemporaryId(tradeId)) { enqueueOperation(operation); return; }
    try {
      const { error } = await supabase.from('trades').delete().eq('id', tradeId).eq('user_id', cloudUserId);
      if (error) throw error;
      await refreshFromCloud();
    } catch (error) {
      console.warn('[cloud-sync] delete deferred:', error?.message || error);
      if (isRetryableNetworkError(error)) enqueueOperation(operation);
      else throw error;
    }
  }, [cloudUserId, cacheTradesLocally, enqueueOperation, refreshFromCloud]);

  const clearAllTrades = useCallback(async () => {
    if (!cloudUserId) { setManualTrades({}); return; }
    if (!navigator.onLine) throw new Error('Для очистки всей облачной истории нужно подключение к интернету.');
    const { error } = await supabase.from('trades').delete().eq('user_id', cloudUserId);
    if (error) throw error;
    setManualTrades({});
    manualTradesRef.current = {};
    cacheTradesLocally({}, cloudUserId);
  }, [cloudUserId, cacheTradesLocally]);

  return { manualTrades, setManualTrades, manualTradesRef, cacheTradesLocally, pendingSyncCount, saveTrade, deleteTrade, clearAllTrades, refreshFromCloud };
}
