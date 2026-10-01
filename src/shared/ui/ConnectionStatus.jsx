import React, { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, X } from 'lucide-react';
import './ConnectionStatus.css';

export default function ConnectionStatus({ language = 'ru', isLight = false }) {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [restored, setRestored] = useState(false);
  const previous = useRef(online);
  const timer = useRef(null);
  useEffect(() => {
    function update() {
      const connected = navigator.onLine;
      window.clearTimeout(timer.current);
      setOnline(connected);
      setRestored(connected && !previous.current);
      if (connected && !previous.current) timer.current = window.setTimeout(() => setRestored(false), 4500);
      previous.current = connected;
    }
    // A network change may happen between render and effect registration.
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (online && !restored) return null;
  const copy = language === 'en'
    ? ['You are offline', 'Saved data is available on this device', 'You are back online!', 'Connection restored', 'Close']
    : language === 'ro' || language === 'md'
    ? ['Sunteți offline', 'Datele salvate sunt disponibile pe dispozitiv', 'Sunteți din nou online!', 'Conexiune restabilită', 'Închide']
    : ['Вы находитесь офлайн', 'Сохранённые данные доступны на устройстве', 'Ура, вы снова в сети!', 'Подключение восстановлено', 'Закрыть'];
  const Icon = online ? Wifi : WifiOff;
  return (
    <div className="connection-status-wrap">
      <div className="connection-status" data-online={online} data-light={isLight} role="status" aria-live="polite">
        <span className="connection-status-icon"><Icon aria-hidden="true" /></span>
        <div><p>{copy[online ? 2 : 0]}</p><small>{copy[online ? 3 : 1]}</small></div>
        {online && <button type="button" onClick={() => setRestored(false)} aria-label={copy[4]}><X aria-hidden="true" /></button>}
      </div>
    </div>
  );
}
