import { useEffect, useRef } from 'react';

export function useCalendarDayHistory(selectedKey, setSelectedKey) {
  const entryId = useRef(null);
  const selected = useRef(false);
  const closing = useRef(false);
  const latest = useRef(selectedKey);
  latest.current = selectedKey;
  if (!entryId.current) entryId.current = `calendar-${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;

  useEffect(() => {
    function onPopState() {
      if (closing.current) {
        closing.current = false;
        // A day may have been reopened before the pending Back completed.
        if (latest.current) {
          history.pushState({ ...history.state, calendarDay: latest.current, calendarEntry: entryId.current }, '');
          selected.current = true;
        }
        return;
      }
      selected.current = false;
      setSelectedKey(null);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [setSelectedKey]);

  useEffect(() => {
    try {
      if (selectedKey) {
        if (closing.current) return;
        const state = { ...history.state, calendarDay: selectedKey, calendarEntry: entryId.current };
        if (history.state?.calendarEntry === entryId.current) history.replaceState(state, '');
        else history.pushState(state, '');
      } else if (selected.current && history.state?.calendarEntry === entryId.current) {
        closing.current = true;
        history.back();
      }
      selected.current = Boolean(selectedKey);
    } catch { /* The calendar remains usable when history access is restricted. */ }
  }, [selectedKey]);
}
