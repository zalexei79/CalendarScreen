// Actual calendar and wallet components, with no auth or network writes.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import CalendarGrid from '../CalendarGrid';
import WalletPanel from '../src/features/wallet/WalletPanel';
import { transitionView } from '../src/shared/ui/transitionView';
import { useWorkspaceViewport } from '../src/shared/ui/useWorkspaceViewport';

function Fixture() {
  useWorkspaceViewport();
  const [view, setView] = useState('calendar'), [month, setMonth] = useState(0);
  const [pro, setPro] = useState(true), [blocked, setBlocked] = useState(false), [selected, setSelected] = useState(null);
  const cells = Array.from({ length: 35 }, (_, i) => ({ key: `day-${i}`, date: new Date(2026, 8, i + 1), inMonth: true, isToday: false }));
  return <>
    <div className="controls"><button id="pro" onClick={() => setPro(value => !value)}>PRO</button><button id="blocked" onClick={() => setBlocked(value => !value)}>Block</button><input aria-label="Test field" /><span id="month">{month}</span><span id="selected">{selected || ''}</span></div>
    <div className="history-fab" style={{ position: 'fixed', left: 16, right: 16, height: 48, pointerEvents: 'none' }}>History / Add</div>
    {view === 'calendar' ? <CalendarGrid key={month} language="en" proView={pro} cells={cells} selectedKey={selected} monthMaxAbsPnl={0} plansForDay={() => []} tradesForDayFiltered={() => []} totalPnlForDay={() => 0} formatPnlDisplay={() => ''} onSelectDay={setSelected} onEmptyClick={() => setSelected(null)} onNextMonth={() => setMonth(value => value + 1)} onPreviousMonth={() => setMonth(value => value - 1)} gesturesDisabled={blocked} onOpenWallet={pro ? () => transitionView(() => setView('wallet')) : undefined} />
      : <WalletPanel language="en" currency="USD" transactions={[]} balanceByCurrency={{ USD: 0 }} onSave={async () => {}} onBackToCalendar={() => transitionView(() => setView('calendar'))} />}
  </>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
