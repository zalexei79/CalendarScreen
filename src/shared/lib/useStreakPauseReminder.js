import { useEffect, useState } from 'react';
import { localDateKey } from './activityStreak.js';

const shownThisSession = new Map();

export function streakReminderDay(streak, now = new Date()) {
  if (streak?.serverDate) return streak.serverDate;
  if (streak?.timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: streak.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const value = type => parts.find(part => part.type === type)?.value;
      return `${value('year')}-${value('month')}-${value('day')}`;
    } catch { /* guest or an old cache without a valid zone */ }
  }
  return localDateKey(now);
}

export default function useStreakPauseReminder(ownerId, streak, status, celebration) {
  const owner = ownerId || 'guest';
  const day = streakReminderDay(streak);
  const eligible = status === 'ready' && Boolean(streak?.paused) && streak?.currentStreak > 0 && !celebration;
  const [notice, setNotice] = useState(null);
  useEffect(() => {
    setNotice(null);
    if (!eligible) return;
    let expiry;
    const show = () => {
      if (document.visibilityState !== 'visible') return;
      const key = `dayris_streak_pause_notice:${owner}`;
      let last = shownThisSession.get(owner);
      try { last = window.localStorage.getItem(key) || last; } catch { /* session fallback */ }
      if (last === day) return;
      shownThisSession.set(owner, day);
      try { window.localStorage.setItem(key, day); } catch { /* session fallback */ }
      setNotice({ owner, day });
      expiry = window.setTimeout(() => setNotice(null), 7000);
    };
    const timer = window.setTimeout(show, 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') show(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer); window.clearTimeout(expiry);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [owner, day, eligible]);
  return { visible: eligible && notice?.owner === owner && notice?.day === day,
    dismiss: () => setNotice(null) };
}
