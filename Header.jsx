import React from 'react';
import {
  ChevronLeft, ChevronRight, Link2, LogIn, LogOut, Download, Smartphone, Monitor, Wifi, Cloud,
  Settings, Sun, Moon, Languages, CircleDollarSign,
} from 'lucide-react';
import { LANGUAGES, CURRENCIES } from './src/shared/config/constants';
import { monthsFor } from './src/shared/i18n';

export default function Header({
  isLight, traderMode, t, theme, setTheme, settingsRef, settingsOpen,
  closeSettings, openSettings, settingsVisible, language, setLanguage,
  currency, setCurrency, user, handleGoogleLogout, handleGoogleLogin,
  goToPrevMonth, goToNextMonth, monthMenuRef, monthMenuOpen, setMonthMenuOpen,
  yearMenuRef, yearMenuOpen, setYearMenuOpen, month, year, today,
  setViewMonth, setViewYear, setSelectedKey, setTraderMode, setPlatformFilter,
  openConnectModal, ctraderConnected, installInfoRef, handleInstallClick,
  pendingSyncCount, installInfoOpen, installInstructions,
  platformFilter, platformOptions = [], calendarTypeFilter, setCalendarTypeFilter,
}) {
  return (
    <header className={`px-2 sm:px-8 pt-3 sm:pt-8 pb-3 sm:pb-4 border-b ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className={`font-data text-[11px] sm:text-[12px] tracking-[0.16em] uppercase ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{traderMode ? t('titlePro') : t('titleMoney')}</p>
    
        {/* Theme toggle + settings gear — compact on mobile, same control scales up on wider screens */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* install as app + offline pending-sync indicator */}
          <div className="relative shrink-0 block" ref={installInfoRef}>
            <button
              onClick={handleInstallClick}
              title="Скачать / установить приложение"
              className={`group flex h-10 w-10 sm:h-8 sm:w-auto items-center justify-center gap-1.5 rounded-full sm:rounded-xl border sm:px-2.5 shadow-sm transition-all hover:-translate-y-px hover:border-amber-400/45 ${isLight ? 'border-zinc-300 bg-white text-zinc-600 hover:bg-amber-50 hover:text-amber-700' : 'border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:bg-zinc-900 hover:text-amber-300'}`}
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-md text-amber-500 transition-colors ${isLight ? 'bg-amber-50 group-hover:bg-amber-100' : 'bg-zinc-800 group-hover:bg-amber-400/10'}`}><Download className="h-3 w-3" /></span>
              <span className="hidden sm:inline font-data text-[9px] tracking-[0.12em] uppercase">{t('app')}</span>
              {pendingSyncCount > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />}
            </button>

            {installInfoOpen && (
              <div className={`absolute right-0 top-full mt-3 w-[min(320px,calc(100vw-24px))] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl z-30 ${isLight ? 'border-zinc-200 bg-white/95' : 'border-zinc-800 bg-zinc-950/95'}`}>
                <div className={`border-b bg-gradient-to-r from-amber-400/10 via-transparent to-transparent px-4 py-3.5 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-400"><Download className="h-4 w-4" /></div>
                    <div><p className="font-data text-[10px] tracking-[0.2em] text-amber-400 uppercase">AI Trade Journal</p><p className={`mt-0.5 text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Всегда под рукой</p></div>
                  </div>
                </div>
                <div className="space-y-3 px-4 py-3.5">
                  <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Установите журнал как приложение — быстрый запуск, полноэкранный режим и доступ к данным даже при нестабильном интернете.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}><Smartphone className="mb-1 h-3.5 w-3.5 text-amber-400"/><p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>{t('mobile')}</p></div>
                    <div className={`rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}><Monitor className="mb-1 h-3.5 w-3.5 text-amber-400"/><p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>{t('desktop')}</p></div>
                    <div className={`rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}><Cloud className="mb-1 h-3.5 w-3.5 text-amber-400"/><p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>{t('sync')}</p></div>
                  </div>
                  <div className={`rounded-xl border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/40'}`}><div className="flex gap-2"><Wifi className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400"/><p className={`text-[11px] leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{installInstructions}</p></div></div>
                  {pendingSyncCount > 0 && <p className="border-t border-zinc-800 pt-2.5 text-[11px] leading-relaxed text-amber-300">{pendingSyncCount} {traderMode ? (pendingSyncCount === 1 ? 'сделка' : 'сделок') : (pendingSyncCount === 1 ? 'запись' : 'записей')} ждут синхронизации.</p>}
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTheme((v) => (v === 'light' ? 'dark' : 'light'))}
            title={isLight ? t('themeDark') : t('themeLight')}
            aria-label="Переключить тему"
            className={[
              'relative flex items-center justify-center gap-1 rounded-full border h-10 w-10 sm:h-8 sm:w-8 px-2 text-xs overflow-hidden transition-all duration-300',
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
              {isLight ? <Sun className="h-5 w-5 sm:h-4 sm:w-4" /> : <Moon className="h-5 w-5 sm:h-4 sm:w-4" />}
            </span>
          </button>
    
          <div className="relative" ref={settingsRef}>
            <button
              type="button"
              onClick={() => (settingsOpen ? closeSettings() : openSettings())}
              title={t('settings')}
              aria-label={t('settings')}
              className={[
                'flex items-center justify-center h-10 w-10 sm:h-8 sm:w-8 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                isLight
                  ? 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:border-zinc-600',
              ].join(' ')}
            >
              <Settings
                className="h-5 w-5 sm:h-4 sm:w-4 transition-transform duration-300 ease-out"
                style={{ transform: settingsOpen ? 'rotate(75deg)' : 'rotate(0deg)' }}
              />
            </button>
    
            {settingsOpen && (
              <div
                className={[
                  'absolute right-0 top-full mt-3 z-30 rounded-3xl border shadow-2xl p-4 origin-top-right backdrop-blur-xl',
                  'w-[320px] sm:w-[310px]',
                  'transition-all duration-200 ease-out',
                  settingsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1.5 scale-95',
                  isLight ? 'border-zinc-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,.14)]' : 'border-zinc-800 bg-zinc-900',
                ].join(' ')}
              >
                <p className={`font-data text-[11px] tracking-[0.2em] uppercase mb-4 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {t('settings')} · ПРОФИЛЬ
                </p>
    
                <div className={`mb-2 rounded-xl border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-zinc-800 bg-zinc-950'}`}>
                  <p className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}><Languages className="h-3.5 w-3.5" /> {t('language')}</p>
                  <div className="flex gap-1.5">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => setLanguage(l.code)}
                        className={[
                          'flex-1 rounded-xl border px-2 py-3 text-sm font-data transition-all hover:-translate-y-px',
                          language === l.code
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                            : isLight
                            ? 'border-zinc-300 text-zinc-600 hover:border-zinc-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
    
                {/* Account — visible on mobile inside the settings panel. */}
                <div className={`mb-3 rounded-xl border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-zinc-800 bg-zinc-950'}`}>
                  <p className={`font-data text-[11px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{t('account')}</p>
                  {user ? (
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                          {user.user_metadata?.nickname || user.user_metadata?.full_name || user.email}
                        </p>
                        {user.user_metadata?.nickname && user.email && (
                          <p className={`truncate text-[11px] mt-0.5 ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{user.email}</p>
                        )}
                      </div>
                      <button
                        onClick={handleGoogleLogout}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        title={t('signOut')}
                        aria-label={t('signOut')}
                      >
                        <LogOut className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleGoogleLogin}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2.5 text-sm text-zinc-400 hover:border-amber-400/50 hover:text-amber-400 transition-colors"
                    >
                      <LogIn className="h-4 w-4" />
                      {t('signIn')}
                    </button>
                  )}
                </div>
    
                <div className={`rounded-xl border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-zinc-800 bg-zinc-950'}`}>
                  <p className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}><CircleDollarSign className="h-3.5 w-3.5" /> {t('currency')}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {CURRENCIES.map((c) => (
                      <button
                        key={c.code}
                        onClick={() => setCurrency(c.code)}
                        className={[
                          'rounded-xl border px-2 py-3 text-sm font-data transition-all hover:-translate-y-px',
                          currency === c.code
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                            : isLight
                            ? 'border-zinc-300 text-zinc-600 hover:border-zinc-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {c.symbol} {c.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-4">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={goToPrevMonth}
            aria-label="Предыдущий месяц"
            title="Предыдущий месяц"
            className={`rounded-lg border h-10 w-10 flex items-center justify-center transition-colors ${isLight ? 'border-zinc-300 bg-white text-zinc-600 hover:border-amber-400 hover:text-amber-700' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600'}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-baseline gap-1.5 sm:gap-2 min-w-0 sm:min-w-[190px]">
            <div className="relative" ref={monthMenuRef}>
              <button
                onClick={() => { setMonthMenuOpen((v) => !v); setYearMenuOpen(false); }}
                className={`font-display text-2xl sm:text-2xl font-semibold transition-colors ${isLight ? 'text-zinc-900 hover:text-amber-600' : 'text-zinc-50 hover:text-amber-400'}`}
              >
                {monthsFor(language)[month]}
              </button>
              {monthMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-40 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-30 p-1">
                  {monthsFor(language).map((m, i) => (
                    <button
                      key={m}
                      onClick={() => { setViewMonth(i); setSelectedKey(null); setMonthMenuOpen(false); }}
                      className={[
                        'w-full text-left rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        i === month ? 'bg-amber-400/10 text-amber-400' : 'text-zinc-300 hover:bg-zinc-800',
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
                className={`font-display text-2xl sm:text-2xl font-semibold transition-colors ${isLight ? 'text-zinc-600 hover:text-amber-600' : 'text-zinc-500 hover:text-amber-400'}`}
              >
                {year}
              </button>
              {yearMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-24 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-30 p-1">
                  {Array.from({ length: 12 }, (_, i) => today.getFullYear() - 6 + i).map((y) => (
                    <button
                      key={y}
                      onClick={() => { setViewYear(y); setSelectedKey(null); setYearMenuOpen(false); }}
                      className={[
                        'w-full text-left rounded-md px-2.5 py-1.5 text-sm font-data transition-colors',
                        y === year ? 'bg-amber-400/10 text-amber-400' : 'text-zinc-300 hover:bg-zinc-800',
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
            aria-label="Следующий месяц"
            title="Следующий месяц"
            className={`rounded-lg border h-10 w-10 flex items-center justify-center transition-colors ${isLight ? 'border-zinc-300 bg-white text-zinc-600 hover:border-amber-400 hover:text-amber-700' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600'}`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
    
          {/* Account */}
          <div className="ml-2 hidden sm:flex items-center rounded-md border border-zinc-800 bg-zinc-900 font-data text-[10px] tracking-wide overflow-hidden">
            {user ? (
              <div className="flex items-center gap-1 pl-2 pr-1 py-1">
                <span className="max-w-[80px] truncate text-zinc-300">
                  {user.user_metadata?.nickname || user.user_metadata?.full_name || user.email}
                </span>
                <button
                  onClick={handleGoogleLogout}
                  title={t('signOut')}
                  className="flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-colors border-l border-zinc-800 pl-1.5 ml-0.5"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleGoogleLogin}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-amber-400 transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                {t('signIn')}
              </button>
            )}
          </div>
    
          {/* Money / PRO + platform reveal — адаптивно, всегда видно, но на телефоне компактнее */}
          <div className="mt-1 flex w-full items-center justify-between sm:mt-0 sm:ml-1.5 sm:w-auto sm:basis-auto sm:justify-start">
            <button
              type="button"
              role="switch"
              aria-checked={traderMode}
              onClick={() => setTraderMode(v => { const next = !v; if (!next) setPlatformFilter('ALL'); return next; })}
              title={traderMode ? 'PRO: LONG/SHORT, Take Profit и Stop Loss' : 'Денежный: доходы и расходы без трейдерских полей'}
              className="relative h-10 sm:h-9 w-[116px] sm:w-[128px] shrink-0 rounded-full border border-zinc-700 bg-zinc-950 p-0.5 font-data text-[9px] sm:text-[10px] tracking-[0.12em] text-zinc-400 shadow-[inset_0_1px_0_rgba(255,255,255,.03),0_8px_24px_rgba(0,0,0,.16)] transition-all duration-300 hover:border-amber-400/40 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
            >
              <span
                aria-hidden="true"
                className={[
                  'absolute top-0.5 bottom-0.5 left-0.5 w-[56px] sm:w-[62px] rounded-full border transition-all duration-300 ease-out',
                  traderMode
                    ? 'translate-x-[56px] sm:translate-x-[62px] border-amber-400/70 bg-gradient-to-br from-amber-400/35 to-amber-500/10 shadow-[0_0_24px_rgba(251,191,36,0.22)]'
                    : isLight
                    ? 'translate-x-0 border-zinc-300 bg-zinc-200'
                    : 'translate-x-0 border-zinc-700 bg-zinc-800/90',
                ].join(' ')}
              />
              <span
                className={[
                  'relative z-10 flex h-full items-center justify-center transition-colors duration-300',
                  !traderMode ? 'text-zinc-100' : 'text-zinc-600',
                ].join(' ')}
                style={{ width: '56px' }}
              >
                {t('freePlan')}
              </span>
              <span
                className={[
                  'absolute right-0.5 top-0.5 bottom-0.5 z-10 flex items-center justify-center transition-colors duration-300',
                  traderMode ? 'text-amber-400' : 'text-zinc-600',
                ].join(' ')}
                style={{ width: '56px' }}
              >
                <span className="flex items-center gap-1"><span className={traderMode ? 'text-amber-300' : ''}>✦</span>PRO</span>
              </span>
            </button>
    
            <div
              className={`overflow-hidden shrink-0 transition-[width,margin,opacity] duration-300 ease-out ${
                traderMode ? 'ml-1.5 w-[88px] opacity-100 sm:w-[108px]' : 'ml-0 w-0 opacity-0'
              }`}
              aria-hidden={!traderMode}
            >
              <button
                onClick={openConnectModal}
                tabIndex={traderMode ? 0 : -1}
                className="flex h-8 sm:h-9 w-[88px] sm:w-[108px] items-center justify-center gap-1 rounded-lg border border-amber-400/40 bg-amber-400/10 px-1 sm:px-2 font-data text-[10px] sm:text-[11px] tracking-wide text-amber-400 whitespace-nowrap hover:bg-amber-400/15 transition-colors"
              >
                <Link2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0" />
                <span className="hidden xs:inline">{t('platform')}</span>
                {ctraderConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>
            </div>
          </div>
    

        </div>
      </div>

      {/* PRO control center — returns the controls that were accidentally dropped in the previous version */}
      <div className={`overflow-hidden transition-all duration-300 ${traderMode ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
        <div className={`rounded-2xl border px-3 py-3 sm:px-4 ${isLight ? 'border-amber-300/60 bg-amber-50/70' : 'border-amber-400/20 bg-gradient-to-r from-amber-400/[0.07] via-zinc-950 to-zinc-950'}`}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="shrink-0 font-data text-[9px] uppercase tracking-[0.18em] text-zinc-500">{t('platforms')}</span>
              <div className="flex min-w-0 gap-1 overflow-x-auto pb-0.5">
                {platformOptions.map((p) => (
                  <button key={p} onClick={() => setPlatformFilter(p)} className={`shrink-0 rounded-lg px-3 py-2 text-[10px] font-data transition-all ${platformFilter === p ? 'border border-amber-400/45 bg-amber-400/15 text-amber-400 shadow-[0_6px_18px_rgba(251,191,36,.08)]' : isLight ? 'text-zinc-500 hover:bg-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>{p === 'ALL' ? 'Все' : p}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="shrink-0 font-data text-[9px] uppercase tracking-[0.18em] text-zinc-500">Показать в календаре</span>
              <div className={`inline-flex w-fit gap-1 rounded-xl border p-1 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}>
                {[['all','Все'],['income','+ Доходы'],['expense','− Расходы']].map(([key,label]) => (
                  <button key={key} onClick={() => setCalendarTypeFilter(key)} className={`rounded-lg px-3 py-1.5 text-[10px] font-data transition-all ${calendarTypeFilter === key ? 'bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/20' : 'text-zinc-500 hover:text-zinc-300'}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

