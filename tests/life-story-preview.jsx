// Local development harness. This page never connects to an account or writes entries.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import FirstRunSetup from '../src/features/onboarding/FirstRunSetup';
import CalendarGrid from '../CalendarGrid';
import '../src/styles.css';

function Preview() {
  const [step, setStep] = useState('language');
  const [language, setLanguage] = useState('ru');
  const [currency, setCurrency] = useState('MDL');
  const [theme, setTheme] = useState('light');
  const [destination, setDestination] = useState('');
  const [arrived, setArrived] = useState(false);
  const now = new Date();
  const offset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()) / 7) * 7;
  const cells = Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth(), 1 - offset + index);
    return { date, key: date.toISOString(), inMonth: date.getMonth() === now.getMonth(), isToday: date.toDateString() === now.toDateString() };
  });
  const openEntry = () => { setDestination('first-entry'); setStep(null); setArrived(false); };
  return <>
    <main data-destination={destination} style={{ padding: '36px 18px 100px', minHeight: '100dvh', background: theme === 'light' ? '#f8fafc' : '#09090b', color: theme === 'light' ? '#334155' : '#d4d4d8' }}>
      <h1 style={{ marginBottom: 28 }}>DAYRIS · {now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</h1>
      {destination === 'first-entry' ? <h2>Форма первой записи</h2> : <CalendarGrid language={language} cells={cells} isLight={theme === 'light'} selectedKey={null} monthMaxAbsPnl={0} tradesForDayFiltered={() => []} totalPnlForDay={() => 0} formatPnlDisplay={String} onSelectDay={openEntry} onEmptyClick={() => {}} />}
      {!step && <button onClick={() => { setArrived(false); setDestination(''); setStep('language'); }}>Повторить первый запуск</button>}
    </main>
    {arrived && !step && <div className="first-entry-whisper" data-light={theme === 'light'}><button onClick={openEntry}>Добавить первую запись</button></div>}
    {step && <FirstRunSetup step={step} language={language} currency={currency} theme={theme} profileKey="life-story-preview" onLanguage={item => setLanguage(item.code)} onCurrency={setCurrency} onTheme={setTheme} onStep={setStep} onStart={openEntry} onArrive={() => { setDestination('calendar'); setStep(null); setArrived(true); }} onSkip={() => { setDestination('calendar'); setStep(null); setArrived(false); }} />}
  </>;
}
createRoot(document.getElementById('root')).render(<Preview />);
