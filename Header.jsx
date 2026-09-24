import React, { useState } from 'react';
import {
  ChevronLeft, ChevronRight, Link2, LogIn, LogOut, Download, Smartphone, Monitor, Wifi, Cloud,
  Settings, Sun, Moon, Languages, CircleDollarSign, User, SlidersHorizontal, ChevronDown, LockKeyhole, Gift, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { LANGUAGES, CURRENCIES } from './src/shared/config/constants';
import { monthsFor } from './src/shared/i18n';
import BrandIcon from './src/shared/ui/BrandIcon.jsx';

function pendingSyncText(count, traderMode, language) {
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
  isLight, traderMode, t, theme, setTheme, settingsRef, settingsOpen,
  closeSettings, openSettings, settingsVisible, language, setLanguage,
  currency, setCurrency, user, handleGoogleLogout, handleGoogleLogin,
  goToPrevMonth, goToNextMonth, monthMenuRef, monthMenuOpen, setMonthMenuOpen,
  yearMenuRef, yearMenuOpen, setYearMenuOpen, month, year, today,
  setViewMonth, setViewYear, setSelectedKey, setTraderMode, setPlatformFilter,
  openConnectModal, ctraderConnected, installInfoRef, handleInstallClick,
  pendingSyncCount, installInfoOpen, installInstructions, isPwaInstalled,
  failedSyncCount = 0, retryFailedSync = () => {},
  platformFilter, platformOptions = [], calendarTypeFilter, setCalendarTypeFilter,
  periodStats, periodTrades = [], currencySymbol = '$', formatMoney,
  monthSummary,
  proAccessActive = false, proAccessLoading = false, proAccessUntil = null,
  openReferralHub = () => {}, invitedCount = 0, referralLabel = 'Invites',
}) {
  const [proFiltersOpen, setProFiltersOpen] = useState(false);
  const [syncIssueOpen, setSyncIssueOpen] = useState(false);
  const [retryingSync, setRetryingSync] = useState(false);

  async function retrySync() {
    setRetryingSync(true);
    try { await retryFailedSync(); }
    finally { setRetryingSync(false); }
  }


  return (
    <header className={`px-3 sm:px-8 pt-3 sm:pt-5 pb-3 sm:pb-4 border-b transition-colors duration-300 ${isLight ? 'border-slate-200/70 bg-white/80' : 'border-white/[0.06] bg-zinc-950/70'}`}>
      {/* Top row: Brand app icon + Title on left, [Download] [Theme] [Settings] on right */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
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
              <div className={`absolute right-0 top-full mt-3 w-[min(320px,calc(100vw-32px))] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl z-50 ${isLight ? 'border-zinc-200 bg-white/95' : 'border-zinc-800 bg-zinc-950/95'}`}>
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

            {settingsOpen && (
              <div
                className={[
                  'absolute right-0 top-full mt-3 z-50 rounded-3xl border shadow-2xl p-4 origin-top-right backdrop-blur-xl',
                  'w-[min(320px,calc(100vw-32px))] sm:w-[310px]',
                  'transition-all duration-200 ease-out',
                  settingsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1.5 scale-95',
                  isLight ? 'border-zinc-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,.14)]' : 'border-zinc-800 bg-zinc-900',
                ].join(' ')}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-500/10 mb-3">
                  <p className={`font-data text-[11px] tracking-[0.2em] uppercase font-semibold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                    {t('settings')} · {t('profile')}
                  </p>
                  <span className="text-amber-400 text-xs">✦</span>
                </div>

                {/* 1. Account Section */}
                <div className={`mb-3 rounded-2xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-zinc-800 bg-zinc-950/70'}`}>
                  <p className={`flex items-center gap-1.5 font-data text-[10px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    <User className="h-3.5 w-3.5 text-amber-500" />
                    {t('account')}
                  </p>
                  {user ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                          {user.user_metadata?.nickname || user.user_metadata?.full_name || user.email}
                        </p>
                        {user.user_metadata?.nickname && user.email && (
                          <p className={`truncate text-[11px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{user.email}</p>
                        )}
                      </div>
                      <button
                        onClick={handleGoogleLogout}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                          isLight
                            ? 'border-zinc-300 text-zinc-500 hover:border-red-400 hover:bg-red-50 hover:text-red-500'
                            : 'border-zinc-700 text-zinc-400 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400'
                        }`}
                        title={t('signOut')}
                        aria-label={t('signOut')}
                      >
                        <LogOut className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGoogleLogin}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-500 hover:bg-amber-400/20 transition-colors"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      {t('signIn')}
                    </button>
                  )}
                </div>

                {/* 2. Appearance Section */}
                <div className={`mb-3 rounded-2xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-zinc-800 bg-zinc-950/70'}`}>
                  <p className={`flex items-center gap-1.5 font-data text-[10px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                    <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500" />
                    {t('appearance')}
                  </p>

                  {/* Language */}
                  <div className="mb-3">
                    <p className={`text-[11px] mb-1.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{t('language')}</p>
                    <div className="flex gap-1.5">
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => setLanguage(l.code)}
                          className={[
                            'flex-1 rounded-xl border px-2 py-2 text-xs font-data transition-all hover:-translate-y-px',
                            language === l.code
                              ? 'border-amber-400/70 bg-amber-400/15 text-amber-500 font-semibold shadow-sm'
                              : isLight
                              ? 'border-zinc-300 text-zinc-600 hover:border-zinc-400 bg-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 bg-zinc-900',
                          ].join(' ')}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Currency */}
                  <div>
                    <p className={`text-[11px] mb-1.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{t('currency')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className={[
                            'rounded-xl border px-2 py-2 text-xs font-data transition-all hover:-translate-y-px',
                            currency === c.code
                              ? 'border-amber-400/70 bg-amber-400/15 text-amber-500 font-semibold shadow-sm'
                              : isLight
                              ? 'border-zinc-300 text-zinc-600 hover:border-zinc-400 bg-white'
                              : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 bg-zinc-900',
                          ].join(' ')}
                        >
                          {c.symbol} {c.code}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Second row: Calendar month navigation + Free/PRO switch */}
      <div className="relative">
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-4">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                {monthsFor(language)[month]}
              </button>
              {monthMenuOpen && (
                <div className={`absolute left-0 top-full mt-2 w-40 max-h-64 overflow-y-auto rounded-xl border shadow-xl z-50 p-1 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'}`}>
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
                <div className={`absolute left-0 top-full mt-2 w-24 max-h-64 overflow-y-auto rounded-xl border shadow-xl z-50 p-1 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900'}`}>
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
          {/* Account badge on desktop */}
          <div className={`ml-2 hidden sm:flex items-center rounded-lg border font-data text-[10px] tracking-wide overflow-hidden ${isLight ? 'border-zinc-300 bg-zinc-100' : 'border-zinc-800 bg-zinc-900'}`}>
            {user ? (
              <div className="flex items-center gap-1 pl-2.5 pr-1 py-1">
                <span className={`max-w-[90px] truncate ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                  {user.user_metadata?.nickname || user.user_metadata?.full_name || user.email}
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
              <button
                onClick={handleGoogleLogin}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors ${isLight ? 'text-zinc-600 hover:text-amber-600' : 'text-zinc-400 hover:text-amber-400'}`}
              >
                <LogIn className="h-3.5 w-3.5" />
                {t('signIn')}
              </button>
            )}
          </div>

          {/* High-contrast luxury minimal FREE / PRO toggle */}
          <div className="mt-1 flex w-full items-center justify-between sm:mt-0 sm:ml-2 sm:w-auto sm:basis-auto sm:justify-start">
            <button
              type="button"
              role="switch"
              aria-checked={traderMode}
              onClick={() => setTraderMode(v => { const next = !v; if (!next) setPlatformFilter('ALL'); return next; })}
              title={traderMode ? 'PRO' : (proAccessActive ? 'PRO' : 'PRO · invite to unlock')}
              className={`relative h-9 w-[124px] shrink-0 rounded-full border p-0.5 font-data text-[10px] tracking-[0.14em] shadow-[inset_0_1px_1px_rgba(0,0,0,.2)] transition-all duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60 ${
                isLight ? 'border-zinc-300 bg-zinc-100' : 'border-zinc-700/80 bg-zinc-950'
              }`}
            >
              <span
                aria-hidden="true"
                className={[
                  'absolute top-0.5 bottom-0.5 left-0.5 w-[58px] rounded-full border transition-all duration-300 ease-out',
                  traderMode
                    ? 'translate-x-[60px] border-amber-400/70 bg-gradient-to-br from-amber-400/35 to-amber-500/15 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                    : isLight
                    ? 'translate-x-0 border-zinc-400/40 bg-white shadow-sm'
                    : 'translate-x-0 border-zinc-600/60 bg-zinc-800/90 shadow-sm',
                ].join(' ')}
              />
              <span
                className={[
                  'relative z-10 flex h-full items-center justify-center transition-colors duration-300 font-medium',
                  !traderMode
                    ? isLight ? 'text-zinc-900 font-semibold' : 'text-zinc-100 font-semibold'
                    : 'text-zinc-500',
                ].join(' ')}
                style={{ width: '58px' }}
              >
                {t('freePlan')}
              </span>
              <span
                className={[
                  'absolute right-0.5 top-0.5 bottom-0.5 z-10 flex items-center justify-center transition-colors duration-300 font-semibold',
                  traderMode ? 'text-amber-400' : 'text-zinc-500',
                ].join(' ')}
                style={{ width: '58px' }}
              >
                <span className="flex items-center gap-1">
                  {!proAccessLoading && !proAccessActive && !traderMode
                    ? <LockKeyhole className="h-3 w-3 stroke-[1.9]" />
                    : <span className={traderMode ? 'text-amber-300' : ''}>✦</span>}
                  PRO
                </span>
              </span>
            </button>

            <div className="ml-2 max-w-[190px] opacity-100">
              <button
                type="button"
                onClick={openReferralHub}
                title={referralLabel}
                aria-label={referralLabel}
                className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 font-data text-[10px] font-semibold transition-colors ${
                  isLight
                    ? 'border-amber-200 bg-amber-50/80 text-amber-700 hover:bg-amber-100'
                    : 'border-amber-400/20 bg-amber-400/[0.07] text-amber-300 hover:bg-amber-400/[0.12]'
                }`}
              >
                <Gift className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline max-w-[110px] truncate">{referralLabel}</span>
                <span className={`min-w-5 rounded-full px-1.5 py-0.5 text-center text-[9px] ${
                  invitedCount > 0
                    ? 'bg-amber-400/15 text-amber-500'
                    : isLight ? 'bg-white text-zinc-500' : 'bg-white/[0.06] text-zinc-500'
                }`}>
                  {invitedCount}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PRO extras slide out below the static FREE / PRO switch. */}
      <div className={`grid transition-[grid-template-rows,opacity,margin,transform] duration-300 ease-out ${
        traderMode
          ? 'grid-rows-[1fr] opacity-100 mt-1.5 translate-y-0'
          : 'grid-rows-[0fr] opacity-0 mt-0 -translate-y-1 pointer-events-none'
      }`}>
        <div className="min-h-0 overflow-hidden">
          <div className={`rounded-2xl border px-3 py-2.5 sm:px-4 sm:py-3 ${
            isLight
              ? 'border-slate-200 bg-white shadow-sm'
              : 'border-white/[0.07] bg-white/[0.025]'
          }`}>
            <div className="grid items-center gap-2.5 md:grid-cols-[minmax(200px,1fr)_1px_minmax(220px,auto)_minmax(140px,1fr)]">
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

              <div className={`h-px md:h-8 md:w-px ${isLight ? 'bg-slate-200' : 'bg-white/[0.06]'}`} />

              {/* Keep only the useful income / expense visibility filter. */}
              <div className="flex flex-wrap items-center justify-between gap-2 md:justify-center">
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
