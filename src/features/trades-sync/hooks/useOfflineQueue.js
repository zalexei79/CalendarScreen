import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../../supabaseClient';
import { OFFLINE_QUEUE_KEY } from '../../../shared/config/constants';

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
    queue.push(operation);
    writeOfflineQueue(queue);
    setPendingSyncCount(queue.length);
  }, [readOfflineQueue, writeOfflineQueue]);

  const flushOfflineQueue = useCallback(async () => {
    if (!user || !navigator.onLine) return;
    const queue = readOfflineQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        if (item.action === 'insert') {
          const queuedUserId = item.trade?.user_id;
          if (!queuedUserId) {
            // Legacy guest queue item: guest data stays local and must not
            // be sent to Supabase without a real authenticated user id.
            continue;
          }
          const { data, error } = await supabase.from('trades').insert(item.trade).select().single();
          if (error) throw error;

          // Notify parent to replace temporary offline id with real database id
          if (onSyncedInsert) {
            onSyncedInsert(item.trade.date_key, item.tempId, data.id);
          }
        } else if (item.action === 'update') {
          const { error } = await supabase.from('trades').update(item.updates).eq('id', item.tradeId);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase.from('trades').delete().eq('id', item.tradeId);
          if (error) throw error;
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
