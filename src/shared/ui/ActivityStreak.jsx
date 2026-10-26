import React, { useEffect, useRef } from 'react';
import { Flame } from 'lucide-react';
import useAccountActivityStreak from '../lib/useAccountActivityStreak.js';
import './ActivityStreak.css';

export default function ActivityStreak({ ownerId, isLight, t, onOpen, onChange }) {
  const { streak, status, refresh } = useAccountActivityStreak(ownerId);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (streak) onChangeRef.current?.(streak);
  }, [streak]);

  const days = streak ? String(streak.currentStreak) : '…';
  const label = streak ? (t('streakDays') || '{0} дн.').replace('{0}', days) : days;
  const title = status === 'loading' ? t('streakSyncing') : status === 'offline' ? t('streakSyncOffline') : streak?.paused
    ? t('streakPaused')
    : (t('streakTitle') || 'Огонёк входов: {0} дней').replace('{0}', days);

  return (
    <button
      type="button"
      onClick={() => { if (streak) onOpen?.(streak); else refresh(); }}
      className={`activity-streak ${isLight ? 'activity-streak-light' : ''} ${streak?.paused || status === 'offline' ? 'activity-streak-paused' : ''}`}
      aria-haspopup="dialog"
      aria-label={title}
      title={title}
      aria-busy={status === 'loading'}
    >
      <Flame className="activity-streak-icon" aria-hidden="true" />
      <span className="activity-streak-value">{label}</span>
      {streak?.paused && <span className="activity-streak-pause">· {t('streakPauseShort')}</span>}
    </button>
  );
}
