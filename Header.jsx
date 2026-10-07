import React, { useState } from 'react';
import { transitionView } from './src/shared/ui/transitionView';
import './src/shared/ui/GlassSystem.css';
import {
  ChevronLeft, ChevronRight, Link2, LogOut, Download, Smartphone, Monitor, Wifi, Cloud,
  Settings, Sun, Moon, ChevronDown, LockKeyhole, Gift, AlertTriangle, RefreshCw,
} from 'lucide-react';

import SettingsPanel from './src/shared/ui/SettingsPanel.jsx';
import { monthsFor } from './src/shared/i18n';
import BrandIcon from './src/shared/ui/BrandIcon.jsx';
import AnimatedMonthLabel from './src/shared/ui/AnimatedMonthLabel.jsx';
import WorkspaceModePanel from './src/features/pro/WorkspaceModePanel.jsx';
import LoginButtons from './src/features/auth/LoginButtons.jsx';

function pendingSyncText(count, traderMode, language) {
  if (String(language).startsWith('zh')) return `${count} ${traderMode ? '笔交易' : '条记录'}等待同步。`;
  const locale = language === 'md' ? 'ro' : language;
  if (locale === 'en') return `${count} ${traderMode ? (count === 1 ? 'trade' : 'trades') : (count === 1 ? 'entry' : 'entries')} waiting for sync.`;
  if (locale === 'ro') return `${count} ${traderMode ? (count === 1 ? 'tranzacție' : 'tranzacții') : (count === 1 ? 'înregistrare' : 'înregistrări')} așteaptă sincronizarea.`;
  const form = (one, few, many) => {
    const lastTwo = count % 100;
    if (lastTwo >= 11 && lastTwo <= 14) return many;
    if (count % 10 === 1) return one;
    if (count % 10 >= 2 && count % 10 <= 4) return few;
    return many;
  };
  return `${count} ${traderMode ? form('сделка', 'сделки', 'сделок') : form('запись', 'записи', 'записей')} ждут синхронизации.`;

}

