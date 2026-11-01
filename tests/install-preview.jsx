import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import InstallGuide from '../src/shared/ui/InstallGuide.jsx';

function Preview() {
  const [open, setOpen] = useState(true);
  const [light, setLight] = useState(false);
  const [language, setLanguage] = useState('ru');
  const [device, setDevice] = useState('iphone');
  const platform = { ios: device === 'iphone', android: device === 'android', browser: device === 'iphone' ? 'Chrome' : '', name: device === 'iphone' ? 'iPhone / iPad' : device === 'android' ? 'Android' : '' };
  return <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100">
    <h1 className="mb-6 text-2xl">DAYRIS · Установка</h1>
    <div className="flex flex-wrap gap-4">
      <button onClick={() => setOpen(true)}>Открыть окно</button>
      <button onClick={() => setLight(!light)}>Светлая / тёмная</button>
      <select className="bg-zinc-800" value={language} onChange={e => setLanguage(e.target.value)}>{['ru','uk','en','ro','zh'].map(lang => <option key={lang}>{lang}</option>)}</select>
      <select className="bg-zinc-800" value={device} onChange={e => setDevice(e.target.value)}>{['iphone','android','desktop'].map(name => <option key={name}>{name}</option>)}</select>
    </div>
    <InstallGuide open={open} onClose={() => setOpen(false)} language={language} isLight={light} platform={platform} />
  </main>;
}
createRoot(document.getElementById('root')).render(<Preview />);
