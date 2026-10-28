import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Flame, Pause, X, ArrowUpRight } from 'lucide-react';
import useAccountActivityStreak from '../lib/useAccountActivityStreak.js';
import useStreakPauseReminder from '../lib/useStreakPauseReminder.js';
import './ActivityStreak.css';

export default function ActivityStreak({ ownerId, isLight, t, onOpen, onChange, onCreateEntry }) {
  const { streak, status, refresh, celebration } = useAccountActivityStreak(ownerId);
  const reminder = useStreakPauseReminder(ownerId, streak, status, celebration);
  const paused = Boolean(streak?.paused && streak.currentStreak > 0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (streak) onChangeRef.current?.(streak);
  }, [streak]);

  const days = streak ? String(streak.currentStreak) : '…';
  const label = streak ? (t('streakDays') || '{0} дн.').replace('{0}', days) : days;
  const title = status === 'loading' ? t('streakSyncing') : status === 'offline' ? t('streakSyncOffline') : streak?.paused
    ? t('streakPaused')
    : (t('streakTitle') || 'Огонёк записей: {0} дней').replace('{0}', days);

  return (
    <><button
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
      {paused && <span className="activity-streak-pause"><Pause size={11} strokeWidth={2.7} aria-hidden="true"/>{t('streakPauseShort')}</span>}
    </button>
    {reminder.visible && createPortal(<div className={`activity-streak-reminder ${isLight ? 'is-light' : ''}`}>
      <Pause className="activity-streak-reminder-icon" size={18} aria-hidden="true"/>
      <div className="activity-streak-reminder-copy">
        <span role="status" aria-live="polite">{t('streakReminderTitle')}</span>
        <button type="button" onClick={() => { reminder.dismiss(); if (onCreateEntry) onCreateEntry(); else onOpen?.(streak); }}>
          {t('streakCreateEntry')}<ArrowUpRight size={13} aria-hidden="true"/>
        </button>
      </div>
      <button type="button" className="activity-streak-reminder-close" aria-label={t('streakClose')} onClick={reminder.dismiss}><X size={16} aria-hidden="true"/></button>
    </div>, document.body)}
    {celebration && createPortal(<div className={`activity-streak-success ${isLight ? 'is-light' : ''}`} role="status" aria-live="polite">
      <Flame size={18} aria-hidden="true"/><span>{t(celebration.started ? 'streakStarted' : 'streakContinued')}</span>
    </div>, document.body)}</>
  );
}