export default function Header({
  isLight, traderMode, t, theme, themePreference = theme, setTheme, settingsRef, settingsOpen,
  closeSettings, openSettings, settingsVisible, language, setLanguage,
  currency, setCurrency, user, handleGoogleLogout, handleGoogleLogin,
  handleTelegramLogin, loginPending, loginError,
  goToPrevMonth, goToNextMonth, monthMenuRef, monthMenuOpen, setMonthMenuOpen,
  yearMenuRef, yearMenuOpen, setYearMenuOpen, month, year, today,
  setViewMonth, setViewYear, setSelectedKey, setTraderMode, setPlatformFilter,
  openConnectModal, ctraderConnected, ctraderReconnect, metaTraderState, installInfoRef, handleInstallClick,
  pendingSyncCount, installInfoOpen, installInstructions, isPwaInstalled,
  failedSyncCount = 0, retryFailedSync = () => {},
  platformFilter, platformOptions = [], calendarTypeFilter, setCalendarTypeFilter,
  periodStats, periodTrades = [], currencySymbol = '$', formatMoney,
  monthSummary,
  proAccessActive = false, proAccessLoading = false, proAccessUntil = null,
  proView = false, setProView = () => {},
  openReferralHub = () => {}, openProPresentation = () => {}, invitedCount = 0, referralLabel = 'Invites',
  accountMode = 'main', setAccountMode = () => {},
  onReplayLifeStory, onRestartOnboarding,
}) {
  const [proFiltersOpen, setProFiltersOpen] = useState(false);
  const [syncIssueOpen, setSyncIssueOpen] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);

  async function retrySync() {
    setRetryingSync(true);
    try { await retryFailedSync(); }
    finally { setRetryingSync(false); }
  }

  function changeAccountMode(nextMode) {
    if (nextMode === 'wallet') {
      if (proAccessLoading) return;
      if (!proAccessActive) { openProPresentation(); return; }
    }
    if (nextMode === accountMode) return;
    transitionView(() => {
      // Wallet requires both entitlement and the PRO view. Enter atomically so
      // the parent's access effect cannot bounce a FREE-view subscriber back.
      if (nextMode === 'wallet') setProView(true);
      setAccountMode(nextMode);
    });
  }

  if (accountMode === 'wallet') {
    return (
      <header className={`wallet-focus-header border-b px-3 py-3 sm:px-8 sm:py-4 ${isLight ? 'border-amber-200/70 bg-[#f4f6f8]/95' : 'border-amber-400/10 bg-[#08090c]/95'}`}>
        <button
          type="button"
          onClick={() => changeAccountMode('main')}
          aria-label={t('walletBackLabel')}
          className={`group flex min-h-11 items-center gap-3 rounded-full border py-1.5 pl-1.5 pr-5 text-sm font-semibold shadow-lg backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[.98] ${
            isLight
              ? 'border-amber-300/70 bg-white/90 text-zinc-900 shadow-amber-900/5 hover:border-amber-400'
              : 'border-amber-400/25 bg-white/[.045] text-zinc-100 shadow-black/30 hover:border-amber-400/45 hover:bg-white/[.07]'
          }`}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-zinc-950 shadow-[0_0_20px_rgba(251,191,36,.2)] transition-transform duration-300 group-hover:-translate-x-0.5">
            <ChevronLeft className="h-4 w-4 stroke-[2.2]" />
          </span>
          <span>{t('walletBackLabel')}</span>
        </button>
      </header>
    );
  }


  return (
    <header className={`dayris-header px-3 sm:px-8 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b transition-all duration-500 ${isLight ? 'border-slate-200/70 bg-white/80' : 'border-white/[0.06] bg-zinc-950/70'}`}>
      {/* Top row: Brand app icon + Title on left, [Download] [Theme] [Settings] on right */}
      <div className="dayris-brand-row flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0 flex items-center justify-center">
            <BrandIcon
              alt={t('appName')}
              className="h-8 w-8 sm:h-9 sm:w-9"
            />
          </div>
          <div className="min-w-0">
            <h1 className={`font-display text-base sm:text-lg font-semibold tracking-tight truncate leading-tight ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
              {t('appName')}
            </h1>
            <p
              className="h-[14px] font-data text-[9px] sm:text-[10px] tracking-[0.16em] uppercase truncate text-zinc-500"
            >
              {t('titleMoney')}
            </p>
          </div>
        </div>

        {/* Action controls: [ Download ] [ Theme ] [ Settings ] */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Install is useful in the browser, not inside the installed app. */}
          {!isPwaInstalled && <div className="relative shrink-0 block" ref={installInfoRef}>
            <button
              onClick={handleInstallClick}
              title={t('app')}
              className={`group flex h-10 w-10 sm:h-9 sm:w-auto items-center justify-center gap-1.5 rounded-full sm:rounded-xl border sm:px-2.5 shadow-sm transition-all hover:-translate-y-px hover:border-amber-400/45 ${
                isLight
                  ? 'border-zinc-300 bg-white text-zinc-600 hover:bg-amber-50 hover:text-amber-700'
                  : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-900 hover:text-amber-300'
              }`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-md text-amber-500 transition-colors ${isLight ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-zinc-800 group-hover:bg-amber-400/10'}`}>
                <Download className="h-3.5 w-3.5" />
              </span>
              <span className="hidden sm:inline font-data text-[10px] tracking-[0.12em] uppercase font-medium">{t('app')}</span>
              {pendingSyncCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
            </button>

            {installInfoOpen && (
              <div className={`dayris-status-menu absolute right-0 top-full mt-3 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl z-50 ${isLight ? 'border-zinc-200 bg-white/95' : 'border-zinc-800 bg-zinc-950/95'}`}>
                <div className={`border-b bg-gradient-to-r from-amber-400/10 via-transparent to-transparent px-4 py-3.5 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-400">
                      <Download className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-data text-[10px] tracking-[0.2em] text-amber-400 uppercase">{t('titleMoney')}</p>
                      <p className={`mt-0.5 text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{t('alwaysAtHand')}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-3.5">
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {t('installAppDesc')}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                      <Smartphone className="mb-1 h-3.5 w-3.5 text-amber-400" />
                      <p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>{t('mobile')}</p>
                    </div>
                    <div className={`rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                      <Monitor className="mb-1 h-3.5 w-3.5 text-amber-400" />
                      <p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>{t('desktop')}</p>
                    </div>
                    <div className={`rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                      <Cloud className="mb-1 h-3.5 w-3.5 text-amber-400" />
                      <p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>{t('sync')}</p>
                    </div>
                  </div>
                  <div className={`rounded-xl border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/40'}`}>
                    <div className="flex gap-2">
                      <Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      <p className={`text-[11px] leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{installInstructions}</p>
                    </div>
                  </div>
                  {pendingSyncCount > 0 && (
                    <p className="border-t border-zinc-800 pt-2.5 text-[11px] leading-relaxed text-amber-300">
                      {pendingSyncText(pendingSyncCount, traderMode, language)}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>}

          {failedSyncCount > 0 && (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setSyncIssueOpen((open) => !open)}
                aria-expanded={syncIssueOpen}
                aria-label={t('syncIssueTitle')}
                className={`flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center rounded-full border transition-colors ${
                  isLight
                    ? 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    : 'border-amber-400/30 bg-amber-400/[0.09] text-amber-300 hover:bg-amber-400/[0.14]'
                }`}
              >
                <AlertTriangle className="h-4 w-4" />
              </button>

              {syncIssueOpen && (
                <div role="status" className={`absolute right-0 top-full z-50 mt-3 w-[min(320px,calc(100vw-32px))] rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${isLight ? 'border-zinc-200 bg-white/95' : 'border-zinc-800 bg-zinc-950/95'}`}>
                  <div className="flex gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-400"><AlertTriangle className="h-4 w-4" /></span>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{t('syncIssueTitle')}</p>
                      <p className={`mt-1 text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{t('syncIssueDesc')}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={retryingSync || !navigator.onLine}
                    onClick={retrySync}
                    className="mt-4 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className={`h-4 w-4 ${retryingSync ? 'animate-spin' : ''}`} />
                    {t(retryingSync ? 'syncRetrying' : 'syncRetry')}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Theme toggle */}
          <button
            type="button"
            onClick={() => setTheme((v) => (v === 'light' ? 'dark' : 'light'))}
            title={isLight ? t('themeDark') : t('themeLight')}
            aria-label={isLight ? t('themeDark') : t('themeLight')}
            className={[
              'relative flex items-center justify-center gap-1 rounded-full border h-10 w-10 sm:h-9 sm:w-9 px-2 text-xs overflow-hidden transition-all duration-300',
              isLight
                ? 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:border-zinc-600',
            ].join(' ')}
          >
            <span
              key={theme}
              className="inline-block"
              style={{ animation: 'themeIconPop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both' }}
            >
              {isLight ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </span>
          </button>

          {/* Settings gear */}
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => (settingsOpen ? closeSettings() : openSettings())}
              title={t('settings')}
              aria-label={t('settings')}
              className={[
                'flex items-center justify-center h-10 w-10 sm:h-9 sm:w-9 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                isLight
                  ? 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:border-zinc-600',
              ].join(' ')}
            >
              <Settings
                className="h-4 w-4 transition-transform duration-300 ease-out"
                style={{ transform: settingsOpen ? 'rotate(75deg)' : 'rotate(0deg)' }}
              />
            </button>

            {settingsOpen && <SettingsPanel
              t={t} language={language} setLanguage={setLanguage} currency={currency} setCurrency={setCurrency}
              theme={theme} themePreference={themePreference} setTheme={setTheme} isLight={isLight}
              user={user} handleGoogleLogin={handleGoogleLogin} handleTelegramLogin={handleTelegramLogin}
              handleGoogleLogout={handleGoogleLogout} loginPending={loginPending} loginError={loginError}
              proAccessActive={proAccessActive} proAccessLoading={proAccessLoading}
              onPro={openProPresentation} onStory={onReplayLifeStory} onRestart={onRestartOnboarding}
              onClose={closeSettings} visible={settingsVisible} anchorRef={settingsRef}
            />}
          </div>
        </div>
      </div>

      {/* Second row: Calendar month navigation + Free/PRO switch */}
      <div className="relative">
      <div>
        <div className="dayris-command-row">
          <div className="dayris-date-navigation">
          <button
            onClick={goToPrevMonth}
            aria-label={t('previousMonth')}
            title={t('previousMonth')}
            className={`rounded-full border h-9 w-9 flex items-center justify-center transition-all duration-200 hover:-translate-y-px ${isLight ? 'border-zinc-300/80 bg-white/70 text-zinc-600 hover:border-amber-400 hover:text-amber-700 hover:shadow-sm' : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:text-zinc-100 hover:border-white/[0.18] hover:bg-white/[0.06]'}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-baseline gap-1.5 sm:gap-2 min-w-0 sm:min-w-[190px]">
            <div className="relative" ref={monthMenuRef}>
              <button
                onClick={() => { setMonthMenuOpen((v) => !v); setYearMenuOpen(false); }}
                className={`font-display text-2xl sm:text-[28px] font-semibold transition-colors ${isLight ? 'text-zinc-900 hover:text-amber-600' : 'text-zinc-50 hover:text-amber-400'}`}
              >
                <AnimatedMonthLabel year={year} month={month} label={monthsFor(language)[month]} />
              </button>
              {monthMenuOpen && (
                <div className={`dayris-date-menu absolute left-0 top-full mt-2 w-40 max-h-64 overflow-y-auto rounded-xl border shadow-xl z-50 p-1 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'}`}>
                  {monthsFor(language).map((m, i) => (
                    <button
                      key={m}
                      onClick={() => { setViewMonth(i); setSelectedKey(null); setMonthMenuOpen(false); }}
                      className={[
                        'w-full text-left rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        i === month
                          ? 'bg-amber-400/10 text-amber-500 font-semibold'
                          : isLight ? 'text-zinc-700 hover:bg-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
                      ].join(' ')}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={yearMenuRef}>
              <button
                onClick={() => { setYearMenuOpen((v) => !v); setMonthMenuOpen(false); }}
                className={`font-display text-2xl sm:text-[28px] font-semibold transition-colors ${isLight ? 'text-zinc-600 hover:text-amber-600' : 'text-zinc-500 hover:text-amber-400'}`}
              >
                {year}
              </button>
              {yearMenuOpen && (
                <div className={`dayris-date-menu absolute left-0 top-full mt-2 w-24 max-h-64 overflow-y-auto rounded-xl border shadow-xl z-50 p-1 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'}`}>
                  {Array.from({ length: 12 }, (_, i) => today.getFullYear() - 6 + i).map((y) => (
                    <button
                      key={y}
                      onClick={() => { setViewYear(y); setSelectedKey(null); setYearMenuOpen(false); }}
                      className={[
                        'w-full text-left rounded-md px-2.5 py-1.5 text-sm font-data transition-colors',
                        y === year
                          ? 'bg-amber-400/10 text-amber-500 font-semibold'
                          : isLight ? 'text-zinc-700 hover:bg-zinc-100' : 'text-zinc-300 hover:bg-zinc-800',
                      ].join(' ')}
                    >
                      {y}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={goToNextMonth}
            aria-label={t('nextMonth')}
            title={t('nextMonth')}
            className={`rounded-full border h-9 w-9 flex items-center justify-center transition-all duration-200 hover:-translate-y-px ${isLight ? 'border-zinc-300/80 bg-white/70 text-zinc-600 hover:border-amber-400 hover:text-amber-700 hover:shadow-sm' : 'border-white/[0.08] bg-white/[0.035] text-zinc-400 hover:text-zinc-100 hover:border-white/[0.18] hover:bg-white/[0.06]'}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {(month !== today.getMonth() || year !== today.getFullYear()) && (
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setViewMonth(now.getMonth());
                setViewYear(now.getFullYear());
                setSelectedKey(null);
                setMonthMenuOpen(false);
                setYearMenuOpen(false);

                // Trigger a soft pulse on today's calendar cell after the current month renders.
                window.setTimeout(() => {
                  window.dispatchEvent(new Event('dk:today-pulse'));
                }, 80);
              }}
              className={`min-h-9 rounded-full px-3 text-xs font-medium transition-all duration-200 hover:-translate-y-px ${isLight ? 'text-amber-700 hover:bg-amber-50' : 'text-amber-400 hover:bg-amber-400/10'}`}
            >
              {t('today')}
            </button>
          )}
          </div>
          {/* Account details are also available from Settings. */}
          <div className={`dayris-account-badge hidden items-center rounded-lg border font-data text-[10px] tracking-wide overflow-hidden ${isLight ? 'border-zinc-300 bg-zinc-100' : 'border-zinc-800 bg-zinc-900'}`}>
            {user ? (
              <div className="flex items-center gap-1 pl-2.5 pr-1 py-1">
                <span className={`max-w-[90px] truncate ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  {user.user_metadata?.nickname || user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.preferred_username || user.email}
                </span>
                <button
                  onClick={handleGoogleLogout}
                  title={t('signOut')}
                  className={`flex items-center gap-1 transition-colors border-l pl-1.5 ml-0.5 ${isLight ? 'border-zinc-300 text-zinc-400 hover:text-red-500' : 'border-zinc-800 text-zinc-500 hover:text-red-400'}`}
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <LoginButtons t={t} handleGoogleLogin={handleGoogleLogin} handleTelegramLogin={handleTelegramLogin} loginPending={loginPending} loginError={loginError} />
            )}
          </div>

          {/* The workspace selector is separate from server-side PRO entitlement. */}
          <div className="dayris-workspace-slot">
            <WorkspaceModePanel
              proView={proView} onModeChange={() => setProView((value) => !value)} isLight={isLight}
              language={language} t={t} traderMode={traderMode}
              onTraderChange={() => setTraderMode((value) => {
                const next = !value;
                if (!next) setPlatformFilter('ALL');
                return next;
              })}
              onWallet={() => changeAccountMode('wallet')}
              walletAccess={proAccessActive} walletLoading={proAccessLoading}
              onConnect={openConnectModal} connected={ctraderConnected}
              metatrader={metaTraderState} reconnect={ctraderReconnect}
              onOffer={openProPresentation}
            />
          </div>
        </div>
      </div>

      {/* Trader Mode tools slide out only after the separate Trader Mode switch is enabled. */}
      <div className="hidden" aria-hidden="true">
        <div className={`min-h-0 ${traderMode && accountMode === 'main' ? 'overflow-visible' : 'overflow-hidden'}`}>
          {/* Mobile keeps PRO useful without pushing the calendar below the fold. */}
          <div className={`pro-mobile-commandbar sm:hidden rounded-xl border px-2.5 py-2 shadow-[0_12px_30px_-24px_rgba(251,191,36,.75),inset_0_1px_rgba(255,255,255,.035)] ${
            isLight
              ? 'border-amber-200/70 bg-gradient-to-r from-amber-50/80 via-white to-white shadow-sm'
              : 'border-amber-400/15 bg-gradient-to-r from-amber-400/[0.055] via-white/[0.025] to-transparent'
          }`}>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <button
                type="button"
                onClick={openConnectModal}
                className="flex min-w-0 items-center gap-2 rounded-lg text-left"
              >
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                  ctraderConnected
                    ? isLight
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                      : 'border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-400'
                    : isLight
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'
                }`}>
                  <Link2 className="h-3.5 w-3.5 stroke-[1.8]" />
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-[11px] font-semibold leading-tight ${isLight ? 'text-slate-900' : 'text-zinc-200'}`}>cTrader</span>
                  <span className={`block truncate text-[9px] leading-tight ${ctraderConnected ? 'text-emerald-500' : isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                    {ctraderConnected ? t('connected') : t('connectPlatform')}
                  </span>
                </span>
              </button>

              {monthSummary && (
                <div className="min-w-0 text-right">
                  <span className={`block truncate font-data text-[10px] font-semibold tabular-nums ${
                    monthSummary.total < 0 ? 'text-red-500' : monthSummary.total > 0 ? 'text-emerald-500' : 'text-zinc-500'
                  }`}>
                    {monthSummary.total > 0 ? '+' : monthSummary.total < 0 ? '−' : ''}
                    {formatMoney(Math.abs(monthSummary.total))} {currency}
                  </span>
                  <span className={`block truncate text-[8px] ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                    {t('calendarTradingDays')}: {monthSummary.days}
                  </span>
                </div>
              )}
            </div>

            <div className={`mt-2 hidden grid-cols-3 gap-1 rounded-lg border p-0.5 ${
              isLight ? 'border-slate-200/80 bg-slate-100/80' : 'border-white/[0.06] bg-black/20'
            }`}>
              {[
                ['all', t('all')],
                ['income', `+ ${t('income')}`],
                ['expense', `− ${t('expense')}`],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCalendarTypeFilter(key)}
                  className={`min-w-0 truncate rounded-md px-1.5 py-1.5 font-data text-[9px] transition-colors ${
                    calendarTypeFilter === key
                      ? isLight
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'bg-amber-400/15 text-amber-300'
                      : isLight ? 'text-slate-500' : 'text-zinc-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop keeps cTrader and the period controls in one quiet status row. */}
          <div className={`hidden sm:block rounded-xl border px-3 py-2 ${
            isLight
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/[0.07] bg-white/[0.025]'
          }`}>
            <div className="flex items-center justify-between gap-4">
              {/* cTrader is currently the single supported platform — show it directly. */}
              <div className="flex items-center justify-between gap-3 md:pr-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                    ctraderConnected
                      ? isLight
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                        : 'border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-400'
                      : isLight
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'
                  }`}>
                    <Link2 className="h-4 w-4 stroke-[1.8]" />
                  </span>

                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${
                      isLight ? 'text-slate-900' : 'text-zinc-200'
                    }`}>
                      cTrader
                    </p>
                    <p className={`mt-0.5 text-[10px] ${
                      ctraderConnected
                        ? 'text-emerald-500'
                        : isLight ? 'text-slate-500' : 'text-zinc-500'
                    }`}>
                      {ctraderConnected ? t('connected') : t('connectPlatform')}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openConnectModal}
                  className={`shrink-0 rounded-full border px-2.5 py-1.5 font-data text-[10px] font-semibold transition-all ${
                    ctraderConnected
                      ? isLight
                        ? 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        : 'border-white/[0.07] bg-white/[0.035] text-zinc-300 hover:bg-white/[0.06]'
                      : isLight
                        ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300 hover:bg-amber-400/[0.12]'
                  }`}
                >
                  {ctraderConnected ? 'cTrader' : t('connectPlatform')}
                </button>
              </div>

              <div className="hidden" />

              {/* Keep only the useful income / expense visibility filter. */}
              <div className="hidden flex-wrap items-center justify-between gap-2 md:justify-center">
                <span className={`font-data text-[9px] uppercase tracking-[0.16em] ${
                  isLight ? 'text-slate-500 font-semibold' : 'text-zinc-500'
                }`}>
                  {t('show')}
                </span>

                <div className={`inline-flex gap-1 rounded-xl border p-1 ${
                  isLight ? 'border-slate-200 bg-slate-100' : 'border-white/[0.07] bg-black/20'
                }`}>
                  {[
                    ['all', t('all')],
                    ['income', `+ ${t('income')}`],
                    ['expense', `− ${t('expense')}`],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setCalendarTypeFilter(key)}
                      className={`rounded-full px-2.5 py-1.5 text-[10px] font-data transition-all ${
                        calendarTypeFilter === key
                          ? isLight
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/20'
                          : isLight
                            ? 'text-slate-600 hover:text-slate-950'
                            : 'text-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {monthSummary && (
                <div className={`flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[10px] md:pl-4 ${
                  isLight ? 'text-slate-500' : 'text-zinc-500'
                }`}>
                  <span className={`font-data font-semibold tabular-nums ${
                    monthSummary.total < 0
                      ? 'text-red-500'
                      : monthSummary.total > 0
                        ? 'text-emerald-500'
                        : 'text-zinc-500'
                  }`}>
                    {monthSummary.total > 0 ? '+' : monthSummary.total < 0 ? '−' : ''}
                    {formatMoney(Math.abs(monthSummary.total))} {currency}
                  </span>
                  <span>· {t('calendarTradingDays')}: {monthSummary.days}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      </div>
    </header>
  );
}
