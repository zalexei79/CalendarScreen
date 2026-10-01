import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Header from '../Header';
import CalendarGrid from '../CalendarGrid';
import MonthlyGoal from '../MonthlyGoal';
import WorkspaceDock from '../src/shared/ui/WorkspaceDock';
import { useWorkspaceViewport } from '../src/shared/ui/useWorkspaceViewport';
import { translate } from '../src/shared/i18n';
const noop = () => {};
function Fixture() {
  useWorkspaceViewport();
  const [month, setMonth] = useState(9), [trader, setTrader] = useState(false), [selected, setSelected] = useState(null);
  const refs = [useRef(), useRef(), useRef(), useRef()];
  window.testMonth = setMonth;
  const start = new Date(2026, month, 1);
  const offset = (start.getDay() + 6) % 7;
  const count = Math.ceil((offset + new Date(2026, month + 1, 0).getDate()) / 7) * 7;
  const cells = Array.from({ length: count }, (_, i) => {
    const date = new Date(2026, month, i - offset + 1);
    return { date, key: date.toISOString().slice(0, 10), inMonth: date.getMonth() === month, isToday: i === offset };
  });
  return <div className="premium-shell min-h-screen flex flex-col bg-zinc-950 text-zinc-100">
    <Header language="ru" t={key => translate('ru', key)} theme="dark" traderMode={trader} setTraderMode={setTrader}
      proView proAccessActive setProView={noop} accountMode="main" setAccountMode={noop} month={month} year={2026} today={new Date(2026,9,1)}
      setViewMonth={setMonth} setViewYear={noop} goToPrevMonth={() => setMonth(m => m - 1)} goToNextMonth={() => setMonth(m => m + 1)}
      setSelectedKey={setSelected} monthMenuRef={refs[0]} yearMenuRef={refs[1]} settingsRef={refs[2]} installInfoRef={refs[3]}
      setMonthMenuOpen={noop} setYearMenuOpen={noop} openSettings={noop} closeSettings={noop} setTheme={noop}
      setLanguage={noop} setCurrency={noop} currency="USD" handleGoogleLogin={noop} handleGoogleLogout={noop}
      openConnectModal={noop} platformFilter="ALL" setPlatformFilter={noop} setCalendarTypeFilter={noop}
      isPwaInstalled formatMoney={String} monthSummary={{total:42, days:3}} />
    <div className="px-3"><MonthlyGoal year={2026} month={month} currency="USD" currentPnl={42} language="ru" /></div>
    <CalendarGrid key={month} traderMode={trader} proView language="ru" cells={cells} selectedKey={selected} monthMaxAbsPnl={42}
      tradesForDayFiltered={() => [{ pnl: 42 }]} totalPnlForDay={() => 42} formatPnlDisplay={() => '+$42'}
      plansForDay={() => []} onSelectDay={setSelected} onEmptyClick={() => setSelected(null)}
      onNextMonth={() => setMonth(m => m + 1)} onPreviousMonth={() => setMonth(m => m - 1)} />
    <WorkspaceDock proView><div className="flex gap-2 rounded-full border border-amber-400/30 bg-zinc-900 p-2 pointer-events-auto">
      <button className="px-4 text-sm text-zinc-100">История</button><button className="rounded-full bg-amber-400 px-4 text-sm text-black">Добавить</button>
    </div></WorkspaceDock>
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
