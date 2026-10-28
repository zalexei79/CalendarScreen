import React from 'react';
import {Award,ChevronDown,Flame,Pencil,Sparkles,TrendingDown,TrendingUp,Zap} from 'lucide-react';
import {getCurrencyMeta} from '../../shared/config/constants.js';
import PnlCurve from '../trades-sync/components/PnlCurve.jsx';
import PeriodDynamics from '../trades-sync/components/PeriodDynamics.jsx';
import NoteInsights from '../day-notes/NoteInsights.jsx';
import {PlatformHistoryActions} from '../platforms/PlatformConnections.jsx';

// Restored analytical sections retain their calculations and interactions.
export default function PremiumHistoryAnalytics({section,context}) {
  const {premiumHistory,premiumHistorySource,traderMode,historyScope,validUserId,ctraderAccounts,language,isLight,dateFrom,dateTo,periodPreset,notesRevision,jumpToTradeDate,t,formatAmountInCurrency,formatMoney,formatMoneyShort,formatDateLabel,proHistoryCopy,displayMode,depositSize,handleEditDeposit,setDisplayMode,currencySymbol,openConnectModal,instrumentBreakdownOpen,setInstrumentBreakdownOpen,setHistoryCurrency}=context;
    const trading = traderMode && historyScope !== 'money';
    const historyTrades = premiumHistory.rows;
    const historyFilteredTrades = premiumHistorySource;
    const historyCurrency = premiumHistory.summary.currency;
    const historyCurrencySymbol = historyCurrency === 'ALL' ? '' : getCurrencyMeta(historyCurrency).symbol;
    const historyIncome = premiumHistory.summary.income;
    const historyExpense = premiumHistory.summary.expense;
    const historyTotal = premiumHistory.summary.total;
    const historyAnalysis = {incomeSources:premiumHistory.incomes.map(item=>[item.name,item.amount]),expenseCategories:premiumHistory.expenses.map(item=>[item.name,item.amount]),dailyEntries:premiumHistory.dailyEntries};
    const formatSignedShort = value => formatAmountInCurrency(value,historyCurrency);
    const historyByCurrency = Object.entries(historyTrades.reduce((groups,row)=>{const code=row.currency||'USD';const stats=groups[code]||{balance:0,count:0};stats.balance+=Number(row.pnl)||0;stats.count++;groups[code]=stats;return groups;},{}));
    if(premiumHistory.summary.mixed) return <div className="premium-history-analytics premium-history-advanced" data-analytics="currency-groups">
      <div className="premium-analytics-card"><h3>{t('currencyDynamics')}</h3><p className="premium-history-hint">{t('currenciesNotMixed')}</p>{historyByCurrency.map(([code,stats])=><button key={code} type="button" className="premium-history-row" onClick={()=>setHistoryCurrency(code)}><span className="premium-history-row-copy"><span>{code}</span><small>{stats.count} {t('transactions')}</small></span><span className="premium-history-row-amount" data-negative={stats.balance<0}>{formatAmountInCurrency(stats.balance,code)}</span></button>)}</div>
      {trading && <PnlCurve appearance="glass" userId={validUserId} trades={historyTrades} comparisonTrades={historyFilteredTrades} dateFrom={periodPreset === 'Вся история'?null:dateFrom} dateTo={dateTo} accounts={ctraderAccounts} language={language} isLight={isLight}/>}
      {trading && section==='full' && <NoteInsights appearance="glass" userId={validUserId} trades={historyTrades} revision={notesRevision} language={language} isLight={isLight} onDay={jumpToTradeDate}/>}
      <PeriodDynamics appearance="glass" trades={historyTrades} language={language} isLight={isLight}/>
    </div>;
    return <div className="premium-history-analytics premium-history-advanced">
      {trading && <>
        <div className="premium-analytics-card premium-analytics-average" data-analytics="trade-average"><span>{proHistoryCopy.averageTrade}</span><strong>{historyTrades.length?formatAmountInCurrency(historyTotal/historyTrades.length,historyCurrency):'—'}</strong><small>{historyTrades.length} {t('trades')}</small></div>
                  {/* ── Compact toolbar (currency · deposit · sync) — always visible ── */}
                  <div className="premium-analytics-tools flex flex-wrap items-center gap-2 mb-3">
                    <div className={`inline-flex min-w-0 max-w-full items-center rounded-xl border ${isLight ? 'border-zinc-200 bg-white/80 shadow-sm' : 'border-white/10 bg-zinc-950/40'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        if (displayMode === 'usd' && depositSize <= 0) { handleEditDeposit(); return; }
                        setDisplayMode((m) => (m === 'usd' ? 'percent' : 'usd'));
                      }}
                      className={`flex h-9 min-w-9 shrink-0 items-center justify-center rounded-l-xl border-r font-data text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${
                        isLight ? 'border-zinc-200 text-zinc-600 hover:bg-amber-50 hover:text-amber-700'
                        : 'border-white/10 text-zinc-400 hover:bg-amber-400/10 hover:text-amber-400'
                      }`}
                    >
                      {displayMode === 'usd' ? currencySymbol : '%'}
                    </button>
                    <button type="button" onClick={handleEditDeposit}
                      className={`group flex h-9 min-w-0 items-center gap-2 rounded-r-xl px-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60 ${isLight ? 'hover:bg-zinc-50' : 'hover:bg-white/5'}`}>
                      <span className="text-[10px] text-zinc-500">{t('deposit')}</span>
                      <span className={`truncate font-data text-xs font-semibold tabular-nums ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{depositSize > 0 ? `${currencySymbol}${formatMoney(depositSize)}` : t('notSet')}</span>
                      <Pencil aria-hidden="true" className="h-3 w-3 shrink-0 text-zinc-600 transition-colors group-hover:text-amber-500" />
                    </button>
                    </div>
                    <PlatformHistoryActions language={language} isLight={isLight} onOpen={openConnectModal} />
                  </div>

                  <PnlCurve appearance="glass" key={validUserId || 'guest'} userId={validUserId} trades={historyTrades} comparisonTrades={historyFilteredTrades} dateFrom={periodPreset === 'Вся история' ? null : dateFrom} dateTo={dateTo} accounts={ctraderAccounts} language={language} isLight={isLight} />
                  {/* ── Luxury Donut + Stats Header ─────────────────────── */}
                  {(() => {
                    const hTrades = historyTrades;
                    const hWin = hTrades.filter(t => t.pnl > 0).length;
                    const hLoss = hTrades.filter(t => t.pnl < 0).length;
                    const hWinrate = hTrades.length > 0 ? Math.round((hWin / hTrades.length) * 100) : 0;
                    const hTotal = hTrades.reduce((s, t) => s + t.pnl, 0);
                    const r = 38;
                    const circ = 2 * Math.PI * r;
                    const offset = circ - (hWinrate / 100) * circ;
                    const lossOffset = circ - ((hLoss / (hTrades.length || 1)) * circ);
                    return (
                      <div className={`premium-analytics-card relative mb-4 overflow-hidden rounded-2xl border p-4 sm:p-5 ${
                        isLight
                          ? 'border-zinc-200 bg-gradient-to-br from-white to-zinc-50/80 shadow-sm'
                          : 'border-amber-400/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_24px_60px_rgba(0,0,0,.4)]'
                      }`}>
                        {/* Ambient glow */}
                        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-amber-400/[0.06] blur-3xl" />
                        <div className="pointer-events-none absolute -left-6 -bottom-6 h-32 w-32 rounded-full bg-emerald-500/[0.05] blur-2xl" />

                        <div className="relative flex items-center gap-5">
                          {/* Donut SVG */}
                          <div className="relative flex shrink-0 items-center justify-center" style={{width:96,height:96}}>
                            <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
                              {/* Track */}
                              <circle cx="48" cy="48" r={r} strokeWidth="9"
                                stroke={isLight ? '#e2e8f0' : '#27272a'} fill="none" />
                              {/* Loss arc (full if any losses) */}
                              {hTrades.length > 0 && hLoss > 0 && (
                                <circle cx="48" cy="48" r={r} strokeWidth="9"
                                  stroke="rgba(239, 68, 68, 0.75)"
                                  strokeDasharray={circ}
                                  strokeDashoffset="0"
                                  fill="none" />
                              )}
                              {/* Win arc */}
                              {hTrades.length > 0 && hWin > 0 && (
                                <circle cx="48" cy="48" r={r} strokeWidth="9"
                                  stroke="rgb(16 185 129)"
                                  strokeDasharray={circ}
                                  strokeDashoffset={offset}
                                  strokeLinecap="round"
                                  fill="none"
                                  style={{transition:'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)'}} />
                              )}
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                              <span className={`font-data text-xl font-bold tabular-nums ${
                                hTrades.length === 0 ? 'text-zinc-500'
                                : hWinrate >= 50 ? 'text-emerald-500' : 'text-red-500'
                              }`}>{hWinrate}%</span>
                              <span className={`mt-1 text-[9px] font-bold uppercase tracking-widest ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>WIN</span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-data text-[10px] uppercase tracking-[0.22em] text-amber-500 font-bold">PRO</span>
                              <span className={`font-data text-[10px] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>·</span>
                              <span className={`font-data text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{hTrades.length} {t('trades')}</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                                <span className={`font-data text-xs font-semibold text-emerald-600`}>+{hWin} {t('profitTrade')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                                <span className={`font-data text-xs font-semibold text-red-500`}>−{hLoss} {t('lossTrade')}</span>
                              </div>
                            </div>
                            <div className={`mt-3 flex items-center justify-between rounded-xl border px-3 py-2 font-data ${
                              isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/80'
                            }`}>
                              <span className={`text-[10px] uppercase tracking-wide ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('total')}:</span>
                              <span className={`text-sm font-bold tabular-nums ${hTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {hTotal >= 0 ? '+' : '−'}{historyCurrencySymbol}{formatMoney(Math.abs(hTotal))}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Win-rate bar */}
                        {hTrades.length > 0 && (
                          <div className="relative mt-4 overflow-hidden rounded-full" style={{height:4}}>
                            <div className={`absolute inset-0 ${isLight ? 'bg-red-200' : 'bg-red-500/20'}`} />
                            <div
                              className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all duration-700"
                              style={{width:`${hWinrate}%`}}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── PRO Scorecard — profit factor, payoff, best/worst day, streaks. Always visible, just scroll. ── */}
                  {historyTrades.length > 0 && (() => {
                    const trades = historyTrades;
                    const wins = trades.filter((tr) => tr.pnl > 0);
                    const losses = trades.filter((tr) => tr.pnl < 0);
                    const grossProfit = wins.reduce((s, tr) => s + tr.pnl, 0);
                    const grossLoss = Math.abs(losses.reduce((s, tr) => s + tr.pnl, 0));
                    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
                    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
                    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
                    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;
                    const winrate = trades.length ? Math.round((wins.length / trades.length) * 100) : 0;

                    const byDay = {};
                    for (const tr of trades) byDay[tr.dateKey] = (byDay[tr.dateKey] || 0) + tr.pnl;
                    const dayEntries = Object.entries(byDay);
                    const bestDay = dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
                    const worstDay = dayEntries.reduce((a, b) => (b[1] < a[1] ? b : a));

                    const byInstrument = {};
                    for (const tr of trades) { const key = tr.instrument || '—'; byInstrument[key] = (byInstrument[key] || 0) + 1; }
                    const topInstrument = Object.entries(byInstrument).sort((a, b) => b[1] - a[1])[0];

                    const chronological = [...trades].sort((a, b) => a.dateKey === b.dateKey ? (a.time || '').localeCompare(b.time || '') : a.dateKey.localeCompare(b.dateKey));
                    let longestLossStreak = 0, current = 0;
                    for (const tr of chronological) { if (tr.pnl < 0) { current += 1; longestLossStreak = Math.max(longestLossStreak, current); } else current = 0; }

                    const pfComponent = Math.min(profitFactor === Infinity ? 3 : profitFactor, 3) / 3 * 40;
                    const winComponent = Math.min(Math.max(winrate, 0), 100) / 100 * 35;
                    const payoffComponent = Math.min(payoffRatio, 3) / 3 * 15;
                    const streakPenalty = Math.min(longestLossStreak, 6) * 1.5;
                    const score = Math.max(4, Math.min(99, Math.round(pfComponent + winComponent + payoffComponent - streakPenalty + 10)));
                    const grade = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
                    const scoreLabel = score >= 85 ? t('traderElite') : score >= 70 ? t('traderConfident') : score >= 55 ? t('traderSteady') : score >= 40 ? t('traderImprove') : t('traderDiscipline');
                    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
                    const scoreCirc = 238.76;

                    const insight = longestLossStreak >= 3
                      ? t('insightLossStreak').replace('{0}', longestLossStreak)
                      : (payoffRatio > 0 && payoffRatio < 1 && winrate >= 50)
                      ? t('insightPayoff')
                      : (profitFactor !== Infinity && profitFactor < 1)
                      ? t('insightProfitFactorLow')
                      : profitFactor >= 1.5
                      ? t('insightProfitFactorHigh')
                      : t('insightLittleData');

                    return (
                      <div data-analytics="scorecard" className="mb-4 space-y-3">
                        <div className="space-y-3">
                        <div className={`premium-analytics-card relative overflow-hidden rounded-2xl p-5 sm:p-7 ${isLight ? 'bg-gradient-to-br from-white to-zinc-50 shadow-[0_1px_0_rgba(0,0,0,.04),0_16px_40px_rgba(0,0,0,.06)]' : 'bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_24px_70px_rgba(0,0,0,.5)]'}`}>
                          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/[0.07] blur-3xl" />
                          <div className="relative flex items-center justify-between mb-5">
                            <span className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-[0.28em] text-amber-500 font-bold"><Zap className="h-3 w-3" /> PRO Scorecard</span>
                            <span className={`rounded-full px-2.5 py-1 font-data text-[10px] font-bold tracking-wide ${score >= 80 ? 'bg-emerald-500/15 text-emerald-500' : score >= 60 ? 'bg-amber-400/15 text-amber-500' : score >= 40 ? 'bg-orange-500/15 text-orange-500' : 'bg-red-500/15 text-red-500'}`}>{t('scoreGrade')} {grade}</span>
                          </div>
                          <div className="relative flex flex-col items-center text-center gap-4 sm:flex-row sm:text-left sm:gap-8">
                            <div className="relative flex shrink-0 items-center justify-center" style={{ width: 132, height: 132 }}>
                              <svg width="132" height="132" viewBox="0 0 96 96" className="-rotate-90">
                                <circle cx="48" cy="48" r="38" strokeWidth="6" stroke={isLight ? '#eef0f3' : '#1c1c1f'} fill="none" />
                                <circle cx="48" cy="48" r="38" strokeWidth="6" stroke={scoreColor}
                                  strokeDasharray={scoreCirc} strokeDashoffset={scoreCirc - (score / 100) * scoreCirc}
                                  strokeLinecap="round" fill="none" style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)' }} />
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                                <span className={`font-display text-4xl font-bold tabular-nums tracking-tight ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>{score}</span>
                                <span className={`mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('scoreLabel')}</span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-base font-semibold leading-tight ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{scoreLabel}</p>
                              <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto sm:mx-0">{t('scoreDescription')}</p>
                              <div className={`mt-4 inline-flex items-baseline gap-2 border-t pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500">{t('profitFactor')}</span>
                                <span className={`font-display text-2xl font-bold tabular-nums ${profitFactor >= 1.5 ? 'text-emerald-500' : profitFactor >= 1 ? (isLight ? 'text-zinc-800' : 'text-zinc-200') : 'text-red-500'}`}>{profitFactor === Infinity ? 'MAX' : profitFactor.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`premium-analytics-card grid grid-cols-3 divide-x rounded-2xl px-1 py-4 ${isLight ? 'divide-zinc-200' : 'divide-zinc-800'}`}>
                          <div className="px-3 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5">{t('payoff')}</p>
                            <p className={`font-display text-lg font-semibold tabular-nums ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{payoffRatio > 0 ? `1:${payoffRatio.toFixed(2)}` : '—'}</p>
                          </div>
                          <div className="px-3 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500/70" /> {t('avgWin')}</p>
                            <p className="font-data text-lg font-semibold text-emerald-500 tabular-nums">+{historyCurrencySymbol}{formatMoney(avgWin)}</p>
                          </div>
                          <div className="px-3 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-center gap-1"><TrendingDown className="h-3 w-3 text-red-500/70" /> {t('avgLoss')}</p>
                            <p className="font-data text-lg font-semibold text-red-500 tabular-nums">-{historyCurrencySymbol}{formatMoney(avgLoss)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className={`premium-analytics-card relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${isLight ? 'from-emerald-50 to-white' : 'from-emerald-500/[0.09] to-transparent'}`}>
                            <TrendingUp className="absolute -right-2 -bottom-2 h-14 w-14 text-emerald-500/10" />
                            <p className="relative text-[9px] uppercase tracking-wider text-emerald-600/80 mb-1.5">{t('bestDay')}</p>
                            <p className="relative font-display text-xl font-bold text-emerald-500 tabular-nums">{formatSignedShort(bestDay[1])}</p>
                            <p className="relative mt-1 text-[10px] text-zinc-500">{formatDateLabel(bestDay[0], language)}</p>
                          </div>
                          <div className={`premium-analytics-card relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${isLight ? 'from-red-50 to-white' : 'from-red-500/[0.09] to-transparent'}`}>
                            <TrendingDown className="absolute -right-2 -bottom-2 h-14 w-14 text-red-500/10" />
                            <p className="relative text-[9px] uppercase tracking-wider text-red-500/80 mb-1.5">{t('worstDay')}</p>
                            <p className="relative font-display text-xl font-bold text-red-500 tabular-nums">{formatSignedShort(worstDay[1])}</p>
                            <p className="relative mt-1 text-[10px] text-zinc-500">{formatDateLabel(worstDay[0], language)}</p>
                          </div>
                        </div>

                        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] font-data ${isLight ? 'border-zinc-200 text-zinc-600' : 'border-zinc-800 text-zinc-400'}`}>
                          <span className="inline-flex items-center gap-1.5"><Award className="h-3 w-3 text-amber-500/80" /> {t('topInstrument')} <span className={isLight ? 'text-zinc-900 font-semibold' : 'text-zinc-100 font-semibold'}>{topInstrument ? topInstrument[0] : '—'}</span></span>
                          {longestLossStreak >= 2 && (
                            <>
                              <span className="text-zinc-400/40">·</span>
                              <span className="inline-flex items-center gap-1.5 text-red-400"><Flame className="h-3 w-3" /> {t('lossStreak')} <span className="font-semibold">{longestLossStreak}</span></span>
                            </>
                          )}
                        </div>

                        <section className={`premium-analytics-card rounded-2xl border ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/50'}`}>
                          <button type="button" aria-expanded={instrumentBreakdownOpen} data-analytics="instruments-toggle" aria-controls="history-instrument-breakdown"
                            onClick={() => setInstrumentBreakdownOpen(v => !v)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-xs font-medium">
                            {t('instrumentBreakdown')}
                            <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-300 motion-reduce:transition-none ${instrumentBreakdownOpen ? 'rotate-180' : ''}`} />
                          </button>
                          <div id="history-instrument-breakdown" aria-hidden={!instrumentBreakdownOpen}
                            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${instrumentBreakdownOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                            <div className="min-h-0 overflow-hidden">
                              <div className="space-y-3 px-4 pb-4">
                                {Object.entries(byInstrument).sort((a, b) => b[1] - a[1]).map(([name, count]) => (
                                  <div key={name}>
                                    <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                                      <span className="truncate font-medium">{name}</span>
                                      <span className="shrink-0 font-data text-zinc-500">{count} {t('trades')}</span>
                                    </div>
                                    <div className="h-1 overflow-hidden rounded-full bg-zinc-500/10">
                                      <div className="h-full rounded-full bg-amber-400/60" style={{ width: `${count / trades.length * 100}%` }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </section>

                        <div className={`premium-analytics-card relative overflow-hidden rounded-2xl border p-4 ${isLight ? 'border-amber-300/70 bg-gradient-to-br from-amber-50 to-white' : 'border-amber-400/25 bg-gradient-to-br from-amber-400/[0.08] via-zinc-950 to-zinc-950'}`}>
                          <div className="absolute -right-6 -top-8 select-none pointer-events-none font-display text-7xl font-bold tracking-tighter text-amber-400/[0.06]">PRO</div>
                          <div className="relative flex items-start gap-2.5 mb-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-500"><Sparkles className="h-4 w-4" /></span>
                            <div>
                              <p className={`text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{t('statsObservation')}</p>
                              <p className="text-[11px] text-zinc-500">{t('statsObservationHint')}</p>
                            </div>
                          </div>
                          <p className={`relative rounded-xl border px-3 py-2.5 text-xs leading-relaxed mb-3 ${isLight ? 'border-zinc-200 bg-white text-zinc-700' : 'border-zinc-800 bg-black/25 text-zinc-300'}`}>{insight}</p>

                        </div>
                      </div>
                      </div>
                    );
                  })()}

      </>}
      {section !== 'overview' && <>
{trading && <NoteInsights appearance="glass" userId={validUserId} trades={historyTrades} revision={notesRevision} language={language} isLight={isLight} onDay={jumpToTradeDate} />}


                  {/* ── Аналитика — непрерывная лента ── */}
                  <section className="mb-4" data-analytics="financial-picture">
                    <h3 className="mb-3 px-1 text-sm font-semibold tracking-tight">{t('proFinancialPicture')}</h3>

                    <div className="mt-2">
                  {/* ── Движение денег — депозиты/выводы по категориям ── */}
                  {historyTrades.length > 0 ? (
                  <div className="mb-4 pt-1">
                    <div className="space-y-4">
                  {historyCurrency === 'ALL' ? (
                    <div className="mb-5 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {historyByCurrency.length ? historyByCurrency.map(([code, stats]) => {
                          const meta = getCurrencyMeta(code);
                          return <button key={code} onClick={() => setHistoryCurrency(code)} className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${isLight ? 'border-zinc-200 bg-zinc-50 hover:border-amber-400/40' : 'border-zinc-800 bg-black/20 hover:border-amber-400/35'}`}>
                            <span className="text-[10px] text-zinc-500">{code}</span>
                            <span className={`mt-1 block font-data text-sm sm:text-base font-semibold tabular-nums leading-tight break-all ${stats.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.balance >= 0 ? '+' : '−'}{meta.symbol}{formatMoneyShort(Math.abs(stats.balance))}</span>
                            <span className="mt-1 block text-[10px] text-zinc-500">{stats.count} {t('transactions')} · {t('openAnalysisAction')}</span>
                          </button>;
                        }) : <p className="col-span-full py-8 text-center text-sm text-zinc-500">{t('noRecords')}</p>}
                      </div>
                      <div className={`premium-analytics-card rounded-2xl border p-3 sm:p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-white/5 bg-black/20'}`}>
                        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold">{t('currencyDynamics')}</p><p className="mt-1 text-[10px] text-zinc-500">{t('currenciesNotMixed')}</p></div><span className="text-[10px] text-amber-500">PRO</span></div>
                        <div className="grid gap-2">
                          {historyByCurrency.map(([code, stats]) => { const meta = getCurrencyMeta(code); return <button key={code} onClick={() => setHistoryCurrency(code)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800/80 bg-zinc-900/40'}`}><span><span className="block text-xs font-medium">{meta.symbol} {code}</span><span className="mt-0.5 block text-[10px] text-zinc-500">{stats.count} {t('transactions')}</span></span><span className={`font-data text-sm ${stats.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.balance >= 0 ? '+' : '−'}{meta.symbol}{formatMoney(Math.abs(stats.balance))}</span></button>; })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`premium-analytics-card relative mb-5 overflow-hidden rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/5 bg-black/20'}`}>
                        <div className="absolute -right-3 -bottom-6 select-none pointer-events-none font-display text-7xl sm:text-8xl font-bold tracking-tighter text-emerald-500/[0.045]">{historyCurrency}</div>
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('resultForPeriod')}</p>
                            <p className={`mt-2 font-display font-semibold tracking-tight tabular-nums leading-none break-all text-[clamp(1.75rem,9vw,3.5rem)] ${historyTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {historyTotal >= 0 ? '+' : '−'}{historyCurrencySymbol}{formatMoney(Math.abs(historyTotal))}
                            </p>
                            <p className="mt-3 text-[11px] text-zinc-500">{historyTrades.length} {t('transactions')} · {historyCurrency} · {t('currentPeriod')}</p>
                          </div>
                          <div className={`shrink-0 rounded-xl border px-3 py-2 text-right ${isLight ? 'border-amber-200 bg-white/80' : 'border-amber-400/15 bg-amber-400/[0.04]'}`}>
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500">{t('status')}</p>
                            <p className={`mt-1 text-xs font-semibold ${historyTotal >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{historyTotal >= 0 ? t('positive') : t('needsAttention')}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                        {[
                          [t('incomeLabel'), historyIncome, 'text-emerald-500'],
                          [t('expenseLabel'), historyExpense, 'text-red-500'],
                          [t('balanceLabel'), Math.abs(historyTotal), historyTotal >= 0 ? 'text-emerald-500' : 'text-red-500'],
                        ].map(([label, amount, color]) => (
                          <div key={label} className={`min-w-0 rounded-xl border p-2.5 sm:p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900/50'}`}>
                            <p className="text-[9px] sm:text-[10px] text-zinc-500">{label}</p>
                            <p className={`mt-1 font-data text-sm sm:text-xs font-semibold tabular-nums leading-tight whitespace-nowrap ${color}`}>{label === t('expenseLabel') ? '−' : label === t('balanceLabel') && historyTotal >= 0 ? '+' : '+'}{historyCurrencySymbol}{formatMoneyShort(amount)}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Всё подряд одним потоком — обзор, откуда, куда, радар, привычки */}
                  <div className="space-y-6">
                    <div>
                      <PeriodDynamics appearance="glass" trades={historyTrades} language={language} isLight={isLight} />
                      <div className="grid sm:grid-cols-3 gap-2">
                        <div className={`text-left rounded-xl p-3 ${isLight ? 'bg-emerald-50' : 'bg-emerald-500/[0.07]'}`}><p className="text-[10px] text-zinc-500">{t('mainSource')}</p><p className="mt-1 text-xs font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p></div>
                        <div className={`text-left rounded-xl p-3 ${isLight ? 'bg-red-50' : 'bg-red-500/[0.07]'}`}><p className="text-[10px] text-zinc-500">{t('expenseZone')}</p><p className="mt-1 text-xs font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-amber-50' : 'bg-amber-500/[0.07]'}`}><p className="text-[10px] text-zinc-500">{t('financialSummary')}</p><p className="mt-1 text-xs font-semibold leading-relaxed">{historyIncome > historyExpense ? t('flowPositivePro') : historyExpense > 0 ? t('flowNegativePro') : t('flowLittleData')}</p></div>
                      </div>
                    </div>

                    <div>
                      <p className={`text-xs font-semibold mb-2 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{t('fromWhere')}</p>
                      <div className="space-y-3">{historyAnalysis.incomeSources.length ? historyAnalysis.incomeSources.slice(0,6).map(([name,value]) => <div key={name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate font-medium">{name}</span><span className="font-data text-emerald-500">+{historyCurrencySymbol}{formatMoney(value)}</span></div><div className="h-2 rounded-full bg-zinc-500/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{width:`${Math.max(5,(value/(historyIncome||1))*100)}%`}} /></div></div>) : <p className="py-5 text-center text-sm text-zinc-500">{t('noIncomePeriod')}</p>}</div>
                    </div>

                    <div>
                      <p className={`text-xs font-semibold mb-2 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{t('whereGo')}</p>
                      <div className="space-y-3">{historyAnalysis.expenseCategories.length ? historyAnalysis.expenseCategories.slice(0,6).map(([name,value]) => <div key={name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate font-medium">{name}</span><span className="font-data text-red-500">−{historyCurrencySymbol}{formatMoney(value)}</span></div><div className="h-2 rounded-full bg-zinc-500/10 overflow-hidden"><div className="h-full rounded-full bg-red-500" style={{width:`${Math.max(5,(value/(historyExpense||1))*100)}%`}} /></div></div>) : <p className="py-5 text-center text-sm text-zinc-500">{t('noExpensePeriod')}</p>}</div>
                    </div>

                    <div className="space-y-2">
                      <div className={`premium-analytics-card rounded-2xl border p-4 ${isLight ? 'border-amber-200 bg-amber-50/40' : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.07] to-transparent'}`}><p className="font-data text-[10px] uppercase tracking-[0.18em] text-amber-500">{t('financialRadar')}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('periodPower')}</p><p className="mt-1 text-sm font-semibold">{historyExpense > 0 ? `${(historyIncome / historyExpense).toFixed(1)}×` : historyIncome > 0 ? t('positive') : '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('mainSource')}</p><p className="mt-1 text-sm font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('attentionZone')}</p><p className="mt-1 text-sm font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('bestDay')}</p><p className="mt-1 text-sm font-semibold">{historyAnalysis.dailyEntries.length ? historyAnalysis.dailyEntries.reduce((best, item) => item[1].income - item[1].expense > best[1].income - best[1].expense ? item : best)[0] : '—'}</p></div>
                      </div></div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className={`premium-analytics-card rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('activity')}</p><p className="mt-2 text-lg font-semibold">{historyTrades.length}</p><p className="text-xs text-zinc-500">{t('transactions')}</p></div>
                      <div className={`premium-analytics-card rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('frequentIncome')}</p><p className="mt-2 text-sm font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p><p className="text-xs text-zinc-500">{t('incomeSources')}</p></div>
                      <div className={`premium-analytics-card rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('expensePattern')}</p><p className="mt-2 text-sm font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p><p className="text-xs text-zinc-500">{t('expenseStructure')}</p></div>
                    </div>
                  </div>
                    </div>
                  </div>
                  ) : (
                    <div className={`premium-analytics-card rounded-2xl border border-dashed px-6 py-14 text-center ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                      <p className={`text-sm ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('emptyHistoryDesc')}</p>
                    </div>
                  )}
                    </div>
                  </section>

      </>}
    </div>;
  }

