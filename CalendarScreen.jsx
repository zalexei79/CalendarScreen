import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Inbox, TrendingUp, TrendingDown, Sparkles, Plus, X, Trash2,
  Calendar, ChevronDown, Link2, KeyRound, UploadCloud, FileText,
  CheckCircle2, RefreshCw, History, Download, Pencil,
  Wallet, ShoppingCart, Home, Briefcase, ShoppingBag, CreditCard, MoreHorizontal, Cigarette, Utensils, Car, Gift, Gamepad2, Fish, ChartCandlestick, Repeat2, CircleDollarSign,
  Wifi, WifiOff,
} from 'lucide-react';
import { supabase } from './src/supabaseClient';

/**
 * AI Trading Journal — Screen 01: Calendar + Trade Panel + Add Trade Modal + Platform Connect
 *
 * For your Next.js app:
 *  - rename to CalendarScreen.tsx
 *  - add "use client" as the first line (uses useState/useMemo/useEffect/useRef)
 *  - type the shared objects, e.g.:
 *      type DayCell = { date: Date; key: string; inMonth: boolean; isToday: boolean };
 *      type Trade = { id: string; time: string; instrument: string; direction: 'LONG' | 'SHORT'; pnl: number; comment: string; platform: string };
 *      type ManualTrades = Record<string, Trade[]>;
 *
 * All trade data is user-entered (`manualTrades`) — there is no mock/demo
 * generator. "Platform" connections (API keys / CSV import) are UI-complete
 * stubs: wire handleSaveApiKeys / handleImportCsv to your backend to actually
 * persist credentials or parse & ingest a broker export.
 */

import {
  currentTimeHHMM,
  keyFromDate,
  parseDateKeyLocal,
  addDays,
  startOfWeekMonday,
  formatDateLabel,
  getPresetRange,
} from './src/shared/lib/dateUtils';
import {
  textValue,
  formatMoney,
  formatSignedShort,
  formatMoneyShort,
  getValidUserId,
} from './src/shared/lib/formatters';
import {
  PERIOD_PRESETS,
  DEFAULT_ASSET_TAGS,
  INSTRUMENT_INFO,
  MONEY_CATEGORIES,
  EXCHANGES,
  PLATFORMS,
  MAX_CUSTOM_TAGS,
  RECENT_INSTRUMENTS_STORAGE_KEY,
  CUSTOM_TAGS_STORAGE_KEY,
  DEPOSIT_SIZE_STORAGE_KEY,
  TRADER_MODE_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  CURRENCY_STORAGE_KEY,
  THEME_STORAGE_KEY,
  GUEST_TRADES_CACHE_KEY,
  OFFLINE_QUEUE_KEY,
  LANGUAGES,
  CURRENCIES,
  getTradesCacheKey,
  getMoneyCategoryMeta,
  getCurrencyMeta,
} from './src/shared/config/constants';
import { TRANSLATIONS, translate } from './src/shared/i18n';
import { useAuth } from './src/features/auth/hooks/useAuth';
import { useTrades } from './src/features/trades-sync/hooks/useTrades';
import Header from './Header';
import CalendarGrid from './CalendarGrid';

