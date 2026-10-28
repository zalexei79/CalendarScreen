import { useEffect, useMemo, useRef, useState } from 'react';

const UNDO_DELAY = 6500;
const recordKey = (dateKey, id) => `${dateKey}:${id}`;

// Keep the original record intact during the undo window. The existing trade
// store still owns authentication, offline writes and permanent-error rollback.
export default function useUndoableTradeDelete({ ownerId, records, deleteTrade, resolveTradeId }) {
  const jobs = useRef(new Map());
  const current = useRef(null);
  const [revision, setRevision] = useState(0);
  const [failure, setFailure] = useState(null);
  current.current = { ownerId, deleteTrade, resolveTradeId };

  const publish = () => setRevision(value => value + 1);
  useEffect(() => {
    setFailure(null);
    return () => {
      for (const job of jobs.current.values()) clearTimeout(job.timer);
      jobs.current.clear();
    };
  }, [ownerId]);

  async function commit(job) {
    if (current.current.ownerId !== job.owner || jobs.current.get(job.key) !== job) return;
    job.phase = 'deleting';
    publish();
    try {
      const id = current.current.resolveTradeId(job.dateKey, job.record.id);
      await current.current.deleteTrade(job.dateKey, id);
    } catch {
      if (current.current.ownerId === job.owner && jobs.current.get(job.key) === job) setFailure({ owner: job.owner, id: job.key });
    } finally {
      if (jobs.current.get(job.key) === job) {
        jobs.current.delete(job.key);
        publish();
      }
    }
  }

  function arm(job) {
    job.startedAt = Date.now();
    job.timer = setTimeout(() => { void commit(job); }, job.remaining);
  }

  function remove(dateKey, record) {
    if (!ownerId || !record) return;
    const key = recordKey(dateKey, record.id);
    if (jobs.current.has(key)) return;
    const job = { key, owner: ownerId, dateKey, record, phase: 'waiting', remaining: UNDO_DELAY, timer: null };
    jobs.current.set(key, job);
    setFailure(null);
    arm(job);
    publish();
  }

  function undo(key) {
    const job = jobs.current.get(key);
    if (!job || job.owner !== ownerId || job.phase !== 'waiting') return;
    clearTimeout(job.timer);
    jobs.current.delete(key);
    publish();
  }

  function pause(key) {
    const job = jobs.current.get(key);
    if (!job || job.owner !== ownerId || job.phase !== 'waiting' || job.timer == null) return;
    clearTimeout(job.timer);
    job.timer = null;
    job.remaining = Math.max(0, job.remaining - (Date.now() - job.startedAt));
  }

  function resume(key) {
    const job = jobs.current.get(key);
    if (job && job.owner === ownerId && job.phase === 'waiting' && job.timer == null) arm(job);
  }

  const visibleRecords = useMemo(() => {
    const hidden = new Set([...jobs.current.values()].filter(job => job.owner === ownerId)
      .map(job => recordKey(job.dateKey, resolveTradeId(job.dateKey, job.record.id))));
    if (!hidden.size) return records;
    return Object.fromEntries(Object.entries(records).map(([dateKey, day]) => [dateKey, day.filter(record => !hidden.has(recordKey(dateKey, record.id)))]));
  }, [records, ownerId, resolveTradeId, revision]);

  return {
    records: visibleRecords,
    notices: [...jobs.current.values()].filter(job => job.owner === ownerId),
    failure: failure?.owner === ownerId,
    remove, undo, pause, resume, dismissFailure: () => setFailure(null),
  };
}
