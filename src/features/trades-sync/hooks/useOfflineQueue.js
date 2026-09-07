import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { OFFLINE_QUEUE_KEY } from '../../../shared/config/constants';
import { getValidUserId } from '../../../shared/lib/formatters';

export function isRetryableNetworkError(error) {
  if (!error) return false;
  if (!navigator.onLine) return true;
  const message = String(error.message || error.details || error).toLowerCase();
  return /network|failed to fetch|fetch failed|load failed|networkerror|timeout|timed out|connection|offline/.test(message);
}

/**
 * useOfflineQueue: manages the pending offline operations queue and synchronizes
 * inserts, updates, and deletes with Supabase when online connectivity is restored.
 */
export function useOfflineQueue({ user, onSyncedInsert }) {
  const readOfflineQueue = useCallback(() => {
    try {
      return JSON.parse(window.localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }, []);

  const writeOfflineQueue = useCallback((queue) => {
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // ignore storage failures
    }
  }, []);

  const [pendingSyncCount, setPendingSyncCount] = useState(() => readOfflineQueue().length);

  const enqueueOperation = useCallback((operation) => {
    const queue = readOfflineQueue();

    // Do not create an update/delete against a temporary id. Instead amend
    // or cancel its pending insert before it ever reaches the server.
    const insertIndex = queue.findIndex(
      (item) =>
        item.action === 'insert' &&
        item.user_id === operation.user_id &&
        item.tempId === operation.tradeId
    );
    if (insertIndex >= 0 && operation.action === 'update') {
      queue[insertIndex] = {
        ...queue[insertIndex],
        trade: { ...queue[insertIndex].trade, ...operation.updates },
      };
      writeOfflineQueue(queue);
      setPendingSyncCount(queue.length);
      return;
    }
    if (insertIndex >= 0 && operation.action === 'delete') {
      queue.splice(insertIndex, 1);
      writeOfflineQueue(queue);
      setPendingSyncCount(queue.length);
      return;
    }

    queue.push(operation);
    writeOfflineQueue(queue);
    setPendingSyncCount(queue.length);
  }, [readOfflineQueue, writeOfflineQueue]);

  const flushOfflineQueue = useCallback(async () => {
    const activeUserId = getValidUserId(user);
    if (!activeUserId || !navigator.onLine) return;
    const queue = readOfflineQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      // Legacy entries have no proven owner. Preserve them rather than
      // sending them under whichever account happens to be signed in.
      if (!item.user_id || item.user_id !== activeUserId) {
        remaining.push(item);
        continue;
      }

      try {
        if (item.action === 'insert') {
          const { data, error } = await supabase.from('trades').insert(item.trade).select().single();
          if (error) throw error;

          // Notify parent to replace temporary offline id with real database id
          if (onSyncedInsert) {
            onSyncedInsert(item.trade.date_key, item.tempId, data.id);
          }
        } else if (item.action === 'update') {
          const { error } = await supabase
            .from('trades')
            .update(item.updates)
            .eq('id', item.tradeId)
            .eq('user_id', activeUserId);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase
            .from('trades')
            .delete()
            .eq('id', item.tradeId)
            .eq('user_id', activeUserId);
          if (error) throw error;
        } else {
          remaining.push(item);
        }
      } catch (err) {
        console.error('[offline] не удалось синхронизировать, оставляю в очереди:', err);
        remaining.push(item);
      }
    }
    writeOfflineQueue(remaining);
    setPendingSyncCount(remaining.length);
  }, [user, readOfflineQueue, writeOfflineQueue, onSyncedInsert]);

  useEffect(() => {
    window.addEventListener('online', flushOfflineQueue);
    return () => window.removeEventListener('online', flushOfflineQueue);
  }, [flushOfflineQueue]);

  return {
    pendingSyncCount,
    enqueueOperation,
    flushOfflineQueue,
  };
}