export default function CalendarScreen() {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    function refreshToday() {
      if (document.visibilityState === 'visible') setToday(new Date());
    }
    window.addEventListener('focus', refreshToday);
    document.addEventListener('visibilitychange', refreshToday);
    return () => {
      window.removeEventListener('focus', refreshToday);
      document.removeEventListener('visibilitychange', refreshToday);
    };
  }, []);

  // Auth via useAuth hook
  const {
    user,
    validUserId,
    handleGoogleLogin,
    handleGoogleLogout,
    nicknameModalOpen,
    nicknameModalVisible,
    nicknameInput,
    setNicknameInput,
    handleSaveNickname,
    setupStep,
    setSetupStep,
  } = useAuth();

  // --- cTrader connection state ------------------------------------------
  const [ctraderConnected, setCtraderConnected] = useState(false);
  const [ctraderLoading, setCtraderLoading] = useState(false);
  const [syncingCtrader, setSyncingCtrader] = useState(false);

  async function checkCtraderStatus(userId) {
    if (!userId) {
      setCtraderConnected(false);
      return;
    }
    const { data } = await supabase.from('ctrader_tokens').select('id').eq('user_id', userId).maybeSingle();
    setCtraderConnected(!!data);
  }

  async function handleCtraderCallback(code) {
    setCtraderLoading(true);
    try {
      const redirectUri = window.location.origin + '/';
      const { data, error } = await supabase.functions.invoke('bright-api', {
        body: { code, redirectUri },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      setCtraderConnected(true);
    } catch (err) {
      console.error('[ctrader] ошибка подключения:', err);
      alert('Не удалось подключить cTrader: ' + err.message);
    } finally {
      window.history.replaceState({}, document.title, window.location.pathname);
      setCtraderLoading(false);
    }
  }

  function handleConnectCtrader() {
    if (!validUserId) {
      handleGoogleLogin();
      return;
    }
    const clientId = import.meta.env.VITE_CTRADER_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://connect.spotware.com/apps/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=trading`;
  }

  // Check cTrader status on user change and handle OAuth code return
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code');
    if (code && user) {
      handleCtraderCallback(code);
    } else if (code && !user) {
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (user) {
      checkCtraderStatus(validUserId);
    } else {
      setCtraderConnected(false);
    }
  }, [user, validUserId]);

  // --- Displayed month/year (navigable), separate from the real "today" ----
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const year = viewYear;
  const month = viewMonth;

  function goToPrevMonth() {
    setSelectedKey(null);
    setViewMonth((m) => {
      if (m === 0) {
        setViewYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function goToNextMonth() {
    setSelectedKey(null);
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const [selectedKey, setSelectedKey] = useState(null);
  const calendarTouchStart = useRef(null);
  const [displayMode, setDisplayMode] = useState('usd'); // 'usd' | 'percent'
  const [depositSize, setDepositSize] = useState(() => {
    try {
      return Number(window.localStorage.getItem(DEPOSIT_SIZE_STORAGE_KEY)) || 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(DEPOSIT_SIZE_STORAGE_KEY, String(depositSize));
    } catch {
      // ignore storage write failures
    }
  }, [depositSize]);

  const [traderMode, setTraderMode] = useState(() => {
    try {
      return window.localStorage.getItem(TRADER_MODE_STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(TRADER_MODE_STORAGE_KEY, traderMode ? '1' : '0');
    } catch {
      // ignore storage write failures
    }
  }, [traderMode]);

  // --- Settings: language / currency / theme ------------------------------
  const [language, setLanguage] = useState(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return LANGUAGES.some((l) => l.code === stored) ? stored : 'ru';
    } catch {
      return 'ru';
    }
  });
  const [currency, setCurrency] = useState(() => {
    try {
      const stored = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      return CURRENCIES.some((c) => c.code === stored) ? stored : 'USD';
    } catch {
      return 'USD';
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
      return stored === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const settingsRef = useRef(null);

  function openSettings() {
    setSettingsOpen(true);
    requestAnimationFrame(() => setSettingsVisible(true));
  }
  function closeSettings() {
    setSettingsVisible(false);
    setTimeout(() => setSettingsOpen(false), 160);
  }

  useEffect(() => {
    try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* ignore */ }
  }, [language]);

  useEffect(() => {
    try { window.localStorage.setItem(CURRENCY_STORAGE_KEY, currency); } catch { /* ignore */ }
  }, [currency]);

  useEffect(() => {
    try { window.localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onDocClick(e) {
      if (settingsRef.current && !settingsRef.current.contains(e.target)) closeSettings();
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [settingsOpen]);

  const t = (key) => translate(language, key);
  const currencySymbol = getCurrencyMeta(currency).symbol;
  const isLight = theme === 'light';

  function formatPnlDisplay(amount, short) {
    if (displayMode === 'percent' && depositSize > 0) {
      const pct = (amount / depositSize) * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }
    return `${amount >= 0 ? '+' : '-'}${currencySymbol}${short ? formatMoneyShort(amount) : formatMoney(amount)}`;
  }

  function formatAmountInCurrency(amount, code, { signed = true, short = false } = {}) {
    const symbol = getCurrencyMeta(code || 'USD').symbol;
    const abs = Math.abs(Number(amount) || 0);
    const value = short ? formatMoneyShort(abs) : formatMoney(abs);
    if (!signed) return `${symbol}${value}`;
    return `${amount >= 0 ? '+' : '−'}${symbol}${value}`;
  }

  const suppressNextHistoryPush = useRef(false);

  // native "back" support: opening a day pushes a history entry, so the
  // system back button/swipe closes the day first instead of leaving the site
  useEffect(() => {
    if (selectedKey && !suppressNextHistoryPush.current) {
      window.history.pushState({ calendarDay: selectedKey }, '');
    }
    suppressNextHistoryPush.current = false;
  }, [selectedKey]);

  useEffect(() => {
    function onPopState() {
      suppressNextHistoryPush.current = true;
      setSelectedKey(null);
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);


  // Trades data management via useTrades hook
  const {
    manualTrades,
    setManualTrades,
    manualTradesRef,
    cacheTradesLocally,
    pendingSyncCount,
    saveTrade: hookSaveTrade,
    deleteTrade: hookDeleteTrade,
    clearAllTrades: hookClearAllTrades,
  } = useTrades({ user });

  const [recentInstruments, setRecentInstruments] = useState([]); // most-recently-used instrument symbols
  const [customTags, setCustomTags] = useState([]); // user-added instrument tags, max MAX_CUSTOM_TAGS
  const [addingCustomTag, setAddingCustomTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const dragTagIndex = useRef(null);

  // --- Install as app (PWA) ------------------------------------------------
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [installInfoOpen, setInstallInfoOpen] = useState(false);
  const installInfoRef = useRef(null);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    if (!installInfoOpen) return;
    function onDocClick(e) {
      if (installInfoRef.current && !installInfoRef.current.contains(e.target)) setInstallInfoOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [installInfoOpen]);

  const installInstructions = isIOS
    ? 'Нажмите значок «Поделиться» внизу Safari, затем «На экран «Домой»» — приложение появится как иконка, будет открываться без адресной строки и работать офлайн.'
    : 'Нажмите кнопку ниже (или значок установки в адресной строке браузера) — приложение появится на рабочем столе/телефоне и будет работать без интернета.';

  async function handleInstallClick() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      setDeferredInstallPrompt(null);
      return;
    }
    setInstallInfoOpen((v) => !v);
  }

  // --- Offline / Online notifications ---------------------------------------
  const [offlineNoticeOpen, setOfflineNoticeOpen] = useState(false);
  const [onlineToastOpen, setOnlineToastOpen] = useState(false);

  useEffect(() => {
    function handleOffline() {
      setOnlineToastOpen(false);
      setOfflineNoticeOpen(true);
    }
    function handleOnline() {
      setOfflineNoticeOpen(false);
      setOnlineToastOpen(true);
      const timer = setTimeout(() => {
        setOnlineToastOpen(false);
      }, 4500);
      return () => clearTimeout(timer);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setOfflineNoticeOpen(true);
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // --- Period filter state (compact popover) --------------------------------
  const [periodPreset, setPeriodPreset] = useState('Вся история');
  const initialRange = useMemo(() => getPresetRange('Вся история', today), [today]);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [calendarTypeFilter, setCalendarTypeFilter] = useState('all');
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [yearMenuOpen, setYearMenuOpen] = useState(false);

  function handlePresetChange(preset) {
    setSelectedKey(null);
    setPeriodPreset(preset);
    const range = getPresetRange(preset, today);
    setDateFrom(range.from);
    setDateTo(range.to);
  }

  function handleDateFromChange(value) {
    setSelectedKey(null);
    setDateFrom(value);
    setPeriodPreset('custom');
  }

  function handleDateToChange(value) {
    setSelectedKey(null);
    setDateTo(value);
    setPeriodPreset('custom');
  }

  const periodButtonLabel = periodPreset === 'custom' ? 'Свой период' : periodPreset;

  // --- Add-trade modal state ------------------------------------------------
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDateKey, setModalDateKey] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [form, setForm] = useState({
    instrument: '', direction: 'LONG', sign: 'plus', pnl: '', time: currentTimeHHMM(), comment: '', platform: 'Manual', currency: 'USD',
  });
  const [formError, setFormError] = useState('');

  // --- Connect-platform modal state (API keys / CSV import) -----------------
  const [connectOpen, setConnectOpen] = useState(false);
  const [connectVisible, setConnectVisible] = useState(false);
  const [connectTab, setConnectTab] = useState('api'); // 'api' | 'csv'
  const [apiForm, setApiForm] = useState({ exchange: 'Bybit', key: '', secret: '' });
  const [csvFile, setCsvFile] = useState(null);
  const [csvDragOver, setCsvDragOver] = useState(false);

  // tracks whether mousedown actually started on the backdrop itself,
  // so a text-selection drag that ends outside a modal doesn't close it
  const mouseDownOnBackdrop = useRef(false);
  const monthMenuRef = useRef(null);
  const yearMenuRef = useRef(null);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const offset = (firstOfMonth.getDay() + 6) % 7; // Monday-start week
    const start = new Date(year, month, 1 - offset);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = keyFromDate(d);
      return {
        date: d,
        key,
        inMonth: d.getMonth() === month,
        isToday: d.toDateString() === today.toDateString(),
      };
    });
  }, [year, month, today]);

  // filtered by the active platform selection, so the calendar always
  // matches what the platform filter says (e.g. only Bybit trades)
  function tradesForDayFiltered(key) {
    return (manualTrades[key] || [])
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => (t.currency || 'USD') === currency)
      .filter((t) => calendarTypeFilter === 'all' || (calendarTypeFilter === 'income' ? t.pnl >= 0 : t.pnl < 0));
  }

  function totalPnlForDay(key) {
    return tradesForDayFiltered(key).reduce((sum, t) => sum + t.pnl, 0);
  }

  // heatmap scale: strongest color = the day with the biggest |PnL| this month
  const monthMaxAbsPnl = useMemo(() => {
    let max = 0;
    for (const cell of cells) {
      if (!cell.inMonth) continue;
      const abs = Math.abs(totalPnlForDay(cell.key));
      if (abs > max) max = abs;
    }
    return max;
  }, [cells, manualTrades, platformFilter, currency, calendarTypeFilter]);

  // Flatten every saved trade with its date, then keep only the ones inside
  // the selected period AND matching the platform filter — this drives both
  // the trade list and the compact stats bar.
  // when a calendar day is selected it takes priority over the period
  // range — the panel below then shows strictly that day's trades
  const effectiveFrom = selectedKey || dateFrom;
  const effectiveTo = selectedKey || dateTo;

  // The selected-day sheet is intentionally different from the calendar totals:
  // it shows every record in every currency, while monetary totals stay scoped to
  // the interface currency so different currencies are never added together.
  const periodTrades = useMemo(() => {
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => arr.map((t) => ({ ...t, dateKey })))
      .filter((t) => t.dateKey >= effectiveFrom && t.dateKey <= effectiveTo)
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => (t.currency || 'USD') === currency)
      .filter((t) => calendarTypeFilter === 'all' || (calendarTypeFilter === 'income' ? t.pnl >= 0 : t.pnl < 0))
      .sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
  }, [manualTrades, effectiveFrom, effectiveTo, platformFilter, currency, calendarTypeFilter]);

  const selectedDayTrades = useMemo(() => {
    if (!selectedKey) return periodTrades;
    return (manualTrades[selectedKey] || [])
      .map((t) => ({ ...t, dateKey: selectedKey }))
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => calendarTypeFilter === 'all' || (calendarTypeFilter === 'income' ? t.pnl >= 0 : t.pnl < 0))
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [selectedKey, manualTrades, periodTrades, platformFilter, calendarTypeFilter]);

  const periodStats = useMemo(() => {
    const count = selectedKey ? selectedDayTrades.length : periodTrades.length;
    const pnl = periodTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = periodTrades.filter((t) => t.pnl >= 0).length;
    const winrate = periodTrades.length ? Math.round((wins / periodTrades.length) * 100) : 0;
    return { count, pnl, winrate };
  }, [periodTrades, selectedDayTrades, selectedKey]);

  // free, rule-based analysis — no AI call, just arithmetic. Has its own
  // period, defaulting to whatever's currently selected when opened.
  const [analysisFrom, setAnalysisFrom] = useState(effectiveFrom);
  const [analysisTo, setAnalysisTo] = useState(effectiveTo);
  const [analysisPreset, setAnalysisPreset] = useState('Текущий период');

  const analysisTrades = useMemo(() => {
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => arr.map((t) => ({ ...t, dateKey })))
      .filter((t) => t.dateKey >= analysisFrom && t.dateKey <= analysisTo)
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => (t.currency || 'USD') === currency);
  }, [manualTrades, analysisFrom, analysisTo, platformFilter, currency]);

  const analysisStats = useMemo(() => {
    const count = analysisTrades.length;
    const pnl = analysisTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = analysisTrades.filter((t) => t.pnl >= 0).length;
    const winrate = count ? Math.round((wins / count) * 100) : 0;
    return { count, pnl, winrate };
  }, [analysisTrades]);

  const basicAnalysis = useMemo(() => {
    if (analysisTrades.length === 0) return null;

    const byDay = {};
    for (const t of analysisTrades) byDay[t.dateKey] = (byDay[t.dateKey] || 0) + t.pnl;
    const dayEntries = Object.entries(byDay);
    const bestDay = dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const worstDay = dayEntries.reduce((a, b) => (b[1] < a[1] ? b : a));

    const byInstrument = {};
    for (const t of analysisTrades) byInstrument[t.instrument] = (byInstrument[t.instrument] || 0) + 1;
    const topInstrument = Object.entries(byInstrument).sort((a, b) => b[1] - a[1])[0];

    const avgPnl = analysisStats.pnl / analysisTrades.length;

    const chronological = [...analysisTrades].sort((a, b) =>
      a.dateKey === b.dateKey ? a.time.localeCompare(b.time) : a.dateKey.localeCompare(b.dateKey)
    );
    let longestLossStreak = 0;
    let current = 0;
    for (const t of chronological) {
      if (t.pnl < 0) { current += 1; longestLossStreak = Math.max(longestLossStreak, current); }
      else current = 0;
    }

    // Profit Factor / Payoff Ratio — pure math over analysisTrades, no new data needed
    const winTrades = analysisTrades.filter((t) => t.pnl > 0);
    const lossTrades = analysisTrades.filter((t) => t.pnl < 0);
    const grossProfit = winTrades.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(lossTrades.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const avgWin = winTrades.length > 0 ? grossProfit / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? grossLoss / lossTrades.length : 0;
    const payoffRatio = avgLoss > 0 ? avgWin / avgLoss : 0;

    return { bestDay, worstDay, topInstrument, avgPnl, longestLossStreak, profitFactor, avgWin, avgLoss, payoffRatio };
  }, [analysisTrades, analysisStats]);

  const moneyAnalysis = useMemo(() => {
    if (traderMode || analysisTrades.length === 0) return null;
    const income = analysisTrades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
    const expenses = Math.abs(analysisTrades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0));
    const categories = {};
    for (const t of analysisTrades.filter((t) => t.pnl < 0)) {
      const category = textValue(t.instrument).trim() || 'Другое';
      categories[category] = (categories[category] || 0) + Math.abs(t.pnl);
    }
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const incomeSources = {};
    for (const t of analysisTrades.filter((t) => t.pnl > 0)) {
      const source = textValue(t.instrument).trim() || 'Другое';
      incomeSources[source] = (incomeSources[source] || 0) + t.pnl;
    }
    const topIncomeSources = Object.entries(incomeSources).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const cigarettes = categories['Сигареты'] || 0;
    return { income, expenses, balance: income - expenses, topCategories, topIncomeSources, cigarettes, cigaretteShare: expenses ? Math.round((cigarettes / expenses) * 100) : 0 };
  }, [analysisTrades, traderMode]);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);
  const [analysisTab, setAnalysisTab] = useState('overview');

  function openAnalysis() {
    setAnalysisFrom(effectiveFrom);
    setAnalysisTo(effectiveTo);
    setAnalysisPreset('Текущий период');
    setAnalysisTab('overview');
    setAnalysisOpen(true);
    requestAnimationFrame(() => setAnalysisVisible(true));
  }

  function closeAnalysis() {
    setAnalysisVisible(false);
    setTimeout(() => setAnalysisOpen(false), 180);
  }

  function handleAnalysisPreset(preset) {
    setAnalysisPreset(preset);
    const range = getPresetRange(preset, today);
    setAnalysisFrom(range.from);
    setAnalysisTo(range.to);
  }

  const selectedCell = cells.find((c) => c.key === selectedKey);
  const targetDateKey = selectedCell ? selectedCell.key : keyFromDate(today);
  const todayKey = keyFromDate(today);
  const isFutureSelected = targetDateKey > todayKey;
  const targetDateLabel = parseDateKeyLocal(targetDateKey).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const [editingTrade, setEditingTrade] = useState(null); // { id, dateKey } | null

  // ---- FIX: prevent double-save and improve id generation ----
  const [isSaving, setIsSaving] = useState(false);

  function openModal(tradeToEdit) {
    if (tradeToEdit) {
      setEditingTrade({ id: tradeToEdit.id, dateKey: tradeToEdit.dateKey || modalDateKey || targetDateKey });
      setModalDateKey(tradeToEdit.dateKey || modalDateKey || targetDateKey);
      setForm({
        instrument: textValue(tradeToEdit.instrument),
        direction: textValue(tradeToEdit.direction),
        sign: tradeToEdit.pnl >= 0 ? 'plus' : 'minus',
        pnl: String(Math.abs(tradeToEdit.pnl)),
        time: textValue(tradeToEdit.time) || currentTimeHHMM(),
        comment: tradeToEdit.comment || '',
        platform: textValue(tradeToEdit.platform) || 'Manual',
        currency: tradeToEdit.currency || currency,
        takeProfit: tradeToEdit.take_profit != null ? String(tradeToEdit.take_profit) : '',
        stopLoss: tradeToEdit.stop_loss != null ? String(tradeToEdit.stop_loss) : '',
      });
    } else {
      if (isFutureSelected) return; // нельзя добавлять сделки на будущее
      setEditingTrade(null);
      setModalDateKey(targetDateKey);
      setForm({
        instrument: traderMode ? (recentInstruments[0] || '') : 'Зарплата',
        direction: '',
        sign: 'plus',
        pnl: '',
        time: currentTimeHHMM(),
        comment: '',
        platform: 'Manual',
        currency,
        takeProfit: '',
        stopLoss: '',
      });
    }
    setFormError('');
    // Finance records need category controls immediately visible on mobile; otherwise the required category can be hidden below the fold.
    setDetailsOpen(!traderMode || Boolean(traderMode && tradeToEdit));
    setModalOpen(true);
    requestAnimationFrame(() => setModalVisible(true));
  }

  function closeModal() {
    setModalVisible(false);
    setFormError('');
    setEditingTrade(null);
    setTimeout(() => setModalOpen(false), 180);
  }

  function openConnectModal() {
    setConnectTab('ctrader');
    setApiForm({ exchange: 'Bybit', key: '', secret: '' });
    setCsvFile(null);
    setConnectOpen(true);
    requestAnimationFrame(() => setConnectVisible(true));
  }

  function closeConnectModal() {
    setConnectVisible(false);
    setTimeout(() => setConnectOpen(false), 180);
  }

  useEffect(() => {
    if (!modalOpen && !connectOpen) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (connectOpen) closeConnectModal();
      else if (modalOpen) closeModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, connectOpen]);

  useEffect(() => {
    if (!monthMenuOpen) return;
    function onDocClick(e) {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target)) setMonthMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [monthMenuOpen]);

  useEffect(() => {
    if (!yearMenuOpen) return;
    function onDocClick(e) {
      if (yearMenuRef.current && !yearMenuRef.current.contains(e.target)) setYearMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [yearMenuOpen]);

  // Load previously remembered "frequently used" instruments (client-only).
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = window.localStorage.getItem(RECENT_INSTRUMENTS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) setRecentInstruments(parsed.filter((v) => typeof v === 'string'));
        }
        const storedCustom = window.localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
        if (storedCustom) {
          const parsedCustom = JSON.parse(storedCustom);
          if (Array.isArray(parsedCustom)) setCustomTags(parsedCustom.filter((v) => typeof v === 'string'));
        }
      }
    } catch {
      // ignore malformed/unavailable storage
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_INSTRUMENTS_STORAGE_KEY, JSON.stringify(recentInstruments));
      }
    } catch {
      // ignore storage write failures (e.g. private mode)
    }
  }, [recentInstruments]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(CUSTOM_TAGS_STORAGE_KEY, JSON.stringify(customTags));
      }
    } catch {
      // ignore storage write failures
    }
  }, [customTags]);

  function addCustomTag(raw) {
    const tag = textValue(raw).trim().toUpperCase();
    if (!tag) return;
    if (DEFAULT_ASSET_TAGS.includes(tag) || customTags.includes(tag)) return;
    if (customTags.length >= MAX_CUSTOM_TAGS) return;
    setCustomTags((prev) => [...prev, tag]);
  }

  function removeCustomTag(tag) {
    setCustomTags((prev) => prev.filter((t) => t !== tag));
  }

  function reorderCustomTag(fromIndex, toIndex) {
    setCustomTags((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  // Quick-pick tags: the 3 most recently used instruments first, then the
  // default popular assets — deduplicated so nothing appears twice.
  const quickAssetTags = useMemo(() => {
    const combined = [...recentInstruments.slice(0, 3), ...DEFAULT_ASSET_TAGS];
    return Array.from(new Set(combined));
  }, [recentInstruments]);

  function handleBackdropMouseDown(e) {
    mouseDownOnBackdrop.current = e.target === e.currentTarget;
  }

  function handleModalBackdropClick(e) {
    if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeModal();
  }

  function handleConnectBackdropClick(e) {
    if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeConnectModal();
  }

  async function handleSaveTrade() {
    if (isSaving) return;
    setIsSaving(true);

    try {
      const dateKey = modalDateKey || targetDateKey;

      if (dateKey > todayKey) {
        setFormError('Нельзя добавить запись на будущую дату.');
        setIsSaving(false);
        return;
      }

      const instrument = textValue(form.instrument).trim().toUpperCase();
      if (!instrument) {
        setFormError(traderMode ? 'Укажите символ инструмента.' : 'Выберите категорию или укажите свою.');
        setIsSaving(false);
        return;
      }

      const pnlText = textValue(form.pnl).trim();
      if (!pnlText) {
        setFormError('Укажите сумму в $.');
        setIsSaving(false);
        return;
      }

      const magnitude = parseFloat(pnlText);
      if (Number.isNaN(magnitude) || magnitude < 0) {
        setFormError('Сумма должна быть числом ≥ 0.');
        setIsSaving(false);
        return;
      }

      const signedPnl = form.sign === 'minus'
        ? -Math.abs(magnitude)
        : Math.abs(magnitude);

      const finalDirection =
        traderMode && form.direction
          ? form.direction
          : signedPnl >= 0 ? 'LONG' : 'SHORT';

      const time = textValue(form.time) || currentTimeHHMM();
      const comment = textValue(form.comment).trim();
      const platform = textValue(form.platform) || 'Manual';

      const tp = traderMode && textValue(form.takeProfit).trim() !== ''
        ? parseFloat(form.takeProfit)
        : null;

      const sl = traderMode && textValue(form.stopLoss).trim() !== ''
        ? parseFloat(form.stopLoss)
        : null;

      await hookSaveTrade({
        dateKey,
        isEditing: Boolean(editingTrade),
        editingTradeId: editingTrade?.id,
        time,
        instrument,
        direction: finalDirection,
        signedPnl,
        comment,
        platform,
        currency: form.currency || currency,
        takeProfit: tp,
        stopLoss: sl,
        traderMode,
      });

      setRecentInstruments((prev) =>
        [instrument, ...prev.filter((i) => i !== instrument)].slice(0, 5)
      );

      closeModal();
    } catch (err) {
      console.error('[save] unexpected error:', err);
      setFormError(
        navigator.onLine === false
          ? 'Не удалось поставить запись в очередь офлайн-синхронизации. Попробуйте ещё раз.'
          : (err?.message || 'Не удалось сохранить запись. Попробуйте ещё раз.')
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteTrade(dateKey, tradeId) {
    await hookDeleteTrade(dateKey, tradeId);
  }

  function jumpToTradeDate(dateKey) {
    const [y, m] = dateKey.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedKey(dateKey);
    setHistoryOpen(false);
  }

  // --- History browser: filterable, shows a total, click a trade to jump to its day
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWinLoss, setHistoryWinLoss] = useState('all'); // 'all' | 'win' | 'loss'
  const [historyCurrency, setHistoryCurrency] = useState(() => currency || 'USD');
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [historyPeriodMenuOpen, setHistoryPeriodMenuOpen] = useState(false);
  const [historyAnalysisOpen, setHistoryAnalysisOpen] = useState(false);
  const [proFiltersOpen, setProFiltersOpen] = useState(false);
  const [historyAnalysisTab, setHistoryAnalysisTab] = useState('overview');
  const [freeTimelineSelected, setFreeTimelineSelected] = useState(null);
  // 0 = latest window, 1 = previous 10 days, etc. Keeps the timeline browsable.
  const [freeTimelineOffset, setFreeTimelineOffset] = useState(0);
  const [freeDynamicsOpen, setFreeDynamicsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPeriodPreset, setExportPeriodPreset] = useState('Текущий период');
  const [confirmingClear, setConfirmingClear] = useState(false);

  const historyTrades = useMemo(() => {
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => arr.map((t) => ({ ...t, dateKey })))
      .filter((t) => t.dateKey >= dateFrom && t.dateKey <= dateTo)
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => historyCurrency === 'ALL' || (t.currency || 'USD') === historyCurrency)
      .filter((t) => historyWinLoss === 'all' || (historyWinLoss === 'win' ? t.pnl >= 0 : t.pnl < 0))
      .sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
  }, [manualTrades, dateFrom, dateTo, platformFilter, historyWinLoss, historyCurrency]);

  const historyByCurrency = useMemo(() => Object.entries(historyTrades.reduce((groups, trade) => {
    const code = trade.currency || 'USD';
    groups[code] = groups[code] || { income: 0, expense: 0, balance: 0, count: 0 };
    groups[code].income += trade.pnl > 0 ? trade.pnl : 0;
    groups[code].expense += trade.pnl < 0 ? Math.abs(trade.pnl) : 0;
    groups[code].balance += trade.pnl;
    groups[code].count += 1;
    return groups;
  }, {})), [historyTrades]);

  const historyTotal = useMemo(() => historyTrades.reduce((sum, t) => sum + t.pnl, 0), [historyTrades]);
  const historyIncome = useMemo(() => historyTrades.reduce((sum, t) => sum + (t.pnl > 0 ? t.pnl : 0), 0), [historyTrades]);
  const historyExpense = useMemo(() => historyTrades.reduce((sum, t) => sum + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0), [historyTrades]);
  const historyCurrencySymbol = historyCurrency === 'ALL' ? '' : getCurrencyMeta(historyCurrency).symbol;
  const historyInsights = useMemo(() => {
    if (traderMode || historyExpense === 0) return [];
    const expensesByCategory = {};
    const latePurchases = historyTrades.filter((t) => t.pnl < 0 && t.instrument === 'Покупки' && Number(textValue(t.time).slice(0, 2)) >= 20);
    for (const t of historyTrades.filter((t) => t.pnl < 0)) expensesByCategory[t.instrument || 'Другое'] = (expensesByCategory[t.instrument || 'Другое'] || 0) + Math.abs(t.pnl);
    const [topCategory, topAmount] = Object.entries(expensesByCategory).sort((a, b) => b[1] - a[1])[0] || [];
    const insights = topCategory ? [`${topCategory} — ${Math.round((topAmount / historyExpense) * 100)}% всех расходов.`] : [];
    if (latePurchases.length >= 2) insights.push(`Есть ${latePurchases.length} поздних покупок после 20:00 — проверь, не импульсивные ли они.`);
    return insights;
  }, [historyTrades, historyExpense, traderMode]);

  const historyAnalysis = useMemo(() => {
    const incomeSources = {}, expenseCategories = {}, daily = {};
    historyTrades.forEach((item) => {
      const source = item.instrument || 'Другое';
      daily[item.dateKey] = daily[item.dateKey] || { income: 0, expense: 0 };
      if (item.pnl >= 0) {
        incomeSources[source] = (incomeSources[source] || 0) + item.pnl;
        daily[item.dateKey].income += item.pnl;
      } else {
        const value = Math.abs(item.pnl);
        expenseCategories[source] = (expenseCategories[source] || 0) + value;
        daily[item.dateKey].expense += value;
      }
    });

    const sort = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const existingEntries = Object.entries(daily).sort((a, b) => a[0].localeCompare(b[0]));

    // Последовательная шкала: даже дни без операций остаются на графике.
    // Так динамика читается как период, а не как случайный набор столбиков.
    const toDate = (key) => {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    };
    const toKey = (date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

    let chartEntries = existingEntries;
    if (existingEntries.length) {
      const lastKey = existingEntries[existingEntries.length - 1][0];
      const lastDate = toDate(lastKey);
      const startDate = new Date(lastDate);
      startDate.setDate(lastDate.getDate() - 9);
      chartEntries = Array.from({ length: 10 }, (_, index) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + index);
        const key = toKey(date);
        return [key, daily[key] || { income: 0, expense: 0 }];
      });
    }

    const maxDaily = Math.max(1, ...chartEntries.map(([, v]) => Math.max(v.income, v.expense)));
    const totalIncome = Object.values(daily).reduce((sum, v) => sum + v.income, 0);
    const totalExpense = Object.values(daily).reduce((sum, v) => sum + v.expense, 0);
    const bestDay = existingEntries.length
      ? existingEntries.reduce((best, item) => item[1].income - item[1].expense > best[1].income - best[1].expense ? item : best)
      : null;

    return {
      incomeSources: sort(incomeSources),
      expenseCategories: sort(expenseCategories),
      dailyEntries: existingEntries,
      chartEntries,
      maxDaily,
      totalIncome,
      totalExpense,
      bestDay,
    };
  }, [historyTrades]);

  const historyTimeline = useMemo(() => {
    // Anchor to the last real operation. For "Вся история" dateTo can be 9999-12-31.
    const latestTradeKey = historyTrades.length
      ? historyTrades.reduce((latest, trade) => trade.dateKey > latest ? trade.dateKey : latest, historyTrades[0].dateKey)
      : null;
    const safeEndKey = latestTradeKey || (dateTo && dateTo < '2100-01-01' ? dateTo : keyFromDate(today));
    const end = parseDateKeyLocal(safeEndKey);
    // Every click on "earlier" moves one complete 10-day window back.
    end.setDate(end.getDate() - (freeTimelineOffset * 10));
    const points = [];
    for (let i = 9; i >= 0; i -= 1) {
      const d = new Date(end);
      d.setDate(d.getDate() - i);
      const key = keyFromDate(d);
      const day = historyTrades.filter((t) => t.dateKey === key);
      const income = day.reduce((sum, t) => sum + (t.pnl > 0 ? t.pnl : 0), 0);
      const expense = day.reduce((sum, t) => sum + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0);
      points.push({ key, label: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2, '0')}`, income, expense, net: income - expense, count: day.length });
    }
    const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
    return { points, max, from: points[0]?.label, to: points[points.length - 1]?.label };
  }, [historyTrades, dateTo, today, freeTimelineOffset]);

  const getHistoryCategoryIcon = (instrument) => {
    const normalized = String(instrument || '').trim().toUpperCase();
    if (normalized.includes('СИГАРЕТ') || normalized.includes('ТАБАК')) return Cigarette;
    if (normalized.includes('ЗАРПЛАТ') || normalized.includes('РАБОТ')) return Briefcase;
    if (normalized.includes('ЖИЛ') || normalized.includes('ДОМ') || normalized.includes('КВАРТИР')) return Home;
    if (normalized.includes('ПОДПИСК')) return Repeat2;
    if (normalized.includes('ЕДА') || normalized.includes('ПРОДУКТ') || normalized.includes('КАФЕ')) return Utensils;
    if (normalized.includes('ТРАНСПОРТ') || normalized.includes('ТАКСИ') || normalized.includes('АВТО')) return Car;
    if (normalized.includes('ПОДАР')) return Gift;
    if (normalized.includes('РАЗВЛЕЧ') || normalized.includes('ИГР')) return Gamepad2;
    if (normalized.includes('РЫБ')) return Fish;
    if (/BTC|ETH|XAU|NDX|NASDAQ|EURUSD|GBPUSD|USDJPY/.test(normalized)) return ChartCandlestick;
    return getMoneyCategoryMeta(instrument)?.icon || CircleDollarSign || MoreHorizontal;
  };

  const moneyCategoriesWithIcons = useMemo(() => {
    const base = Array.isArray(MONEY_CATEGORIES) ? MONEY_CATEGORIES.slice() : [];
    if (!base.some((item) => String(item.key || '').toUpperCase().includes('СИГАРЕТ'))) {
      base.push({ key: 'СИГАРЕТЫ', icon: Cigarette });
    }
    return base.map((item) => ({ ...item, icon: getHistoryCategoryIcon(item.key) }));
  }, []);

  function openHistory() {
    setHistoryOpen(true);
    setHistoryFiltersOpen(false);
    setProFiltersOpen(false);
    setConfirmingClear(false);
    // PRO opens its premium layer immediately; FREE gets a compact dynamic snapshot.
    setHistoryAnalysisOpen(Boolean(traderMode));
    setHistoryAnalysisTab('overview');
    requestAnimationFrame(() => setHistoryVisible(true));
  }

  function closeHistory() {
    setHistoryVisible(false);
    setHistoryFiltersOpen(false);
    setProFiltersOpen(false);
    setConfirmingClear(false);
    setTimeout(() => setHistoryOpen(false), 180);
  }

  async function handleClearHistory() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }
    await hookClearAllTrades();
    setConfirmingClear(false);
  }

  const exportTrades = useMemo(() => {
    const range = exportPeriodPreset === 'Текущий период'
      ? { from: dateFrom, to: dateTo }
      : getPresetRange(exportPeriodPreset, today);
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => (arr || []).map((item) => ({ ...item, dateKey })))
      .filter((item) => item.dateKey >= range.from && item.dateKey <= range.to)
      .filter((item) => historyCurrency === 'ALL' || (item.currency || 'USD') === historyCurrency)
      .filter((item) => historyWinLoss === 'all' || (historyWinLoss === 'win' ? item.pnl >= 0 : item.pnl < 0));
  }, [manualTrades, exportPeriodPreset, dateFrom, dateTo, today, historyCurrency, historyWinLoss]);

  function handleExportCsv() {
    const range = exportPeriodPreset === 'Текущий период'
      ? { from: dateFrom, to: dateTo }
      : getPresetRange(exportPeriodPreset, today);
    const title = `ДЕНЕЖНЫЙ КАЛЕНДАРЬ — Все ваши записи за период`;
    const periodLabel = `${formatDateLabel(range.from)} — ${formatDateLabel(range.to)}`;
    const rows = exportTrades.map((item) => [
      formatDateLabel(item.dateKey),
      item.time || '',
      item.instrument || 'Другое',
      item.pnl >= 0 ? 'Доход' : 'Расход',
      formatAmountInCurrency(item.pnl, item.currency || 'USD'),
      item.comment || '',
    ]);
    const totalIncome = exportTrades.reduce((sum, item) => sum + (item.pnl > 0 ? item.pnl : 0), 0);
    const totalExpense = exportTrades.reduce((sum, item) => sum + (item.pnl < 0 ? Math.abs(item.pnl) : 0), 0);
    const currencyMeta = historyCurrency === 'ALL' ? null : getCurrencyMeta(historyCurrency);
    const summary = currencyMeta ? [
      [], ['ИТОГ ЗА ПЕРИОД'], ['Доходы', `+${currencyMeta.symbol}${formatMoney(totalIncome)}`], ['Расходы', `−${currencyMeta.symbol}${formatMoney(totalExpense)}`], ['Баланс', `${totalIncome-totalExpense >= 0 ? '+' : '−'}${currencyMeta.symbol}${formatMoney(Math.abs(totalIncome-totalExpense))}`]
    ] : [];
    const csvRows = [[title], [`Период: ${periodLabel}`], [], ['Дата', 'Время', 'Категория', 'Тип', 'Сумма', 'Комментарий'], ...rows, ...summary];
    const csv = csvRows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money-calendar_${range.from}_${range.to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  }

  function handleEditDeposit() {
    const input = window.prompt('Размер депозита для расчёта %:', depositSize > 0 ? String(depositSize) : '1000');
    const value = parseFloat(input);
    if (!input || Number.isNaN(value) || value <= 0) return;
    setDepositSize(value);
  }

  // --- Platform connect: API keys (stub — wire to your backend) -------------
  function handleSaveApiKeys() {
    // TODO: send apiForm.{exchange,key,secret} to your backend to store the
    // connection securely and kick off the exchange sync job.
    closeConnectModal();
  }

  // --- Platform connect: CSV import (stub — wire to your backend) -----------
  function handleCsvDrop(e) {
    e.preventDefault();
    setCsvDragOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) setCsvFile(file);
  }

  function handleCsvSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (file) setCsvFile(file);
  }

  function handleImportCsv() {
    // TODO: upload csvFile to your backend / parsing skill and ingest the
    // resulting trades into manualTrades (or a dedicated store) once ready.
    closeConnectModal();
  }

  return (
    <div className={`premium-shell min-h-screen w-full flex flex-col transition-colors duration-300 ${isLight ? 'theme-light bg-zinc-100 text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-data { font-family: 'JetBrains Mono', monospace; }
        @keyframes cellGlowIn { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: scale(1); } }
        @keyframes themeIconPop { from { opacity: 0; transform: scale(0.4) rotate(-40deg); } to { opacity: 1; transform: scale(1) rotate(0deg); } }
        /* The screen was designed dark-first. These scoped replacements make
           every remaining dark utility class legible in the light theme,
           including the header, popovers and bottom sheets. */
        .theme-light .bg-zinc-950,
        .theme-light .bg-zinc-900 { background-color: #faf3eb !important; }
        .theme-light .bg-zinc-800 { background-color: #e8e0d8 !important; }
        .theme-light .bg-zinc-100 { background-color: #f5f0e8 !important; }
        .theme-light .bg-zinc-50 { background-color: #f8f2ea !important; }
        .theme-light .bg-white { background-color: #faf3eb !important; }
        .theme-light .text-zinc-50,
        .theme-light .text-zinc-100 { color: #18181b !important; }
        .theme-light .text-zinc-200 { color: #27272a !important; }
        .theme-light .text-zinc-300 { color: #3f3f46 !important; }
        .theme-light .text-zinc-400 { color: #52525b !important; }
        .theme-light .text-zinc-500 { color: #52525b !important; }
        .theme-light .text-zinc-600 { color: #3f3f46 !important; }
        .theme-light .text-zinc-700 { color: #27272a !important; }
        .theme-light .border-zinc-800,
        .theme-light .border-zinc-700 { border-color: #d4c8bc !important; }
        .theme-light .border-zinc-200 { border-color: #d4c8bc !important; }
        .theme-light .border-zinc-300 { border-color: #c8bcb0 !important; }
        /* Dark, unobtrusive scrollbars everywhere instead of the default
           bright OS scrollbar, which reads as a stray white line in this UI. */
        * { scrollbar-width: thin; scrollbar-color: #52525b transparent; }
        *::-webkit-scrollbar { height: 6px; width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: #52525b; border-radius: 9999px; }
        .theme-light *::-webkit-scrollbar-thumb { background-color: #a1a1aa; }
        .theme-light { scrollbar-color: #a1a1aa transparent; }
        /* Mobile layout: use the available viewport instead of leaving a huge empty area. */
        /* Premium visual system */
        .premium-shell { background-image: radial-gradient(circle at 12% -10%, rgba(251,191,36,.10), transparent 28%), radial-gradient(circle at 90% 5%, rgba(59,130,246,.06), transparent 24%); }
        .premium-surface { box-shadow: 0 18px 55px rgba(0,0,0,.18); }
        button { -webkit-tap-highlight-color: transparent; }
        button:focus-visible { outline: 2px solid rgba(251,191,36,.7); outline-offset: 2px; }
        .calendar-days-grid > button { border-radius: 14px !important; overflow: hidden; }
        @media (min-width: 640px) { .calendar-days-grid > button { border-radius: 18px !important; } }
        .calendar-days-grid > button:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(0,0,0,.16); }
        .calendar-days-grid > button:active { transform: scale(.985); }
        @keyframes premiumFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .history-fab { animation: premiumFloat 3.6s ease-in-out infinite; }
        .premium-shell { font-size: 15px; }
        .premium-shell .font-data { letter-spacing: .055em; }
        @media (max-width: 640px) { .premium-shell { font-size: 16px; } .premium-shell p, .premium-shell button { -webkit-font-smoothing: antialiased; } }
        @keyframes proEmber { 0%,100% { opacity:.55; transform:scale(.85) } 50% { opacity:1; transform:scale(1.15) } }
        .pro-ember { animation: proEmber 1.8s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
        @media (max-width: 639px) {
          .calendar-days-grid { flex: 1 1 auto; grid-auto-rows: minmax(76px, 1fr); }
        }
      `}</style>

      {/* HEADER */}
      <Header
        isLight={isLight} traderMode={traderMode} t={t} theme={theme} setTheme={setTheme}
        settingsRef={settingsRef} settingsOpen={settingsOpen} closeSettings={closeSettings}
        openSettings={openSettings} settingsVisible={settingsVisible} language={language}
        setLanguage={setLanguage} currency={currency} setCurrency={setCurrency} user={user}
        handleGoogleLogout={handleGoogleLogout} handleGoogleLogin={handleGoogleLogin}
        goToPrevMonth={goToPrevMonth} goToNextMonth={goToNextMonth}
        monthMenuRef={monthMenuRef} monthMenuOpen={monthMenuOpen} setMonthMenuOpen={setMonthMenuOpen}
        yearMenuRef={yearMenuRef} yearMenuOpen={yearMenuOpen} setYearMenuOpen={setYearMenuOpen}
        month={month} year={year} today={today} setViewMonth={setViewMonth} setViewYear={setViewYear}
        setSelectedKey={setSelectedKey} setTraderMode={setTraderMode} setPlatformFilter={setPlatformFilter}
        platformFilter={platformFilter} platformOptions={PLATFORMS}
        calendarTypeFilter={calendarTypeFilter} setCalendarTypeFilter={setCalendarTypeFilter}
        openConnectModal={openConnectModal} ctraderConnected={ctraderConnected}
        installInfoRef={installInfoRef} handleInstallClick={handleInstallClick}
        pendingSyncCount={pendingSyncCount} installInfoOpen={installInfoOpen} installInstructions={installInstructions}
      />

      {/* PRO controls live in Header: one clean control center, no floating duplicate block. */}
      <CalendarGrid
        cells={cells} selectedKey={selectedKey} isLight={isLight} monthMaxAbsPnl={monthMaxAbsPnl}
        tradesForDayFiltered={tradesForDayFiltered} totalPnlForDay={totalPnlForDay}
        formatPnlDisplay={formatPnlDisplay} onSelectDay={setSelectedKey}
        onEmptyClick={() => setSelectedKey(null)}
        onTouchStart={(e) => { calendarTouchStart.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => {
          const startX = calendarTouchStart.current;
          const endX = e.changedTouches[0]?.clientX;
          calendarTouchStart.current = null;
          if (startX == null || endX == null || Math.abs(endX - startX) < 48) return;
          if (endX < startX) goToNextMonth(); else goToPrevMonth();
        }}
      />

      {/* DAY VIEW — bottom sheet, tap the dimmed backdrop anywhere to return to the calendar */}
      {selectedKey && (
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onMouseDown={handleBackdropMouseDown}
        onClick={(e) => { if (mouseDownOnBackdrop.current) setSelectedKey(null); }}
      >
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-2xl border-t shadow-2xl overflow-y-auto transition-colors duration-200 ${isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-950'}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="max-w-3xl mx-auto px-3 sm:px-8 py-4 sm:py-8 flex flex-col gap-4">
          <div className={`mx-auto h-1 w-10 rounded-full -mt-1 mb-1 ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">{selectedKey}</p>
              <p className="text-[11px] text-zinc-500 mb-0.5">{traderMode ? t('overallResult') : t('balanceOfDay')}</p>
              <div className="flex items-center gap-2">
                {periodStats.count > 0 &&
                  (periodStats.pnl >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-400" />
                  ))}
                <span
                  className={`font-data text-lg font-semibold ${
                    periodStats.count === 0 ? 'text-zinc-600' : periodStats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {periodStats.count === 0 ? '—' : `${periodStats.pnl >= 0 ? '+' : '-'}${currencySymbol}${formatMoney(periodStats.pnl)}`}
                </span>
              </div>
            </div>
          </div>

          <div className={`inline-flex items-center self-start rounded-md border overflow-hidden ${isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-700 bg-zinc-900'}`}>
            <button
              onClick={() => openModal()}
              disabled={isFutureSelected}
              title={isFutureSelected ? (traderMode ? 'Нельзя добавить сделку на будущую дату' : t('recordFutureBlocked')) : undefined}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${isLight ? 'text-zinc-700 hover:bg-zinc-200' : 'text-zinc-200 hover:bg-zinc-800'}`}
            >
              <Plus className="h-4 w-4" />
              {traderMode ? t('addTrade') : t('addRecord')}
            </button>
          </div>

          {traderMode ? (
            <div className={`flex items-center gap-2 rounded-md border px-4 py-2 font-data text-xs ${isLight ? 'border-zinc-300 bg-zinc-50 text-zinc-500' : 'border-zinc-800 bg-zinc-900 text-zinc-400'}`}>
              <span>{t('trades')}: <span className={isLight ? 'text-zinc-900 font-medium' : 'text-zinc-100 font-medium'}>{periodStats.count}</span></span>
              <span className={isLight ? 'text-zinc-300' : 'text-zinc-700'}>•</span>
              <span>PnL: <span className={`font-medium ${periodStats.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{periodStats.pnl >= 0 ? '+' : '-'}{currencySymbol}{formatMoney(periodStats.pnl)}</span></span>
              <span className={isLight ? 'text-zinc-300' : 'text-zinc-700'}>•</span>
              <span>{t('winrate')}: <span className={isLight ? 'text-zinc-900 font-medium' : 'text-zinc-100 font-medium'}>{periodStats.winrate}%</span></span>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <div className={`rounded-lg border px-3 py-2.5 ${isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-800 bg-zinc-900'}`}>
                <p className={`text-[10px] uppercase tracking-wider mb-1 ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('operations')}</p>
                <p className={`font-data text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{periodStats.count}</p>
              </div>
              <div className={`rounded-lg border px-3 py-2.5 ${isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-800 bg-zinc-900'}`}>
                <p className={`text-[10px] uppercase tracking-wider mb-1 ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('income')}</p>
                <p className="font-data text-sm text-emerald-500">+{currencySymbol}{formatMoney(periodTrades.reduce((sum, t) => sum + (t.pnl > 0 ? t.pnl : 0), 0))}</p>
              </div>
              <div className={`rounded-lg border px-3 py-2.5 ${isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-800 bg-zinc-900'}`}>
                <p className={`text-[10px] uppercase tracking-wider mb-1 ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('expense')}</p>
                <p className="font-data text-sm text-red-500">−{currencySymbol}{formatMoney(periodTrades.reduce((sum, t) => sum + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0))}</p>
              </div>
            </div>
          )}

          {selectedDayTrades.length > 0 ? (
            <div className={`rounded-lg border divide-y ${isLight ? 'border-zinc-300 bg-zinc-50 divide-zinc-200' : 'border-zinc-800 bg-zinc-900 divide-zinc-800'}`}>
              {selectedDayTrades.map((trade) => (
                <div key={trade.id} className="px-4 py-3 group">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className={`font-data text-xs w-12 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>{trade.time}</span>
                      <span className={`text-sm font-medium ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{trade.instrument}</span>
                      <span
                        className={[
                          'font-data text-[11px] tracking-wider px-2 py-0.5 rounded-full',
                          trade.pnl >= 0
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-red-500/10 text-red-500',
                        ].join(' ')}
                      >
                        {trade.pnl >= 0 ? (traderMode ? 'Прибыль' : 'Доход') : (traderMode ? 'Убыток' : 'Расход')}
                      </span>
                      <span className={`font-data text-[10px] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{trade.platform}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-data text-sm font-medium ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatAmountInCurrency(trade.pnl, trade.currency || 'USD')}
                      </span>
                      <button
                        onClick={() => openModal(trade)}
                        className={`transition-colors opacity-0 group-hover:opacity-100 ${isLight ? 'text-zinc-400 hover:text-amber-500' : 'text-zinc-600 hover:text-amber-400'}`}
                        aria-label={traderMode ? 'Редактировать сделку' : t('editRecord')}
                        title={traderMode ? 'Редактировать сделку' : t('editRecord')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrade(trade.dateKey, trade.id)}
                        className={`transition-colors opacity-0 group-hover:opacity-100 ${isLight ? 'text-zinc-400 hover:text-red-500' : 'text-zinc-600 hover:text-red-400'}`}
                        aria-label={traderMode ? 'Удалить сделку' : t('deleteRecord')}
                        title={traderMode ? 'Удалить сделку' : t('deleteRecord')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {trade.comment && <p className={`text-xs mt-1.5 pl-16 leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{trade.comment}</p>}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center py-16">
              <div className={`text-center max-w-sm border border-dashed rounded-xl px-10 py-10 ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
                <Inbox className={`h-8 w-8 mx-auto mb-4 ${isLight ? 'text-zinc-300' : 'text-zinc-700'}`} />
                <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{traderMode ? 'Сделок за этот день пока нет' : 'Записей за этот день пока нет'}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      )}

      {/* bottom "История" entry point — search/browse all saved trades */}
      <div className="history-fab fixed bottom-4 sm:bottom-4 inset-x-0 flex justify-center z-30 pointer-events-none">
        <button
          onClick={openHistory}
          className={`pointer-events-auto group flex items-center gap-2.5 rounded-full border backdrop-blur-xl px-5 py-3 text-base shadow-[0_14px_40px_rgba(0,0,0,.24)] transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
            isLight
              ? 'border-zinc-300/90 bg-white/95 text-zinc-700 hover:border-amber-400/70 hover:text-amber-600'
              : 'border-zinc-700/90 bg-zinc-900/95 text-zinc-100 hover:border-amber-400/70 hover:text-amber-300'
          }`}
        >
          <span className="h-7 w-7 rounded-full bg-amber-400/10 flex items-center justify-center group-hover:bg-amber-400/15 transition-colors"><History className="h-4 w-4 text-amber-500" /></span>
          <span className="relative font-medium">{t('history')}{traderMode && <span className="ml-1 text-amber-400">✦</span>}</span>
        </button>
      </div>

      {/* HISTORY MODAL — улучшен визуал для светлой темы + кнопка синхронизации cTrader */}
      {historyOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 sm:px-4 transition-opacity duration-200 ${
            historyVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeHistory(); }}
        >
          <div
            className={`relative w-full ${traderMode ? 'max-w-2xl' : 'max-w-lg'} flex flex-col overflow-hidden rounded-2xl border shadow-2xl transition-all duration-200 ${
              historyVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
            style={{ maxHeight: 'min(90svh, 90vh, calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 32px))' }}
          >
            <div className={`flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b ${isLight ? 'border-zinc-200' : 'border-zinc-800/80'}`}>
              <div>
                <p className="font-data text-[10px] tracking-[0.22em] text-amber-400 uppercase mb-1">
                  {traderMode ? 'История сделок' : t('myMoney')}
                </p>
                <h2 className={`font-display text-xl font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>
                  {traderMode
                    ? (periodPreset === 'Вся история' ? 'Вся история' : dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`)
                    : t('financialHistory')}
                </h2>
              </div>
              <button
                onClick={closeHistory}
                className={`rounded-full p-2 transition-colors ${
                  isLight ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`overflow-y-auto px-5 sm:px-6 py-5 flex-1 min-h-0 ${isLight ? 'bg-zinc-50/50' : ''}`} style={{ overscrollBehavior: 'contain' }}>
              {/* FREE — Динамика периода (скрыта по умолчанию, раскрывается по кнопке) */}
              {!traderMode && (
                <section className="mb-4">
                  {/* Кнопка-аккордеон */}
                  <button
                    type="button"
                    onClick={() => setFreeDynamicsOpen((v) => !v)}
                    className={`w-full group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                      freeDynamicsOpen
                        ? isLight ? 'border-emerald-300/70 bg-emerald-50/60' : 'border-emerald-500/30 bg-emerald-500/[0.06]'
                        : isLight ? 'border-zinc-300 bg-white hover:border-emerald-400/50 hover:shadow-md' : 'border-zinc-800 bg-zinc-950/70 hover:border-emerald-500/35 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${freeDynamicsOpen ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-500' : isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-400 group-hover:border-emerald-300/50 group-hover:text-emerald-500' : 'border-zinc-800 bg-zinc-900 text-zinc-500 group-hover:border-emerald-500/25 group-hover:text-emerald-500'}`}>
                          <TrendingUp className="h-4 w-4" />
                        </span>
                        <span>
                          <span className={`block text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{t('freeDynamicsBtn')}</span>
                          <span className="block mt-0.5 text-[11px] text-zinc-500">{t('freeDynamicsBtnSub')}</span>
                        </span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className={`font-data text-sm font-semibold tabular-nums ${historyTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {historyCurrency === 'ALL' ? t('allCurrencies') : `${historyTotal >= 0 ? '+' : '−'}${historyCurrencySymbol}${formatMoneyShort(Math.abs(historyTotal))}`}
                        </span>
                        <ChevronDown className={`h-4 w-4 text-emerald-500 transition-transform duration-300 ${freeDynamicsOpen ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                  </button>

                  {/* Содержимое аккордеона */}
                  {freeDynamicsOpen && (
                    <div className={`mt-2 overflow-hidden rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950'}`}>
                      {/* Переключатель валюты */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-3">
                        <span className="mr-1 shrink-0 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{t('show')}</span>
                        {[{ code: 'ALL', symbol: t('all'), label: t('allCurrencies') }, ...CURRENCIES].map((c) => (
                          <button key={c.code} type="button" onClick={() => setHistoryCurrency(c.code)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-data transition-all ${historyCurrency === c.code ? 'border-amber-400/60 bg-amber-400/10 text-amber-500' : isLight ? 'border-zinc-200 bg-white text-zinc-500' : 'border-zinc-800 bg-zinc-950 text-zinc-500'}`}>{c.symbol} <span className="opacity-70">{c.code === 'ALL' ? '' : c.code}</span></button>
                        ))}
                      </div>

                      <div className={`rounded-2xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-black/20'}`}>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex gap-3 text-[10px]"><span className="text-emerald-500">● {t('incomeLabel')}</span><span className="text-red-400">● {t('expenseLabel')}</span></div>
                          <span className="text-[10px] text-zinc-500">{historyTimeline.from} — {historyTimeline.to}</span>
                        </div>
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <button type="button" onClick={() => setFreeTimelineOffset((v) => v + 1)} className={`rounded-lg border px-3 py-1.5 text-xs font-data transition-colors ${isLight ? 'border-zinc-200 bg-white text-zinc-600 hover:border-amber-400/50' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-amber-400/40'}`}>{t('earlier')}</button>
                          <span className="text-[10px] text-zinc-500">{t('clickColumnHint')}</span>
                          <button type="button" disabled={freeTimelineOffset === 0} onClick={() => setFreeTimelineOffset((v) => Math.max(0, v - 1))} className={`rounded-lg border px-3 py-1.5 text-xs font-data transition-colors disabled:opacity-30 ${isLight ? 'border-zinc-200 bg-white text-zinc-600 hover:border-amber-400/50' : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-amber-400/40'}`}>{t('later')}</button>
                        </div>
                        {historyCurrency === 'ALL' && <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/[0.05] px-2.5 py-2 text-[10px] leading-relaxed text-zinc-500">{t('allCurrenciesNotice')}</p>}
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 items-end h-44 sm:h-48">
                          {historyTimeline.points.map((point) => {
                            const incomeH = point.income ? Math.max(7, Math.round((point.income / historyTimeline.max) * 100)) : 3;
                            const expenseH = point.expense ? Math.max(7, Math.round((point.expense / historyTimeline.max) * 100)) : 3;
                            const active = point.income || point.expense;
                            const net = point.net;
                            const selected = freeTimelineSelected === point.key;
                            return <button type="button" key={point.key} onClick={() => setFreeTimelineSelected(selected ? null : point.key)} className={`group min-w-0 h-full rounded-xl px-1 pt-2 pb-1 flex flex-col justify-end transition-all ${selected ? (isLight ? 'bg-white shadow-md ring-1 ring-amber-400/40' : 'bg-white/[0.04] ring-1 ring-amber-400/30') : 'hover:bg-zinc-500/[0.04]'}`}>
                              <span className={`mb-1 min-h-[28px] text-center text-[9px] sm:text-[10px] font-data leading-tight ${!active ? 'text-zinc-400' : net >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{active ? `${net >= 0 ? '+' : '−'}${formatMoneyShort(Math.abs(net))}` : '—'}</span>
                              <div className="flex flex-1 items-end justify-center gap-1"><span className="w-2.5 sm:w-3 rounded-t-md bg-gradient-to-t from-emerald-600/70 to-emerald-300/90 transition-all" style={{height:`${incomeH}%`}} /><span className="w-2.5 sm:w-3 rounded-t-md bg-gradient-to-t from-red-700/65 to-red-400/85 transition-all" style={{height:`${expenseH}%`}} /></div>
                              <span className="mt-2 text-center text-[9px] text-zinc-500">{point.label}</span>
                            </button>;
                          })}
                        </div>
                        {(() => { const fallback = [...historyTimeline.points].reverse().find((x) => x.income || x.expense)?.key || historyTimeline.points[historyTimeline.points.length - 1]?.key; const p = historyTimeline.points.find((x) => x.key === (freeTimelineSelected || fallback)); return p ? <div className={`mt-3 grid grid-cols-3 gap-2 rounded-xl border p-2.5 text-center ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/60'}`}><div><p className="text-[9px] text-zinc-500">{t('incomeLabel')}</p><p className="mt-1 text-xs font-data text-emerald-500">+{historyCurrencySymbol}{formatMoneyShort(p.income)}</p></div><div><p className="text-[9px] text-zinc-500">{t('expenseLabel')}</p><p className="mt-1 text-xs font-data text-red-400">−{historyCurrencySymbol}{formatMoneyShort(p.expense)}</p></div><div><p className="text-[9px] text-zinc-500">{t('result')} · {p.label} · {p.count}</p><p className={`mt-1 text-xs font-data ${p.net >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{p.net >= 0 ? '+' : '−'}{historyCurrencySymbol}{formatMoneyShort(Math.abs(p.net))}</p></div></div> : null; })()}
                      </div>

                      {/* Итог периода */}
                      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-zinc-500/10 pt-4">
                        <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">{t('incomeLabel')}</p><p className="mt-1 text-sm font-data text-emerald-500">+{historyCurrencySymbol}{formatMoneyShort(historyIncome)}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">{t('expenseLabel')}</p><p className="mt-1 text-sm font-data text-red-500">−{historyCurrencySymbol}{formatMoneyShort(historyExpense)}</p></div>
                        <div><p className="text-[10px] uppercase tracking-wide text-zinc-500">{t('recordsCount')}</p><p className={`mt-1 text-sm font-data ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{historyTrades.length}</p></div>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* FREE — Обзор денег (анализ источников, всегда скрыт под toggle) */}
              {!traderMode && historyTrades.length > 0 && (
                <section className="mb-4">
                  <button
                    type="button"
                    onClick={() => setHistoryAnalysisOpen((v) => !v)}
                    className={`w-full group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 ${
                      historyAnalysisOpen
                        ? isLight ? 'border-amber-300/60 bg-amber-50/60' : 'border-amber-400/30 bg-amber-400/[0.06]'
                        : isLight ? 'border-zinc-300 bg-white hover:border-amber-400/40 hover:shadow-md' : 'border-zinc-800 bg-zinc-950/70 hover:border-amber-400/30 hover:bg-zinc-900'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-colors ${historyAnalysisOpen ? 'border-amber-400/30 bg-amber-400/10 text-amber-500' : isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-400 group-hover:text-amber-500' : 'border-zinc-800 bg-zinc-900 text-zinc-500 group-hover:text-amber-500'}`}>
                          <Sparkles className="h-4 w-4" />
                        </span>
                        <span>
                          <span className={`block text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{t('freeAnalysisTitle')}</span>
                          <span className="block mt-0.5 text-[11px] text-zinc-500">{t('freeAnalysisSub')}</span>
                        </span>
                      </span>
                      <ChevronDown className={`h-4 w-4 text-amber-500 shrink-0 transition-transform duration-300 ${historyAnalysisOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {historyAnalysisOpen && (
                    <div className={`mt-2 overflow-hidden rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-amber-200/60 bg-white shadow-sm' : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.05] via-zinc-950 to-zinc-950'}`}>
                      {/* Финансовый вывод */}
                      <div className={`mb-4 rounded-xl border px-4 py-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/20'}`}>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 mb-1">{t('financialSummary')}</p>
                        <p className={`text-sm font-medium leading-relaxed ${historyIncome > historyExpense ? 'text-emerald-600' : historyExpense > 0 ? 'text-red-500' : (isLight ? 'text-zinc-600' : 'text-zinc-400')}`}>
                          {historyIncome > historyExpense ? t('flowSummaryPositive') : historyExpense > 0 ? t('flowSummaryNegative') : t('flowSummaryEmpty')}
                        </p>
                      </div>
                      {/* Мини-вкладки */}
                      <div className="flex gap-1 mb-4 overflow-x-auto pb-0.5">
                        {[['overview', t('overview')], ['income', t('fromWhere')], ['expense', t('whereGo')]].map(([key, label]) => (
                          <button key={key} onClick={() => setHistoryAnalysisTab(key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${historyAnalysisTab === key ? 'bg-amber-400/15 text-amber-600' : isLight ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-500 hover:bg-zinc-900'}`}>{label}</button>
                        ))}
                      </div>
                      {historyAnalysisTab === 'overview' && (
                        <>
                          <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}><p className="text-[10px] text-zinc-500 mb-1">{t('incomeLabel')}</p><p className="font-data text-xs text-emerald-600 tabular-nums truncate">+{historyCurrencySymbol}{formatMoney(historyIncome)}</p></div>
                            <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}><p className="text-[10px] text-zinc-500 mb-1">{t('expenseLabel')}</p><p className="font-data text-xs text-red-600 tabular-nums truncate">−{historyCurrencySymbol}{formatMoney(historyExpense)}</p></div>
                            <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}><p className="text-[10px] text-zinc-500 mb-1">{t('recordsCount')}</p><p className="font-data text-sm">{historyTrades.length}</p></div>
                          </div>
                          <div className={`flex items-end gap-1 h-24 rounded-xl border p-3 overflow-x-auto ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/20'}`}>
                            {historyAnalysis.dailyEntries.length ? historyAnalysis.dailyEntries.map(([date, stats]) => (
                              <button key={date} title={date} className="group min-w-[18px] flex-1 h-full flex flex-col justify-end gap-0.5">
                                <span className="w-full rounded-t bg-emerald-500/75 transition-all group-hover:bg-emerald-400" style={{ height: `${Math.max(4, (stats.income / historyAnalysis.maxDaily) * 100)}%` }} />
                                <span className="w-full rounded-t bg-red-500/70 transition-all group-hover:bg-red-400" style={{ height: `${Math.max(3, (stats.expense / historyAnalysis.maxDaily) * 100)}%` }} />
                              </button>
                            )) : <p className="m-auto text-xs text-zinc-500">{t('noRecords')}</p>}
                          </div>
                        </>
                      )}
                      {historyAnalysisTab === 'income' && (
                        <div className="space-y-3">
                          {historyAnalysis.incomeSources.length ? historyAnalysis.incomeSources.slice(0,5).map(([name, value]) => (
                            <div key={name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate font-medium">{name}</span><span className="font-data text-emerald-600 tabular-nums">+{historyCurrencySymbol}{formatMoney(value)}</span></div><div className="h-1.5 rounded-full bg-zinc-500/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{width:`${Math.max(5,(value/(historyIncome||1))*100)}%`}} /></div></div>
                          )) : <p className="py-5 text-center text-sm text-zinc-500">{t('noIncomePeriod')}</p>}
                        </div>
                      )}
                      {historyAnalysisTab === 'expense' && (
                        <div className="space-y-3">
                          {historyAnalysis.expenseCategories.length ? historyAnalysis.expenseCategories.slice(0,5).map(([name, value]) => (
                            <div key={name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate font-medium">{name}</span><span className="font-data text-red-600 tabular-nums">−{historyCurrencySymbol}{formatMoney(value)}</span></div><div className="h-1.5 rounded-full bg-zinc-500/10 overflow-hidden"><div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{width:`${Math.max(5,(value/(historyExpense||1))*100)}%`}} /></div></div>
                          )) : <p className="py-5 text-center text-sm text-zinc-500">{t('noExpensePeriod')}</p>}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              )}

              {traderMode && <button
                onClick={() => setHistoryAnalysisOpen((v) => !v)}
                disabled={historyTrades.length === 0}
                className={`mb-4 w-full group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 ${
                  historyAnalysisOpen
                    ? 'border-amber-400/50 bg-amber-400/10 shadow-[0_10px_30px_rgba(251,191,36,.08)]'
                    : isLight ? 'border-zinc-300 bg-white hover:border-amber-400/50 hover:shadow-lg' : 'border-zinc-800 bg-zinc-950/70 hover:border-amber-400/45 hover:bg-zinc-900'
                }`}
              >
                <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-amber-400/10 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/25 bg-amber-400/10 text-amber-500 group-hover:scale-110 transition-transform"><Sparkles className="h-4 w-4" /></span>
                    <span>
                      <span className={`block text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{historyAnalysisOpen ? 'Анализ открыт' : 'Открыть анализ'}</span>
                      <span className="block mt-0.5 text-[11px] text-zinc-500">Динамика · источники денег · структура расходов</span>
                    </span>
                  </span>
                  <ChevronDown className={`h-4 w-4 text-amber-500 transition-transform duration-300 ${historyAnalysisOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>}
              {traderMode && historyAnalysisOpen && (
                <section className={`relative overflow-hidden mb-5 rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-amber-300/70 bg-white shadow-sm' : 'border-amber-400/20 bg-gradient-to-br from-amber-400/[0.08] via-zinc-950 to-zinc-950 shadow-[0_18px_60px_rgba(0,0,0,.28)]'}`}>
                  <div className="absolute -right-8 -top-10 select-none pointer-events-none font-display text-8xl font-bold tracking-tighter text-amber-400/[0.045]">PRO</div>
                  <div className="relative flex items-start justify-between gap-4 mb-4">
                    <div>
                      <p className="font-data text-[10px] uppercase tracking-[0.24em] text-amber-500">PRO · Финансовая картина</p>
                      <h3 className={`mt-1 text-lg font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Деньги в движении</h3>
                      <p className="mt-1 text-xs text-zinc-500">Личный финансовый intelligence — без лишнего шума.</p>
                    </div>
                    <Sparkles className="h-5 w-5 shrink-0 text-amber-500" />
                  </div>

                  <div className="relative mb-5 overflow-x-auto pb-1">
                    <div className={`inline-flex min-w-max gap-1 rounded-xl border p-1 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/5 bg-black/20'}`}>
                      {[{ code: 'ALL', symbol: 'Все', label: 'Все валюты' }, ...CURRENCIES].map((c) => (
                        <button key={c.code} onClick={() => setHistoryCurrency(c.code)} title={c.label} className={`rounded-lg px-3 py-1.5 text-xs font-data transition-all ${historyCurrency === c.code ? 'bg-amber-400/15 text-amber-500 shadow-sm ring-1 ring-amber-400/20' : 'text-zinc-500 hover:text-zinc-300'}`}>{c.symbol} <span className="ml-1 opacity-60">{c.code === 'ALL' ? '' : c.code}</span></button>
                      ))}
                    </div>
                  </div>

                  {historyCurrency === 'ALL' ? (
                    <div className="mb-5 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {historyByCurrency.length ? historyByCurrency.map(([code, stats]) => {
                          const meta = getCurrencyMeta(code);
                          return <button key={code} onClick={() => setHistoryCurrency(code)} className={`rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 ${isLight ? 'border-zinc-200 bg-zinc-50 hover:border-amber-400/40' : 'border-zinc-800 bg-black/20 hover:border-amber-400/35'}`}>
                            <span className="text-[10px] text-zinc-500">{code}</span>
                            <span className={`mt-1 block font-data text-sm sm:text-base font-semibold tabular-nums leading-tight break-all ${stats.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.balance >= 0 ? '+' : '−'}{meta.symbol}{formatMoneyShort(Math.abs(stats.balance))}</span>
                            <span className="mt-1 block text-[10px] text-zinc-500">{stats.count} операций · открыть анализ</span>
                          </button>;
                        }) : <p className="col-span-full py-8 text-center text-sm text-zinc-500">За выбранный период пока нет данных.</p>}
                      </div>
                      <div className={`rounded-2xl border p-3 sm:p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-white/5 bg-black/20'}`}>
                        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold">Динамика по валютам</p><p className="mt-1 text-[10px] text-zinc-500">Валюты не смешиваются — каждая сохраняет собственный масштаб.</p></div><span className="text-[10px] text-amber-500">PRO</span></div>
                        <div className="grid gap-2">
                          {historyByCurrency.map(([code, stats]) => { const meta = getCurrencyMeta(code); return <button key={code} onClick={() => setHistoryCurrency(code)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800/80 bg-zinc-900/40'}`}><span><span className="block text-xs font-medium">{meta.symbol} {code}</span><span className="mt-0.5 block text-[10px] text-zinc-500">{stats.count} операций за период</span></span><span className={`font-data text-sm ${stats.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.balance >= 0 ? '+' : '−'}{meta.symbol}{formatMoney(Math.abs(stats.balance))}</span></button>; })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`relative mb-5 overflow-hidden rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/5 bg-black/20'}`}>
                        <div className="absolute -right-3 -bottom-6 select-none pointer-events-none font-display text-7xl sm:text-8xl font-bold tracking-tighter text-emerald-500/[0.045]">{historyCurrency}</div>
                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-wider text-zinc-500">Результат за период</p>
                            <p className={`mt-2 font-display font-semibold tracking-tight tabular-nums leading-none break-all text-[clamp(1.75rem,9vw,3.5rem)] ${historyTotal >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                              {historyTotal >= 0 ? '+' : '−'}{historyCurrencySymbol}{formatMoney(Math.abs(historyTotal))}
                            </p>
                            <p className="mt-3 text-[11px] text-zinc-500">{historyTrades.length} операций · {historyCurrency} · выбранный период</p>
                          </div>
                          <div className={`shrink-0 rounded-xl border px-3 py-2 text-right ${isLight ? 'border-amber-200 bg-white/80' : 'border-amber-400/15 bg-amber-400/[0.04]'}`}>
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Статус</p>
                            <p className={`mt-1 text-xs font-semibold ${historyTotal >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>{historyTotal >= 0 ? 'Положительный' : 'Требует внимания'}</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
                        {[
                          ['Доходы', historyIncome, 'text-emerald-500'],
                          ['Расходы', historyExpense, 'text-red-500'],
                          ['Баланс', Math.abs(historyTotal), historyTotal >= 0 ? 'text-emerald-500' : 'text-red-500'],
                        ].map(([label, amount, color]) => (
                          <div key={label} className={`min-w-0 rounded-xl border p-2.5 sm:p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900/50'}`}>
                            <p className="text-[9px] sm:text-[10px] text-zinc-500">{label}</p>
                            <p className={`mt-1 font-data text-sm sm:text-xs font-semibold tabular-nums leading-tight whitespace-nowrap ${color}`}>{label === 'Расходы' ? '−' : label === 'Баланс' && historyTotal >= 0 ? '+' : '+'}{historyCurrencySymbol}{formatMoneyShort(amount)}</p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
                    {[['overview','Обзор'],['income','Откуда'],['expense','Куда'],['radar','Радар'],['habits','Привычки']].map(([key,label]) => <button key={key} onClick={() => setHistoryAnalysisTab(key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${historyAnalysisTab === key ? 'bg-gradient-to-r from-amber-400/20 to-amber-500/5 text-amber-400 ring-1 ring-amber-400/25 shadow-[0_8px_24px_rgba(251,191,36,.08)]' : isLight ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-500 hover:bg-white/5'}`}>{label}</button>)}
                  </div>

                  {historyAnalysisTab === 'overview' && (
                    <div>
                      <div className={`relative overflow-hidden rounded-2xl border p-3 sm:p-4 mb-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}>
                        <div className="absolute inset-x-4 top-[52%] border-t border-dashed border-zinc-500/15 pointer-events-none" />
                        <div className="relative mb-4 flex items-end justify-between gap-3">
                          <div>
                            <span className="text-sm font-semibold">Динамика периода</span>
                            <p className="mt-1 text-[10px] text-zinc-500">Последние 10 календарных дней. Значение видно сразу — без наведения.</p>
                          </div>
                          <div className="flex shrink-0 gap-2 text-[9px]"><span className="text-emerald-500">● Приход</span><span className="text-red-400">● Расход</span></div>
                        </div>
                        {historyAnalysis.chartEntries.length ? (
                          <div className="relative grid grid-cols-5 sm:grid-cols-10 gap-x-1.5 gap-y-3 items-end h-52 sm:h-44">
                            {historyAnalysis.chartEntries.map(([date, stats]) => {
                              const net = stats.income - stats.expense;
                              const active = stats.income > 0 || stats.expense > 0;
                              return <div key={date} className="min-w-0 h-full flex flex-col justify-end">
                                <div className={`mb-1 min-h-[14px] text-center text-[10px] sm:text-[11px] font-data tabular-nums ${!active ? 'text-zinc-700' : net >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                  {active ? `${net >= 0 ? '+' : '−'}${formatMoneyShort(Math.abs(net))}` : '—'}
                                </div>
                                <div className="relative flex flex-1 items-end justify-center gap-1">
                                  <span className={`w-2.5 sm:w-3 rounded-t-md transition-all duration-500 ${stats.income > 0 ? 'bg-gradient-to-t from-emerald-600/70 to-emerald-300/90 shadow-[0_0_16px_rgba(16,185,129,.18)]' : 'bg-emerald-500/[0.06]'}`} style={{height:`${stats.income > 0 ? Math.max(6,(stats.income/historyAnalysis.maxDaily)*100) : 3}%`}} />
                                  <span className={`w-2.5 sm:w-3 rounded-t-md transition-all duration-500 ${stats.expense > 0 ? 'bg-gradient-to-t from-red-700/65 to-red-400/85 shadow-[0_0_16px_rgba(248,113,113,.12)]' : 'bg-red-500/[0.05]'}`} style={{height:`${stats.expense > 0 ? Math.max(5,(stats.expense/historyAnalysis.maxDaily)*100) : 3}%`}} />
                                </div>
                                <span className={`mt-2 text-center text-[10px] sm:text-[11px] ${active ? 'text-zinc-500' : 'text-zinc-700'}`}>{date.slice(8,10)}</span>
                              </div>;
                            })}
                          </div>
                        ) : <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-800 text-xs text-zinc-500">Добавь ещё несколько операций — здесь появится динамика периода.</div>}
                      </div>
                      <div className="grid sm:grid-cols-3 gap-2">
                        <button onClick={() => setHistoryAnalysisTab('income')} className={`text-left rounded-xl p-3 transition-transform hover:-translate-y-0.5 ${isLight ? 'bg-emerald-50' : 'bg-emerald-500/[0.07]'}`}><p className="text-[10px] text-zinc-500">Главный источник</p><p className="mt-1 text-xs font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p><p className="mt-1 text-[10px] text-emerald-500">Открыть структуру →</p></button>
                        <button onClick={() => setHistoryAnalysisTab('expense')} className={`text-left rounded-xl p-3 transition-transform hover:-translate-y-0.5 ${isLight ? 'bg-red-50' : 'bg-red-500/[0.07]'}`}><p className="text-[10px] text-zinc-500">Зона расходов</p><p className="mt-1 text-xs font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p><p className="mt-1 text-[10px] text-red-400">Посмотреть детали →</p></button>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-amber-50' : 'bg-amber-500/[0.07]'}`}><p className="text-[10px] text-zinc-500">Финансовый вывод</p><p className="mt-1 text-xs font-semibold leading-relaxed">{historyIncome > historyExpense ? 'Поток положительный: доходы покрывают расходы.' : historyExpense > 0 ? 'Расходы сейчас сильнее — стоит посмотреть структуру.' : 'Данных пока мало для уверенного вывода.'}</p></div>
                      </div>
                    </div>
                  )}
                  {historyAnalysisTab === 'income' && <div className="space-y-3">{historyAnalysis.incomeSources.length ? historyAnalysis.incomeSources.slice(0,6).map(([name,value]) => <div key={name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate font-medium">{name}</span><span className="font-data text-emerald-500">+{historyCurrencySymbol}{formatMoney(value)}</span></div><div className="h-2 rounded-full bg-zinc-500/10 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{width:`${Math.max(5,(value/(historyIncome||1))*100)}%`}} /></div></div>) : <p className="py-5 text-center text-sm text-zinc-500">Нет доходов за этот период</p>}</div>}
                  {historyAnalysisTab === 'expense' && <div className="space-y-3">{historyAnalysis.expenseCategories.length ? historyAnalysis.expenseCategories.slice(0,6).map(([name,value]) => <div key={name}><div className="flex justify-between gap-3 text-xs mb-1"><span className="truncate font-medium">{name}</span><span className="font-data text-red-500">−{historyCurrencySymbol}{formatMoney(value)}</span></div><div className="h-2 rounded-full bg-zinc-500/10 overflow-hidden"><div className="h-full rounded-full bg-red-500" style={{width:`${Math.max(5,(value/(historyExpense||1))*100)}%`}} /></div></div>) : <p className="py-5 text-center text-sm text-zinc-500">Нет расходов за этот период</p>}</div>}
                  {historyAnalysisTab === 'radar' && <div className="space-y-2">
                    <div className={`rounded-2xl border p-4 ${isLight ? 'border-amber-200 bg-amber-50/40' : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.07] to-transparent'}`}><p className="font-data text-[10px] uppercase tracking-[0.18em] text-amber-500">✦ Финансовый радар</p><div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">Сила периода</p><p className="mt-1 text-sm font-semibold">{historyExpense > 0 ? `Доходы выше расходов в ${(historyIncome / historyExpense).toFixed(1)}×` : historyIncome > 0 ? 'Период без расходов' : 'Нужны данные'}</p></div>
                      <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">Главный источник</p><p className="mt-1 text-sm font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || 'Пока нет доходов'}</p></div>
                      <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">Зона внимания</p><p className="mt-1 text-sm font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || 'Расходов пока нет'}</p></div>
                      <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">Лучший день</p><p className="mt-1 text-sm font-semibold">{historyAnalysis.dailyEntries.length ? historyAnalysis.dailyEntries.reduce((best, item) => item[1].income - item[1].expense > best[1].income - best[1].expense ? item : best)[0] : 'Недостаточно данных'}</p></div>
                    </div></div>
                  </div>}
                  {historyAnalysisTab === 'habits' && <div className="grid gap-2 sm:grid-cols-3">
                    <div className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">Активность</p><p className="mt-2 text-lg font-semibold">{historyTrades.length}</p><p className="text-xs text-zinc-500">операций за период</p></div>
                    <div className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">Частый доход</p><p className="mt-2 text-sm font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p><p className="text-xs text-zinc-500">формирует поток</p></div>
                    <div className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">Паттерн расходов</p><p className="mt-2 text-sm font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p><p className="text-xs text-zinc-500">главная категория</p></div>
                  </div>}
                </section>
              )}

              {!traderMode ? (
                <>
                  {/* Compact period selector */}
                  <div className="relative flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setHistoryPeriodMenuOpen((v) => !v)}
                      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors ${isLight ? 'border-zinc-300 bg-white text-zinc-700 hover:border-amber-400/40' : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-amber-400/30'}`}
                    >
                      {periodButtonLabel}
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${historyPeriodMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {historyPeriodMenuOpen && (
                      <div className={`absolute left-0 top-full z-30 mt-2 min-w-[180px] rounded-2xl border p-1.5 shadow-2xl ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                        {PERIOD_PRESETS.map((p) => (
                          <button key={p} onClick={() => { handlePresetChange(p); setHistoryPeriodMenuOpen(false); }} className={`block w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${periodPreset === p ? 'bg-amber-400/10 text-amber-600' : isLight ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'}`}>{p}</button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => setHistoryFiltersOpen((v) => !v)}
                      className={`rounded-xl border px-3 py-2 text-xs transition-colors ${historyFiltersOpen ? 'border-amber-400/40 bg-amber-400/10 text-amber-600' : isLight ? 'border-zinc-300 bg-white text-zinc-600' : 'border-zinc-700 bg-zinc-950 text-zinc-400'}`}
                    >
                      {t('filters')}
                    </button>
                  </div>

                  {historyFiltersOpen && (
                    <div className={`rounded-xl border p-3 mb-4 ${
                      isLight ? 'bg-white border-zinc-300' : 'bg-zinc-950/60 border-zinc-800'
                    }`}>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => handleDateFromChange(e.target.value)}
                          className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-xs font-data focus:outline-none focus:border-emerald-400/50 ${
                            isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          }`}
                        />
                        <span className={isLight ? 'text-zinc-400' : 'text-zinc-600'}>—</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => handleDateToChange(e.target.value)}
                          className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-xs font-data focus:outline-none focus:border-emerald-400/50 ${
                            isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          }`}
                        />
                      </div>
                      <div className="flex gap-2">
                        {[
                          { key: 'all', label: t('all') },
                          { key: 'win', label: t('income') },
                          { key: 'loss', label: t('expense') },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setHistoryWinLoss(opt.key)}
                            className={[
                              'flex-1 rounded-lg border px-3 py-2 text-xs transition-colors',
                              historyWinLoss === opt.key
                                ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700'
                                : isLight
                                ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-800 hover:border-zinc-400'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`flex items-center justify-between mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    <p className="text-xs">{historyTrades.length} {traderMode ? 'операций' : 'записей'}</p>
                    {periodPreset !== 'Вся история' && (
                      <button
                        onClick={() => setHistoryFiltersOpen(true)}
                        className={`text-xs ${isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-600 hover:text-zinc-300'} transition-colors`}
                      >
                        Изменить период
                      </button>
                    )}
                  </div>

                  {historyTrades.length > 0 ? (
                    <div className={`rounded-2xl border overflow-hidden ${
                      isLight ? 'bg-white border-zinc-300' : 'bg-zinc-950 border-zinc-800'
                    }`}>
                      {historyTrades.map((entry) => {
                        const Icon = getHistoryCategoryIcon(entry.instrument);
                        return (
                          <button
                            key={entry.id}
                            onClick={() => jumpToTradeDate(entry.dateKey)}
                            className={`w-full px-4 py-3.5 flex items-center gap-3 text-left border-b last:border-b-0 transition-colors ${
                              isLight
                                ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-800'
                                : 'border-zinc-800/80 hover:bg-zinc-900 text-zinc-100'
                            }`}
                          >
                            <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${entry.pnl >= 0 ? (isLight ? 'bg-emerald-100 text-emerald-600' : 'bg-emerald-500/15 text-emerald-400') : (isLight ? 'bg-red-100 text-red-600' : 'bg-red-500/15 text-red-400')}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm font-medium truncate ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{entry.instrument || 'Другое'}</span>
                              <span className={`block text-[11px] mt-0.5 truncate ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{formatDateLabel(entry.dateKey)} · {entry.time}{entry.comment ? ` · ${entry.comment}` : ''}</span>
                            </span>
                            <span className={`font-data text-sm font-medium shrink-0 tabular-nums whitespace-nowrap ${entry.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              {formatAmountInCurrency(entry.pnl, entry.currency || 'USD')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className={`rounded-2xl border border-dashed px-6 py-12 text-center ${
                      isLight ? 'border-zinc-300 bg-white/50' : 'border-zinc-800'
                    }`}>
                      <Wallet className={`h-8 w-8 mx-auto mb-3 ${isLight ? 'text-zinc-400' : 'text-zinc-700'}`} />
                      <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-500'}`}>Пока здесь пусто</p>
                      <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-700'}`}>Добавляй доходы и расходы — календарь соберёт картину месяца.</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <div>
                      <button
                      onClick={() => setExportOpen(true)}
                      disabled={historyTrades.length === 0}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-900 hover:border-zinc-400'
                          : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Скачать отчёт
                    </button>
                      <p className={`mt-1 px-1 text-[10px] leading-tight ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>Красивый денежный отчёт за выбранный период</p>
                    </div>
                    <button
                      onClick={handleClearHistory}
                      className={[
                        'h-fit rounded-xl border px-3 py-2.5 text-xs transition-colors',
                        confirmingClear
                          ? 'border-red-500 bg-red-500/10 text-red-600'
                          : isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-red-600 hover:border-red-500/40'
                          : 'border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/40',
                      ].join(' ')}
                    >
                      {confirmingClear ? 'Точно удалить?' : 'Очистить историю'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* PRO history — улучшен визуал для светлой темы */}
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => {
                        if (displayMode === 'usd' && depositSize <= 0) {
                          handleEditDeposit();
                          return;
                        }
                        setDisplayMode((m) => (m === 'usd' ? 'percent' : 'usd'));
                      }}
                      className={`rounded-md border px-2.5 py-1 font-data text-xs transition-colors ${
                        isLight
                          ? 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-600'
                      }`}
                    >
                      {displayMode === 'usd' ? '$' : '%'}
                    </button>
                    <button
                      onClick={handleEditDeposit}
                      className={`font-data text-xs ${isLight ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-zinc-300'} transition-colors`}
                    >
                      Депозит: {depositSize > 0 ? `${currencySymbol}${formatMoney(depositSize)}` : 'не задан'} ✎
                    </button>
                    {ctraderConnected && (
                      <button
                        onClick={handleSyncCtraderTrades}
                        disabled={syncingCtrader}
                        className={`ml-auto flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                          isLight
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        <RefreshCw className={`h-3 w-3 ${syncingCtrader ? 'animate-spin' : ''}`} />
                        {syncingCtrader ? 'Синхр...' : 'Синхронизировать'}
                      </button>
                    )}
                  </div>

                  <div className="mb-3">
                    <button onClick={() => setProFiltersOpen((v) => !v)} className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${proFiltersOpen ? 'border-amber-400/45 bg-amber-400/10' : isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/70'}`}>
                      <span><span className="block text-xs font-medium">Период и фильтры</span><span className="mt-0.5 block text-[10px] text-zinc-500">{periodPreset} · {platformFilter === 'ALL' ? 'Все источники' : platformFilter}</span></span>
                      <ChevronDown className={`h-4 w-4 text-amber-500 transition-transform ${proFiltersOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {proFiltersOpen && <div className={`mt-2 space-y-3 rounded-2xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-black/20'}`}>
                      <div className="flex flex-wrap gap-1.5">{PERIOD_PRESETS.map((p) => <button key={p} onClick={() => handlePresetChange(p)} className={`rounded-full border px-2.5 py-1.5 font-data text-[10px] ${periodPreset === p ? 'border-amber-400/60 bg-amber-400/10 text-amber-500' : isLight ? 'border-zinc-300 bg-white text-zinc-600' : 'border-zinc-700 bg-zinc-950 text-zinc-400'}`}>{p}</button>)}</div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5"><input type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} className={`min-w-0 rounded-xl border px-2 py-2 text-xs font-data ${isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-zinc-200'}`} /><span className="text-zinc-500">—</span><input type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)} className={`min-w-0 rounded-xl border px-2 py-2 text-xs font-data ${isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-zinc-200'}`} /></div>
                      <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className={`w-full rounded-xl border px-3 py-2 text-xs font-data ${isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-700 text-zinc-200'}`}><option value="ALL">Все источники</option>{PLATFORMS.map((item) => <option key={item} value={item}>{item}</option>)}</select>
                    </div>}
                  </div>

                  <div className="flex gap-1.5 mb-4">
                    {[{ key: 'all', label: 'Все' }, { key: 'win', label: 'Прибыль' }, { key: 'loss', label: 'Убыток' }].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setHistoryWinLoss(opt.key)}
                        className={[
                          'flex-1 rounded-md border px-2 py-1.5 font-data text-xs transition-colors',
                          historyWinLoss === opt.key
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                            : isLight
                            ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-800 hover:border-zinc-400'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'} mb-2`}>{historyTrades.length} сделок</p>
                  {historyTrades.length > 0 ? (
                    <div className={`rounded-lg border divide-y overflow-y-auto ${
                      isLight
                        ? 'bg-white border-zinc-300 divide-zinc-200'
                        : 'bg-zinc-950 border-zinc-800 divide-zinc-800'
                    }`}>
                      {historyTrades.map((trade) => (
                        <button
                          key={trade.id}
                          onClick={() => jumpToTradeDate(trade.dateKey)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                            isLight ? 'hover:bg-zinc-50' : 'hover:bg-zinc-900'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`font-data text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'} w-14 shrink-0`}>{formatDateLabel(trade.dateKey)}</span>
                            <span className={`text-sm font-medium truncate ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{trade.instrument}</span>
                          </div>
                          <span className={`font-data text-sm font-medium shrink-0 ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {formatPnlDisplay(trade.pnl)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className={`text-sm text-center py-6 ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>Нет сделок за выбранный период</p>
                  )}

                  <div className={`flex items-center justify-between rounded-md border px-3 py-2.5 mt-3 ${
                    isLight ? 'bg-white border-zinc-300' : 'bg-zinc-950 border-zinc-800'
                  }`}>
                    <span className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>Итог</span>
                    <span className={`font-data text-sm font-semibold ${historyTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {historyTotal >= 0 ? '+' : '-'}{historyCurrencySymbol}{formatMoney(historyTotal)}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => setExportOpen(true)}
                      disabled={historyTrades.length === 0}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 font-data text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-900 hover:border-zinc-400'
                          : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Скачать отчёт
                    </button>
                    <button
                      onClick={handleClearHistory}
                      className={[
                        'flex-1 rounded-md border px-3 py-2 font-data text-xs transition-colors',
                        confirmingClear
                          ? 'border-red-500 bg-red-500/10 text-red-600'
                          : isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-red-600 hover:border-red-500/40'
                          : 'border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/40',
                      ].join(' ')}
                    >
                      {confirmingClear ? 'Точно удалить? Ещё раз' : 'Очистить историю'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD TRADE MODAL — compact quick-entry UI */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/60 px-3 py-3 transition-opacity duration-200 sm:items-center sm:px-4 ${
            modalVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={handleModalBackdropClick}
        >
          <div
            className={`relative my-auto w-full max-w-[360px] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-200 sm:px-5 sm:py-5 ${
              modalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <button
              onClick={closeModal}
              className={`absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isLight ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="pr-8">
              <p className="font-data text-[10px] tracking-[0.18em] text-amber-400 uppercase">
                {traderMode
                  ? (editingTrade ? 'Редактировать сделку' : 'Новая сделка')
                  : (editingTrade ? t('editRecord') : t('addRecord'))}
              </p>
              <p className={`mt-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                {modalDateKey &&
                  parseDateKeyLocal(modalDateKey).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
              </p>
            </div>

            <div className="mt-4">
              {/* Income / expense: the first and fastest decision */}
              <div className={`grid grid-cols-2 gap-1 rounded-xl border p-1 ${
                isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-800 bg-zinc-950'
              }`}>
                <button
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, sign: 'plus' })); setFormError(''); }}
                  className={[
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors',
                    form.sign === 'plus'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : isLight ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300',
                  ].join(' ')}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {traderMode ? 'Профит' : 'Доход'}
                </button>
                <button
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, sign: 'minus' })); setFormError(''); }}
                  className={[
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors',
                    form.sign === 'minus'
                      ? 'bg-red-500/10 text-red-600'
                      : isLight ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300',
                  ].join(' ')}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  {traderMode ? 'Убыток' : 'Расход'}
                </button>
              </div>

              {/* Amount is the visual focus */}
              <div className={`mt-3 rounded-xl border px-3 py-2 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/20 ${
                isLight ? 'border-zinc-300 bg-white' : 'border-zinc-700 bg-zinc-950'
              }`}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  autoFocus
                  value={form.pnl}
                  onChange={(e) => { setForm((f) => ({ ...f, pnl: e.target.value })); setFormError(''); }}
                  className={`w-full bg-transparent text-center font-data text-3xl font-semibold tracking-tight outline-none placeholder:text-zinc-700 ${
                    isLight ? 'text-zinc-900' : 'text-zinc-100'
                  }`}
                  placeholder="0"
                  aria-label={traderMode ? 'Результат' : 'Сумма'}
                />
              </div>

              {/* Currency */}
              <div className="mt-2 flex items-center justify-center gap-1">
                {CURRENCIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, currency: c.code }))}
                    title={c.code}
                    aria-label={`Валюта ${c.code}`}
                    className={[
                      'min-w-10 rounded-lg border px-3 py-1.5 font-data text-xs transition-colors',
                      form.currency === c.code
                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-600'
                        : isLight
                        ? 'border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400 hover:text-zinc-700'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300',
                    ].join(' ')}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>

              {/* Time is available, but deliberately quiet */}
              <div className="mt-2 flex justify-center">
                <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                  isLight ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700' : 'text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400'
                }`}>
                  <span>◷</span>
                  <span>{form.time || currentTimeHHMM()}</span>
                  <input
                    type="time"
                    value={form.time}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* not supported */ } }}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="sr-only"
                    aria-label="Время"
                  />
                </label>
              </div>

              {/* Details are intentionally hidden for quick entry */}
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className={`mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
                  isLight ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                }`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                {detailsOpen ? 'Скрыть детали' : 'Дополнительно'}
                <ChevronDown className={`h-3 w-3 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </button>

              {detailsOpen && (
                <div className={`mt-2 space-y-3 rounded-xl border p-3 ${
                  isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-950/60'
                }`}>
                  {traderMode ? (
                    <>
                      <div>
                        <label className={`mb-1.5 block font-data text-[10px] tracking-widest uppercase ${
                          isLight ? 'text-zinc-600' : 'text-zinc-600'
                        }`}>
                          Инструмент
                        </label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {quickAssetTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, instrument: tag })); setFormError(''); }}
                              className={[
                                'rounded-full border px-2.5 py-1 font-data text-[11px] transition-colors',
                                textValue(form.instrument).trim().toUpperCase() === tag
                                  ? 'border-amber-400/60 bg-amber-400/10 text-amber-600'
                                  : isLight
                                  ? 'border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700'
                                  : 'border-zinc-800 text-zinc-500 hover:text-zinc-300',
                              ].join(' ')}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={form.instrument}
                          onChange={(e) => { setForm((f) => ({ ...f, instrument: e.target.value })); setFormError(''); }}
                          className={`w-full rounded-lg border px-3 py-2 text-sm font-data outline-none focus:border-amber-400/60 ${
                            isLight
                              ? 'bg-white border-zinc-300 text-zinc-900'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                          }`}
                          placeholder="Например, XAUUSD"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, direction: 'LONG' }))}
                          className={[
                            'rounded-lg border py-2 text-xs font-data transition-colors',
                            form.direction === 'LONG'
                              ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-600'
                              : isLight
                              ? 'border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700'
                              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300',
                          ].join(' ')}
                        >LONG</button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, direction: 'SHORT' }))}
                          className={[
                            'rounded-lg border py-2 text-xs font-data transition-colors',
                            form.direction === 'SHORT'
                              ? 'border-red-400/60 bg-red-500/10 text-red-600'
                              : isLight
                              ? 'border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700'
                              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300',
                          ].join(' ')}
                        >SHORT</button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          step="any"
                          value={form.takeProfit}
                          onChange={(e) => setForm((f) => ({ ...f, takeProfit: e.target.value }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm font-data outline-none focus:border-amber-400/60 ${
                            isLight
                              ? 'bg-white border-zinc-300 text-zinc-900'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                          }`}
                          placeholder="Take Profit"
                        />
                        <input
                          type="number"
                          step="any"
                          value={form.stopLoss}
                          onChange={(e) => setForm((f) => ({ ...f, stopLoss: e.target.value }))}
                          className={`w-full rounded-lg border px-3 py-2 text-sm font-data outline-none focus:border-amber-400/60 ${
                            isLight
                              ? 'bg-white border-zinc-300 text-zinc-900'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                          }`}
                          placeholder="Stop Loss"
                        />
                      </div>

                      <select
                        value={form.platform}
                        onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                        className={`w-full rounded-lg border px-3 py-2 text-sm font-data outline-none focus:border-amber-400/60 ${
                          isLight
                            ? 'bg-white border-zinc-300 text-zinc-900'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                        }`}
                      >
                        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </>
                  ) : (
                    <div>
                      <label className={`mb-1.5 block font-data text-[10px] tracking-widest uppercase ${
                        isLight ? 'text-zinc-600' : 'text-zinc-600'
                      }`}>
                        Категория
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {moneyCategoriesWithIcons.map((category) => {
                          const Icon = category.icon;
                          const active = textValue(form.instrument).trim() === category.key;
                          return (
                            <button
                              key={category.key}
                              type="button"
                              onClick={() => { setForm((f) => ({ ...f, instrument: category.key })); setFormError(''); }}
                              className={[
                                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors',
                                active
                                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-600'
                                  : isLight
                                  ? 'border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700'
                                  : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-zinc-300',
                              ].join(' ')}
                            >
                              <Icon className="h-3.5 w-3.5 shrink-0" />
                              <span className="text-xs font-medium">{category.key}</span>
                            </button>
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        value={form.instrument}
                        onChange={(e) => { setForm((f) => ({ ...f, instrument: e.target.value })); setFormError(''); }}
                        className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-emerald-400/50 ${
                          isLight
                            ? 'bg-white border-zinc-300 text-zinc-900'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                        }`}
                        placeholder="Своя категория"
                      />
                    </div>
                  )}

                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                    rows={2}
                    className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-amber-400/60 ${
                      isLight
                        ? 'bg-white border-zinc-300 text-zinc-900'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                    }`}
                    placeholder={traderMode ? 'Заметка по сделке (необязательно)' : t('recordNotePlaceholder')}
                  />
                </div>
              )}

              {formError && <p className="mt-2 text-center text-xs text-red-600">{formError}</p>}

              <button
                onClick={handleSaveTrade}
                disabled={isSaving}
                className="sticky bottom-0 mt-3 block w-full rounded-xl bg-amber-400 px-4 py-3 text-base font-bold text-zinc-950 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {isSaving ? 'Сохранение...' : (editingTrade ? 'Сохранить изменения' : (traderMode ? 'Сохранить сделку' : t('saveRecord')))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT REPORT MODAL */}
      {exportOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) setExportOpen(false); }}>
          <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}>
            <div className="flex items-center justify-between border-b border-zinc-800/70 px-5 py-4">
              <div><p className="font-data text-[10px] uppercase tracking-[0.22em] text-amber-500">Денежный календарь</p><h3 className="mt-1 font-semibold">Скачать отчёт</h3></div>
              <button onClick={() => setExportOpen(false)} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-500/10"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5">
              <p className="text-sm font-medium">Все ваши записи за выбранный период</p>
              <p className="mt-1 text-xs text-zinc-500">Выбери период — технические поля вроде Manual в обычный отчёт не попадут.</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {['Текущий период', 'Сегодня', 'Текущая неделя', 'Текущий месяц', '3 месяца', 'Вся история'].map((preset) => (
                  <button key={preset} onClick={() => setExportPeriodPreset(preset)} className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${exportPeriodPreset === preset ? 'border-amber-400/50 bg-amber-400/10 text-amber-600' : isLight ? 'border-zinc-200 hover:bg-zinc-50' : 'border-zinc-800 hover:bg-zinc-900'}`}>{preset}</button>
                ))}
              </div>
              <div className={`mt-4 rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/40'}`}>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">В отчёте</p>
                <p className="mt-1 text-sm font-medium">Дата · категория · доходы и расходы · сумма · комментарии</p>
                <p className="mt-1 text-xs text-zinc-500">{exportTrades.length} записей с учётом текущей валюты и фильтров</p>
              </div>
              <button onClick={handleExportCsv} disabled={!exportTrades.length} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"><Download className="h-4 w-4" />Скачать денежный отчёт</button>
            </div>
          </div>
        </div>
      )}

      {/* CONNECT PLATFORM MODAL — API keys / CSV import */}
      {connectOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-200 ${
            connectVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={handleConnectBackdropClick}
        >
          <div
            className={`relative w-full max-w-md rounded-xl border p-6 shadow-xl transition-all duration-200 ${
              connectVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <button
              onClick={closeConnectModal}
              className={`absolute top-4 right-4 transition-colors ${
                isLight ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Подключить площадку</p>
            <h2 className={`font-display text-lg font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-50'} mb-3`}>Источник сделок</h2>

            <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 mb-4">
              <p className="text-xs text-amber-400/90 leading-relaxed">
                cTrader подключается по-настоящему. API-ключи бирж и импорт CSV — пока в разработке, данные не сохраняют.
              </p>
            </div>

            {/* tabs */}
            <div className={`flex gap-1 rounded-md border p-1 mb-4 ${
              isLight ? 'border-zinc-300 bg-zinc-50' : 'border-zinc-800 bg-zinc-950'
            }`}>
              <button
                onClick={() => setConnectTab('ctrader')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  connectTab === 'ctrader'
                    ? isLight
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'bg-zinc-800 text-zinc-100'
                    : isLight
                    ? 'text-zinc-500 hover:text-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <Link2 className="h-3.5 w-3.5" />
                cTrader
              </button>
              <button
                onClick={() => setConnectTab('api')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  connectTab === 'api'
                    ? isLight
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'bg-zinc-800 text-zinc-100'
                    : isLight
                    ? 'text-zinc-500 hover:text-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <KeyRound className="h-3.5 w-3.5" />
                API Ключи
              </button>
              <button
                onClick={() => setConnectTab('csv')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  connectTab === 'csv'
                    ? isLight
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'bg-zinc-800 text-zinc-100'
                    : isLight
                    ? 'text-zinc-500 hover:text-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Импорт CSV
              </button>
            </div>

            {connectTab === 'ctrader' ? (
              <div className="flex flex-col gap-4">
                <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-500'} leading-relaxed`}>
                  Подключите свой аккаунт cTrader через Spotware — это разрешит приложению видеть ваши сделки.
                </p>
                {ctraderConnected ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-emerald-600 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    cTrader подключён
                  </div>
                ) : (
                  <button
                    onClick={handleConnectCtrader}
                    disabled={ctraderLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-50 transition-colors"
                  >
                    {ctraderLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    {ctraderLoading ? 'Подключение...' : 'Подключить cTrader'}
                  </button>
                )}
              </div>
            ) : connectTab === 'api' ? (
              <div className="flex flex-col gap-4">
                <div>
                  <label className={`block font-data text-[11px] tracking-widest uppercase mb-1.5 ${
                    isLight ? 'text-zinc-600' : 'text-zinc-500'
                  }`}>
                    Биржа / терминал
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {EXCHANGES.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setApiForm((f) => ({ ...f, exchange: ex }))}
                        className={[
                          'rounded-md border px-3 py-2 text-sm font-data transition-colors',
                          apiForm.exchange === ex
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-600'
                            : isLight
                            ? 'border-zinc-300 bg-white text-zinc-500 hover:text-zinc-700 hover:border-zinc-400'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`block font-data text-[11px] tracking-widest uppercase mb-1.5 ${
                    isLight ? 'text-zinc-600' : 'text-zinc-500'
                  }`}>
                    API Key
                  </label>
                  <input
                    type="text"
                    value={apiForm.key}
                    onChange={(e) => setApiForm((f) => ({ ...f, key: e.target.value }))}
                    placeholder="••••••••••••"
                    className={`w-full rounded-md border px-3 py-2 text-sm font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 ${
                      isLight
                        ? 'bg-white border-zinc-300 text-zinc-900'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                    }`}
                  />
                </div>

                <div>
                  <label className={`block font-data text-[11px] tracking-widest uppercase mb-1.5 ${
                    isLight ? 'text-zinc-600' : 'text-zinc-500'
                  }`}>
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={apiForm.secret}
                    onChange={(e) => setApiForm((f) => ({ ...f, secret: e.target.value }))}
                    placeholder="••••••••••••"
                    className={`w-full rounded-md border px-3 py-2 text-sm font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 ${
                      isLight
                        ? 'bg-white border-zinc-300 text-zinc-900'
                        : 'bg-zinc-950 border-zinc-700 text-zinc-100'
                    }`}
                  />
                </div>

                <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-600'} leading-relaxed`}>
                  Рекомендуем создавать ключ с правами только на чтение (read-only), без доступа к выводу средств.
                </p>

                <button
                  onClick={handleSaveApiKeys}
                  disabled={!textValue(apiForm.key).trim() || !textValue(apiForm.secret).trim()}
                  className="w-full rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Подключить {apiForm.exchange}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <label
                  onDragOver={(e) => { e.preventDefault(); setCsvDragOver(true); }}
                  onDragLeave={() => setCsvDragOver(false)}
                  onDrop={handleCsvDrop}
                  className={[
                    'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
                    csvDragOver ? 'border-amber-400/60 bg-amber-400/5' : isLight ? 'border-zinc-300 hover:border-zinc-400' : 'border-zinc-700 hover:border-zinc-600',
                  ].join(' ')}
                >
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvSelect} />
                  {csvFile ? (
                    <>
                      <FileText className="h-6 w-6 text-amber-400" />
                      <p className={`text-sm font-medium ${isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>{csvFile.name}</p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>Файл готов к импорту</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className={`h-6 w-6 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />
                      <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Перетащите файл отчёта сюда</p>
                      <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>или нажмите, чтобы выбрать .csv</p>
                    </>
                  )}
                </label>

                <button
                  onClick={handleImportCsv}
                  disabled={!csvFile}
                  className="w-full rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Импортировать
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ANALYSIS MODAL — free basic stats now, paid deep AI analysis coming later */}
      {analysisOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-200 ${
            analysisVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeAnalysis(); }}
        >
          <div
            className={`relative w-full max-w-md rounded-xl border p-6 shadow-xl transition-all duration-200 ${
              analysisVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <button
              onClick={closeAnalysis}
              className={`absolute top-4 right-4 transition-colors ${
                isLight ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-200'
              }`}
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Анализ периода</p>
            <h2 className={`font-display text-lg font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-50'} mb-3`}>
              {analysisFrom === '0000-01-01'
                ? 'Вся история'
                : analysisFrom === analysisTo
                ? analysisFrom
                : `${analysisFrom} — ${analysisTo}`}
            </h2>

            <div className={`grid grid-cols-3 gap-1 rounded-xl border p-1 mb-4 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950'}`}>
              {[
                { key: 'overview', label: 'Обзор' },
                { key: 'income', label: 'Откуда' },
                { key: 'expense', label: 'Расходы' },
              ].map((tab) => (
                <button key={tab.key} onClick={() => setAnalysisTab(tab.key)} className={`rounded-lg px-2 py-2 text-xs font-medium transition-all ${analysisTab === tab.key ? 'bg-amber-400/15 text-amber-600 shadow-sm' : isLight ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-zinc-200'}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'} mb-4`}>{analysisStats.count} {traderMode ? 'сделок' : 'операций'} в выборке</p>

            {moneyAnalysis && (
              <div className="mb-4 space-y-3">
                {analysisTab === 'overview' && (
                  <>
                    <div className={`grid grid-cols-3 gap-2 rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                      {[
                        ['Доходы', moneyAnalysis.income, 'text-emerald-600'],
                        ['Расходы', moneyAnalysis.expenses, 'text-red-600'],
                        ['Баланс', moneyAnalysis.balance, moneyAnalysis.balance >= 0 ? 'text-emerald-600' : 'text-red-600'],
                      ].map(([label, amount, color]) => (
                        <button key={label} onClick={() => setAnalysisTab(label === 'Доходы' ? 'income' : label === 'Расходы' ? 'expense' : 'overview')} className={`min-w-0 rounded-lg border p-2 text-left transition-transform hover:-translate-y-0.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                          <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</p>
                          <p className={`truncate font-data text-sm ${color}`}>{amount < 0 ? '-' : ''}{currencySymbol}{formatMoney(Math.abs(amount))}</p>
                        </button>
                      ))}
                    </div>
                    <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                      <div className="mb-2 flex items-center justify-between"><p className={`text-xs font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>Динамика периода</p><span className="text-[10px] text-emerald-500">по операциям</span></div>
                      <div className="flex h-24 items-end gap-1.5">
                        {Object.entries(analysisTrades.reduce((acc, t) => { acc[t.dateKey] = (acc[t.dateKey] || 0) + t.pnl; return acc; }, {})).slice(-12).map(([day, amount]) => {
                          const max = Math.max(1, ...Object.values(analysisTrades.reduce((acc, t) => { acc[t.dateKey] = (acc[t.dateKey] || 0) + Math.abs(t.pnl); return acc; }, {})));
                          const h = Math.max(8, Math.round((Math.abs(amount) / max) * 100));
                          return <button key={day} title={`${day}: ${amount >= 0 ? '+' : '-'}${currencySymbol}${formatMoney(Math.abs(amount))}`} className="group flex flex-1 flex-col justify-end"><div className={`w-full rounded-t-md transition-all duration-300 group-hover:opacity-70 ${amount >= 0 ? 'bg-emerald-500/80' : 'bg-red-500/80'}`} style={{ height: `${h}%` }} /></button>;
                        })}
                      </div>
                    </div>
                  </>
                )}
                {analysisTab === 'income' && (
                  <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                    <div className="mb-3"><p className={`text-sm font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Откуда пришли деньги</p><p className="text-[11px] text-zinc-500">Источники дохода за выбранный период</p></div>
                    <div className="space-y-3">{moneyAnalysis.topIncomeSources.length ? moneyAnalysis.topIncomeSources.map(([source, amount]) => <div key={source}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-zinc-500">{source}</span><span className="font-data text-emerald-500">+{currencySymbol}{formatMoney(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800/70"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(6, Math.round((amount / moneyAnalysis.income) * 100))}%` }} /></div></div>) : <p className="py-6 text-center text-xs text-zinc-500">За период пока нет доходов</p>}</div>
                  </div>
                )}
                {analysisTab === 'expense' && (
                  <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                    <div className="mb-3"><p className={`text-sm font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Куда уходят деньги</p><p className="text-[11px] text-zinc-500">Самые крупные категории расходов</p></div>
                    <div className="space-y-3">{moneyAnalysis.topCategories.length ? moneyAnalysis.topCategories.map(([category, amount]) => <div key={category}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-zinc-500">{category}</span><span className="font-data text-red-500">−{currencySymbol}{formatMoney(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800/70"><div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${Math.max(6, Math.round((amount / moneyAnalysis.expenses) * 100))}%` }} /></div></div>) : <p className="py-6 text-center text-xs text-zinc-500">За период пока нет расходов</p>}</div>
                  </div>
                )}
              </div>
            )}

            {traderMode && basicAnalysis && (
              <div className="mb-4">
                <div className={`text-center rounded-lg border py-4 mb-3 ${
                  isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-950'
                }`}>
                  <p className={`font-data text-[10px] tracking-widest ${isLight ? 'text-zinc-500' : 'text-zinc-500'} uppercase mb-1`}>Profit Factor</p>
                  <p className={`font-display text-3xl font-semibold ${basicAnalysis.profitFactor >= 1.5 ? 'text-emerald-600' : basicAnalysis.profitFactor >= 1 ? 'text-zinc-800' : 'text-red-600'}`}>
                    {basicAnalysis.profitFactor === Infinity ? 'MAX' : basicAnalysis.profitFactor.toFixed(2)}
                  </p>
                </div>

                <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-500'} leading-relaxed`}>
                  Средний:{' '}
                  <span className="text-emerald-600 font-data">+${formatMoney(basicAnalysis.avgWin)}</span>
                  {' / '}
                  <span className="text-red-600 font-data">-${formatMoney(basicAnalysis.avgLoss)}</span>
                  {basicAnalysis.payoffRatio > 0 && <span className="font-data"> (1:{basicAnalysis.payoffRatio.toFixed(2)})</span>}
                  {' · Лучший день: '}
                  <span className="text-emerald-600 font-data">{formatSignedShort(basicAnalysis.bestDay[1])}</span>
                  {' ('}{formatDateLabel(basicAnalysis.bestDay[0])}{')'}
                  {' · Худший: '}
                  <span className="text-red-600 font-data">{formatSignedShort(basicAnalysis.worstDay[1])}</span>
                  {' ('}{formatDateLabel(basicAnalysis.worstDay[0])}{')'}
                  {' · Частый: '}
                  <span className={`font-data ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`}>{basicAnalysis.topInstrument[0]}</span>
                  {basicAnalysis.longestLossStreak >= 2 && (
                    <>
                      {' · Серия убытков: '}
                      <span className="text-red-600 font-data">{basicAnalysis.longestLossStreak}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className={`rounded-md border border-dashed px-3 py-3 flex items-start gap-2.5 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>
              <Sparkles className={`h-4 w-4 ${isLight ? 'text-zinc-400' : 'text-zinc-600'} shrink-0 mt-0.5`} />
              <div>
                <p className={`text-sm font-medium mb-0.5 ${isLight ? 'text-zinc-700' : 'text-zinc-400'}`}>Глубокий AI-анализ — скоро</p>
                <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-600'} leading-relaxed`}>
                  Разбор эмоциональных паттернов, конкретных ошибок по каждой сделке и персональные рекомендации — по подписке.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}


      {setupStep && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4">
          <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
            isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
          }`}>
            <p className="font-data text-[10px] tracking-widest text-amber-400 uppercase mb-2">Настройка {setupStep === 'language' ? '1' : setupStep === 'currency' ? '2' : '3'} из 3</p>
            <h2 className={`font-display text-xl font-semibold mb-4 ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>{setupStep === 'language' ? 'Выберите язык' : setupStep === 'currency' ? 'Выберите валюту' : 'Выберите тему'}</h2>
            {setupStep === 'language' && <div className="grid grid-cols-3 gap-2">{LANGUAGES.map((item) => <button key={item.code} onClick={() => { setLanguage(item.code); setSetupStep('currency'); }} className={`rounded-lg border px-3 py-3 font-data text-sm hover:border-amber-400 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>{item.label}</button>)}</div>}
            {setupStep === 'currency' && <div className="grid grid-cols-2 gap-2">{CURRENCIES.map((item) => <button key={item.code} onClick={() => { setCurrency(item.code); setSetupStep('theme'); }} className={`rounded-lg border px-3 py-3 font-data text-sm hover:border-amber-400 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>{item.symbol} {item.code}</button>)}</div>}
            {setupStep === 'theme' && <div className="grid grid-cols-2 gap-2"><button onClick={() => { setTheme('light'); setSetupStep(null); }} className={`rounded-lg border px-3 py-3 hover:border-amber-400 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>☀ День</button><button onClick={() => { setTheme('dark'); setSetupStep(null); }} className={`rounded-lg border px-3 py-3 hover:border-amber-400 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>🌙 Ночь</button></div>}
          </div>
        </div>
      )}

      {nicknameModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-200 ${
            nicknameModalVisible ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div
            className={`relative w-full max-w-sm rounded-xl border p-6 shadow-xl transition-all duration-200 ${
              nicknameModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Добро пожаловать</p>
            <h2 className={`font-display text-lg font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-50'} mb-1`}>Как вас называть?</h2>
            <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-500'} mb-4`}>
              Это имя будет отображаться в приложении. Можно оставить пустым — тогда возьмём имя из Google.
            </p>

            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
              placeholder={user?.user_metadata?.full_name || user?.email || 'Ваш ник'}
              autoFocus
              className={`w-full rounded-md border px-3 py-2 text-sm font-data mb-4 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40 ${
                isLight
                  ? 'bg-white border-zinc-300 text-zinc-900'
                  : 'bg-zinc-950 border-zinc-700 text-zinc-100'
              }`}
            />

            <button
              onClick={handleSaveNickname}
              className="w-full rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition-colors"
            >
              Продолжить
            </button>
          </div>
        </div>
      )}

      {/* OFFLINE NOTICE MODAL */}
      {offlineNoticeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm transition-opacity duration-200">
          <div
            className={`relative w-full max-w-sm rounded-2xl border p-5 sm:p-6 shadow-2xl transition-all duration-200 ${
              isLight ? 'border-amber-300/80 bg-white text-zinc-900' : 'border-amber-400/25 bg-zinc-900 text-zinc-100'
            }`}
          >
            <div className="flex items-start gap-3.5 mb-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-500">
                <WifiOff className="h-5 w-5" />
              </span>
              <div>
                <p className="font-data text-[10px] uppercase tracking-[0.2em] text-amber-500 font-semibold mb-1">
                  OFFLINE
                </p>
                <h3 className="font-display text-lg font-semibold leading-tight">
                  {t('offlineTitle')}
                </h3>
              </div>
            </div>

            <p className={`text-xs leading-relaxed mb-5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
              {t('offlineDesc')}
            </p>

            <button
              type="button"
              onClick={() => setOfflineNoticeOpen(false)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-md hover:from-amber-300 hover:to-amber-400 transition-all active:scale-[0.99]"
            >
              <span>{t('goToOffline')}</span>
            </button>
          </div>
        </div>
      )}

      {/* ONLINE TOAST / CONNECTED POPUP */}
      {onlineToastOpen && (
        <div className="fixed top-4 sm:top-6 inset-x-4 sm:inset-x-auto sm:right-6 z-50 sm:max-w-md pointer-events-auto transition-all duration-300">
          <div
            className={`flex items-start gap-3.5 rounded-2xl border p-4 shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl ${
              isLight
                ? 'border-emerald-300/90 bg-white/95 text-zinc-900'
                : 'border-emerald-500/30 bg-zinc-900/95 text-zinc-100'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="font-semibold text-sm leading-tight">
                  {t('onlineTitle')}
                </h4>
              </div>
              <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {t('onlineDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOnlineToastOpen(false)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold shrink-0 transition-colors ${
                isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800' : 'bg-white/10 hover:bg-white/15 text-zinc-200'
              }`}
            >
              {t('onlineAction')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
