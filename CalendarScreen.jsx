import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Inbox, TrendingUp, TrendingDown, Sparkles, Plus, X, Trash2,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, Link2, KeyRound, UploadCloud, FileText,
  LogIn, LogOut, CheckCircle2, RefreshCw, History, Download, Pencil,
  Wallet, ShoppingCart, Home, Briefcase, ShoppingBag, CreditCard, MoreHorizontal,
  Settings, Sun, Moon, Languages, CircleDollarSign,
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

function currentTimeHHMM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Safely normalize form/input values before string operations.
// Old or incomplete trade records must never be able to crash the whole screen.
function textValue(value) {
  return value == null ? '' : String(value);
}

// yyyy-mm-dd key — used consistently for calendar cells, manual trade storage
// and the period date inputs so that string comparison ("2026-07-16" <=
// "2026-07-31") is enough to filter by period.
function keyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// dateKey ("yyyy-mm-dd") is always a LOCAL calendar date — parse it as local,
// never via `new Date(dateKey)` (that reads it as UTC and can shift by a day).
function parseDateKeyLocal(dateKey) {
  const [y, m, day] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeekMonday(d) {
  const day = (d.getDay() + 6) % 7; // Monday-start week
  return addDays(d, -day);
}

function formatMoney(n) {
  const abs = Math.abs(n);
  const rounded = Math.round(abs * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function formatSignedShort(n) {
  return `${n >= 0 ? '+' : '-'}$${formatMoney(n)}`;
}

function formatMoneyShort(n) {
  const abs = Math.abs(n);
  const [divisor, suffix] = abs >= 1e9 ? [1e9, 'б'] : abs >= 1e6 ? [1e6, 'м'] : abs >= 1e3 ? [1e3, 'к'] : [1, ''];
  return String(Math.round(abs / divisor)) + suffix;
}

function formatDateLabel(dateKey) {
  return parseDateKeyLocal(dateKey).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

const PERIOD_PRESETS = ['Сегодня', 'Текущая неделя', 'Текущий месяц', 'Вся история'];

function getPresetRange(preset, today) {
  const y = today.getFullYear();
  const m = today.getMonth();

  switch (preset) {
    case 'Сегодня': {
      const k = keyFromDate(today);
      return { from: k, to: k };
    }
    case 'Текущая неделя': {
      const start = startOfWeekMonday(today);
      const end = addDays(start, 6);
      return { from: keyFromDate(start), to: keyFromDate(end) };
    }
    case 'Текущий месяц': {
      const start = new Date(y, m, 1);
      const end = new Date(y, m + 1, 0);
      return { from: keyFromDate(start), to: keyFromDate(end) };
    }
    case 'Вся история':
      return { from: '0000-01-01', to: '9999-12-31' };
    default:
      return { from: keyFromDate(today), to: keyFromDate(today) };
  }
}

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_MD = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];
function monthsFor(language) {
  if (language === 'en') return MONTHS_EN;
  if (language === 'md') return MONTHS_MD;
  return MONTHS;
}

const DEFAULT_ASSET_TAGS = ['BTCUSD', 'ETHUSD', 'XAUUSD', 'EURUSD', 'NDX100'];
const INSTRUMENT_INFO = {
  BTCUSD: { icon: '₿', label: 'Bitcoin / US Dollar' },
  ETHUSD: { icon: 'Ξ', label: 'Ethereum / US Dollar' },
  XAUUSD: { icon: '🥇', label: 'Gold / US Dollar' },
  EURUSD: { icon: '€', label: 'Euro / US Dollar' },
  NDX100: { icon: '📈', label: 'Nasdaq 100' },
};

const MONEY_CATEGORIES = [
  { key: 'Зарплата', icon: Wallet },
  { key: 'Продукты', icon: ShoppingCart },
  { key: 'Жильё', icon: Home },
  { key: 'Работа', icon: Briefcase },
  { key: 'Покупки', icon: ShoppingBag },
  { key: 'Подписки', icon: CreditCard },
  { key: 'Фриланс', icon: Wallet },
  { key: 'Другое', icon: MoreHorizontal },
];
const EXCHANGES = ['Bybit', 'Binance', 'OKX', 'MT4/MT5', 'cTrader'];
const PLATFORMS = ['Manual', ...EXCHANGES];
const RECENT_INSTRUMENTS_STORAGE_KEY = 'atj_recent_instruments';
const CUSTOM_TAGS_STORAGE_KEY = 'atj_custom_instrument_tags';
const DEPOSIT_SIZE_STORAGE_KEY = 'atj_deposit_size';
const TRADER_MODE_STORAGE_KEY = 'atj_trader_mode';
const MAX_CUSTOM_TAGS = 6;

function getMoneyCategoryMeta(category) {
  return MONEY_CATEGORIES.find((item) => item.key === category) || null;
}

// ---------------------------------------------------------------------------
// Settings: language / currency / theme
// Persisted locally per device (not per Supabase user) — same pattern as the
// other small UI prefs already in this file (deposit size, trader mode).
// ---------------------------------------------------------------------------
const LANGUAGE_STORAGE_KEY = 'atj_language';
const CURRENCY_STORAGE_KEY = 'atj_currency';
const THEME_STORAGE_KEY = 'atj_theme';

const LANGUAGES = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'md', label: 'MD' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'MDL', symbol: 'L', label: 'MDL' },
  { code: 'RUB', symbol: '₽', label: 'RUB' },
];

function getCurrencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}

// Only the chrome that's always visible (header, day panel, settings, empty
// states) is translated for now — deep modals (platform connect, CSV import,
// AI analysis copy) stay in Russian for this pass and can be extended later
// using the same `t()` helper and dictionary shape.
const TRANSLATIONS = {
  ru: {
    titleMoney: 'Денежный календарь', titlePro: 'Трейдерский календарь',
    signIn: 'Войти через Google', signOut: 'Выйти из аккаунта',
    settings: 'Настройки', language: 'Язык', currency: 'Валюта', theme: 'Тема',
    themeDark: 'Ночь', themeLight: 'День',
    balanceOfDay: 'Баланс дня', overallResult: 'Общий результат дня',
    analysis: 'Анализ', addRecord: 'Новая запись', addTrade: 'Добавить сделку',
    operations: 'История', income: 'Доходы', expense: 'Расходы',
    trades: 'Сделок', winrate: 'Winrate', noRecords: 'Пока нет записей за этот период.',
    close: 'Закрыть',
    record: 'Запись', editRecord: 'Редактировать запись', deleteRecord: 'Удалить запись',
    saveRecord: 'Сохранить запись', recordNotePlaceholder: 'Заметка по записи (необязательно)',
    recordFutureBlocked: 'Нельзя добавить запись на будущую дату',
    myMoney: 'Мои деньги',
  },
  en: {
    titleMoney: 'Money Calendar', titlePro: 'Trading Calendar',
    signIn: 'Sign in with Google', signOut: 'Sign out',
    settings: 'Settings', language: 'Language', currency: 'Currency', theme: 'Theme',
    themeDark: 'Dark', themeLight: 'Light',
    balanceOfDay: "Day's balance", overallResult: "Day's overall result",
    analysis: 'Analysis', addRecord: 'New entry', addTrade: 'Add trade',
    operations: 'History', income: 'Income', expense: 'Expenses',
    trades: 'Trades', winrate: 'Winrate', noRecords: 'No entries for this period yet.',
    close: 'Close',
    record: 'Entry', editRecord: 'Edit entry', deleteRecord: 'Delete entry',
    saveRecord: 'Save entry', recordNotePlaceholder: 'Note (optional)',
    recordFutureBlocked: "Can't add an entry for a future date",
    myMoney: 'My money',
  },
  md: {
    titleMoney: 'Calendar de bani', titlePro: 'Calendar de tranzacții',
    signIn: 'Autentificare cu Google', signOut: 'Ieșire din cont',
    settings: 'Setări', language: 'Limbă', currency: 'Valută', theme: 'Temă',
    themeDark: 'Noapte', themeLight: 'Zi',
    balanceOfDay: 'Soldul zilei', overallResult: 'Rezultatul zilei',
    analysis: 'Analiză', addRecord: 'Înregistrare nouă', addTrade: 'Adaugă tranzacție',
    operations: 'Istoric', income: 'Venituri', expense: 'Cheltuieli',
    trades: 'Tranzacții', winrate: 'Winrate', noRecords: 'Încă nu sunt înregistrări pentru această perioadă.',
    close: 'Închide',
    record: 'Înregistrare', editRecord: 'Editează înregistrarea', deleteRecord: 'Șterge înregistrarea',
    saveRecord: 'Salvează înregistrarea', recordNotePlaceholder: 'Notă (opțional)',
    recordFutureBlocked: 'Nu se poate adăuga o înregistrare pentru o dată viitoare',
    myMoney: 'Banii mei',
  },
};

