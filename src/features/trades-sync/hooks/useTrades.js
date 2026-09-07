import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { getValidUserId, textValue } from '../../../shared/lib/formatters';
import { getTradesCacheKey } from '../../../shared/config/constants';
import { useOfflineQueue } from './useOfflineQueue';

/**
 * useTrades: encapsulates Local-First storage, local storage caching per user/guest,
 * Supabase cloud synchronization, and optimistic CRUD operations.
 */
export function useTrades({ user }) {
  const [manualTrades, setManualTrades] = useState({});
  const manualTradesRef = useRef({});
  const tradesCacheOwnerRef = useRef('__loading__');

  const cloudUserId = getValidUserId(user);
  const owner = cloudUserId || 'guest';

  const readCachedTrades = useCallback((userId) => {
    try {
      const raw = window.localStorage.getItem(getTradesCacheKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }, []);

  const cacheTradesLocally = useCallback((trades, userId) => {
    try {
      window.localStorage.setItem(getTradesCacheKey(userId), JSON.stringify(trades));
    } catch {
      // ignore storage failures
    }
  }, []);

  // Callback when an offline insert is successfully flushed to Supabase
  const handleSyncedInsert = useCallback((dateKey, tempId, realId) => {
    setManualTrades((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).map((t) =>
        t.id === tempId ? { ...t, id: realId } : t
      ),
    }));
  }, []);

  const { pendingSyncCount, enqueueOperation, flushOfflineQueue } = useOfflineQueue({
    user,
    onSyncedInsert: handleSyncedInsert,
  });

  // Load cache on user change, then sync with cloud if signed in
  useEffect(() => {
    tradesCacheOwnerRef.current = '__loading__';

    const cached = readCachedTrades(cloudUserId);
    setManualTrades(cached);

    if (!user) {
      tradesCacheOwnerRef.current = owner;
      return;
    }

    if (!navigator.onLine) {
      tradesCacheOwnerRef.current = owner;
      return;
    }

    supabase
      .from('trades')
      .select('*')
      .eq('user_id', cloudUserId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[trades] ошибка загрузки:', error);
          tradesCacheOwnerRef.current = owner;
          return;
        }

        const grouped = {};
        for (const row of data) {
          grouped[row.date_key] = grouped[row.date_key] || [];
          grouped[row.date_key].push({
            id: row.id,
            time: textValue(row.time),
            instrument: textValue(row.instrument),
            direction: textValue(row.direction),
            pnl: Number(row.pnl),
            comment: row.comment || '',
            platform: textValue(row.platform) || 'Manual',
            take_profit: row.take_profit ?? null,
            stop_loss: row.stop_loss ?? null,
          });
        }

        setManualTrades((prev) => {
          const merged = { ...grouped };

          // Keep local-only records and local edits. Cloud records fill in
          // anything that is not already present locally.
          for (const [dateKey, localList] of Object.entries(prev || {})) {
            if (!merged[dateKey]) {
              merged[dateKey] = localList;
              continue;
            }

            const cloudIds = new Set(merged[dateKey].map((t) => String(t.id)));

            for (const localTrade of localList) {
              if (!cloudIds.has(String(localTrade.id))) {
                merged[dateKey].push(localTrade);
              }
            }
          }

          manualTradesRef.current = merged;
          return merged;
        });

        tradesCacheOwnerRef.current = owner;
        flushOfflineQueue();
      });
  }, [user, cloudUserId, owner, readCachedTrades, flushOfflineQueue]);

  // Sync cache with displayed manualTrades
  useEffect(() => {
    manualTradesRef.current = manualTrades;
    if (tradesCacheOwnerRef.current !== owner) return;
    cacheTradesLocally(manualTrades, cloudUserId);
  }, [manualTrades, cloudUserId, owner, cacheTradesLocally]);

  // Local-First Save (Insert or Update)
  const saveTrade = useCallback(
    async ({
      dateKey,
      isEditing,
      editingTradeId,
      time,
      instrument,
      direction,
      signedPnl,
      comment,
      platform,
      currency,
      takeProfit,
      stopLoss,
      traderMode,
    }) => {
      const localId = crypto.randomUUID
        ? crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const localTrade = {
        id: isEditing ? editingTradeId : localId,
        time,
        instrument,
        direction,
        pnl: signedPnl,
        comment,
        platform,
        currency,
        ...(traderMode ? { take_profit: takeProfit, stop_loss: stopLoss } : {}),
        pending: false,
      };

      // 1. Optimistic Local Update
      setManualTrades((prev) => {
        const nextForDay = [...(prev[dateKey] || [])];

        if (isEditing) {
          const index = nextForDay.findIndex((t) => String(t.id) === String(editingTradeId));
          if (index >= 0) {
            nextForDay[index] = { ...nextForDay[index], ...localTrade };
          } else {
            nextForDay.push(localTrade);
          }
        } else {
          nextForDay.push(localTrade);
        }

        const nextTrades = { ...prev, [dateKey]: nextForDay };
        manualTradesRef.current = nextTrades;
        cacheTradesLocally(nextTrades, cloudUserId);
        return nextTrades;
      });

      // 2. Guest user finishes here
      if (!cloudUserId) {
        return;
      }

      // 3. Cloud Sync in background
      const cloudPayload = {
        user_id: cloudUserId,
        date_key: dateKey,
        time,
        instrument,
        direction,
        pnl: signedPnl,
        comment,
        platform,
      };

      try {
        if (
          isEditing &&
          !String(editingTradeId).startsWith('local-') &&
          !String(editingTradeId).startsWith('guest-') &&
          !String(editingTradeId).startsWith('offline-')
        ) {
          const { error } = await supabase
            .from('trades')
            .update({
              time,
              instrument,
              direction,
              pnl: signedPnl,
              comment,
              platform,
            })
            .eq('id', editingTradeId)
            .eq('user_id', cloudUserId);

          if (error) {
            console.warn('[cloud-sync] update skipped:', error.message);
          }
          return;
        }

        const { data, error } = await supabase.from('trades').insert(cloudPayload).select().single();

        if (error) {
          console.warn('[cloud-sync] insert skipped, local record kept:', error.message);
          return;
        }

        // Replace local id with server id
        setManualTrades((prev) => {
          const merged = { ...prev };
          const list = [...(merged[dateKey] || [])];
          const index = list.findIndex((t) => String(t.id) === String(localId));

          if (index >= 0) {
            list[index] = {
              ...list[index],
              id: data.id,
              pending: false,
            };
            merged[dateKey] = list;
          }

          manualTradesRef.current = merged;
          cacheTradesLocally(merged, cloudUserId);
          return merged;
        });
      } catch (err) {
        console.warn('[cloud-sync] unavailable, local record kept:', err);
      }
    },
    [cloudUserId, cacheTradesLocally]
  );

  // Delete trade
  const deleteTrade = useCallback(
    async (dateKey, tradeId) => {
      setManualTrades((prev) => {
        const nextTrades = { ...prev };
        nextTrades[dateKey] = (nextTrades[dateKey] || []).filter(
          (t) => String(t.id) !== String(tradeId)
        );
        manualTradesRef.current = nextTrades;
        cacheTradesLocally(nextTrades, cloudUserId);
        return nextTrades;
      });

      if (!cloudUserId || String(tradeId).startsWith('guest-') || String(tradeId).startsWith('local-')) {
        return;
      }

      if (!navigator.onLine) {
        enqueueOperation({ action: 'delete', tradeId });
        return;
      }

      try {
        const { error } = await supabase
          .from('trades')
          .delete()
          .eq('id', tradeId)
          .eq('user_id', cloudUserId);

        if (error) console.warn('[trades] cloud delete skipped:', error.message);
      } catch (err) {
        console.warn('[trades] cloud delete unavailable:', err);
      }
    },
    [cloudUserId, cacheTradesLocally, enqueueOperation]
  );

  // Clear all trades
  const clearAllTrades = useCallback(async () => {
    if (!cloudUserId) {
      setManualTrades({});
      return;
    }
    const { error } = await supabase.from('trades').delete().eq('user_id', cloudUserId);
    if (error) {
      console.error('[trades] ошибка очистки истории:', error);
      return;
    }
    setManualTrades({});
  }, [cloudUserId]);

  return {
    manualTrades,
    setManualTrades,
    manualTradesRef,
    cacheTradesLocally,
    pendingSyncCount,
    saveTrade,
    deleteTrade,
    clearAllTrades,
  };
}
