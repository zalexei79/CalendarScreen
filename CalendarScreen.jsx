import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Inbox, TrendingUp, TrendingDown, Sparkles, Plus, X, Trash2,
  Calendar, ChevronDown, ChevronLeft, ChevronRight, Link2, KeyRound, UploadCloud, FileText,
  LogIn, LogOut, CheckCircle2, RefreshCw, Maximize2, Minimize2,
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

const DEFAULT_ASSET_TAGS = ['BTCUSD', 'ETHUSD', 'XAUUSD', 'EURUSD', 'NDX100'];
const INSTRUMENT_INFO = {
  BTCUSD: { icon: '₿', label: 'Bitcoin / US Dollar' },
  ETHUSD: { icon: 'Ξ', label: 'Ethereum / US Dollar' },
  XAUUSD: { icon: '🥇', label: 'Gold / US Dollar' },
  EURUSD: { icon: '€', label: 'Euro / US Dollar' },
  NDX100: { icon: '📈', label: 'Nasdaq 100' },
};
const EXCHANGES = ['Bybit', 'Binance', 'OKX', 'MT4/MT5', 'cTrader'];
const PLATFORMS = ['Manual', ...EXCHANGES];
const RECENT_INSTRUMENTS_STORAGE_KEY = 'atj_recent_instruments';
const CUSTOM_TAGS_STORAGE_KEY = 'atj_custom_instrument_tags';
const MAX_CUSTOM_TAGS = 6;