function translate(language, key) {
  return (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.ru[key] || key;
}

function getValidUserId(user) {
  const id = typeof user?.id === 'string' ? user.id.trim() : '';
  // Supabase public.user_id is UUID. Treat anything else (including the
  // literal string "undefined") as a guest session.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id) ? id : null;
}

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

  // Google session — optional; the calendar works without signing in
  const [user, setUser] = useState(null);
  const nicknamePrompted = useRef(false);

  // in-app "choose a nickname" modal shown once right after a fresh Google login
  const [nicknameModalOpen, setNicknameModalOpen] = useState(false);
  const [nicknameModalVisible, setNicknameModalVisible] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // --- cTrader connection state ------------------------------------------
  const [ctraderConnected, setCtraderConnected] = useState(false);
  const [ctraderLoading, setCtraderLoading] = useState(false);

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
    if (!getValidUserId(user)) {
      handleGoogleLogin();
      return;
    }
    const clientId = import.meta.env.VITE_CTRADER_CLIENT_ID;
    const redirectUri = encodeURIComponent(window.location.origin + '/');
    window.location.href = `https://connect.spotware.com/apps/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=trading`;
  }

  useEffect(() => {
    async function init() {
      // Google возвращает нас на страницу с токенами в hash (#access_token=...).
      // Библиотека сама их иногда не подхватывает — заберём вручную и надёжно.
      if (window.location.hash.includes('access_token')) {
        const params = new URLSearchParams(window.location.hash.substring(1));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          console.log('[auth] setSession вручную →', error ? 'ошибка' : 'успех', error || '');
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      const { data, error } = await supabase.auth.getSession();
      console.log('[auth] getSession →', data.session ? 'сессия найдена' : 'сессии нет', error || '');
      const currentUser = data.session?.user ?? null;
      const normalizedUser = getValidUserId(currentUser) ? currentUser : null;
      setUser(normalizedUser);

      // cTrader вернул нас с ?code=... в адресе — обмениваем на токены
      const code = new URLSearchParams(window.location.search).get('code');
      if (code && normalizedUser) {
        handleCtraderCallback(code);
      } else if (code && !normalizedUser) {
        // код есть, но пользователь ещё не вошёл через Google — обмен невозможен,
        // чистим адрес сразу, иначе код "зависнет" в URL навсегда
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (normalizedUser) {
        checkCtraderStatus(getValidUserId(normalizedUser));
      }
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth] событие:', event, session ? session.user.email : '(нет пользователя)');
      const activeUser = session?.user ?? null;
      const normalizedUser = getValidUserId(activeUser) ? activeUser : null;
      setUser(normalizedUser);
      if (normalizedUser) checkCtraderStatus(getValidUserId(normalizedUser));
      else setCtraderConnected(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  // open the nickname modal once per fresh login, if no nickname is saved yet
  useEffect(() => {
    if (!user || user.user_metadata?.nickname || nicknamePrompted.current) return;
    nicknamePrompted.current = true;
    setNicknameInput(user.user_metadata?.full_name || '');
    setNicknameModalOpen(true);
    requestAnimationFrame(() => setNicknameModalVisible(true));
  }, [user]);

  function closeNicknameModal() {
    setNicknameModalVisible(false);
    setTimeout(() => setNicknameModalOpen(false), 180);
  }

  function handleSaveNickname() {
    const googleName = user?.user_metadata?.full_name || user?.email || '';
    const nickname = textValue(nicknameInput).trim() || googleName;
    supabase.auth.updateUser({ data: { nickname } });
    closeNicknameModal();
  }

  async function handleGoogleLogin() {
    console.log('[auth] кнопка "Войти через Google" нажата');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        queryParams: { prompt: 'select_account' },
        redirectTo: window.location.origin,
      },
    });
    if (error) console.error('[auth] ошибка от Supabase:', error);
    else console.log('[auth] signInWithOAuth вызван, редирект-URL:', data?.url);
  }

  async function handleGoogleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[auth] ошибка при выходе:', error);
  }

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


  const [manualTrades, setManualTrades] = useState({}); // { [dateKey]: Trade[] } — real, user-saved trades only
  const manualTradesRef = useRef({});
  const [recentInstruments, setRecentInstruments] = useState([]); // most-recently-used instrument symbols
  const [customTags, setCustomTags] = useState([]); // user-added instrument tags, max MAX_CUSTOM_TAGS
  const [addingCustomTag, setAddingCustomTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const dragTagIndex = useRef(null);

  // --- Offline/local support ----------------------------------------------
  // Guest users work completely locally. Authenticated users get their own
  // browser cache, so different accounts on the same device never mix data.
  const GUEST_TRADES_CACHE_KEY = 'money_calendar_guest_trades_cache';
  const OFFLINE_QUEUE_KEY = 'atj_offline_queue';

  function getTradesCacheKey(userId) {
    return userId ? `money_calendar_trades_${userId}` : GUEST_TRADES_CACHE_KEY;
  }

  function readCachedTrades(userId) {
    try {
      const raw = window.localStorage.getItem(getTradesCacheKey(userId));
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  function cacheTradesLocally(trades, userId) {
    try {
      window.localStorage.setItem(getTradesCacheKey(userId), JSON.stringify(trades));
    } catch {
      // ignore storage failures
    }
  }

  function readOfflineQueue() {
    try {
      return JSON.parse(window.localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function writeOfflineQueue(queue) {
    try {
      window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch {
      // ignore storage failures
    }
  }

  const [pendingSyncCount, setPendingSyncCount] = useState(() => readOfflineQueue().length);
  const tradesCacheOwnerRef = useRef('__loading__');

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

  async function flushOfflineQueue() {
    if (!user || !navigator.onLine) return;
    const queue = readOfflineQueue();
    if (queue.length === 0) return;

    const remaining = [];
    for (const item of queue) {
      try {
        if (item.action === 'insert') {
          const queuedUserId = item.trade?.user_id;
          if (!queuedUserId) {
            // Legacy guest queue item: guest data stays local and must not
            // be sent to Supabase without a real authenticated user id.
            continue;
          }
          const { data, error } = await supabase.from('trades').insert(item.trade).select().single();
          if (error) throw error;
          // swap the temporary offline id for the real database id
          setManualTrades((prev) => ({
            ...prev,
            [item.trade.date_key]: (prev[item.trade.date_key] || []).map((t) =>
              t.id === item.tempId ? { ...t, id: data.id } : t
            ),
          }));
        } else if (item.action === 'update') {
          const { error } = await supabase.from('trades').update(item.updates).eq('id', item.tradeId);
          if (error) throw error;
        } else if (item.action === 'delete') {
          const { error } = await supabase.from('trades').delete().eq('id', item.tradeId);
          if (error) throw error;
        }
      } catch (err) {
        console.error('[offline] не удалось синхронизировать, оставляю в очереди:', err);
        remaining.push(item);
      }
    }
    writeOfflineQueue(remaining);
    setPendingSyncCount(remaining.length);
  }

  useEffect(() => {
    window.addEventListener('online', flushOfflineQueue);
    return () => window.removeEventListener('online', flushOfflineQueue);
  }, [user]);

  // Guest: read/write locally and use the app without any account.
  // Signed-in: read the user's cloud data, with a user-specific local cache.
  useEffect(() => {
    const cloudUserId = getValidUserId(user);
    const owner = cloudUserId || 'guest';
    tradesCacheOwnerRef.current = '__loading__';

    const cached = readCachedTrades(cloudUserId);
    setManualTrades(cached);

    if (!user) {
      tradesCacheOwnerRef.current = owner;
      setCtraderConnected(false);
      return;
    }

    if (!navigator.onLine) {
      tradesCacheOwnerRef.current = owner;
      return;
    }

    supabase
      .from('trades')
      .select('*')
      .eq('user_id', cloudUserId)
      .then(({ data, error }) => {
        if (error) {
          console.error('[trades] ошибка загрузки:', error);
          // Keep cached data visible even when cloud loading fails.
          tradesCacheOwnerRef.current = owner;
          return;
        }

        const grouped = {};
        for (const row of data) {
          grouped[row.date_key] = grouped[row.date_key] || [];
          grouped[row.date_key].push({
            id: row.id,
            time: textValue(row.time),
            instrument: textValue(row.instrument),
            direction: textValue(row.direction),
            pnl: Number(row.pnl),
            comment: row.comment || '',
            platform: textValue(row.platform) || 'Manual',
            take_profit: row.take_profit ?? null,
            stop_loss: row.stop_loss ?? null,
          });
        }

        setManualTrades((prev) => {
          const merged = { ...grouped };

          // Keep local-only records and local edits. Cloud records fill in
          // anything that is not already present locally.
          for (const [dateKey, localList] of Object.entries(prev || {})) {
            if (!merged[dateKey]) {
              merged[dateKey] = localList;
              continue;
            }

            const cloudById = new Map(merged[dateKey].map((t) => [String(t.id), t]));
            const localByCloudId = new Map(
              localList
                .filter((t) => t.id && !String(t.id).startsWith('guest-') && !String(t.id).startsWith('local-') && !String(t.id).startsWith('offline-'))
                .map((t) => [String(t.id), t])
            );

            // Preserve local version of any record that already exists in cloud.
            for (const [id, localTrade] of localByCloudId.entries()) {
              if (cloudById.has(id)) {
                cloudById.set(id, localTrade);
              }
            }

            // Append genuinely local-only records.
            const existingIds = new Set(merged[dateKey].map((t) => String(t.id)));
            for (const localTrade of localList) {
              if (!existingIds.has(String(localTrade.id))) {
                merged[dateKey].push(localTrade);
              }
            }
          }

          manualTradesRef.current = merged;
          return merged;
        });

        tradesCacheOwnerRef.current = owner;
        flushOfflineQueue();
      });
  }, [user]);

  // Keep the correct guest/user cache in sync with what is displayed.
  useEffect(() => {
    manualTradesRef.current = manualTrades;

    const cloudUserId = getValidUserId(user);
    const owner = cloudUserId || 'guest';
    if (tradesCacheOwnerRef.current !== owner) return;
    cacheTradesLocally(manualTrades, cloudUserId);
  }, [manualTrades, user?.id]);


  // --- Period filter state (compact popover) --------------------------------
  const [periodPreset, setPeriodPreset] = useState('Вся история');
  const initialRange = useMemo(() => getPresetRange('Вся история', today), [today]);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [platformFilter, setPlatformFilter] = useState('ALL');
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
    return Array.from({ length: 42 }, (_, i) => {
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
      .filter((t) => (t.currency || 'USD') === currency);
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
  }, [cells, manualTrades, platformFilter]);

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
      .sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
  }, [manualTrades, effectiveFrom, effectiveTo, platformFilter, currency]);

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
    const dateKey = modalDateKey || targetDateKey;

    if (dateKey > todayKey) {
      setFormError('Нельзя добавить запись на будущую дату.');
      return;
    }

    const instrument = textValue(form.instrument).trim().toUpperCase();
    if (!instrument) {
      setFormError(traderMode ? 'Укажите символ инструмента.' : 'Выберите категорию или укажите свою.');
      return;
    }

    const pnlText = textValue(form.pnl).trim();
    if (!pnlText) {
      setFormError('Укажите сумму в $.');
      return;
    }

    const magnitude = parseFloat(pnlText);
    if (Number.isNaN(magnitude) || magnitude < 0) {
      setFormError('Сумма должна быть числом ≥ 0.');
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

    const cloudUserId = getValidUserId(user);
    const isEditing = Boolean(editingTrade);
    const localId = isEditing
      ? editingTrade.id
      : `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const localTrade = {
      id: localId,
      time,
      instrument,
      direction: finalDirection,
      pnl: signedPnl,
      comment,
      platform,
      // Per-entry currency: kept local-only (not sent to Supabase below) so
      // it can't break cloud saves if the `trades` table doesn't have this
      // column yet — same precaution as take_profit/stop_loss above.
      currency: form.currency || currency,
      ...(traderMode ? { take_profit: tp, stop_loss: sl } : {}),
      pending: false,
    };

    // -------- LOCAL FIRST --------
    // This is what the UI renders. It never depends on Google/Supabase.
    //
    // IMPORTANT: this must go through the functional setState form, reading
    // off `prev` (React's own latest state) rather than a manually-kept
    // `manualTradesRef` snapshot. The ref is only re-synced *after* a render
    // commits, so if a background update (cloud fetch merge, offline-queue
    // flush) lands in that gap, a snapshot taken from the stale ref would
    // overwrite it — this is what silently dropped a same-day second entry.
    // Building the next value inside the updater keeps every save strictly
    // ordered against every other update to the same state, regardless of
    // timing.
    setManualTrades((prev) => {
      const nextForDay = [...(prev[dateKey] || [])];

      if (isEditing) {
        const index = nextForDay.findIndex((t) => String(t.id) === String(editingTrade.id));
        if (index >= 0) {
          nextForDay[index] = { ...nextForDay[index], ...localTrade };
        } else {
          nextForDay.push(localTrade);
        }
      } else {
        nextForDay.push(localTrade);
      }

      const nextTrades = { ...prev, [dateKey]: nextForDay };
      manualTradesRef.current = nextTrades;
      // Persist immediately to the correct local store.
      cacheTradesLocally(nextTrades, cloudUserId);
      return nextTrades;
    });

    setRecentInstruments((prev) =>
      [instrument, ...prev.filter((i) => i !== instrument)].slice(0, 5)
    );

    closeModal();

    // -------- GUEST --------
    if (!cloudUserId) return;

    // -------- CLOUD SYNC IN BACKGROUND --------
    // Only the core columns are sent for now. This prevents the missing
    // stop_loss/take_profit DB columns from breaking PRO saves.
    const cloudPayload = {
      user_id: cloudUserId,
      date_key: dateKey,
      time,
      instrument,
      direction: finalDirection,
      pnl: signedPnl,
      comment,
      platform,
    };

    try {
      if (isEditing && !String(editingTrade.id).startsWith('local-') && !String(editingTrade.id).startsWith('guest-') && !String(editingTrade.id).startsWith('offline-')) {
        // Existing Supabase record: update in the background.
        const { error } = await supabase
          .from('trades')
          .update({
            time,
            instrument,
            direction: finalDirection,
            pnl: signedPnl,
            comment,
            platform,
          })
          .eq('id', editingTrade.id)
          .eq('user_id', cloudUserId);

        if (error) {
          console.warn('[cloud-sync] update skipped:', error.message);
        }
        return;
      }

      // New local record: create the cloud copy in the background.
      const { data, error } = await supabase
        .from('trades')
        .insert(cloudPayload)
        .select()
        .single();

      if (error) {
        console.warn('[cloud-sync] insert skipped, local record kept:', error.message);
        return;
      }

      // Replace ONLY the local record we just created.
      setManualTrades((prev) => {
        const merged = { ...prev };
        const list = [...(merged[dateKey] || [])];
        const index = list.findIndex((t) => String(t.id) === String(localId));

        if (index >= 0) {
          list[index] = {
            ...list[index],
            id: data.id,
            pending: false,
          };
          merged[dateKey] = list;
        }

        manualTradesRef.current = merged;
        cacheTradesLocally(merged, cloudUserId);
        return merged;
      });
    } catch (err) {
      console.warn('[cloud-sync] unavailable, local record kept:', err);
    }
  }

  async function handleDeleteTrade(dateKey, tradeId) {
    const cloudUserId = getValidUserId(user);

    // Same reasoning as handleSaveTrade: build off `prev`, not the ref.
    setManualTrades((prev) => {
      const nextTrades = { ...prev };
      nextTrades[dateKey] = (nextTrades[dateKey] || []).filter(
        (t) => String(t.id) !== String(tradeId)
      );
      manualTradesRef.current = nextTrades;
      cacheTradesLocally(nextTrades, cloudUserId);
      return nextTrades;
    });

    // Guest/local-only record.
    if (!cloudUserId || String(tradeId).startsWith('guest-') || String(tradeId).startsWith('local-')) {
      return;
    }

    // Offline synced-later delete.
    if (!navigator.onLine) {
      const queue = readOfflineQueue(cloudUserId);
      queue.push({ action: 'delete', tradeId });
      writeOfflineQueue(queue, cloudUserId);
      setPendingSyncCount(queue.length);
      return;
    }

    try {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', tradeId)
        .eq('user_id', cloudUserId);

      if (error) console.warn('[trades] cloud delete skipped:', error.message);
    } catch (err) {
      console.warn('[trades] cloud delete unavailable:', err);
    }
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
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const historyTrades = useMemo(() => {
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => arr.map((t) => ({ ...t, dateKey })))
      .filter((t) => t.dateKey >= dateFrom && t.dateKey <= dateTo)
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => (t.currency || 'USD') === currency)
      .filter((t) => historyWinLoss === 'all' || (historyWinLoss === 'win' ? t.pnl >= 0 : t.pnl < 0))
      .sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
  }, [manualTrades, dateFrom, dateTo, platformFilter, historyWinLoss, currency]);

  const historyTotal = useMemo(() => historyTrades.reduce((sum, t) => sum + t.pnl, 0), [historyTrades]);
  const historyIncome = useMemo(() => historyTrades.reduce((sum, t) => sum + (t.pnl > 0 ? t.pnl : 0), 0), [historyTrades]);
  const historyExpense = useMemo(() => historyTrades.reduce((sum, t) => sum + (t.pnl < 0 ? Math.abs(t.pnl) : 0), 0), [historyTrades]);

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

    // Guest history is stored locally and can be cleared without login.
    const cloudUserId = getValidUserId(user);
    if (!cloudUserId) {
      setManualTrades({});
      setConfirmingClear(false);
      return;
    }
    const { error } = await supabase.from('trades').delete().eq('user_id', cloudUserId);
    if (error) {
      console.error('[trades] ошибка очистки истории:', error);
      return;
    }
    setManualTrades({});
    setConfirmingClear(false);
  }

  function handleExportCsv() {
    const header = ['Дата', 'Время', 'Категория', 'Тип', 'Сумма', 'Источник', 'Комментарий'];
    const rows = historyTrades.map((t) => [
      t.dateKey,
      t.time,
      t.instrument,
      t.pnl >= 0 ? 'Доход' : 'Расход',
      t.pnl,
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
        .theme-light .bg-zinc-900 { background-color: #ffffff !important; }
        .theme-light .bg-zinc-800 { background-color: #e4e4e7 !important; }
        .theme-light .text-zinc-50,
        .theme-light .text-zinc-100 { color: #18181b !important; }
        .theme-light .text-zinc-200 { color: #27272a !important; }
        .theme-light .text-zinc-300 { color: #3f3f46 !important; }
        .theme-light .text-zinc-400 { color: #52525b !important; }
        .theme-light .text-zinc-500 { color: #52525b !important; }
        .theme-light .text-zinc-600 { color: #3f3f46 !important; }
        .theme-light .text-zinc-700 { color: #27272a !important; }
        .theme-light .border-zinc-800,
        .theme-light .border-zinc-700 { border-color: #d4d4d8 !important; }
        .theme-light .border-zinc-200 { border-color: #d4d4d8 !important; }
        .theme-light .border-zinc-300 { border-color: #a1a1aa !important; }
        .theme-light .bg-zinc-50 { background-color: #f4f4f5 !important; }
        /* Dark, unobtrusive scrollbars everywhere instead of the default
           bright OS scrollbar, which reads as a stray white line in this UI. */
        * { scrollbar-width: thin; scrollbar-color: #52525b transparent; }
        *::-webkit-scrollbar { height: 6px; width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: #52525b; border-radius: 9999px; }
        .theme-light *::-webkit-scrollbar-thumb { background-color: #a1a1aa; }
        .theme-light { scrollbar-color: #a1a1aa transparent; }
      `}</style>

      {/* HEADER */}
      <header className={`px-3 sm:px-8 pt-4 sm:pt-8 pb-4 border-b ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className={`font-data text-[10px] tracking-widest uppercase ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{traderMode ? t('titlePro') : t('titleMoney')}</p>

          {/* Theme toggle + settings gear — compact on mobile, same control scales up on wider screens */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setTheme((v) => (v === 'light' ? 'dark' : 'light'))}
              title={isLight ? t('themeDark') : t('themeLight')}
              aria-label="Переключить тему"
              className={[
                'relative flex items-center gap-1 rounded-full border px-2 py-1 text-xs overflow-hidden transition-all duration-300',
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
                {isLight ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              </span>
            </button>

            <div className="relative" ref={settingsRef}>
              <button
                type="button"
                onClick={() => (settingsOpen ? closeSettings() : openSettings())}
                title={t('settings')}
                aria-label={t('settings')}
                className={[
                  'flex items-center justify-center h-7 w-7 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
                  isLight
                    ? 'border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-amber-400 hover:border-zinc-600',
                ].join(' ')}
              >
                <Settings
                  className="h-3.5 w-3.5 transition-transform duration-300 ease-out"
                  style={{ transform: settingsOpen ? 'rotate(75deg)' : 'rotate(0deg)' }}
                />
              </button>

              {settingsOpen && (
                <div
                  className={[
                    'absolute right-0 top-full mt-2 z-30 rounded-xl border shadow-xl p-4 origin-top-right',
                    'w-[220px] sm:w-[260px]',
                    'transition-all duration-200 ease-out',
                    settingsVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1.5 scale-95',
                    isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900',
                  ].join(' ')}
                >
                  <p className={`font-data text-[10px] tracking-widest uppercase mb-3 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    {t('settings')}
                  </p>

                  <div className={`mb-3 rounded-lg border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950'}`}>
                    <p className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}><Languages className="h-3.5 w-3.5" /> {t('language')}</p>
                    <div className="flex gap-1.5">
                      {LANGUAGES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => setLanguage(l.code)}
                          className={[
                            'flex-1 rounded-md border px-2 py-1.5 text-xs font-data transition-colors',
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

                  <div className={`rounded-lg border p-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950'}`}>
                    <p className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wide mb-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}><CircleDollarSign className="h-3.5 w-3.5" /> {t('currency')}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CURRENCIES.map((c) => (
                        <button
                          key={c.code}
                          onClick={() => setCurrency(c.code)}
                          className={[
                            'rounded-md border px-2 py-1.5 text-xs font-data transition-colors',
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
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goToPrevMonth}
              aria-label="Предыдущий месяц"
              title="Предыдущий месяц"
              className="rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-baseline gap-2 min-w-[190px]">
              <div className="relative" ref={monthMenuRef}>
                <button
                  onClick={() => { setMonthMenuOpen((v) => !v); setYearMenuOpen(false); }}
                  className="font-display text-2xl font-semibold text-zinc-50 hover:text-amber-400 transition-colors"
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
                  className="font-display text-2xl font-semibold text-zinc-500 hover:text-amber-400 transition-colors"
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
              className="rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            {/* Account */}
            <div className="ml-2 flex items-center rounded-md border border-zinc-800 bg-zinc-900 font-data text-[10px] tracking-wide overflow-hidden">
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

            {/* Money / PRO + platform reveal */}
            <div className="ml-1.5 flex items-center">
              {/* Smooth mode switch */}
              <button
                type="button"
                role="switch"
                aria-checked={traderMode}
                onClick={() => setTraderMode((v) => {
                  const next = !v;
                  if (!next) setPlatformFilter('ALL');
                  return next;
                })}
                title={traderMode
                  ? 'PRO: LONG/SHORT, Take Profit и Stop Loss'
                  : 'Денежный: доходы и расходы без трейдерских полей'}
                className="relative h-7 w-[92px] shrink-0 rounded-full border border-zinc-800 bg-zinc-900 p-0.5 font-data text-[9px] tracking-wider text-zinc-500 shadow-inner focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/60"
              >
                {/* sliding active pill */}
                <span
                  aria-hidden="true"
                  className={[
                    'absolute top-0.5 bottom-0.5 left-0.5 w-[44px] rounded-full border transition-all duration-300 ease-out',
                    traderMode
                      ? 'translate-x-[44px] border-amber-400/50 bg-amber-400/10 shadow-[0_0_14px_rgba(251,191,36,0.08)]'
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
                  style={{ width: '44px' }}
                >
                  ДЕНЬГИ
                </span>
                <span
                  className={[
                    'absolute right-0.5 top-0.5 bottom-0.5 z-10 flex items-center justify-center transition-colors duration-300',
                    traderMode ? 'text-amber-400' : 'text-zinc-600',
                  ].join(' ')}
                  style={{ width: '44px' }}
                >
                  PRO
                </span>
              </button>

              {/* Platform slides out from the right side of PRO */}
              <div
                className="overflow-hidden shrink-0 transition-[width,margin,opacity] duration-300 ease-out"
                style={{
                  width: traderMode ? '92px' : '0px',
                  marginLeft: traderMode ? '6px' : '0px',
                  opacity: traderMode ? 1 : 0,
                }}
                aria-hidden={!traderMode}
              >
                <button
                  onClick={openConnectModal}
                  tabIndex={traderMode ? 0 : -1}
                  className="flex h-7 w-[92px] items-center justify-center gap-1 rounded-md border border-amber-400/40 bg-amber-400/10 px-2 font-data text-[10px] tracking-wide text-amber-400 whitespace-nowrap hover:bg-amber-400/15 transition-colors"
                >
                  <Link2 className="h-3 w-3 shrink-0" />
                  Площадка
                  {ctraderConnected && (
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              </div>
            </div>

            {/* install as app + offline pending-sync indicator */}
            <div className="relative ml-1.5" ref={installInfoRef}>
              <button
                onClick={handleInstallClick}
                title="Установить приложение"
                className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-zinc-400 hover:text-amber-400 hover:border-zinc-600 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                {pendingSyncCount > 0 && (
                  <span
                    title={`${pendingSyncCount} сделок ждут синхронизации`}
                    className="h-1.5 w-1.5 rounded-full bg-amber-400"
                  />
                )}
              </button>

              {installInfoOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-30 p-3">
                  <p className="font-data text-[10px] tracking-widest text-amber-400 uppercase mb-1.5">Установить как приложение</p>
                  <p className="text-xs text-zinc-400 leading-relaxed">{installInstructions}</p>
                  {pendingSyncCount > 0 && (
                    <p className="text-xs text-amber-400 mt-2 pt-2 border-t border-zinc-800">
                      {pendingSyncCount} {traderMode
                        ? (pendingSyncCount === 1 ? 'сделка' : 'сделок')
                        : (pendingSyncCount === 1 ? 'запись' : 'записей')} сохранены офлайн и досинхронизируются, когда появится интернет.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* CALENDAR — the main view of the whole app */}
      <section
        className={`flex-1 px-3 sm:px-8 py-4 sm:py-6 border-b relative transition-colors duration-200 ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedKey(null); }}
      >
        <div
          className="grid grid-cols-7 gap-1 sm:gap-2 mb-2"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedKey(null); }}
        >
          {WEEKDAYS.map((w) => (
            <div key={w} className={`font-data text-[11px] tracking-wider text-center uppercase pb-1 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {w}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 grid-rows-6 gap-1 sm:gap-2 h-full"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedKey(null); }}
        >
          {cells.map((cell, cellIndex) => {
            const isSelected = cell.key === selectedKey;
            const hasTrades = tradesForDayFiltered(cell.key).length > 0;
            const pnl = totalPnlForDay(cell.key);
            const isProfit = pnl >= 0;
            const pnlText = formatPnlDisplay(pnl, true);
            const intensity = monthMaxAbsPnl > 0 ? Math.min(Math.abs(pnl) / monthMaxAbsPnl, 1) : 0;
            const glowRgb = isProfit ? '16,185,129' : '239,68,68';
            const heatmapStyle =
              cell.inMonth && hasTrades && !isSelected
                ? {
                    backgroundColor: `rgba(${glowRgb},${(0.10 + intensity * 0.22).toFixed(2)})`,
                    borderColor: `rgba(${glowRgb},${(0.35 + intensity * 0.5).toFixed(2)})`,
                    boxShadow: `0 0 ${Math.round(6 + intensity * 22)}px rgba(${glowRgb},${(0.25 + intensity * 0.45).toFixed(2)})`,
                    animation: 'cellGlowIn 0.35s ease-out both',
                    animationDelay: `${cellIndex * 18}ms`,
                  }
                : { animation: 'cellGlowIn 0.35s ease-out both', animationDelay: `${cellIndex * 18}ms` };
            return (
              <button
                key={cell.key}
                onClick={() => setSelectedKey(isSelected ? null : cell.key)}
                style={heatmapStyle}
                className={[
                  'relative rounded-md border flex flex-col justify-between text-left transition-all duration-150',
                  'min-h-[64px] sm:min-h-[110px] p-1.5 sm:p-4',
                  isLight
                    ? (cell.inMonth ? (hasTrades ? 'bg-white' : 'bg-zinc-50') : 'bg-zinc-100')
                    : (cell.inMonth ? (hasTrades ? 'bg-zinc-900' : 'bg-zinc-900/20') : 'bg-zinc-950'),
                  isLight
                    ? (cell.inMonth ? (hasTrades ? 'border-zinc-300' : 'border-zinc-200') : 'border-zinc-200')
                    : (cell.inMonth ? (hasTrades ? 'border-zinc-800' : 'border-zinc-800/30') : 'border-zinc-900'),
                  !cell.inMonth ? 'opacity-40' : '',
                  isSelected
                    ? `border-amber-400 ring-2 ring-amber-400/60 scale-[1.03] shadow-lg shadow-amber-500/10 z-10 ${isLight ? 'bg-amber-50' : 'bg-zinc-800'}`
                    : isLight
                    ? 'hover:border-zinc-400 hover:bg-zinc-100'
                    : 'hover:border-zinc-600 hover:bg-zinc-800/60',
                ].join(' ')}
              >
                {cell.isToday && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
                <span className={`font-data text-xs sm:text-base ${cell.inMonth ? (isLight ? 'text-zinc-500' : 'text-zinc-400') : (isLight ? 'text-zinc-300' : 'text-zinc-700')}`}>
                  {cell.date.getDate()}
                </span>
                {cell.inMonth && hasTrades && (
                  <span className={`font-data text-[10px] sm:text-lg font-medium whitespace-nowrap ${isProfit ? 'text-emerald-500' : 'text-red-500'}`}>
                    {pnlText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

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
                        {trade.pnl >= 0 ? '+' : '-'}{getCurrencyMeta(trade.currency || currency).symbol}{formatMoney(trade.pnl)}
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
      <div className="fixed bottom-4 inset-x-0 flex justify-center z-30 pointer-events-none">
        <button
          onClick={openHistory}
          className={`pointer-events-auto flex items-center gap-2 rounded-full border backdrop-blur px-4 py-2.5 text-sm shadow-xl transition-colors ${
            isLight
              ? 'border-zinc-300 bg-white/95 text-zinc-700 hover:border-amber-400/60 hover:text-amber-500'
              : 'border-zinc-700 bg-zinc-900/95 text-zinc-200 hover:border-amber-400/60 hover:text-amber-400'
          }`}
        >
          <History className="h-4 w-4" />
          История
        </button>
      </div>

      {/* HISTORY MODAL — money mode gets a simple personal-finance timeline; PRO keeps the dense trader view */}
      {historyOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3 sm:px-4 transition-opacity duration-200 ${
            historyVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeHistory(); }}
        >
          <div
            className={`relative w-full ${traderMode ? 'max-w-md' : 'max-w-lg'} max-h-[86vh] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-2xl transition-all duration-200 ${
              historyVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 pb-4 border-b border-zinc-800/80">
              <div>
                <p className="font-data text-[10px] tracking-[0.22em] text-amber-400 uppercase mb-1">
                  {traderMode ? 'История сделок' : t('myMoney')}
                </p>
                <h2 className="font-display text-xl font-semibold text-zinc-50">
                  {traderMode
                    ? (periodPreset === 'Вся история' ? 'Вся история' : dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`)
                    : 'Финансовая история'}
                </h2>
              </div>
              <button
                onClick={closeHistory}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
                aria-label="Закрыть"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto px-5 sm:px-6 py-5 max-h-[calc(86vh-80px)]">
              {!traderMode ? (
                <>
                  {/* Money summary */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 sm:p-5 mb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs text-zinc-500">Результат за выбранный период</p>
                      <div className="flex gap-1 shrink-0">
                        {CURRENCIES.map((c) => (
                          <button
                            key={c.code}
                            onClick={() => setCurrency(c.code)}
                            title={c.code}
                            className={[
                              'px-1.5 py-0.5 rounded text-[11px] font-data border transition-colors',
                              currency === c.code
                                ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600',
                            ].join(' ')}
                          >
                            {c.symbol}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className={`font-display text-4xl sm:text-5xl font-semibold tracking-tight ${historyTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPnlDisplay(historyTotal)}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-3">
                        <p className="text-[11px] text-zinc-500 mb-1">Доходы</p>
                        <p className="font-data text-sm text-emerald-400">+{currencySymbol}{formatMoney(historyIncome)}</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 px-3 py-3">
                        <p className="text-[11px] text-zinc-500 mb-1">Расходы</p>
                        <p className="font-data text-sm text-red-400">−{currencySymbol}{formatMoney(historyExpense)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fast period controls */}
                  <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
                    {PERIOD_PRESETS.map((p) => (
                      <button
                        key={p}
                        onClick={() => handlePresetChange(p)}
                        className={[
                          'shrink-0 rounded-full border px-3 py-1.5 text-xs transition-colors',
                          periodPreset === p
                            ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
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
                        historyFiltersOpen ? 'border-zinc-500 bg-zinc-800 text-zinc-100' : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200',
                      ].join(' ')}
                    >
                      Фильтры
                    </button>
                  </div>

                  {historyFiltersOpen && (
                    <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => handleDateFromChange(e.target.value)}
                          className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 font-data focus:outline-none focus:border-emerald-400/50"
                        />
                        <span className="text-zinc-600">—</span>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => handleDateToChange(e.target.value)}
                          className="flex-1 min-w-0 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 font-data focus:outline-none focus:border-emerald-400/50"
                        />
                      </div>
                      <div className="flex gap-2">
                        {[
                          { key: 'all', label: 'Все' },
                          { key: 'win', label: 'Доходы' },
                          { key: 'loss', label: 'Расходы' },
                        ].map((opt) => (
                          <button
                            key={opt.key}
                            onClick={() => setHistoryWinLoss(opt.key)}
                            className={[
                              'flex-1 rounded-lg border px-3 py-2 text-xs transition-colors',
                              historyWinLoss === opt.key
                                ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
                                : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-zinc-200',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-zinc-500">{historyTrades.length} {traderMode ? 'операций' : 'записей'}</p>
                    {periodPreset !== 'Вся история' && (
                      <button
                        onClick={() => setHistoryFiltersOpen(true)}
                        className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors"
                      >
                        Изменить период
                      </button>
                    )}
                  </div>

                  {historyTrades.length > 0 ? (
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 overflow-hidden">
                      {historyTrades.map((entry) => {
                        const category = getMoneyCategoryMeta(entry.instrument);
                        const Icon = category?.icon || MoreHorizontal;
                        return (
                          <button
                            key={entry.id}
                            onClick={() => jumpToTradeDate(entry.dateKey)}
                            className="w-full px-4 py-3.5 flex items-center gap-3 text-left border-b last:border-b-0 border-zinc-800/80 hover:bg-zinc-900 transition-colors"
                          >
                            <span className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${entry.pnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-zinc-100 truncate">{entry.instrument || 'Другое'}</span>
                              <span className="block text-[11px] text-zinc-500 mt-0.5">{formatDateLabel(entry.dateKey)} · {entry.time}{entry.comment ? ` · ${entry.comment}` : ''}</span>
                            </span>
                            <span className={`font-data text-sm font-medium shrink-0 ${entry.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                              {entry.pnl >= 0 ? '+' : '−'}{getCurrencyMeta(entry.currency || currency).symbol}{formatMoney(entry.pnl)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center">
                      <Wallet className="h-8 w-8 text-zinc-700 mx-auto mb-3" />
                      <p className="text-sm text-zinc-500">Пока здесь пусто</p>
                      <p className="text-xs text-zinc-700 mt-1">Добавляй доходы и расходы — календарь соберёт картину месяца.</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleExportCsv}
                      disabled={historyTrades.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-zinc-800 px-3 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Экспорт CSV
                    </button>
                    <button
                      onClick={handleClearHistory}
                      className={[
                        'flex-1 rounded-xl border px-3 py-2.5 text-xs transition-colors',
                        confirmingClear
                          ? 'border-red-500 bg-red-500/10 text-red-400'
                          : 'border-zinc-800 text-zinc-600 hover:text-red-400 hover:border-red-500/40',
                      ].join(' ')}
                    >
                      {confirmingClear ? 'Точно удалить?' : 'Очистить историю'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* PRO history: preserve the denser trader workflow */}
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => {
                        if (displayMode === 'usd' && depositSize <= 0) {
                          handleEditDeposit();
                          return;
                        }
                        setDisplayMode((m) => (m === 'usd' ? 'percent' : 'usd'));
                      }}
                      className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1 font-data text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
                    >
                      {displayMode === 'usd' ? '$' : '%'}
                    </button>
                    <button
                      onClick={handleEditDeposit}
                      className="font-data text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Депозит: {depositSize > 0 ? `${currencySymbol}${formatMoney(depositSize)}` : 'не задан'} ✎
                    </button>
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
                      className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 font-data focus:outline-none focus:border-amber-400/60"
                    />
                    <span className="text-zinc-600">—</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => handleDateToChange(e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 font-data focus:outline-none focus:border-amber-400/60"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <select
                      value={platformFilter}
                      onChange={(e) => setPlatformFilter(e.target.value)}
                      className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 font-data focus:outline-none focus:border-amber-400/60"
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
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <p className="text-xs text-zinc-500 mb-2">{historyTrades.length} сделок</p>
                  {historyTrades.length > 0 ? (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 divide-y divide-zinc-800 overflow-y-auto">
                      {historyTrades.map((trade) => (
                        <button
                          key={trade.id}
                          onClick={() => jumpToTradeDate(trade.dateKey)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-900 transition-colors"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-data text-xs text-zinc-500 w-14 shrink-0">{formatDateLabel(trade.dateKey)}</span>
                            <span className="text-sm text-zinc-200 font-medium truncate">{trade.instrument}</span>
                          </div>
                          <span className={`font-data text-sm font-medium shrink-0 ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {formatPnlDisplay(trade.pnl)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-600 text-center py-6">Нет сделок за выбранный период</p>
                  )}

                  <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5 mt-3">
                    <span className="text-xs text-zinc-500">Итог</span>
                    <span className={`font-data text-sm font-semibold ${historyTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPnlDisplay(historyTotal)}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleExportCsv}
                      disabled={historyTrades.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-zinc-800 px-3 py-2 font-data text-xs text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Экспорт CSV
                    </button>
                    <button
                      onClick={handleClearHistory}
                      className={[
                        'flex-1 rounded-md border px-3 py-2 font-data text-xs transition-colors',
                        confirmingClear
                          ? 'border-red-500 bg-red-500/10 text-red-400'
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
            className={`relative w-full max-w-[360px] rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-4 shadow-2xl transition-all duration-200 sm:px-5 sm:py-5 ${
              modalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <button
              onClick={closeModal}
              className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
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
              <p className="mt-1 text-xs text-zinc-500">
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
              <div className="grid grid-cols-2 gap-1 rounded-xl border border-zinc-800 bg-zinc-950 p-1">
                <button
                  type="button"
                  onClick={() => { setForm((f) => ({ ...f, sign: 'plus' })); setFormError(''); }}
                  className={[
                    'flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors',
                    form.sign === 'plus'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-300',
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
                      ? 'bg-red-500/10 text-red-400'
                      : 'text-zinc-500 hover:text-zinc-300',
                  ].join(' ')}
                >
                  <TrendingDown className="h-3.5 w-3.5" />
                  {traderMode ? 'Убыток' : 'Расход'}
                </button>
              </div>

              {/* Amount is the visual focus */}
              <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 focus-within:border-amber-400/60 focus-within:ring-1 focus-within:ring-amber-400/20">
                <input
                  type="number"
                  min="0"
                  step="any"
                  autoFocus
                  value={form.pnl}
                  onChange={(e) => { setForm((f) => ({ ...f, pnl: e.target.value })); setFormError(''); }}
                  className="w-full bg-transparent text-center font-data text-3xl font-semibold tracking-tight text-zinc-100 outline-none placeholder:text-zinc-700"
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
                        ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                        : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300',
                    ].join(' ')}
                  >
                    {c.symbol}
                  </button>
                ))}
              </div>

              {/* Time is available, but deliberately quiet */}
              <div className="mt-2 flex justify-center">
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] text-zinc-600 hover:bg-zinc-800 hover:text-zinc-400 transition-colors">
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
                className="mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                {detailsOpen ? 'Скрыть детали' : 'Дополнительно'}
                <ChevronDown className={`h-3 w-3 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
              </button>

              {detailsOpen && (
                <div className="mt-2 space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  {traderMode ? (
                    <>
                      <div>
                        <label className="mb-1.5 block font-data text-[10px] tracking-widest text-zinc-600 uppercase">
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
                                  ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
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
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data outline-none focus:border-amber-400/60"
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
                              ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-400'
                              : 'border-zinc-800 text-zinc-500 hover:text-zinc-300',
                          ].join(' ')}
                        >LONG</button>
                        <button
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, direction: 'SHORT' }))}
                          className={[
                            'rounded-lg border py-2 text-xs font-data transition-colors',
                            form.direction === 'SHORT'
                              ? 'border-red-400/60 bg-red-500/10 text-red-400'
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
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data outline-none focus:border-amber-400/60"
                          placeholder="Take Profit"
                        />
                        <input
                          type="number"
                          step="any"
                          value={form.stopLoss}
                          onChange={(e) => setForm((f) => ({ ...f, stopLoss: e.target.value }))}
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data outline-none focus:border-amber-400/60"
                          placeholder="Stop Loss"
                        />
                      </div>

                      <select
                        value={form.platform}
                        onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data outline-none focus:border-amber-400/60"
                      >
                        {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </>
                  ) : (
                    <div>
                      <label className="mb-1.5 block font-data text-[10px] tracking-widest text-zinc-600 uppercase">
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
                                  ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300'
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
                        className="mt-1.5 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-400/50"
                        placeholder="Своя категория"
                      />
                    </div>
                  )}

                  <textarea
                    value={form.comment}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                    rows={2}
                    className="w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-400/60"
                    placeholder={traderMode ? 'Заметка по сделке (необязательно)' : t('recordNotePlaceholder')}
                  />
                </div>
              )}

              {formError && <p className="mt-2 text-center text-xs text-red-400">{formError}</p>}

              <button
                onClick={handleSaveTrade}
                className="mt-3 block w-full rounded-xl bg-amber-400 px-4 py-3 text-base font-bold text-zinc-950 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20"
              >
                {editingTrade ? 'Сохранить изменения' : (traderMode ? 'Сохранить сделку' : t('saveRecord'))}
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
            className={`relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl transition-all duration-200 ${
              connectVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <button
              onClick={closeConnectModal}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Подключить площадку</p>
            <h2 className="font-display text-lg font-semibold text-zinc-50 mb-3">Источник сделок</h2>

            <div className="rounded-md border border-amber-400/30 bg-amber-400/5 px-3 py-2 mb-4">
              <p className="text-xs text-amber-400/90 leading-relaxed">
                cTrader подключается по-настоящему. API-ключи бирж и импорт CSV — пока в разработке, данные не сохраняют.
              </p>
            </div>

            {/* tabs */}
            <div className="flex gap-1 rounded-md border border-zinc-800 bg-zinc-950 p-1 mb-4">
              <button
                onClick={() => setConnectTab('ctrader')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  connectTab === 'ctrader' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <Link2 className="h-3.5 w-3.5" />
                cTrader
              </button>
              <button
                onClick={() => setConnectTab('api')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  connectTab === 'api' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <KeyRound className="h-3.5 w-3.5" />
                API Ключи
              </button>
              <button
                onClick={() => setConnectTab('csv')}
                className={[
                  'flex-1 flex items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                  connectTab === 'csv' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
                ].join(' ')}
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Импорт CSV
              </button>
            </div>

            {connectTab === 'ctrader' ? (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Подключите свой аккаунт cTrader через Spotware — это разрешит приложению видеть ваши сделки.
                </p>
                {ctraderConnected ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-emerald-400 text-sm">
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
                  <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
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
                            ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                        ].join(' ')}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                    API Key
                  </label>
                  <input
                    type="text"
                    value={apiForm.key}
                    onChange={(e) => setApiForm((f) => ({ ...f, key: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                  />
                </div>

                <div>
                  <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                    API Secret
                  </label>
                  <input
                    type="password"
                    value={apiForm.secret}
                    onChange={(e) => setApiForm((f) => ({ ...f, secret: e.target.value }))}
                    placeholder="••••••••••••"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                  />
                </div>

                <p className="text-xs text-zinc-600 leading-relaxed">
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
                    csvDragOver ? 'border-amber-400/60 bg-amber-400/5' : 'border-zinc-700 hover:border-zinc-600',
                  ].join(' ')}
                >
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvSelect} />
                  {csvFile ? (
                    <>
                      <FileText className="h-6 w-6 text-amber-400" />
                      <p className="text-sm text-zinc-200 font-medium">{csvFile.name}</p>
                      <p className="text-xs text-zinc-600">Файл готов к импорту</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="h-6 w-6 text-zinc-600" />
                      <p className="text-sm text-zinc-400">Перетащите файл отчёта сюда</p>
                      <p className="text-xs text-zinc-600">или нажмите, чтобы выбрать .csv</p>
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
            className={`relative w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl transition-all duration-200 ${
              analysisVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <button
              onClick={closeAnalysis}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Анализ периода</p>
            <h2 className="font-display text-lg font-semibold text-zinc-50 mb-3">
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
                      ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>

            <p className="text-xs text-zinc-500 mb-4">{analysisStats.count} сделок в выборке</p>

            {basicAnalysis && (
              <div className="mb-4">
                <div className="text-center rounded-lg border border-zinc-800 bg-zinc-950 py-4 mb-3">
                  <p className="font-data text-[10px] tracking-widest text-zinc-500 uppercase mb-1">Profit Factor</p>
                  <p className={`font-display text-3xl font-semibold ${basicAnalysis.profitFactor >= 1.5 ? 'text-emerald-400' : basicAnalysis.profitFactor >= 1 ? 'text-zinc-200' : 'text-red-400'}`}>
                    {basicAnalysis.profitFactor === Infinity ? 'MAX' : basicAnalysis.profitFactor.toFixed(2)}
                  </p>
                </div>

                <p className="text-xs text-zinc-500 leading-relaxed">
                  Средний:{' '}
                  <span className="text-emerald-400 font-data">+${formatMoney(basicAnalysis.avgWin)}</span>
                  {' / '}
                  <span className="text-red-400 font-data">-${formatMoney(basicAnalysis.avgLoss)}</span>
                  {basicAnalysis.payoffRatio > 0 && <span className="font-data"> (1:{basicAnalysis.payoffRatio.toFixed(2)})</span>}
                  {' · Лучший день: '}
                  <span className="text-emerald-400 font-data">{formatSignedShort(basicAnalysis.bestDay[1])}</span>
                  {' ('}{formatDateLabel(basicAnalysis.bestDay[0])}{')'}
                  {' · Худший: '}
                  <span className="text-red-400 font-data">{formatSignedShort(basicAnalysis.worstDay[1])}</span>
                  {' ('}{formatDateLabel(basicAnalysis.worstDay[0])}{')'}
                  {' · Частый: '}
                  <span className="text-zinc-300 font-data">{basicAnalysis.topInstrument[0]}</span>
                  {basicAnalysis.longestLossStreak >= 2 && (
                    <>
                      {' · Серия убытков: '}
                      <span className="text-red-400 font-data">{basicAnalysis.longestLossStreak}</span>
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="rounded-md border border-dashed border-zinc-700 px-3 py-3 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-zinc-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-zinc-400 font-medium mb-0.5">Глубокий AI-анализ — скоро</p>
                <p className="text-xs text-zinc-600 leading-relaxed">
                  Разбор эмоциональных паттернов, конкретных ошибок по каждой сделке и персональные рекомендации — по подписке.
                </p>
              </div>
            </div>
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
            className={`relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl transition-all duration-200 ${
              nicknameModalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Добро пожаловать</p>
            <h2 className="font-display text-lg font-semibold text-zinc-50 mb-1">Как вас называть?</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Это имя будет отображаться в приложении. Можно оставить пустым — тогда возьмём имя из Google.
            </p>

            <input
              type="text"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname()}
              placeholder={user?.user_metadata?.full_name || user?.email || 'Ваш ник'}
              autoFocus
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data mb-4 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
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
