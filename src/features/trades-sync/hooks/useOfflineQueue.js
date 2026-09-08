import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../../supabaseClient';
import { OFFLINE_QUEUE_KEY } from '../../../shared/config/constants';
import { getValidUserId } from '../../../shared/lib/formatters';

export function isRetryableNetworkError(error) {
  if (!error) return false;
  if (!navigator.onLine) return true;
  const message = String(error.message || error.details || error).toLowerCase();
  return /network|failed to fetch|fetch failed|load failed|networkerror|timeout|timed out|connection|offline/.test(message);
}

function normalizeCurrency(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'USD';
}

function createOperationId() {
  const generatedId = globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `operation-${generatedId}`;
}

/**
 * useOfflineQueue: manages the pending offline operations queue and synchronizes
 * inserts, updates, and deletes with Supabase when online connectivity is restored.
 */
export function useOfflineQueue({ user, onSyncedInsert }) {
  const isFlushingRef = useRef(false);
  const inFlightOperationIdsRef = useRef(new Set());

  const readOfflineQueue = useCallback(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];

      let changed = false;
      const queue = parsed.map((item) => {
        const normalizedTrade = item?.trade && typeof item.trade === 'object'
          ? { ...item.trade, currency: normalizeCurrency(item.trade.currency) }
          : item?.trade;
        const normalized = {
          ...item,
          ...(normalizedTrade ? { trade: normalizedTrade } : {}),
          operationId: item?.operationId || createOperationId(),
          revision: typeof item?.revision === 'number' ? item.revision : 0,
        };
        if (
          !item?.operationId ||
          typeof item?.revision !== 'number' ||
          (normalizedTrade && normalizedTrade.currency !== item?.trade?.currency)
        ) changed = true;
        return normalized;
      });

      if (changed) window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      return queue;
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

  const amendPendingInsert = useCallback((operation) => {
    const queue = readOfflineQueue();
    const insertIndex = queue.findIndex(
      (item) =>
        item.action === 'insert' &&
        item.user_id === operation.user_id &&
        item.tempId === operation.tradeId
    );

    if (insertIndex < 0) return false;

    const existing = queue[insertIndex];
    queue[insertIndex] = {
      ...existing,
      date_key: operation.date_key,
      trade: {
        ...existing.trade,
        ...operation.updates,
        date_key: operation.date_key,
      },
      revision: existing.revision + 1,
      cancelRequested: false,
      status: undefined,
      failedAt: undefined,
      lastError: undefined,
    };
    writeOfflineQueue(queue);
    setPendingSyncCount(queue.length);
    return true;
  }, [readOfflineQueue, writeOfflineQueue]);

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
      amendPendingInsert(operation);
      return;
    }
    if (insertIndex >= 0 && operation.action === 'delete') {
      const insert = queue[insertIndex];
      if (inFlightOperationIdsRef.current.has(insert.operationId)) {
        queue[insertIndex] = {
          ...insert,
          cancelRequested: true,
          revision: insert.revision + 1,
        };
        writeOfflineQueue(queue);
        setPendingSyncCount(queue.length);
        return;
      }
      queue.splice(insertIndex, 1);
      writeOfflineQueue(queue);
      setPendingSyncCount(queue.length);
      return;
    }

    queue.push({ ...operation, operationId: createOperationId(), revision: 0 });
    writeOfflineQueue(queue);
    setPendingSyncCount(queue.length);
  }, [readOfflineQueue, writeOfflineQueue, amendPendingInsert]);

  const flushOfflineQueue = useCallback(async () => {
    const activeUserId = getValidUserId(user);
    if (!activeUserId || !navigator.onLine || isFlushingRef.current) return;

    isFlushingRef.current = true;
    try {
      while (navigator.onLine) {
        // Read the latest queue before each request. enqueueOperation can run
        // while the previous request is pending, so no stale snapshot is ever
        // written back after a request finishes.
        const item = readOfflineQueue().find(
          (entry) =>
            entry.status !== 'failed' &&
            entry.user_id === activeUserId
        );

        if (!item) break;

        inFlightOperationIdsRef.current.add(item.operationId);
        try {
          if (item.action === 'insert') {
            const safeTrade = { ...item.trade, currency: normalizeCurrency(item.trade?.currency) };
            const { data, error } = await supabase.from('trades').insert(safeTrade).select().single();
            if (error) throw error;

            const latestQueue = readOfflineQueue();
            const latestItem = latestQueue.find((entry) => entry.operationId === item.operationId);

            if (onSyncedInsert) {
              onSyncedInsert(latestItem?.trade?.date_key || item.trade.date_key, item.tempId, data.id);
            }

            if (latestItem?.cancelRequested) {
              const nextQueue = latestQueue.map((entry) => (
                entry.operationId === item.operationId
                  ? {
                    operationId: entry.operationId,
                    revision: entry.revision,
                    action: 'delete',
                    user_id: entry.user_id,
                    tradeId: data.id,
                    date_key: entry.trade.date_key,
                  }
                  : entry
              ));
              writeOfflineQueue(nextQueue);
              setPendingSyncCount(nextQueue.length);
              continue;
            }

            if (latestItem && latestItem.revision !== item.revision) {
              const { user_id, date_key, ...updates } = latestItem.trade;
              const nextQueue = latestQueue.map((entry) => (
                entry.operationId === item.operationId
                  ? {
                    operationId: entry.operationId,
                    revision: entry.revision,
                    action: 'update',
                    user_id: entry.user_id,
                    tradeId: data.id,
                    date_key,
                    updates,
                  }
                  : entry
              ));
              writeOfflineQueue(nextQueue);
              setPendingSyncCount(nextQueue.length);
              continue;
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
            throw new Error(`Unsupported offline operation: ${item.action}`);
          }

          // Remove only the operation that just succeeded. This preserves any
          // operations enqueued while the Supabase request was in flight.
          const latestQueue = readOfflineQueue();
          const nextQueue = latestQueue.filter((entry) => entry.operationId !== item.operationId);
          writeOfflineQueue(nextQueue);
          setPendingSyncCount(nextQueue.length);
        } catch (err) {
          if (isRetryableNetworkError(err)) {
            console.warn('[offline] retryable sync error; operation remains queued:', err);
            break;
          }

          // Preserve the operation and its payload for diagnosis, but do not
          // retry a permanent error on every online event or app restart.
          const latestQueue = readOfflineQueue();
          const nextQueue = latestQueue.map((entry) => (
            entry.operationId === item.operationId
              ? {
                ...entry,
                status: 'failed',
                failedAt: new Date().toISOString(),
                lastError: String(err?.message || err),
              }
              : entry
          ));
          writeOfflineQueue(nextQueue);
          setPendingSyncCount(nextQueue.length);
          console.error('[offline] permanent sync error; operation retained as failed and will not retry automatically:', err);
        } finally {
          inFlightOperationIdsRef.current.delete(item.operationId);
        }
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [user, readOfflineQueue, writeOfflineQueue, onSyncedInsert]);

  useEffect(() => {
    window.addEventListener('online', flushOfflineQueue);
    return () => window.removeEventListener('online', flushOfflineQueue);
  }, [flushOfflineQueue]);

  return {
    pendingSyncCount,
    enqueueOperation,
    amendPendingInsert,
    flushOfflineQueue,
  };
}
