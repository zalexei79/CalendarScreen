import React, { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { readAndUpdateActivityStreak } from '../lib/activityStreak.js';
import './ActivityStreak.css';

export default function ActivityStreak({ ownerId, isLight, t }) {
  const [streak, setStreak] = useState(null);

  useEffect(() => {
    const owner = ownerId || 'guest';
    setStreak(readAndUpdateActivityStreak(window.localStorage, `dayris_activity_streak:${owner}`));
  }, [ownerId]);

  if (!streak) return null;
  const days = String(streak.currentStreak);
  const label = (t('streakDays') || '{0} дн.').replace('{0}', days);
  const title = streak.paused
    ? t('streakPaused')
    : (t('streakTitle') || 'Огонёк входов: {0} дней').replace('{0}', days);

  return (
    <div
      className={`activity-streak ${isLight ? 'activity-streak-light' : ''} ${streak.paused ? 'activity-streak-paused' : ''}`}
      role="status"
      aria-label={title}
      title={title}
    >
      <Flame className="activity-streak-icon" aria-hidden="true" />
      <span className="activity-streak-value">{label}</span>
      {streak.paused && <span className="activity-streak-pause">· {t('streakPauseShort')}</span>}
    </div>
  );
}
