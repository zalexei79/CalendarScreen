import { useEffect, useState } from 'react';

export function useLocalToday() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    let timer;
    function schedule() {
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 25);
    }
    function refresh() {
      if (document.visibilityState === 'visible') setToday(new Date());
      schedule();
    }
    schedule();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  return today;
}