export default function CalendarScreen() {
  const today = useMemo(() => new Date(), []);

  // Google session — informational only, doesn't block using the calendar
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
    const { data } = await supabase.from('ctrader_tokens').select('id').eq('user_id', userId).maybeSingle();
    setCtraderConnected(!!data);
  }

  async function handleCtraderCallback(code) {
    setCtraderLoading(true);
    try {
      const redirectUri = window.location.origin + '/';
      const { data, error } = await supabase.functions.invoke('ctrader-auth', {
        body: { code, redirectUri },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      window.history.replaceState({}, document.title, window.location.pathname);
      setCtraderConnected(true);
    } catch (err) {
      console.error('[ctrader] ошибка подключения:', err);
      setFormError('');
      alert('Не удалось подключить cTrader: ' + err.message);
    } finally {
      setCtraderLoading(false);
    }
  }

  function handleConnectCtrader() {
    if (!user) {
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
      setUser(currentUser);

      // cTrader вернул нас с ?code=... в адресе — обмениваем на токены
      const code = new URLSearchParams(window.location.search).get('code');
      if (code && currentUser) {
        handleCtraderCallback(code);
      } else if (currentUser) {
        checkCtraderStatus(currentUser.id);
      }
    }
    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[auth] событие:', event, session ? session.user.email : '(нет пользователя)');
      const activeUser = session?.user ?? null;
      setUser(activeUser);
      if (activeUser) checkCtraderStatus(activeUser.id);
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
    const nickname = nicknameInput.trim() || googleName;
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

  const [calendarExpanded, setCalendarExpanded] = useState(true);
  const [manualTrades, setManualTrades] = useState({}); // { [dateKey]: Trade[] } — real, user-saved trades only
  const [recentInstruments, setRecentInstruments] = useState([]); // most-recently-used instrument symbols
  const [customTags, setCustomTags] = useState([]); // user-added instrument tags, max MAX_CUSTOM_TAGS
  const [addingCustomTag, setAddingCustomTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const dragTagIndex = useRef(null);

  // load this user's trades from Supabase whenever they log in; clear on logout
  useEffect(() => {
    if (!user) {
      setManualTrades({});
      return;
    }
    supabase
      .from('trades')
      .select('*')
      .eq('user_id', user.id)
      .then(({ data, error }) => {
        if (error) {
          console.error('[trades] ошибка загрузки:', error);
          return;
        }
        const grouped = {};
        for (const row of data) {
          grouped[row.date_key] = grouped[row.date_key] || [];
          grouped[row.date_key].push({
            id: row.id,
            time: row.time,
            instrument: row.instrument,
            direction: row.direction,
            pnl: Number(row.pnl),
            comment: row.comment || '',
            platform: row.platform,
          });
        }
        setManualTrades(grouped);
      });
  }, [user]);


  // --- Period filter state (compact popover) --------------------------------
  const [periodPreset, setPeriodPreset] = useState('Текущий месяц');
  const initialRange = useMemo(() => getPresetRange('Текущий месяц', today), [today]);
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [platformFilter, setPlatformFilter] = useState('ALL');
  const [periodMenuOpen, setPeriodMenuOpen] = useState(false);
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
  const [form, setForm] = useState({
    instrument: '', direction: 'LONG', sign: 'plus', pnl: '', time: currentTimeHHMM(), comment: '', platform: 'Manual',
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
  const timeInputRef = useRef(null);
  const periodMenuRef = useRef(null);
  const monthMenuRef = useRef(null);
  const yearMenuRef = useRef(null);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(year, month, 1);
    const offset = (firstOfMonth.getDay() + 6) % 7; // Monday-start week
    const start = new Date(year, month, 1 - offset);
    return Array.from({ length: 35 }, (_, i) => {
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
    return (manualTrades[key] || []).filter((t) => platformFilter === 'ALL' || t.platform === platformFilter);
  }

  function totalPnlForDay(key) {
    return tradesForDayFiltered(key).reduce((sum, t) => sum + t.pnl, 0);
  }

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
      .sort((a, b) => (a.dateKey === b.dateKey ? b.time.localeCompare(a.time) : b.dateKey.localeCompare(a.dateKey)));
  }, [manualTrades, effectiveFrom, effectiveTo, platformFilter]);

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
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter);
  }, [manualTrades, analysisFrom, analysisTo, platformFilter]);

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

    return { bestDay, worstDay, topInstrument, avgPnl, longestLossStreak };
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

  function openModal() {
    if (!user) {
      handleGoogleLogin();
      return;
    }
    if (isFutureSelected) return; // нельзя добавлять сделки на будущее
    setModalDateKey(targetDateKey);
    setForm({
      instrument: recentInstruments[0] || '',
      direction: 'LONG',
      sign: 'plus',
      pnl: '',
      time: currentTimeHHMM(),
      comment: '',
      platform: 'Manual',
    });
    setFormError('');
    setModalOpen(true);
    requestAnimationFrame(() => setModalVisible(true));
  }

  function closeModal() {
    setModalVisible(false);
    setFormError('');
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

  // close the period popover on an outside click
  useEffect(() => {
    if (!periodMenuOpen) return;
    function onDocClick(e) {
      if (periodMenuRef.current && !periodMenuRef.current.contains(e.target)) {
        setPeriodMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [periodMenuOpen]);

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
        if (stored) setRecentInstruments(JSON.parse(stored));
        const storedCustom = window.localStorage.getItem(CUSTOM_TAGS_STORAGE_KEY);
        if (storedCustom) setCustomTags(JSON.parse(storedCustom));
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
    const tag = raw.trim().toUpperCase();
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
    if (!user) {
      setFormError('Войдите через Google, чтобы сохранять сделки.');
      return;
    }
    const dateKey = modalDateKey || targetDateKey;
    if (dateKey > todayKey) {
      setFormError('Нельзя добавить сделку на будущую дату.');
      return;
    }

    const instrument = form.instrument.trim().toUpperCase();
    if (!instrument) {
      setFormError('Укажите символ инструмента.');
      return;
    }
    if (form.pnl.trim() === '') {
      setFormError('Укажите результат сделки в $.');
      return;
    }
    const magnitude = parseFloat(form.pnl);
    if (Number.isNaN(magnitude) || magnitude < 0) {
      setFormError('Результат должен быть числом ≥ 0.');
      return;
    }

    const signedPnl = form.sign === 'minus' ? -Math.abs(magnitude) : Math.abs(magnitude);
    const time = form.time || currentTimeHHMM();
    const comment = form.comment.trim();

    const { data, error } = await supabase
      .from('trades')
      .insert({
        user_id: user.id,
        date_key: dateKey,
        time,
        instrument,
        direction: form.direction,
        pnl: signedPnl,
        comment,
        platform: form.platform,
      })
      .select()
      .single();

    if (error) {
      setFormError('Не удалось сохранить: ' + error.message);
      return;
    }

    const newTrade = {
      id: data.id,
      time: data.time,
      instrument: data.instrument,
      direction: data.direction,
      pnl: Number(data.pnl),
      comment: data.comment || '',
      platform: data.platform,
    };

    setManualTrades((prev) => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), newTrade],
    }));

    setRecentInstruments((prev) => [instrument, ...prev.filter((i) => i !== instrument)].slice(0, 5));

    closeModal();
  }

  async function handleDeleteTrade(dateKey, tradeId) {
    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) {
      console.error('[trades] ошибка удаления:', error);
      return;
    }
    setManualTrades((prev) => ({
      ...prev,
      [dateKey]: (prev[dateKey] || []).filter((t) => t.id !== tradeId),
    }));
  }

  function jumpToTradeDate(dateKey) {
    const [y, m] = dateKey.split('-').map(Number);
    setViewYear(y);
    setViewMonth(m - 1);
    setSelectedKey(dateKey);
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
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .font-display { font-family: 'Space Grotesk', sans-serif; }
        .font-data { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      {/* HEADER */}
      <header className="px-3 sm:px-8 pt-4 sm:pt-8 pb-4 border-b border-zinc-800">
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
                  {MONTHS[month]}
                </button>
                {monthMenuOpen && (
                  <div className="absolute left-0 top-full mt-2 w-40 max-h-64 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-30 p-1">
                    {MONTHS.map((m, i) => (
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

            {/* account pill: platform + login, merged into one seamless container */}
            <div className="ml-2 flex items-center rounded-md border border-zinc-800 bg-zinc-900 font-data text-[11px] tracking-wide overflow-hidden">
              <button
                onClick={openConnectModal}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors"
              >
                <Link2 className="h-3.5 w-3.5" />
                Площадка
                {ctraderConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>

              <span className="h-4 w-px bg-zinc-800" />

              {user ? (
                <div className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5">
                  <span className="max-w-[110px] truncate text-zinc-300">
                    {user.user_metadata?.nickname || user.user_metadata?.full_name || user.email}
                  </span>
                  <button
                    onClick={handleGoogleLogout}
                    title="Выйти из аккаунта"
                    className="flex items-center gap-1 text-zinc-500 hover:text-red-400 transition-colors border-l border-zinc-800 pl-2 ml-0.5"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Выйти
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleGoogleLogin}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-amber-400 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  Войти через Google
                </button>
              )}
            </div>
          </div>

          {/* compact period picker — replaces the old preset select + two date inputs */}
          <div className="relative" ref={periodMenuRef}>
            <button
              onClick={() => setPeriodMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 font-data text-xs text-zinc-300 hover:border-zinc-600 transition-colors"
            >
              <Calendar className="h-3.5 w-3.5 text-amber-400" />
              {periodButtonLabel}
              <ChevronDown className={`h-3.5 w-3.5 text-zinc-500 transition-transform ${periodMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {periodMenuOpen && (
              <div className="fixed inset-x-0 bottom-0 sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-80 max-h-[75vh] sm:max-h-none overflow-y-auto rounded-t-2xl sm:rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl z-30 p-4 sm:p-3">
                <p className="font-data text-[10px] tracking-widest text-zinc-500 uppercase mb-1.5">Период</p>
                <div className="flex flex-col gap-1 mb-3">
                  {PERIOD_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePresetChange(p)}
                      className={[
                        'text-left rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        periodPreset === p
                          ? 'bg-amber-400/10 text-amber-400'
                          : 'text-zinc-300 hover:bg-zinc-800',
                      ].join(' ')}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="border-t border-zinc-800 pt-3 mb-3">
                  <p className="font-data text-[10px] tracking-widest text-zinc-500 uppercase mb-1.5">Свой период</p>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => handleDateFromChange(e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                    />
                    <span className="text-zinc-600">—</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => handleDateToChange(e.target.value)}
                      className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-3">
                  <p className="font-data text-[10px] tracking-widest text-zinc-500 uppercase mb-1.5">Площадка</p>
                  <select
                    value={platformFilter}
                    onChange={(e) => setPlatformFilter(e.target.value)}
                    className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                  >
                    <option value="ALL">Все площадки</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* CALENDAR — top half (or nearly full screen when expanded) */}
      <section
        className={`${calendarExpanded ? 'flex-[3]' : 'flex-[1.1]'} px-3 sm:px-8 py-4 sm:py-6 border-b border-zinc-800 relative transition-all duration-200`}
        onClick={(e) => { if (e.target === e.currentTarget) setSelectedKey(null); }}
      >
        <button
          onClick={() => setCalendarExpanded((v) => !v)}
          title={calendarExpanded ? 'Свернуть календарь' : 'Развернуть календарь'}
          className="absolute top-3 left-3 sm:top-5 sm:left-6 z-10 rounded-md border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-500 hover:text-amber-400 hover:border-zinc-600 transition-colors"
        >
          {calendarExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>

        <div
          className="grid grid-cols-7 gap-1 sm:gap-2 mb-2"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedKey(null); }}
        >
          {WEEKDAYS.map((w) => (
            <div key={w} className="font-data text-[11px] tracking-wider text-zinc-600 text-center uppercase pb-1">
              {w}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 grid-rows-5 gap-1 sm:gap-2 h-full"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedKey(null); }}
        >
          {cells.map((cell) => {
            const isSelected = cell.key === selectedKey;
            const hasTrades = tradesForDayFiltered(cell.key).length > 0;
            const pnl = totalPnlForDay(cell.key);
            const isProfit = pnl >= 0;
            const pnlText = `${isProfit ? '+' : '-'}$${formatMoney(pnl)}`;
            const pnlSizeClass =
              pnlText.length > 9 ? 'text-[9px] sm:text-xs' : pnlText.length > 6 ? 'text-[10px] sm:text-sm' : calendarExpanded ? 'text-xs sm:text-xl' : 'text-sm';
            const inPeriodRange = (periodMenuOpen || periodPreset === 'Вся история') && cell.key >= dateFrom && cell.key <= dateTo;
            return (
              <button
                key={cell.key}
                onClick={() => setSelectedKey(isSelected ? null : cell.key)}
                className={[
                  'relative rounded-md border flex flex-col justify-between text-left transition-all duration-150',
                  calendarExpanded ? 'min-h-[64px] sm:min-h-[110px]' : '',
                  calendarExpanded ? 'p-1.5 sm:p-4' : 'p-1 sm:p-2',
                  cell.inMonth ? 'bg-zinc-900' : 'bg-zinc-950',
                  cell.inMonth ? 'border-zinc-800' : 'border-zinc-900',
                  !cell.inMonth ? 'opacity-40' : '',
                  isSelected
                    ? 'border-amber-400 ring-2 ring-amber-400/60 bg-zinc-800 scale-[1.03] shadow-lg shadow-amber-500/10 z-10'
                    : inPeriodRange
                    ? 'border-sky-400/50 bg-sky-400/10'
                    : 'hover:border-zinc-600 hover:bg-zinc-800/60',
                ].join(' ')}
              >
                {cell.isToday && (
                  <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />
                )}
                <span className={`font-data ${calendarExpanded ? 'text-xs sm:text-base' : 'text-xs'} ${cell.inMonth ? 'text-zinc-400' : 'text-zinc-700'}`}>
                  {cell.date.getDate()}
                </span>
                {cell.inMonth && hasTrades && (
                  <span className={`font-data ${pnlSizeClass} font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-full block ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                    {pnlText}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* TRADE PANEL — hidden in expanded calendar mode until a day is picked */}
      {(!calendarExpanded || selectedKey) && (
      <section className="flex-1 px-3 sm:px-8 py-4 sm:py-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto h-full flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">
                {effectiveFrom === '0000-01-01'
                  ? 'Вся история'
                  : effectiveFrom === effectiveTo
                  ? effectiveFrom
                  : `${effectiveFrom} — ${effectiveTo}`}
              </p>
              <p className="text-[11px] text-zinc-500 mb-0.5">
                {effectiveFrom === '0000-01-01'
                  ? 'История за всё время'
                  : effectiveFrom === effectiveTo
                  ? 'Общий результат дня'
                  : 'Общий результат за период'}
              </p>
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
                  {periodStats.count === 0 ? '—' : `${periodStats.pnl >= 0 ? '+' : '-'}$${formatMoney(periodStats.pnl)}`}
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900 overflow-hidden">
                <button
                  onClick={openAnalysis}
                  disabled={periodStats.count === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-amber-400 hover:bg-amber-400/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Sparkles className="h-4 w-4" />
                  Анализ
                </button>
                <span className="h-5 w-px bg-zinc-700" />
                <button
                  onClick={openModal}
                  disabled={isFutureSelected}
                  title={isFutureSelected ? 'Нельзя добавить сделку на будущую дату' : undefined}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4" />
                  Добавить сделку
                </button>
              </div>
              {/* always the strictly selected calendar date, or today if none selected */}
              <p className="font-data text-[10px] text-zinc-600 mt-1">
                на {targetDateLabel}{!selectedCell && ' (сегодня)'}
              </p>
            </div>
          </div>

          {/* compact single-line stats bar, right above the trade list */}
          <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-4 py-2 font-data text-xs text-zinc-400">
            <span>Сделок: <span className="text-zinc-100 font-medium">{periodStats.count}</span></span>
            <span className="text-zinc-700">•</span>
            <span>
              PnL:{' '}
              <span className={`font-medium ${periodStats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {periodStats.pnl >= 0 ? '+' : '-'}${formatMoney(periodStats.pnl)}
              </span>
            </span>
            <span className="text-zinc-700">•</span>
            <span>Winrate: <span className="text-zinc-100 font-medium">{periodStats.winrate}%</span></span>
          </div>

          {periodTrades.length > 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800 flex-1 overflow-y-auto">
              {periodTrades.map((trade) => (
                <div
                  key={trade.id}
                  onClick={() => jumpToTradeDate(trade.dateKey)}
                  className="px-4 py-3 group cursor-pointer hover:bg-zinc-800/60 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-data text-xs text-zinc-500 w-16">{formatDateLabel(trade.dateKey)}</span>
                      <span className="font-data text-xs text-zinc-500 w-12">{trade.time}</span>
                      <span className="text-sm text-zinc-200 font-medium">{trade.instrument}</span>
                      <span
                        className={[
                          'font-data text-[11px] tracking-wider px-2 py-0.5 rounded-full',
                          trade.direction === 'LONG'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-red-500/10 text-red-400',
                        ].join(' ')}
                      >
                        {trade.direction}
                      </span>
                      <span className="font-data text-[10px] text-zinc-600">{trade.platform}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`font-data text-sm font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trade.pnl >= 0 ? '+' : '-'}${formatMoney(trade.pnl)}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteTrade(trade.dateKey, trade.id); }}
                        className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label="Удалить сделку"
                        title="Удалить сделку"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {trade.comment && (
                    <p className="text-xs text-zinc-500 mt-1.5 pl-[7.5rem] leading-relaxed">{trade.comment}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm border border-dashed border-zinc-800 rounded-xl px-10 py-10">
                <Inbox className="h-8 w-8 text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500 text-sm">
                  Нет сохранённых сделок за выбранный период
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
      )}

      {/* ADD TRADE MODAL */}
      {modalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-200 ${
            modalVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={handleModalBackdropClick}
        >
          <div
            className={`relative w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl transition-all duration-200 ${
              modalVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200 transition-colors"
              aria-label="Закрыть"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="font-data text-xs tracking-widest text-amber-400 uppercase mb-1">Новая сделка</p>
            <h2 className="font-display text-lg font-semibold text-zinc-50 mb-5">
              {modalDateKey &&
                parseDateKeyLocal(modalDateKey).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </h2>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                  Инструмент
                </label>

                {(() => {
                  const key = form.instrument.trim().toUpperCase();
                  const info = INSTRUMENT_INFO[key];
                  return (
                    <div className="flex items-center gap-3 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2.5 mb-2">
                      <span className="text-xl leading-none">{info?.icon || '＋'}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 truncate">{key || 'Не выбран'}</p>
                        {info && <p className="text-xs text-zinc-500 truncate">{info.label}</p>}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {quickAssetTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => { setForm((f) => ({ ...f, instrument: tag })); setFormError(''); }}
                      className={[
                        'rounded-full border px-2.5 py-1 font-data text-[11px] tracking-wide transition-colors',
                        form.instrument.trim().toUpperCase() === tag
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      {tag}
                    </button>
                  ))}

                  {customTags.filter((t) => !quickAssetTags.includes(t)).map((tag) => (
                    <span
                      key={tag}
                      draggable
                      onDragStart={() => { dragTagIndex.current = customTags.indexOf(tag); }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const dropIndex = customTags.indexOf(tag);
                        if (dragTagIndex.current !== null && dragTagIndex.current !== dropIndex) reorderCustomTag(dragTagIndex.current, dropIndex);
                        dragTagIndex.current = null;
                      }}
                      className={[
                        'flex items-center gap-1 rounded-full border pl-2.5 pr-1 py-1 font-data text-[11px] tracking-wide cursor-grab transition-colors',
                        form.instrument.trim().toUpperCase() === tag
                          ? 'border-amber-400/60 bg-amber-400/10 text-amber-400'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      <button type="button" onClick={() => { setForm((f) => ({ ...f, instrument: tag })); setFormError(''); }}>
                        {tag}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCustomTag(tag)}
                        className="text-zinc-600 hover:text-red-400 transition-colors"
                        aria-label={`Удалить ${tag}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {addingCustomTag ? (
                    <input
                      type="text"
                      autoFocus
                      value={customTagInput}
                      onChange={(e) => setCustomTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { addCustomTag(customTagInput); setCustomTagInput(''); setAddingCustomTag(false); }
                        if (e.key === 'Escape') { setCustomTagInput(''); setAddingCustomTag(false); }
                      }}
                      onBlur={() => { if (customTagInput.trim()) addCustomTag(customTagInput); setCustomTagInput(''); setAddingCustomTag(false); }}
                      placeholder="TICKER"
                      className="w-20 rounded-full border border-amber-400/60 bg-zinc-950 px-2.5 py-1 font-data text-[11px] tracking-wide text-zinc-100 focus:outline-none"
                    />
                  ) : (
                    customTags.length < MAX_CUSTOM_TAGS && (
                      <button
                        type="button"
                        onClick={() => setAddingCustomTag(true)}
                        title="Добавить свой инструмент"
                        className="flex items-center justify-center h-6 w-6 rounded-full border border-dashed border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-400/60 transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )
                  )}
                </div>
                <input
                  type="text"
                  value={form.instrument}
                  onChange={(e) => { setForm((f) => ({ ...f, instrument: e.target.value })); setFormError(''); }}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                  placeholder="Например, XAUUSD"
                />
              </div>

              <div>
                <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                  Направление
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, direction: 'LONG' }))}
                    className={[
                      'rounded-md border px-3 py-2 text-sm font-data tracking-wider transition-colors',
                      form.direction === 'LONG'
                        ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-400'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600',
                    ].join(' ')}
                  >
                    LONG
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, direction: 'SHORT' }))}
                    className={[
                      'rounded-md border px-3 py-2 text-sm font-data tracking-wider transition-colors',
                      form.direction === 'SHORT'
                        ? 'border-red-400/60 bg-red-500/10 text-red-400'
                        : 'border-zinc-700 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600',
                    ].join(' ')}
                  >
                    SHORT
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[3fr_2fr] gap-3">
                <div>
                  <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                    Результат, $
                  </label>
                  <div className="flex items-stretch gap-1.5">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, sign: 'plus' }))}
                      aria-label="Прибыль"
                      title="Прибыль"
                      className={[
                        'shrink-0 w-8 rounded-md border font-data text-sm font-semibold transition-colors',
                        form.sign === 'plus'
                          ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-400'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, sign: 'minus' }))}
                      aria-label="Убыток"
                      title="Убыток"
                      className={[
                        'shrink-0 w-8 rounded-md border font-data text-sm font-semibold transition-colors',
                        form.sign === 'minus'
                          ? 'border-red-400/60 bg-red-500/10 text-red-400'
                          : 'border-zinc-700 bg-zinc-950 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600',
                      ].join(' ')}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={form.pnl}
                      onChange={(e) => { setForm((f) => ({ ...f, pnl: e.target.value })); setFormError(''); }}
                      className="w-full min-w-0 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                      placeholder="150"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                    Время
                  </label>
                  <input
                    type="time"
                    ref={timeInputRef}
                    value={form.time}
                    onClick={(e) => { try { e.currentTarget.showPicker(); } catch { /* not supported in this browser */ } }}
                    onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                    className="w-full h-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-zinc-100 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                  Площадка
                </label>
                <select
                  value={form.platform}
                  onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 font-data focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-data text-[11px] tracking-widest text-zinc-500 uppercase mb-1.5">
                  Комментарий
                </label>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={2}
                  className="w-full resize-none rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/40"
                  placeholder="Заметка по сделке (необязательно)"
                />
              </div>

              {formError && <p className="text-xs text-red-400 -mt-1">{formError}</p>}

              <button
                onClick={handleSaveTrade}
                className="mt-1 w-full rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 transition-colors"
              >
                Сохранить сделку
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
                  disabled={!apiForm.key.trim() || !apiForm.secret.trim()}
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
              <div className="flex flex-col gap-2.5 text-sm mb-4">
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <span className="text-zinc-500">Лучший день</span>
                  <span className="text-emerald-400 font-data">
                    {formatDateLabel(basicAnalysis.bestDay[0])} · {formatSignedShort(basicAnalysis.bestDay[1])}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <span className="text-zinc-500">Худший день</span>
                  <span className="text-red-400 font-data">
                    {formatDateLabel(basicAnalysis.worstDay[0])} · {formatSignedShort(basicAnalysis.worstDay[1])}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <span className="text-zinc-500">Частый инструмент</span>
                  <span className="text-zinc-200 font-data">{basicAnalysis.topInstrument[0]} ({basicAnalysis.topInstrument[1]})</span>
                </div>
                <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                  <span className="text-zinc-500">Средний результат сделки</span>
                  <span className={`font-data ${basicAnalysis.avgPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {formatSignedShort(basicAnalysis.avgPnl)}
                  </span>
                </div>
                {basicAnalysis.longestLossStreak >= 2 && (
                  <div className="flex items-center justify-between rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2">
                    <span className="text-zinc-500">Серия убытков подряд</span>
                    <span className="text-red-400 font-data">{basicAnalysis.longestLossStreak}</span>
                  </div>
                )}
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
