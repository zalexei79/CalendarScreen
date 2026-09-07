import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Inbox, TrendingUp, TrendingDown, Sparkles, Plus, X, Trash2,
  Calendar, ChevronDown, Link2, KeyRound, UploadCloud, FileText,
  CheckCircle2, RefreshCw, History, Download, Pencil,
  Wallet, ShoppingCart, Home, Briefcase, ShoppingBag, CreditCard, MoreHorizontal,
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

  const periodTrades = useMemo(() => {
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => arr.map((t) => ({ ...t, dateKey })))
      .filter((t) => t.dateKey >= effectiveFrom && t.dateKey <= effectiveTo)
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => (t.currency || 'USD') === currency)
      .filter((t) => calendarTypeFilter === 'all' || (calendarTypeFilter === 'income' ? t.pnl >= 0 : t.pnl < 0))
      .sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
  }, [manualTrades, effectiveFrom, effectiveTo, platformFilter, currency, calendarTypeFilter]);

  const periodStats = useMemo(() => {
    const count = periodTrades.length;
    const pnl = periodTrades.reduce((sum, t) => sum + t.pnl, 0);
    const wins = periodTrades.filter((t) => t.pnl >= 0).length;
    const winrate = count ? Math.round((wins / count) * 100) : 0;
    return { count, pnl, winrate };
  }, [periodTrades]);

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
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const cigarettes = categories['Сигареты'] || 0;
    return { income, expenses, balance: income - expenses, topCategories, cigarettes, cigaretteShare: expenses ? Math.round((cigarettes / expenses) * 100) : 0 };
  }, [analysisTrades, traderMode]);

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisVisible, setAnalysisVisible] = useState(false);

  function openAnalysis() {
    setAnalysisFrom(effectiveFrom);
    setAnalysisTo(effectiveTo);
    setAnalysisPreset('Текущий период');
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
    setDetailsOpen(Boolean(traderMode && tradeToEdit));
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
  const [historyCurrency, setHistoryCurrency] = useState('ALL');
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
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

  function openHistory() {
    setHistoryOpen(true);
    setHistoryFiltersOpen(false);
    setConfirmingClear(false);
    requestAnimationFrame(() => setHistoryVisible(true));
  }

  function closeHistory() {
    setHistoryVisible(false);
    setHistoryFiltersOpen(false);
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

  function handleExportCsv() {
    const header = ['Дата', 'Время', 'Категория', 'Тип', 'Сумма', 'Валюта', 'Источник', 'Комментарий'];
    const rows = historyTrades.map((t) => [
      t.dateKey,
      t.time,
      t.instrument,
      t.pnl >= 0 ? 'Доход' : 'Расход',
      t.pnl,
      t.currency || 'USD',
      t.platform,
      (t.comment || '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades_${keyFromDate(today)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    <div className={`min-h-screen w-full flex flex-col transition-colors duration-200 ${isLight ? 'theme-light bg-zinc-100 text-zinc-900' : 'bg-zinc-950 text-zinc-100'}`}>
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
        @media (max-width: 639px) {
          .calendar-days-grid {
            flex: 1 1 auto;
            grid-auto-rows: minmax(76px, 1fr);
          }
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
        openConnectModal={openConnectModal} ctraderConnected={ctraderConnected}
        installInfoRef={installInfoRef} handleInstallClick={handleInstallClick}
        pendingSyncCount={pendingSyncCount} installInfoOpen={installInfoOpen} installInstructions={installInstructions}
      />

      {/* CALENDAR — the main view of the whole app */}
      {!traderMode && (
        <div className={`flex justify-center border-b px-3 py-2 ${isLight ? 'border-zinc-200 bg-zinc-100/70' : 'border-zinc-800 bg-zinc-950/40'}`}>
          <div className={`inline-flex rounded-lg border p-0.5 ${isLight ? 'border-zinc-300 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-900'}`}>
            {[
              { key: 'all', label: 'Все' },
              { key: 'income', label: 'Доходы' },
              { key: 'expense', label: 'Расходы' },
            ].map((option) => (
              <button key={option.key} onClick={() => setCalendarTypeFilter(option.key)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${calendarTypeFilter === option.key ? 'bg-amber-400/15 text-amber-600 shadow-sm' : isLight ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-500 hover:text-zinc-100'}`}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
      )}
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
              onClick={openAnalysis}
              disabled={periodStats.count === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-500 hover:bg-amber-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Sparkles className="h-4 w-4" />
              {t('analysis')}
            </button>
            <span className={`h-5 w-px ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
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

          {periodTrades.length > 0 ? (
            <div className={`rounded-lg border divide-y ${isLight ? 'border-zinc-300 bg-zinc-50 divide-zinc-200' : 'border-zinc-800 bg-zinc-900 divide-zinc-800'}`}>
              {periodTrades.map((trade) => (
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
      <div className="fixed bottom-4 sm:bottom-4 inset-x-0 flex justify-center z-30 pointer-events-none">
        <button
          onClick={openHistory}
          className={`pointer-events-auto flex items-center gap-2 rounded-full border backdrop-blur px-5 py-3 text-base shadow-xl transition-colors ${
            isLight
              ? 'border-zinc-300 bg-white/95 text-zinc-700 hover:border-amber-400/60 hover:text-amber-500'
              : 'border-zinc-700 bg-zinc-900/95 text-zinc-200 hover:border-amber-400/60 hover:text-amber-400'
          }`}
        >
          <History className="h-4 w-4" />
          {t('history')}
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
            className={`relative w-full ${traderMode ? 'max-w-md' : 'max-w-lg'} max-h-[86vh] overflow-hidden rounded-2xl border shadow-2xl transition-all duration-200 ${
              historyVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
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

            <div className={`overflow-y-auto px-5 sm:px-6 py-5 max-h-[calc(86vh-80px)] ${isLight ? 'bg-zinc-50/50' : ''}`}>
              {!traderMode ? (
                <>
                  {/* Money summary — улучшенная светлая тема */}
                  <div className={`rounded-2xl border p-4 sm:p-5 mb-4 ${
                    isLight ? 'bg-white border-zinc-300 shadow-sm' : 'bg-zinc-950/70 border-zinc-800'
                  }`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-500'}`}>{t('resultForPeriod')}</p>
                      <div className={`flex gap-0.5 shrink-0 rounded-lg border p-0.5 ${
                        isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950/60'
                      }`}>
                        {[{ code: 'ALL', symbol: 'Все', label: 'Все валюты' }, ...CURRENCIES].map((c) => (
                          <button
                            key={c.code}
                            onClick={() => setHistoryCurrency(c.code)}
                            title={c.label}
                            className={[
                              'min-w-[30px] h-7 px-1.5 rounded-md text-sm font-data font-medium border transition-colors flex items-center justify-center',
                              historyCurrency === c.code
                                ? 'border-amber-400/60 bg-amber-400/15 text-amber-500'
                                : isLight
                                ? 'border-transparent text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100'
                                : 'border-transparent text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/70',
                            ].join(' ')}
                          >
                            {c.symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                    {historyCurrency === 'ALL' ? (
                      <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Итоги показаны отдельно по валютам</p>
                    ) : <div className={`font-display text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums ${historyTotal >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatPnlDisplay(historyTotal)}
                    </div>}
                    {historyCurrency !== 'ALL' && (
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className={`rounded-xl border border-l-[3px] px-3 py-3 ${
                        isLight ? 'border-zinc-200 border-l-emerald-400 bg-zinc-50' : 'border-zinc-800/80 border-l-emerald-500/70 bg-zinc-900/70'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                          <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{t('income')}</p>
                        </div>
                        <p className="font-data text-sm text-emerald-600 tabular-nums">+{currencySymbol}{formatMoney(historyIncome)}</p>
                      </div>
                      <div className={`rounded-xl border border-l-[3px] px-3 py-3 ${
                        isLight ? 'border-zinc-200 border-l-red-400 bg-zinc-50' : 'border-zinc-800/80 border-l-red-500/70 bg-zinc-900/70'
                      }`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />
                          <p className={`text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{t('expense')}</p>
                        </div>
                        <p className="font-data text-sm text-red-600 tabular-nums">−{currencySymbol}{formatMoney(historyExpense)}</p>
                      </div>
                    </div>
                  </div>

                    )}

                  {historyCurrency === 'ALL' && historyByCurrency.length > 0 && (
                    <div className="grid gap-2 mb-4 sm:grid-cols-2">
                      {historyByCurrency.map(([code, stats]) => (
                        <div key={code} className={`rounded-xl border px-3 py-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/60'}`}>
                          <p className={`text-[11px] mb-1 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{code} · {stats.count} операций</p>
                          <p className={`font-data text-sm font-medium ${stats.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{stats.balance >= 0 ? '+' : '−'}{getCurrencyMeta(code).symbol}{formatMoney(stats.balance)}</p>
                          <p className={`mt-1 text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>+{getCurrencyMeta(code).symbol}{formatMoney(stats.income)} · −{getCurrencyMeta(code).symbol}{formatMoney(stats.expense)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {historyInsights.length > 0 && (
                    <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <p className="text-xs font-semibold text-amber-400">Наблюдения по привычкам</p>
                      </div>
                      <div className="space-y-1.5">
                        {historyInsights.map((insight) => (
                          <div key={insight} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/70 shrink-0" />
                            <p className={`text-xs leading-relaxed ${isLight ? 'text-zinc-700' : 'text-zinc-400'}`}>{insight}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fast period controls - улучшены для светлой темы */}
                  <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                    {PERIOD_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePresetChange(p)}
                        className={[
                          'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                          periodPreset === p
                            ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700'
                            : isLight
                            ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-800 hover:border-zinc-400'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setHistoryFiltersOpen((v) => !v)}
                      className={[
                        'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                        historyFiltersOpen
                          ? 'border-zinc-500 bg-zinc-800 text-zinc-100'
                          : isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-800 hover:border-zinc-400'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200',
                      ].join(' ')}
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
                        const category = getMoneyCategoryMeta(entry.instrument);
                        const Icon = category?.icon || MoreHorizontal;
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
                            <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${entry.pnl >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}`}>
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
                      onClick={handleExportCsv}
                      disabled={historyTrades.length === 0}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-900 hover:border-zinc-400'
                          : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Скачать CSV
                    </button>
                      <p className={`mt-1 px-1 text-[10px] leading-tight ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>Скачает операции по выбранным фильтрам</p>
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

                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {PERIOD_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePresetChange(p)}
                        className={[
                          'rounded-full border px-2.5 py-1 font-data text-[11px] tracking-wide transition-colors',
                          periodPreset === p
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                            : isLight
                            ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-800 hover:border-zinc-400'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {p}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 mb-3">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => handleDateFromChange(e.target.value)}
                      className={`flex-1 min-w-0 rounded-md border px-2 py-1.5 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                        isLight
                          ? 'bg-white border-zinc-300 text-zinc-900'
                          : 'bg-zinc-950 border-zinc-700 text-zinc-200'
                      }`}
                    />
                    <span className={isLight ? 'text-zinc-400' : 'text-zinc-600'}>—</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => handleDateToChange(e.target.value)}
                      className={`flex-1 min-w-0 rounded-md border px-2 py-1.5 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                        isLight
                          ? 'bg-white border-zinc-300 text-zinc-900'
                          : 'bg-zinc-950 border-zinc-700 text-zinc-200'
                      }`}
                    />
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <select
                      value={platformFilter}
                      onChange={(e) => setPlatformFilter(e.target.value)}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                        isLight
                          ? 'bg-white border-zinc-300 text-zinc-900'
                          : 'bg-zinc-950 border-zinc-700 text-zinc-200'
                      }`}
                    >
                      <option value="ALL">Все источники</option>
                      {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
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
                      {formatPnlDisplay(historyTotal)}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleExportCsv}
                      disabled={historyTrades.length === 0}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 font-data text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        isLight
                          ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-900 hover:border-zinc-400'
                          : 'border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'
                      }`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Экспорт CSV
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
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-200 ${
            modalVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={handleModalBackdropClick}
        >
          <div
            className={`relative w-full max-w-[360px] rounded-2xl border px-4 py-4 shadow-2xl transition-all duration-200 sm:px-5 sm:py-5 ${
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
                        {MONEY_CATEGORIES.map((category) => {
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
                className="mt-3 block w-full rounded-xl bg-amber-400 px-4 py-3 text-base font-bold text-zinc-950 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {isSaving ? 'Сохранение...' : (editingTrade ? 'Сохранить изменения' : (traderMode ? 'Сохранить сделку' : t('saveRecord')))}
              </button>
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

            <div className="flex flex-wrap gap-1.5 mb-4">
              {['Текущий период', ...PERIOD_PRESETS].map((p) => (
                <button
                  key={p}
                  onClick={() => (p === 'Текущий период' ? openAnalysis() : handleAnalysisPreset(p))}
                  className={[
                    'rounded-full border px-2.5 py-1 font-data text-[11px] tracking-wide transition-colors',
                    analysisPreset === p
                      ? 'border-amber-400/60 bg-amber-400/10 text-amber-600'
                      : isLight
                      ? 'border-zinc-300 bg-white text-zinc-600 hover:text-zinc-800 hover:border-zinc-400'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>

            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'} mb-4`}>{analysisStats.count} {traderMode ? 'сделок' : 'операций'} в выборке</p>

            {moneyAnalysis && (
              <div className="mb-4 space-y-3">
                <div className={`grid grid-cols-3 gap-2 rounded-lg border p-2 ${
                  isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-950'
                }`}>
                  {[
                    ['Доходы', moneyAnalysis.income, 'text-emerald-600'],
                    ['Расходы', moneyAnalysis.expenses, 'text-red-600'],
                    ['Остаток', moneyAnalysis.balance, moneyAnalysis.balance >= 0 ? 'text-emerald-600' : 'text-red-600'],
                  ].map(([label, amount, color]) => (
                    <div key={label} className="rounded-lg border p-2">
                      <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</p>
                      <p className={`font-data text-sm ${color}`}>{amount < 0 ? '-' : ''}{currencySymbol}{formatMoney(Math.abs(amount))}</p>
                    </div>
                  ))}
                </div>
                {moneyAnalysis.topCategories.length > 0 && (
                  <div className={`rounded-lg border p-3 ${
                    isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-950'
                  }`}>
                    <p className={`mb-2 text-xs font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>Куда уходят деньги</p>
                    <div className="space-y-2">
                      {moneyAnalysis.topCategories.map(([category, amount]) => (
                        <div key={category}>
                          <div className={`mb-1 flex justify-between text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}><span>{category}</span><span>{currencySymbol}{formatMoney(amount)}</span></div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.max(6, Math.round((amount / moneyAnalysis.expenses) * 100))}%` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {moneyAnalysis.cigarettes > 0 && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-600">Сигареты: {currencySymbol}{formatMoney(moneyAnalysis.cigarettes)} — {moneyAnalysis.cigaretteShare}% всех расходов.</p>}
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
    </div>
  );
}
