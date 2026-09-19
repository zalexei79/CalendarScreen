import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Inbox, TrendingUp, TrendingDown, Sparkles, Plus, X, Trash2,
  Calendar, ChevronDown, Link2, KeyRound, UploadCloud, FileText,
  CheckCircle2, RefreshCw, History, Download, Pencil, Share2,
  Wallet, ShoppingCart, Home, Briefcase, ShoppingBag, CreditCard, MoreHorizontal, Cigarette, Utensils, Car, Gift, Gamepad2, Fish, ChartCandlestick, Repeat2, CircleDollarSign,
  Wifi, WifiOff, Zap, Award, Flame,
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
import HistoryChart from './HistoryChart';
import DayNote from './src/features/day-notes/DayNote';
import NoteInsights from './src/features/day-notes/NoteInsights';
import { useCurveNotes } from './src/features/day-notes/useCurveNotes';
import PnlCurve from './src/features/trades-sync/components/PnlCurve';
import PeriodDynamics from './src/features/trades-sync/components/PeriodDynamics';
import CalendarGrid from './CalendarGrid';
import MonthlyGoal from './MonthlyGoal';
import CtraderControl from './src/features/ctrader/CtraderControl';
import { createQrMatrix, drawQrToCanvas } from './qrCode.js';
import { useReferral } from './src/features/referrals/useReferral.js';
import { useProAccess } from './src/features/pro/useProAccess.js';

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

  // Referral code belongs to the signed-in account. The hook also claims any
  // referral that was saved before/through Google OAuth.
  const {
    referralCode,
    claimStatus,
    invitedCount,
    rewardedCount,
    pendingCount,
    recentInvites = [],
    myReferralStatus,
    myReferralRewardedAt,
  } = useReferral({ user });
  const {
    active: proAccessActive,
    until: proAccessUntil,
    loading: proAccessLoading,
    refresh: refreshProAccess,
  } = useProAccess({ user });

  const proDaysRemaining = useMemo(() => {
    if (!proAccessActive || !proAccessUntil) return 0;
    const until = new Date(proAccessUntil).getTime();
    if (!Number.isFinite(until)) return 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 86400000));
  }, [proAccessActive, proAccessUntil]);

  // --- cTrader connection state ------------------------------------------
  const [ctraderConnected, setCtraderConnected] = useState(false);
  const [ctraderLoading, setCtraderLoading] = useState(false);
  const [syncingCtrader, setSyncingCtrader] = useState(false);
  const [ctraderAccounts, setCtraderAccounts] = useState([]);
  const [ctraderAccountId, setCtraderAccountId] = useState('');
  const [ctraderNotice, setCtraderNotice] = useState(null);
  useEffect(() => {
    // Keep errors and incomplete calendar refresh warnings visible.
    if (ctraderNotice?.kind !== 'success' || !ctraderNotice.refreshed) return;
    const timer = window.setTimeout(() => {
      setCtraderNotice(current => current === ctraderNotice ? null : current);
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [ctraderNotice]);
  const ctraderBusy = useRef(false);
  const [ctraderReconnect, setCtraderReconnect] = useState(false);
  const ctraderOwner = useRef(validUserId);
  ctraderOwner.current = validUserId;
  const oauthCodeHandled = useRef(null);
  const ctraderStatusVersion = useRef(0);

  function showCtraderError(error, stage) {
    // Background account checks stay quiet; user-initiated failures belong in the control card.
    if (stage === 'sync' || stage === 'oauth') openConnectModal();
    if (error?.message === 'RECONNECT_REQUIRED') {
      setCtraderReconnect(true);
      setCtraderConnected(false);
    }
    // Only expose symbolic error codes, never response bodies or credentials.
    const code = /^[A-Z][A-Z0-9_]{1,63}$/.test(error?.message || '') ? error.message : 'REQUEST_FAILED';
    const status = Number.isInteger(error?.status) && error.status >= 100 && error.status <= 599 ? error.status : null;
    const backendStages = ['AUTH', 'LOAD_TOKEN', 'CONNECT_DEMO', 'CONNECT_LIVE', 'APP_AUTH_DEMO', 'APP_AUTH_LIVE', 'LIST_ACCOUNTS', 'SAVE_ACCOUNTS', 'SELECT_ACCOUNT', 'REFRESH_TOKEN', 'ACCOUNT_AUTH', 'GET_TRADER', 'GET_ASSETS', 'GET_SYMBOLS', 'GET_DEALS', 'MAP_DEALS', 'SAVE_TRADES', 'DISCONNECT'];
    const backendStage = backendStages.includes(error?.backendStage) ? error.backendStage : null;
    setCtraderNotice({ kind: 'error', code, stage, status, backendStage });
  }

  async function callCtrader(body) {
    if (!navigator.onLine) throw new Error('OFFLINE');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.access_token || session.user.id !== validUserId) throw new Error('UNAUTHORIZED');
    const { data, error } = await supabase.functions.invoke('kalendar', {
      body, headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (error || data?.error) {
      const response = error?.context;
      const details = response?.json ? await response.clone().json().catch(() => null) : null;
      const failure = new Error(details?.error || data?.error || 'REQUEST_FAILED');
      failure.status = response?.status;
      failure.backendStage = details?.stage || data?.stage;
      throw failure;
    }
    return data;
  }

  async function checkCtraderStatus(userId) {
    const version = ++ctraderStatusVersion.current;
    if (!userId) {
      setCtraderConnected(false);
      return;
    }
    try {
      const data = await callCtrader({ action: 'accounts' });
      if (ctraderOwner.current !== userId || version !== ctraderStatusVersion.current) return;
      setCtraderConnected(true);
      setCtraderReconnect(false);
      setCtraderAccounts(data.accounts || []);
      setCtraderAccountId(data.accounts?.find(a => a.is_active)?.id || '');
    } catch (error) {
      if (ctraderOwner.current !== userId || version !== ctraderStatusVersion.current) return;
      showCtraderError(error, 'accounts');
      setCtraderConnected(false);
    }
  }

  async function handleCtraderCallback(code) {
    if (oauthCodeHandled.current === code) return;
    oauthCodeHandled.current = code;
    setCtraderLoading(true);
    try {
      const redirectUri = window.location.origin + '/';
      const { data, error } = await supabase.functions.invoke('bright-api', {
        body: { code, redirectUri },
      });
      if (error || data?.error) throw new Error(error?.message || data?.error);
      await checkCtraderStatus(validUserId);
    } catch (err) {
      showCtraderError(err, 'oauth');
    } finally {
      try { window.history.replaceState({}, document.title, window.location.pathname); } catch {}
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
      return; // Keep the OAuth code while the existing Supabase session restores.
    } else if (user) {
      checkCtraderStatus(validUserId);
    } else {
      setCtraderConnected(false);
      setCtraderAccounts([]);
      setCtraderAccountId('');
      setCtraderReconnect(false);
      setCtraderNotice(null);
    }
  }, [user, validUserId]);

  async function handleSyncCtraderTrades() {
    if (!validUserId || ctraderBusy.current) return;
    if (!ctraderAccountId) { openConnectModal(); return; }
    ctraderBusy.current = true;
    setSyncingCtrader(true);
    setCtraderNotice(null);
    const owner = validUserId;
    let stage = 'select-account';
    try {
      await callCtrader({ action: 'select-account', accountId: ctraderAccountId });
      stage = 'sync';
      const data = await callCtrader({
        action: 'sync', accountId: ctraderAccountId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      const refreshed = await refreshFromCloud().catch(() => false);
      if (ctraderOwner.current !== owner) return;
      setCtraderNotice({ kind: 'success', inserted: data.inserted, skipped: data.skipped, refreshed, currency: data.currency, accountId: ctraderAccountId });
    } catch (err) {
      if (ctraderOwner.current === owner) showCtraderError(err, stage);
    } finally {
      ctraderBusy.current = false;
      setSyncingCtrader(false);
    }
  }

  async function handleSelectCtraderAccount(accountId) {
    if (ctraderBusy.current) return false;
    ctraderStatusVersion.current++;
    ctraderBusy.current = true;
    setCtraderLoading(true);
    const owner = validUserId;
    try {
      const data = await callCtrader({ action: 'select-account', accountId });
      if (ctraderOwner.current !== owner) return false;
      setCtraderAccountId(data.account.id);
      setCtraderAccounts(previous => previous.map(a => ({ ...a, is_active: a.id === data.account.id })));
      setCtraderNotice(null);
      return true;
    } catch (error) {
      if (ctraderOwner.current === owner) showCtraderError(error, 'select-account');
      return false;
    } finally { ctraderBusy.current = false; setCtraderLoading(false); }
  }

  async function handleDisconnectCtrader() {
    if (ctraderBusy.current) return false;
    ctraderStatusVersion.current++;
    const owner = validUserId;
    ctraderBusy.current = true;
    setCtraderLoading(true);
    try {
      await callCtrader({ action: 'disconnect' });
      if (ctraderOwner.current !== owner) return false;
      setCtraderConnected(false);
      setCtraderReconnect(false);
      setCtraderAccounts([]);
      setCtraderAccountId('');
      setCtraderNotice(null);
      return true;
    } catch (error) {
      if (ctraderOwner.current === owner) showCtraderError(error, 'disconnect');
      return false;
    } finally { ctraderBusy.current = false; setCtraderLoading(false); }
  }

  function showImportedCalendar() {
    const latest = Object.entries(manualTrades).filter(([, trades]) => trades.some(trade =>
      trade.platform === 'cTrader' && trade.ctrader_account_id === ctraderNotice.accountId)).map(([key]) => key).sort().at(-1);
    if (latest) {
      const date = parseDateKeyLocal(latest);
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
    }
    if (ctraderNotice.currency) setCurrency(ctraderNotice.currency);
    setPlatformFilter('cTrader');
    setCalendarTypeFilter('all');
    setSelectedKey(null);
    closeConnectModal();
    closeHistory();
    setCtraderNotice(null);
  }

  // --- Displayed month/year (navigable), separate from the real "today" ----
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [slideDirection, setSlideDirection] = useState(null);
  const [animKey, setAnimKey] = useState(0);
  const year = viewYear;
  const month = viewMonth;

  function goToPrevMonth() {
    setSelectedKey(null);
    setSlideDirection('prev');
    setAnimKey((k) => k + 1);
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
    setSlideDirection('next');
    setAnimKey((k) => k + 1);
    setViewMonth((m) => {
      if (m === 11) {
        setViewYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  const [selectedKey, setSelectedKey] = useState(null);
  const [firstRunGuideStep, setFirstRunGuideStep] = useState(0); // 0 off, 1 today, 2 form, 3 success, 4 day view tip
  const [firstRunGuideChoice, setFirstRunGuideChoice] = useState(null);
  const guideAmountRef = useRef(null);
  const guideCommentRef = useRef(null);
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

  // PRO mode is now a UI preference only. Permission itself comes from
  // Supabase get_my_pro_status(); localStorage can no longer unlock PRO.
  const [traderMode, setTraderModeInternal] = useState(false);
  const [proAccessPromptOpen, setProAccessPromptOpen] = useState(false);
  const [proOfferTab, setProOfferTab] = useState('offer');
  const [proCheckoutLoading, setProCheckoutLoading] = useState(false);
  const [proCheckoutError, setProCheckoutError] = useState('');
  const [referralShareStatus, setReferralShareStatus] = useState('');
  const [referralNotice, setReferralNotice] = useState(null);

  function setTraderMode(valueOrUpdater) {
    const requested = typeof valueOrUpdater === 'function'
      ? Boolean(valueOrUpdater(traderMode))
      : Boolean(valueOrUpdater);

    if (requested) {
      if (proAccessLoading) return;
      if (!proAccessActive) {
        setReferralShareStatus('');
        setProOfferTab('offer');
        setProAccessPromptOpen(true);
        return;
      }
    }

    setTraderModeInternal(requested);
  }

  function openReferralHub() {
    setProCheckoutError('');
    setProOfferTab('invites');
    setProAccessPromptOpen(true);
  }

  async function handleStartProCheckout() {
    if (proCheckoutLoading) return;

    setProCheckoutError('');

    if (!user) {
      setProAccessPromptOpen(false);
      await handleGoogleLogin();
      return;
    }

    // Do not start another paid subscription while any PRO access is active.
    // This also protects users who already have referral/admin PRO from paying
    // before their current access expires.
    if (proAccessActive) return;

    setProCheckoutLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('lemon-checkout', {
        body: {},
      });

      if (error) throw error;

      const checkoutUrl = data?.url;
      if (!checkoutUrl) throw new Error('CHECKOUT_URL_MISSING');

      // Never navigate to an arbitrary URL returned by a compromised endpoint.
      const parsed = new URL(checkoutUrl);
      const lemonHost = parsed.hostname === 'lemonsqueezy.com'
        || parsed.hostname.endsWith('.lemonsqueezy.com');

      if (parsed.protocol !== 'https:' || !lemonHost) {
        throw new Error('INVALID_CHECKOUT_URL');
      }

      window.location.assign(parsed.toString());
    } catch (error) {
      console.error('[pro] checkout failed:', error);
      setProCheckoutError('CHECKOUT_FAILED');
      setProCheckoutLoading(false);
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(TRADER_MODE_STORAGE_KEY, traderMode ? '1' : '0');
    } catch {
      // localStorage remembers only the preferred view, never the entitlement.
    }
  }, [traderMode]);

  useEffect(() => {
    if (proAccessLoading) return;

    if (!proAccessActive) {
      setTraderModeInternal(false);
      try { window.localStorage.setItem(TRADER_MODE_STORAGE_KEY, '0'); } catch { /* ignore */ }
      return;
    }

    // Restore the user's preferred view only after the server confirms access.
    try {
      if (window.localStorage.getItem(TRADER_MODE_STORAGE_KEY) === '1') {
        setTraderModeInternal(true);
      }
    } catch {
      // ignore storage read failures
    }
  }, [proAccessActive, proAccessLoading, user?.id]);

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

  // Keep onboarding language independent from the app language state so the
  // very next onboarding screen switches immediately after the user's tap,
  // regardless of the exact language codes used in LANGUAGES.
  function resolveOnboardingLanguage(itemOrCode, label = '') {
    const code = typeof itemOrCode === 'object'
      ? String(itemOrCode?.code || '').toLowerCase()
      : String(itemOrCode || '').toLowerCase();
    const name = typeof itemOrCode === 'object'
      ? String(itemOrCode?.label || '').toLowerCase()
      : String(label || '').toLowerCase();

    if (code === 'en' || code.startsWith('en-') || name.includes('english') || name.includes('англ')) return 'en';
    if (['ro', 'md', 'mo', 'ron', 'rum'].includes(code) || code.startsWith('ro-') || name.includes('rom') || name.includes('mold')) return 'ro';
    return 'ru';
  }

  const [onboardingLang, setOnboardingLang] = useState(() => resolveOnboardingLanguage(language));

  function handleOnboardingLanguageSelect(item) {
    setOnboardingLang(resolveOnboardingLanguage(item));
    setLanguage(item.code);
    setSetupStep('currency');
  }

  const onboardingCopy = {
    ru: {
      setup: 'Настройка',
      of: 'из',
      chooseLanguage: 'Выберите язык',
      chooseCurrency: 'Выберите валюту',
      currencyHint: 'Не переживай — валюту можно изменить позже в настройках.',
      chooseTheme: 'Выберите тему',
      light: 'День',
      dark: 'Ночь',
      title: 'Каждый день — своя история.',
      subtitle: 'Записывай то, что важно именно тебе.',
      exampleDate: '16 сентября',
      exampleDay: 'пример дня',
      coffee: 'Кофе',
      groceries: 'Продукты',
      sideJob: 'Подработка',
      greatDay: 'Отличный день',
      noAmount: 'без суммы',
      total: 'Итого за день',
      create: 'Создать первую запись →',
      skip: 'Пропустить',
      guideTapToday: 'Начнём с сегодняшнего дня',
      guideTapTodayHint: 'Нажми на подсвеченный день — добавим первую настоящую запись.',
      guideExpense: 'Потратил',
      guideIncome: 'Получил',
      guideNote: 'Хочу запомнить',
      guideChooseType: 'Что уже произошло сегодня?',
      guideChooseTypeHint: 'Выбери один вариант. Я подготовлю форму, а ты дополнишь её как хочешь.',
      guideAmountHint: 'Отлично. Теперь просто укажи сумму.',
      guideNoteHint: 'Напиши мысль или событие, которое хочешь сохранить.',
      guideSuccess: 'Вот и всё. Теперь календарь сам собирает твою историю.',
      guideMore: 'Покажи ещё одну возможность',
      guideDayTip: 'В любой день можно вернуться',
      guideDayTipHint: 'Здесь хранятся записи за день — их можно открыть, изменить или удалить.',
      guideDone: 'Понятно, готово',
      guideSkip: 'Я разберусь сам',
    },
    en: {
      setup: 'Setup',
      of: 'of',
      chooseLanguage: 'Choose language',
      chooseCurrency: 'Choose currency',
      currencyHint: 'No worries — you can change the currency later in Settings.',
      chooseTheme: 'Choose theme',
      light: 'Day',
      dark: 'Night',
      title: 'Every day has its own story.',
      subtitle: 'Record what matters to you.',
      exampleDate: 'September 16',
      exampleDay: 'example day',
      coffee: 'Coffee',
      groceries: 'Groceries',
      sideJob: 'Side job',
      greatDay: 'Great day',
      noAmount: 'no amount',
      total: 'Total for the day',
      create: 'Create first entry →',
      skip: 'Skip',
      guideTapToday: 'Start with today',
      guideTapTodayHint: 'Tap the highlighted day and create your first real entry.',
      guideExpense: 'Spent',
      guideIncome: 'Received',
      guideNote: 'Remember this',
      guideChooseType: 'What happened today?',
      guideChooseTypeHint: 'Pick one option. I’ll prepare the form and you can finish it your way.',
      guideAmountHint: 'Great. Now just enter the amount.',
      guideNoteHint: 'Write the thought or event you want to remember.',
      guideSuccess: 'That’s it. Your calendar now builds your story automatically.',
      guideMore: 'Show me one more thing',
      guideDayTip: 'You can return to any day',
      guideDayTipHint: 'This is where that day’s entries live — you can open, edit, or delete them.',
      guideDone: 'Got it',
      guideSkip: 'I’ll figure it out',
    },
    ro: {
      setup: 'Configurare',
      of: 'din',
      chooseLanguage: 'Alege limba',
      chooseCurrency: 'Alege moneda',
      currencyHint: 'Nu-ți face griji — poți schimba moneda mai târziu din Setări.',
      chooseTheme: 'Alege tema',
      light: 'Zi',
      dark: 'Noapte',
      title: 'Fiecare zi are propria poveste.',
      subtitle: 'Notează ceea ce contează pentru tine.',
      exampleDate: '16 septembrie',
      exampleDay: 'exemplu de zi',
      coffee: 'Cafea',
      groceries: 'Produse alimentare',
      sideJob: 'Venit suplimentar',
      greatDay: 'O zi minunată',
      noAmount: 'fără sumă',
      total: 'Total pe zi',
      create: 'Creează prima înregistrare →',
      skip: 'Omite',
      guideTapToday: 'Începem cu ziua de azi',
      guideTapTodayHint: 'Apasă pe ziua evidențiată și creează prima înregistrare reală.',
      guideExpense: 'Am cheltuit',
      guideIncome: 'Am primit',
      guideNote: 'Vreau să țin minte',
      guideChooseType: 'Ce s-a întâmplat azi?',
      guideChooseTypeHint: 'Alege o variantă. Eu pregătesc formularul, iar tu îl completezi cum vrei.',
      guideAmountHint: 'Perfect. Acum introdu doar suma.',
      guideNoteHint: 'Scrie gândul sau evenimentul pe care vrei să-l păstrezi.',
      guideSuccess: 'Gata. De acum calendarul îți adună singur povestea.',
      guideMore: 'Arată-mi încă o posibilitate',
      guideDayTip: 'Poți reveni la orice zi',
      guideDayTipHint: 'Aici sunt păstrate înregistrările zilei — le poți deschide, modifica sau șterge.',
      guideDone: 'Am înțeles',
      guideSkip: 'Mă descurc singur',
    },
  }[onboardingLang];

  const historyShareCopy = {
    ru: {
      share: 'Поделиться',
      shareTitle: 'Поделиться результатами',
      preview: 'Предпросмотр',
      myResults: 'Мои результаты',
      period: 'Период',
      result: 'Результат',
      income: 'Доходы',
      expense: 'Расходы',
      records: 'Записей',
      trades: 'Сделок',
      winrate: 'Winrate',
      profitable: 'В плюс',
      losing: 'В минус',
      saveImage: 'Сохранить PNG',
      preparing: 'Готовим карточку…',
      caption: 'Посмотри мои результаты',
      createdWith: 'Собрано в AI Trade Journal',
      close: 'Закрыть',
      mixedCurrencies: 'Все валюты',
      allHistory: 'За всё время',
      installCta: 'Присоединяйся',
      scanToInstall: 'Сканируй QR или открой ссылку',
      viralTagline: 'Следи за деньгами красиво и просто',
      referralBonus: '7 ДНЕЙ PRO ПО МОЕЙ ССЫЛКЕ',
      shareInviteLine: 'Следи за деньгами красиво и просто.',
      shareBonusLine: 'По моей ссылке — 7 дней PRO после первой записи.',
      shareGenericLine: 'Попробуй AI Trade Journal и начни вести свой календарь.',
      shareLinkHint: 'Вместе с картинкой отправится кликабельная ссылка на установку',
    },
    en: {
      share: 'Share',
      shareTitle: 'Share results',
      preview: 'Preview',
      myResults: 'My results',
      period: 'Period',
      result: 'Result',
      income: 'Income',
      expense: 'Expenses',
      records: 'Entries',
      trades: 'Trades',
      winrate: 'Win rate',
      profitable: 'Profitable',
      losing: 'Losing',
      saveImage: 'Save PNG',
      preparing: 'Preparing card…',
      caption: 'Check out my results',
      createdWith: 'Created with AI Trade Journal',
      close: 'Close',
      mixedCurrencies: 'All currencies',
      allHistory: 'All time',
      installCta: 'JOIN ME',
      scanToInstall: 'Scan the QR or open the link',
      viralTagline: 'Track your money beautifully and simply',
      referralBonus: '7 DAYS PRO WITH MY LINK',
      shareInviteLine: 'Track your money beautifully and simply.',
      shareBonusLine: 'My link gives you 7 days of PRO after your first entry.',
      shareGenericLine: 'Try AI Trade Journal and start your own calendar.',
      shareLinkHint: 'A clickable install link will be shared together with the image',
    },
    ro: {
      share: 'Distribuie',
      shareTitle: 'Distribuie rezultatele',
      preview: 'Previzualizare',
      myResults: 'Rezultatele mele',
      period: 'Perioadă',
      result: 'Rezultat',
      income: 'Venituri',
      expense: 'Cheltuieli',
      records: 'Înregistrări',
      trades: 'Tranzacții',
      winrate: 'Rată de succes',
      profitable: 'Pe plus',
      losing: 'Pe minus',
      saveImage: 'Salvează PNG',
      preparing: 'Pregătim cardul…',
      caption: 'Uite rezultatele mele',
      createdWith: 'Creat cu AI Trade Journal',
      close: 'Închide',
      mixedCurrencies: 'Toate monedele',
      allHistory: 'Toată perioada',
      installCta: 'ALĂTURĂ-TE',
      scanToInstall: 'Scanează QR-ul sau deschide linkul',
      viralTagline: 'Urmărește-ți banii simplu și frumos',
      referralBonus: '7 ZILE PRO DIN LINKUL MEU',
      shareInviteLine: 'Urmărește-ți banii simplu și frumos.',
      shareBonusLine: 'Din linkul meu primești 7 zile PRO după prima înregistrare.',
      shareGenericLine: 'Încearcă AI Trade Journal și începe propriul calendar.',
      shareLinkHint: 'Împreună cu imaginea va fi trimis și un link de instalare pe care se poate apăsa',
    },
  }[resolveOnboardingLanguage(language)];

  const proAccessCopy = {
    ru: {
      eyebrow: 'AI TRADE JOURNAL PRO',
      title: 'Открой AI Trade Journal PRO',
      body: 'Больше аналитики. Подключение площадок. Меньше ручной работы.',
      invitesHubTitle: 'Мои приглашения',
      invitesHubBody: 'Следи за приглашёнными, статусами и заработанными днями PRO.',
      featuresTitle: 'Что откроется в PRO',
      featurePlatform: 'Подключение площадки',
      featurePlatformHint: 'cTrader: синхронизация аккаунтов и сделок',
      featureAnalytics: 'Расширенная аналитика',
      featureAnalyticsHint: 'PnL-кривая, динамика периода и статистика',
      featureJournal: 'Торговый журнал',
      featureJournalHint: 'Инструмент, направление, TP/SL и заметки',
      featureInsights: 'Разбор результатов',
      featureInsightsHint: 'История и заметки помогают видеть закономерности',
      freeTitle: 'Получить PRO бесплатно',
      freeBody: 'Пригласи друга. После его первой настоящей записи награда активируется автоматически.',
      reward: '+26 дней PRO тебе',
      rewardHint: '+7 дней PRO другу на старт',
      share: 'Создать приглашение',
      signIn: 'Войти и получить приглашение',
      preparing: 'Готовим твоё приглашение…',
      buyTitle: 'PRO без приглашения',
      buyPrice: '$1.99',
      buyPeriod: '/ месяц',
      buyBody: 'Помесячный доступ к PRO — без приглашений.',
      buyButton: 'Подключить PRO',
      buyLoading: 'Открываем оплату…',
      buySignIn: 'Войти и подключить PRO',
      buyActive: 'PRO уже активен',
      buyError: 'Не удалось открыть оплату. Попробуй ещё раз.',
      comingSoon: 'Безопасная оплата через Lemon Squeezy',
      paymentSuccessTitle: 'PRO активирован',
      paymentSuccessBody: 'Подписка подтверждена. Доступ PRO уже включён.',
      invitedLabel: 'Приглашено',
      offerTab: 'PRO и бонусы',
      invitesTab: 'Мои приглашения',
      invitedPeople: 'Приглашено',
      activatedPeople: 'Активировали',
      waitingPeople: 'Ждём запись',
      earnedDays: 'Заработано PRO',
      daysShort: 'дн.',
      myPro: 'Мой PRO',
      proRemaining: 'Осталось',
      proUntil: 'до',
      proInactive: 'PRO не активен',
      currencyTitle: 'Валюта аналитики',
      currencyHint: 'Выбранная валюта применяется к Обзору, Аналитике, Сделкам и карточке «Поделиться».',
      mixedCurrencyHint: 'Для точных цифр выбери одну валюту. Смешивать разные валюты в один результат некорректно.',
      historyTitle: 'Последние приглашения',
      noInvitesTitle: 'Пока приглашений нет',
      noInvitesBody: 'Создай персональное приглашение — здесь появится прогресс каждого нового пользователя.',
      inviteMore: 'Пригласить ещё',
      pendingStatus: 'Ждём первую запись',
      qualifiedStatus: 'Начисляем награду',
      rewardedStatus: '+26 дней PRO',
      joinedAt: 'Присоединился',
      rewardedAt: 'Награда',
      signInHistory: 'Войди в аккаунт, чтобы видеть историю приглашений.',
      inviteWaiting: 'Поделись приглашением — друг получит 7 дней PRO.',
      invitePending: 'Друг уже присоединился · ждём его первую запись.',
      inviteDone: 'Готово · бонус PRO начислен.',
      close: 'Не сейчас',
    },
    en: {
      eyebrow: 'AI TRADE JOURNAL PRO',
      title: 'Unlock AI Trade Journal PRO',
      body: 'More analytics. Platform connections. Less manual work.',
      invitesHubTitle: 'My invitations',
      invitesHubBody: 'Track invited users, their status, and the PRO days you have earned.',
      featuresTitle: 'What PRO unlocks',
      featurePlatform: 'Platform connection',
      featurePlatformHint: 'cTrader account and trade sync',
      featureAnalytics: 'Advanced analytics',
      featureAnalyticsHint: 'PnL curve, period dynamics and statistics',
      featureJournal: 'Trading journal',
      featureJournalHint: 'Instrument, direction, TP/SL and notes',
      featureInsights: 'Results review',
      featureInsightsHint: 'History and notes help reveal patterns',
      freeTitle: 'Get PRO for free',
      freeBody: 'Invite a friend. After their first real entry, the reward activates automatically.',
      reward: '+26 days PRO for you',
      rewardHint: '+7 days PRO for your friend',
      share: 'Create invitation',
      signIn: 'Sign in to get an invitation',
      preparing: 'Preparing your invitation…',
      buyTitle: 'PRO without inviting',
      buyPrice: '$1.99',
      buyPeriod: '/ month',
      buyBody: 'Monthly PRO access — no invitation required.',
      buyButton: 'Get PRO',
      buyLoading: 'Opening checkout…',
      buySignIn: 'Sign in to get PRO',
      buyActive: 'PRO is already active',
      buyError: 'Could not open checkout. Please try again.',
      comingSoon: 'Secure checkout by Lemon Squeezy',
      paymentSuccessTitle: 'PRO activated',
      paymentSuccessBody: 'Your subscription is confirmed. PRO access is now active.',
      invitedLabel: 'Invited',
      offerTab: 'PRO & rewards',
      invitesTab: 'My invites',
      invitedPeople: 'Invited',
      activatedPeople: 'Activated',
      waitingPeople: 'Waiting',
      earnedDays: 'PRO earned',
      daysShort: 'days',
      myPro: 'My PRO',
      proRemaining: 'Remaining',
      proUntil: 'until',
      proInactive: 'PRO is not active',
      currencyTitle: 'Analytics currency',
      currencyHint: 'The selected currency applies to Overview, Analytics, Trades and the Share card.',
      mixedCurrencyHint: 'Choose one currency for exact numbers. Different currencies should not be combined into one result.',
      historyTitle: 'Recent invitations',
      noInvitesTitle: 'No invitations yet',
      noInvitesBody: 'Create a personal invitation and each new user’s progress will appear here.',
      inviteMore: 'Invite another',
      pendingStatus: 'Waiting for first entry',
      qualifiedStatus: 'Granting reward',
      rewardedStatus: '+26 days PRO',
      joinedAt: 'Joined',
      rewardedAt: 'Reward',
      signInHistory: 'Sign in to see your invitation history.',
      inviteWaiting: 'Share your invitation — your friend gets 7 days of PRO.',
      invitePending: 'Your friend joined · waiting for their first entry.',
      inviteDone: 'Done · your PRO bonus has been granted.',
      close: 'Not now',
    },
    ro: {
      eyebrow: 'AI TRADE JOURNAL PRO',
      title: 'Deblochează AI Trade Journal PRO',
      body: 'Mai multă analiză. Conectarea platformelor. Mai puțină muncă manuală.',
      invitesHubTitle: 'Invitațiile mele',
      invitesHubBody: 'Urmărește invitațiile, starea lor și zilele PRO câștigate.',
      featuresTitle: 'Ce deblochează PRO',
      featurePlatform: 'Conectarea platformei',
      featurePlatformHint: 'cTrader: sincronizarea conturilor și tranzacțiilor',
      featureAnalytics: 'Analiză avansată',
      featureAnalyticsHint: 'Curba PnL, dinamica perioadei și statistici',
      featureJournal: 'Jurnal de tranzacționare',
      featureJournalHint: 'Instrument, direcție, TP/SL și notițe',
      featureInsights: 'Analiza rezultatelor',
      featureInsightsHint: 'Istoricul și notițele ajută să vezi tipare',
      freeTitle: 'Primește PRO gratuit',
      freeBody: 'Invită un prieten. După prima lui înregistrare reală, recompensa se activează automat.',
      reward: '+26 zile PRO pentru tine',
      rewardHint: '+7 zile PRO pentru prieten',
      share: 'Creează invitația',
      signIn: 'Autentifică-te pentru invitație',
      preparing: 'Pregătim invitația…',
      buyTitle: 'PRO fără invitație',
      buyPrice: '$1.99',
      buyPeriod: '/ lună',
      buyBody: 'Acces PRO lunar — fără invitații.',
      buyButton: 'Activează PRO',
      buyLoading: 'Deschidem plata…',
      buySignIn: 'Autentifică-te pentru PRO',
      buyActive: 'PRO este deja activ',
      buyError: 'Nu am putut deschide plata. Încearcă din nou.',
      comingSoon: 'Plată securizată prin Lemon Squeezy',
      paymentSuccessTitle: 'PRO activat',
      paymentSuccessBody: 'Abonamentul este confirmat. Accesul PRO este activ.',
      invitedLabel: 'Invitați',
      offerTab: 'PRO și bonusuri',
      invitesTab: 'Invitațiile mele',
      invitedPeople: 'Invitați',
      activatedPeople: 'Activați',
      waitingPeople: 'Așteptăm',
      earnedDays: 'PRO câștigat',
      daysShort: 'zile',
      myPro: 'PRO-ul meu',
      proRemaining: 'Au rămas',
      proUntil: 'până la',
      proInactive: 'PRO nu este activ',
      currencyTitle: 'Moneda analizei',
      currencyHint: 'Moneda selectată se aplică la Rezumat, Analiză, Tranzacții și cardul „Distribuie”.',
      mixedCurrencyHint: 'Pentru cifre exacte alege o singură monedă. Monedele diferite nu trebuie adunate într-un singur rezultat.',
      historyTitle: 'Invitații recente',
      noInvitesTitle: 'Încă nu ai invitații',
      noInvitesBody: 'Creează o invitație personală și aici va apărea progresul fiecărui utilizator nou.',
      inviteMore: 'Invită încă o persoană',
      pendingStatus: 'Așteptăm prima înregistrare',
      qualifiedStatus: 'Acordăm recompensa',
      rewardedStatus: '+26 zile PRO',
      joinedAt: 'S-a alăturat',
      rewardedAt: 'Recompensă',
      signInHistory: 'Autentifică-te pentru a vedea istoricul invitațiilor.',
      inviteWaiting: 'Trimite invitația — prietenul primește 7 zile PRO.',
      invitePending: 'Prietenul s-a alăturat · așteptăm prima înregistrare.',
      inviteDone: 'Gata · bonusul PRO a fost acordat.',
      close: 'Nu acum',
    },
  }[resolveOnboardingLanguage(language)];

  const referralShareCopy = {
    ru: {
      preview: 'ПЕРСОНАЛЬНОЕ ПРИГЛАШЕНИЕ',
      shareTitle: 'Пригласить в AI Trade Journal',
      hero: 'Присоединяйся — будем считать дни вместе',
      tagline: 'Следи за деньгами красиво и просто',
      friendBonus: '7 ДНЕЙ PRO',
      friendBonusHint: 'на старт после первой записи',
      qrHint: 'Сканируй QR и установи приложение',
      honestLine: 'После твоей первой записи я тоже получу бонус PRO.',
      saveImage: 'Сохранить PNG',
      share: 'Поделиться',
      preparing: 'Создаём приглашение…',
      close: 'Закрыть',
      shareText: 'Следи за деньгами красиво и просто. По моей ссылке ты получишь 7 дней PRO после первой записи.',
    },
    en: {
      preview: 'PERSONAL INVITATION',
      shareTitle: 'Invite to AI Trade Journal',
      hero: 'Join me — let’s count the days together',
      tagline: 'Track your money beautifully and simply',
      friendBonus: '7 DAYS PRO',
      friendBonusHint: 'to get started after your first entry',
      qrHint: 'Scan the QR code and install the app',
      honestLine: 'After your first entry, I’ll get a PRO bonus too.',
      saveImage: 'Save PNG',
      share: 'Share',
      preparing: 'Creating invitation…',
      close: 'Close',
      shareText: 'Track your money beautifully and simply. My link gives you 7 days of PRO after your first entry.',
    },
    ro: {
      preview: 'INVITAȚIE PERSONALĂ',
      shareTitle: 'Invită în AI Trade Journal',
      hero: 'Alătură-te — numărăm zilele împreună',
      tagline: 'Urmărește-ți banii simplu și frumos',
      friendBonus: '7 ZILE PRO',
      friendBonusHint: 'pentru început, după prima înregistrare',
      qrHint: 'Scanează QR-ul și instalează aplicația',
      honestLine: 'După prima ta înregistrare, primesc și eu un bonus PRO.',
      saveImage: 'Salvează PNG',
      share: 'Distribuie',
      preparing: 'Creăm invitația…',
      close: 'Închide',
      shareText: 'Urmărește-ți banii simplu și frumos. Din linkul meu primești 7 zile PRO după prima înregistrare.',
    },
  }[resolveOnboardingLanguage(language)];

  function formatProUntilDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const locale = resolveOnboardingLanguage(language) === 'ru'
      ? 'ru-RU'
      : resolveOnboardingLanguage(language) === 'ro'
        ? 'ro-RO'
        : 'en-US';

    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  function formatReferralHistoryDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const locale = resolveOnboardingLanguage(language) === 'ru'
      ? 'ru-RU'
      : resolveOnboardingLanguage(language) === 'ro'
        ? 'ro-RO'
        : 'en-US';

    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  const proHistoryCopy = {
    ru: {
      overview: 'Обзор',
      analytics: 'Аналитика',
      trades: 'Сделки',
      commandCenter: 'PRO ОБЗОР',
      commandTitle: 'Картина торговли за период',
      commandSubtitle: 'Главное — без шума. Результат, качество сделок и ключевые сигналы в одном месте.',
      result: 'Результат',
      winrate: 'Winrate',
      tradesCount: 'Сделок',
      averageTrade: 'Средняя сделка',
      proValue: 'Что даёт PRO',
      platform: 'Подключение площадки',
      platformHint: 'cTrader и синхронизация сделок',
      curve: 'Кривая результата',
      curveHint: 'PnL и просадка по времени',
      discipline: 'Дисциплина',
      disciplineHint: 'Заметки и торговые паттерны',
      comparison: 'Сравнение периодов',
      comparisonHint: 'Динамика и качество результатов',
      deeperTitle: 'Глубокая аналитика',
      deeperBody: 'Здесь уже не просто список сделок — структура результата, дисциплина и поведение по периоду.',
      tradesTitle: 'Журнал сделок',
      tradesBody: 'Фильтруй, открывай и редактируй сделки без визуального шума.',
    },
    en: {
      overview: 'Overview',
      analytics: 'Analytics',
      trades: 'Trades',
      commandCenter: 'PRO OVERVIEW',
      commandTitle: 'Your trading picture for the period',
      commandSubtitle: 'The important signals without the noise: result, trade quality and key patterns.',
      result: 'Result',
      winrate: 'Win rate',
      tradesCount: 'Trades',
      averageTrade: 'Average trade',
      proValue: 'What PRO unlocks',
      platform: 'Platform connection',
      platformHint: 'cTrader and trade sync',
      curve: 'Performance curve',
      curveHint: 'PnL and drawdown over time',
      discipline: 'Discipline',
      disciplineHint: 'Notes and trading patterns',
      comparison: 'Period comparison',
      comparisonHint: 'Dynamics and result quality',
      deeperTitle: 'Deep analytics',
      deeperBody: 'More than a trade list: structure of results, discipline and period behaviour.',
      tradesTitle: 'Trading journal',
      tradesBody: 'Filter, open and edit trades without visual noise.',
    },
    ro: {
      overview: 'Privire generală',
      analytics: 'Analiză',
      trades: 'Tranzacții',
      commandCenter: 'REZUMAT PRO',
      commandTitle: 'Imaginea tranzacționării pentru perioadă',
      commandSubtitle: 'Semnalele importante fără zgomot: rezultat, calitatea tranzacțiilor și tipare.',
      result: 'Rezultat',
      winrate: 'Rată de succes',
      tradesCount: 'Tranzacții',
      averageTrade: 'Tranzacție medie',
      proValue: 'Ce oferă PRO',
      platform: 'Conectarea platformei',
      platformHint: 'cTrader și sincronizarea tranzacțiilor',
      curve: 'Curba rezultatului',
      curveHint: 'PnL și declin în timp',
      discipline: 'Disciplină',
      disciplineHint: 'Notițe și tipare de tranzacționare',
      comparison: 'Compararea perioadelor',
      comparisonHint: 'Dinamică și calitatea rezultatelor',
      deeperTitle: 'Analiză aprofundată',
      deeperBody: 'Mai mult decât o listă: structura rezultatului, disciplina și comportamentul perioadei.',
      tradesTitle: 'Jurnal de tranzacții',
      tradesBody: 'Filtrează, deschide și modifică tranzacțiile fără zgomot vizual.',
    },
  }[resolveOnboardingLanguage(language)];

  useEffect(() => {
    if (!user?.id) return undefined;

    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return undefined;

    let cancelled = false;
    let confirmed = false;
    const timers = [];

    const cleanPaymentParam = () => {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('payment');
      window.history.replaceState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    };

    const checkAccess = async () => {
      const isActive = await refreshProAccess();
      if (cancelled || confirmed || !isActive) return;

      confirmed = true;
      cleanPaymentParam();
      setReferralNotice({
        title: proAccessCopy.paymentSuccessTitle,
        body: proAccessCopy.paymentSuccessBody,
      });
    };

    // The checkout redirect can beat the Lemon webhook by a moment. Retry
    // quietly so the user does not need to reload or wait for the 2-minute poll.
    [0, 1500, 3500, 7000].forEach((delay) => {
      timers.push(window.setTimeout(checkAccess, delay));
    });

    // Do not leave a stale payment marker in the URL forever. If the webhook
    // is unusually slow, the normal focus/online polling will still refresh PRO.
    timers.push(window.setTimeout(() => {
      if (!cancelled && !confirmed) cleanPaymentParam();
    }, 9000));

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    user?.id,
    refreshProAccess,
    proAccessCopy.paymentSuccessTitle,
    proAccessCopy.paymentSuccessBody,
  ]);

  const referralNoticeCopy = {
    ru: {
      claimedTitle: 'Приглашение принято',
      claimedBody: 'Создай первую настоящую запись — после неё тебе откроется 7 дней PRO.',
      friendJoinedTitle: 'Друг присоединился · 1/1',
      friendJoinedBody: 'Отлично. Теперь ждём его первую настоящую запись.',
      inviterRewardTitle: '+26 дней PRO начислено',
      inviterRewardBody: 'Друг создал первую запись. Твой бонус уже активирован.',
      friendRewardTitle: 'Тебе открыто 7 дней PRO',
      friendRewardBody: 'Первая запись готова — приветственный PRO активирован.',
    },
    en: {
      claimedTitle: 'Invitation accepted',
      claimedBody: 'Create your first real entry and you’ll unlock 7 days of PRO.',
      friendJoinedTitle: 'Friend joined · 1/1',
      friendJoinedBody: 'Great. Now we’re waiting for their first real entry.',
      inviterRewardTitle: '+26 days PRO granted',
      inviterRewardBody: 'Your friend created their first entry. Your bonus is active.',
      friendRewardTitle: '7 days of PRO unlocked',
      friendRewardBody: 'Your first entry is done — welcome PRO is active.',
    },
    ro: {
      claimedTitle: 'Invitație acceptată',
      claimedBody: 'Creează prima înregistrare reală și vei primi 7 zile PRO.',
      friendJoinedTitle: 'Prietenul s-a alăturat · 1/1',
      friendJoinedBody: 'Perfect. Acum așteptăm prima lui înregistrare reală.',
      inviterRewardTitle: '+26 zile PRO acordate',
      inviterRewardBody: 'Prietenul a creat prima înregistrare. Bonusul tău este activ.',
      friendRewardTitle: 'Ai primit 7 zile PRO',
      friendRewardBody: 'Prima înregistrare este gata — PRO de bun venit este activ.',
    },
  }[resolveOnboardingLanguage(language)];

  useEffect(() => {
    if (claimStatus !== 'claimed') return;
    setReferralNotice({
      title: referralNoticeCopy.claimedTitle,
      body: referralNoticeCopy.claimedBody,
    });
  }, [claimStatus, referralNoticeCopy.claimedTitle, referralNoticeCopy.claimedBody]);

  useEffect(() => {
    if (!user?.id) return;

    const key = `atj_referrer_invited_seen_${user.id}`;
    let seen = 0;
    try { seen = Number(window.localStorage.getItem(key)) || 0; } catch { /* ignore */ }

    if (invitedCount > seen) {
      if (seen > 0 || invitedCount === 1) {
        setReferralNotice({
          title: referralNoticeCopy.friendJoinedTitle,
          body: referralNoticeCopy.friendJoinedBody,
        });
      }
      try { window.localStorage.setItem(key, String(invitedCount)); } catch { /* ignore */ }
    }
  }, [user?.id, invitedCount, referralNoticeCopy.friendJoinedTitle, referralNoticeCopy.friendJoinedBody]);

  useEffect(() => {
    if (!user?.id) return;

    const key = `atj_referrer_rewarded_seen_${user.id}`;
    let seen = 0;
    try { seen = Number(window.localStorage.getItem(key)) || 0; } catch { /* ignore */ }

    if (rewardedCount > seen) {
      setReferralNotice({
        title: referralNoticeCopy.inviterRewardTitle,
        body: referralNoticeCopy.inviterRewardBody,
      });
      try { window.localStorage.setItem(key, String(rewardedCount)); } catch { /* ignore */ }
    }
  }, [user?.id, rewardedCount, referralNoticeCopy.inviterRewardTitle, referralNoticeCopy.inviterRewardBody]);

  useEffect(() => {
    if (!user?.id || myReferralStatus !== 'rewarded' || !myReferralRewardedAt) return;

    const key = `atj_referred_reward_seen_${user.id}_${myReferralRewardedAt}`;
    let seen = false;
    try { seen = window.localStorage.getItem(key) === '1'; } catch { /* ignore */ }
    if (seen) return;

    setReferralNotice({
      title: referralNoticeCopy.friendRewardTitle,
      body: referralNoticeCopy.friendRewardBody,
    });
    try { window.localStorage.setItem(key, '1'); } catch { /* ignore */ }
  }, [
    user?.id,
    myReferralStatus,
    myReferralRewardedAt,
    referralNoticeCopy.friendRewardTitle,
    referralNoticeCopy.friendRewardBody,
  ]);

  useEffect(() => {
    if (!referralNotice) return undefined;
    const timer = window.setTimeout(() => setReferralNotice(null), 5200);
    return () => window.clearTimeout(timer);
  }, [referralNotice]);

  function markFirstRunGuideComplete() {
    try { window.localStorage.setItem('calendar_guide_completed', '1'); } catch { /* ignore */ }
    setFirstRunGuideChoice(null);
    setFirstRunGuideStep(0);
  }

  function chooseFirstRunGuideType(type) {
    setFirstRunGuideChoice(type);
    if (type === 'expense') {
      setForm((f) => ({ ...f, sign: 'minus', instrument: 'Продукты', pnl: '' }));
      requestAnimationFrame(() => guideAmountRef.current?.focus());
      return;
    }
    if (type === 'income') {
      setForm((f) => ({ ...f, sign: 'plus', instrument: 'Зарплата', pnl: '' }));
      requestAnimationFrame(() => guideAmountRef.current?.focus());
      return;
    }
    setForm((f) => ({ ...f, sign: 'plus', instrument: 'Заметка', pnl: '0' }));
    setDetailsOpen(true);
    requestAnimationFrame(() => guideCommentRef.current?.focus());
  }

  useEffect(() => {
    if (firstRunGuideStep !== 3) return undefined;
    const timer = window.setTimeout(() => markFirstRunGuideComplete(), 12000);
    return () => window.clearTimeout(timer);
  }, [firstRunGuideStep]);

  const currencySymbol = getCurrencyMeta(currency).symbol;
  const isLight = theme === 'light';
  const periodLabel = (preset) => ({
    'Сегодня': t('today'),
    'Текущая неделя': t('currentWeek'),
    'Текущий месяц': t('currentMonth'),
    '3 месяца': t('threeMonths'),
    'Вся история': t('allHistory'),
    custom: t('customPeriod'),
  }[preset] || preset);

  function formatPnlDisplay(amount, short) {
    const num = Number(amount) || 0;
    if (displayMode === 'percent' && depositSize > 0) {
      const pct = (num / depositSize) * 100;
      return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    }
    return `${num >= 0 ? '+' : '-'}${currencySymbol}${short ? formatMoneyShort(num) : formatMoney(num)}`;
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
      try { window.history.pushState({ calendarDay: selectedKey }, ''); } catch {}
    }
    suppressNextHistoryPush.current = false;
  }, [selectedKey]);

  useEffect(() => {
    function onPopState() {
      suppressNextHistoryPush.current = true;
      setSelectedKey(null);
    }
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
    refreshFromCloud,
  } = useTrades({ user });

  const [recentInstruments, setRecentInstruments] = useState([]); // most-recently-used instrument symbols
  const [customTags, setCustomTags] = useState([]); // user-added instrument tags, max MAX_CUSTOM_TAGS
  const [addingCustomTag, setAddingCustomTag] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const dragTagIndex = useRef(null);

  // --- Install as app (PWA) ------------------------------------------------
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [installInfoOpen, setInstallInfoOpen] = useState(false);
  const [isPwaInstalled, setIsPwaInstalled] = useState(() => {
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
    try { return standalone || window.localStorage.getItem('atj_pwa_installed') === 'true'; } catch { return standalone; }
  });
  const installInfoRef = useRef(null);
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent);

  useEffect(() => {
    function onBeforeInstallPrompt(e) {
      e.preventDefault();
      setDeferredInstallPrompt(e);
    }
    function onAppInstalled() {
      setIsPwaInstalled(true);
      try { window.localStorage.setItem('atj_pwa_installed', 'true'); } catch { /* ignore */ }
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
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

  const periodButtonLabel = periodLabel(periodPreset);

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

  const [notesRevision, setNotesRevision] = useState(0);
  const { notes: calendarNotes } = useCurveNotes(traderMode ? validUserId : null, cells[0]?.key, cells.at(-1)?.key, notesRevision);
  const monthSummary = useMemo(() => {
    let total = 0, days = 0;
    for (const cell of cells) {
      if (!cell.inMonth) continue;
      const entries = tradesForDayFiltered(cell.key);
      if (entries.length) days++;
      total += entries.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
    }
    return { total, days };
  }, [cells, manualTrades, platformFilter, currency, calendarTypeFilter]);

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

  // PRO Scorecard — composite 0-100 score from profit factor, winrate, payoff and loss streaks.
  // Pure client-side math over data we already have, no new backend needed.
  const traderScore = useMemo(() => {
    if (!basicAnalysis) return null;
    const pfComponent = Math.min(basicAnalysis.profitFactor === Infinity ? 3 : basicAnalysis.profitFactor, 3) / 3 * 40;
    const winComponent = Math.min(Math.max(analysisStats.winrate, 0), 100) / 100 * 35;
    const payoffComponent = Math.min(basicAnalysis.payoffRatio, 3) / 3 * 15;
    const streakPenalty = Math.min(basicAnalysis.longestLossStreak, 6) * 1.5;
    const score = Math.max(4, Math.min(99, Math.round(pfComponent + winComponent + payoffComponent - streakPenalty + 10)));
    const grade = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
    const label = score >= 85 ? 'Элитный трейдер' : score >= 70 ? 'Уверенная рука' : score >= 55 ? 'Стабильная база' : score >= 40 ? 'Есть над чем работать' : 'Требует дисциплины';
    return { score, grade, label };
  }, [basicAnalysis, analysisStats]);

  // Rule-based observations from the selected trades, not an AI assessment.
  const traderInsight = useMemo(() => {
    if (!basicAnalysis) return '';
    if (basicAnalysis.longestLossStreak >= 3) return `Самая длинная серия убытков в выборке: ${basicAnalysis.longestLossStreak}. Сопоставьте этот период с заметками к торговым дням: по одним результатам сделок нельзя определить причины убытков или эмоциональное состояние.`;
    if (basicAnalysis.payoffRatio > 0 && basicAnalysis.payoffRatio < 1 && analysisStats.winrate >= 50) return 'Винрейт хороший, но средний убыток крупнее среднего профита — похоже, прибыль фиксируется слишком рано, а убытки пересиживаются.';
    if (basicAnalysis.profitFactor !== Infinity && basicAnalysis.profitFactor < 1) return 'Profit Factor ниже 1 — за период убытки перевешивают прибыль. Стоит пересмотреть risk/reward по сделкам.';
    if (basicAnalysis.profitFactor >= 1.5) return 'Сильный период: Profit Factor выше 1.5 говорит о стабильном преимуществе в текущей стратегии. Держите риск неизменным.';
    return 'Данных пока немного для глубоких выводов — статистика станет точнее по мере накопления сделок.';
  }, [basicAnalysis, analysisStats]);

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

  function openModal(tradeToEdit, dateKeyOverride = null) {
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
      if (!dateKeyOverride && isFutureSelected) return; // нельзя добавлять сделки на будущее
      setEditingTrade(null);
      const newEntryDateKey = dateKeyOverride || targetDateKey;
      if (newEntryDateKey > todayKey) return;
      setModalDateKey(newEntryDateKey);
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
    if (firstRunGuideStep === 2 && !editingTrade) setFirstRunGuideStep(1);
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

      const completedFirstRunGuide = firstRunGuideStep === 2 && !editingTrade && dateKey === todayKey && !traderMode;
      closeModal();
      if (completedFirstRunGuide) {
        try { window.localStorage.setItem('calendar_guide_completed', '1'); } catch { /* ignore */ }
        setFirstRunGuideStep(3);
      }
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
  const historyDealsRef = useRef(null);
  const historyScrollRef = useRef(null);
  const [historyAtDeals, setHistoryAtDeals] = useState(false);
  const [proHistoryTab, setProHistoryTab] = useState('overview');
  useEffect(() => { setHistoryAtDeals(false); }, [historyOpen]);

  function handleHistoryScroll(event) {
    const panel = event.currentTarget;
    const target = historyDealsRef.current;
    if (!target || panel.scrollTop <= 8) { setHistoryAtDeals(false); return; }
    const nearDeals = target.getBoundingClientRect().top <= panel.getBoundingClientRect().top + panel.clientHeight * 0.35;
    const atBottom = panel.scrollHeight - panel.clientHeight - panel.scrollTop <= 8;
    setHistoryAtDeals(nearDeals || atBottom);
  }

  function jumpHistorySection() {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    if (historyAtDeals) historyScrollRef.current?.scrollTo({ top: 0, behavior });
    else historyDealsRef.current?.scrollIntoView({ behavior, block: 'start' });
  }
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyWinLoss, setHistoryWinLoss] = useState('all'); // 'all' | 'win' | 'loss'
  const [historyCurrency, setHistoryCurrency] = useState(() => currency || 'USD');
  const [historyNameFilter, setHistoryNameFilter] = useState('');
  const [historyCategoryMenuOpen, setHistoryCategoryMenuOpen] = useState(false);
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [historyPeriodMenuOpen, setHistoryPeriodMenuOpen] = useState(false);
  const [proFiltersOpen, setProFiltersOpen] = useState(false);
  const [instrumentBreakdownOpen, setInstrumentBreakdownOpen] = useState(false);
  const [freeHistoryPanel, setFreeHistoryPanel] = useState(null); // null | 'dynamics' | 'analysis'
  const [freeTimelineSelected, setFreeTimelineSelected] = useState(null);
  // 0 = latest week, 1 = previous week, etc.
  const [freeTimelineOffset, setFreeTimelineOffset] = useState(0);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPeriodPreset, setExportPeriodPreset] = useState('currentPeriod');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [historyShareOpen, setHistoryShareOpen] = useState(false);
  const [historyShareBusy, setHistoryShareBusy] = useState(false);
  const [historyShareUrl, setHistoryShareUrl] = useState('');
  const historyShareBlobRef = useRef(null);

  const [referralShareOpen, setReferralShareOpen] = useState(false);
  const [referralShareBusy, setReferralShareBusy] = useState(false);
  const [referralShareUrl, setReferralShareUrl] = useState('');
  const referralShareBlobRef = useRef(null);

  // Keyboard navigation for PC (ArrowLeft / ArrowRight to switch months)
  useEffect(() => {
    function handleKeyDown(e) {
      const tag = e.target?.tagName?.toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }
      if (historyOpen || modalOpen || settingsOpen || connectOpen || installInfoOpen || selectedKey) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevMonth();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextMonth();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyOpen, modalOpen, settingsOpen, connectOpen, installInfoOpen, selectedKey]);

  const historyFilteredTrades = useMemo(() => {
    return Object.entries(manualTrades || {})
      .flatMap(([dateKey, arr]) => (Array.isArray(arr) ? arr : []).map((t) => ({ ...t, dateKey })))
      .filter((t) => platformFilter === 'ALL' || t.platform === platformFilter)
      .filter((t) => historyCurrency === 'ALL' || (t.currency || 'USD') === historyCurrency)
      .filter((t) => !historyNameFilter || String(t.instrument || '').trim().toUpperCase() === historyNameFilter.trim().toUpperCase())
      .filter((t) => historyWinLoss === 'all' || (historyWinLoss === 'win' ? (Number(t.pnl) || 0) >= 0 : (Number(t.pnl) || 0) < 0))
      .sort((a, b) => (a.dateKey === b.dateKey ? (b.time || '').localeCompare(a.time || '') : (b.dateKey || '').localeCompare(a.dateKey || '')));
  }, [manualTrades, platformFilter, historyWinLoss, historyCurrency, historyNameFilter]);
  const historyTrades = useMemo(() => historyFilteredTrades.filter(t => t.dateKey >= dateFrom && t.dateKey <= dateTo), [historyFilteredTrades, dateFrom, dateTo]);

  function isTradingInstrumentName(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return DEFAULT_ASSET_TAGS.includes(normalized) || /BTC|ETH|SOL|XRP|DOGE|BNB|ADA|USDT|XAU|XAG|GOLD|SILVER|EURUSD|GBPUSD|USDJPY|NDX|NASDAQ|SPX|OIL|WTI|BRENT|КРИПТ|ЗОЛОТ|СЕРЕБР/.test(normalized);
  }

  const historyNameOptions = useMemo(() => [...new Set(
    Object.values(manualTrades).flat().map((trade) => trade.instrument).filter(Boolean)
  )]
    .filter((name) => traderMode || MONEY_CATEGORIES.some((category) => category.key.toUpperCase() === name.trim().toUpperCase()))
    .sort((a, b) => a.localeCompare(b, language)), [manualTrades, language, traderMode]);

  useEffect(() => {
    if (!traderMode && historyNameFilter && isTradingInstrumentName(historyNameFilter)) setHistoryNameFilter('');
  }, [traderMode, historyNameFilter]);

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

  useEffect(() => {
    return () => {
      if (historyShareUrl) URL.revokeObjectURL(historyShareUrl);
    };
  }, [historyShareUrl]);

  useEffect(() => {
    return () => {
      if (referralShareUrl) URL.revokeObjectURL(referralShareUrl);
    };
  }, [referralShareUrl]);

  function roundedCanvasRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function fitCanvasText(ctx, value, maxWidth, startSize, minSize = 34, weight = 700) {
    let size = startSize;
    const family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
    while (size > minSize) {
      ctx.font = `${weight} ${size}px ${family}`;
      if (ctx.measureText(value).width <= maxWidth) return size;
      size -= 2;
    }
    return minSize;
  }

  function drawWrappedCanvasText(ctx, value, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(value || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines - 1) break;
      } else {
        line = test;
      }
    }

    if (line && lines.length < maxLines) {
      const usedWords = lines.join(' ').split(/\s+/).filter(Boolean).length;
      const remaining = words.slice(usedWords);
      let last = remaining.join(' ') || line;
      while (last && ctx.measureText(last).width > maxWidth) {
        last = `${last.slice(0, -2).trim()}…`;
      }
      lines.push(last);
    }

    lines.slice(0, maxLines).forEach((item, index) => {
      ctx.fillText(item, x, y + index * lineHeight);
    });

    return Math.min(lines.length, maxLines);
  }

  function getHistorySharePeriodText() {
    if (dateFrom === '0000-01-01' && dateTo === '9999-12-31') return historyShareCopy.allHistory;

    const locale = resolveOnboardingLanguage(language) === 'ru'
      ? 'ru-RU'
      : resolveOnboardingLanguage(language) === 'ro'
        ? 'ro-RO'
        : 'en-US';
    const from = parseDateKeyLocal(dateFrom);
    const to = parseDateKeyLocal(dateTo);
    if (!(from instanceof Date) || Number.isNaN(from.getTime()) || !(to instanceof Date) || Number.isNaN(to.getTime())) {
      return historyShareCopy.allHistory;
    }

    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
    const dayMonthYear = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    const sameDay = dateFrom === dateTo;
    const sameMonth = from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth();

    if (sameDay) return dayMonthYear.format(from);
    if (sameMonth) {
      const daysInMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
      if (from.getDate() === 1 && to.getDate() === daysInMonth) return monthYear.format(from);
      return `${from.getDate()}–${to.getDate()} ${monthYear.format(from)}`;
    }
    return `${dayMonthYear.format(from)} — ${dayMonthYear.format(to)}`;
  }

  function createReferralShareBlob() {
    return new Promise((resolve, reject) => {
      try {
        if (!referralCode) throw new Error('REFERRAL_CODE_MISSING');

        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('CANVAS_UNAVAILABLE');

        const dark = !isLight;
        const background = dark ? '#08090b' : '#f6f7f9';
        const panel = dark ? '#111318' : '#ffffff';
        const border = dark ? '#282c34' : '#e1e5e9';
        const textMain = dark ? '#f5f7fa' : '#17191d';
        const textMuted = dark ? '#9097a4' : '#6f7782';
        const amber = '#f5b91f';
        const green = '#10b981';

        const inviteUrlObject = new URL('/?install=1', window.location.origin);
        inviteUrlObject.searchParams.set('ref', referralCode);
        const inviteUrl = inviteUrlObject.toString();

        // Premium background.
        const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
        if (dark) {
          gradient.addColorStop(0, '#08090b');
          gradient.addColorStop(0.65, '#0b0c0f');
          gradient.addColorStop(1, '#121006');
        } else {
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.68, '#f6f7f9');
          gradient.addColorStop(1, '#fff8df');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1350);

        const glow = ctx.createRadialGradient(900, 120, 0, 900, 120, 440);
        glow.addColorStop(0, dark ? 'rgba(245,185,31,.18)' : 'rgba(245,185,31,.16)');
        glow.addColorStop(1, 'rgba(245,185,31,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(460, 0, 620, 560);

        // Brand mark.
        roundedCanvasRect(ctx, 72, 72, 92, 92, 24);
        ctx.fillStyle = dark ? '#13151a' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = dark ? '#3a3219' : '#eadba8';
        ctx.lineWidth = 3;
        ctx.stroke();

        const tile = 29;
        const gap = 8;
        const startX = 84;
        const startY = 84;
        [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([cx, cy], index) => {
          roundedCanvasRect(ctx, startX + cx * (tile + gap), startY + cy * (tile + gap), tile, tile, 8);
          ctx.fillStyle = index === 1 ? green : (dark ? '#25282f' : '#e7eaee');
          ctx.fill();
        });

        ctx.fillStyle = textMain;
        ctx.font = '700 40px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText('AI Trade Journal', 190, 116);

        ctx.fillStyle = amber;
        ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(referralShareCopy.preview, 190, 151);

        // Hero copy.
        ctx.fillStyle = textMain;
        ctx.font = '760 62px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        drawWrappedCanvasText(ctx, referralShareCopy.hero, 72, 278, 936, 72, 3);

        ctx.fillStyle = textMuted;
        ctx.font = '600 31px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(referralShareCopy.tagline, 72, 474);

        // Bonus card.
        roundedCanvasRect(ctx, 72, 540, 936, 185, 34);
        ctx.fillStyle = panel;
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = amber;
        ctx.font = '800 51px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(referralShareCopy.friendBonus, 116, 620);

        ctx.fillStyle = textMuted;
        ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(referralShareCopy.friendBonusHint, 116, 669);

        roundedCanvasRect(ctx, 834, 578, 124, 108, 28);
        ctx.fillStyle = dark ? 'rgba(245,185,31,.08)' : '#fff8df';
        ctx.fill();
        ctx.strokeStyle = dark ? 'rgba(245,185,31,.20)' : '#f3d66f';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = amber;
        ctx.textAlign = 'center';
        ctx.font = '800 29px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText('+7', 896, 625);
        ctx.font = '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText('PRO', 896, 655);
        ctx.textAlign = 'left';

        // QR panel.
        roundedCanvasRect(ctx, 72, 774, 936, 402, 38);
        ctx.fillStyle = panel;
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.stroke();

        // QR always uses a white field for reliable scanning.
        roundedCanvasRect(ctx, 112, 812, 326, 326, 28);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        const qrMatrix = createQrMatrix(inviteUrl);
        drawQrToCanvas(ctx, qrMatrix, 132, 832, 286, {
          foreground: '#09090b',
          background: '#ffffff',
        });

        ctx.fillStyle = textMain;
        ctx.font = '760 31px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        drawWrappedCanvasText(ctx, referralShareCopy.qrHint, 490, 866, 458, 42, 3);

        ctx.fillStyle = textMuted;
        ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        drawWrappedCanvasText(ctx, referralShareCopy.honestLine, 490, 1002, 458, 31, 3);

        ctx.fillStyle = amber;
        ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
        ctx.fillText(`REF · ${referralCode}`, 490, 1116);

        // Footer.
        ctx.fillStyle = amber;
        roundedCanvasRect(ctx, 72, 1262, 72, 5, 3);
        ctx.fill();

        ctx.fillStyle = textMuted;
        ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText('AI TRADE JOURNAL', 160, 1271);

        ctx.textAlign = 'right';
        ctx.fillText(new URL(window.location.origin).host, 1008, 1271);
        ctx.textAlign = 'left';

        canvas.toBlob((blob) => {
          if (!blob) reject(new Error('IMAGE_EXPORT_FAILED'));
          else resolve(blob);
        }, 'image/png', 0.96);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function openReferralShare() {
    if (!user) {
      handleGoogleLogin();
      return;
    }
    if (!referralCode) return;

    setReferralShareOpen(true);
    setReferralShareBusy(true);

    try {
      const blob = await createReferralShareBlob();
      referralShareBlobRef.current = blob;
      if (referralShareUrl) URL.revokeObjectURL(referralShareUrl);
      setReferralShareUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Referral share image error:', error);
      setReferralShareOpen(false);
    } finally {
      setReferralShareBusy(false);
    }
  }

  function closeReferralShare() {
    setReferralShareOpen(false);
  }

  function downloadReferralShareImage() {
    const blob = referralShareBlobRef.current;
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai-trade-journal-invite-${referralCode || 'ref'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareReferralCard() {
    const blob = referralShareBlobRef.current;
    if (!blob || !referralCode) return;

    const inviteUrlObject = new URL('/?install=1', window.location.origin);
    inviteUrlObject.searchParams.set('ref', referralCode);
    const inviteUrl = inviteUrlObject.toString();
    const file = new File(
      [blob],
      `ai-trade-journal-invite-${referralCode}.png`,
      { type: 'image/png' },
    );

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: referralShareCopy.shareTitle,
          text: referralShareCopy.shareText,
          url: inviteUrl,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: referralShareCopy.shareTitle,
          text: referralShareCopy.shareText,
          url: inviteUrl,
        });
        downloadReferralShareImage();
        return;
      }

      try {
        await navigator.clipboard.writeText(inviteUrl);
      } catch {
        // Image download below remains a usable fallback.
      }
      downloadReferralShareImage();
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Referral native share error:', error);
        downloadReferralShareImage();
      }
    }
  }

  function createHistoryShareBlob() {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('CANVAS_UNAVAILABLE');

        const dark = !isLight;
        const background = dark ? '#08090b' : '#f7f8fa';
        const panel = dark ? '#111318' : '#ffffff';
        const panelSoft = dark ? '#15171d' : '#f3f5f7';
        const border = dark ? '#262a31' : '#e1e5e9';
        const textMain = dark ? '#f5f7fa' : '#17191d';
        const textMuted = dark ? '#8f96a3' : '#707783';
        const amber = '#f5b91f';
        const green = '#10b981';
        const red = '#ef4444';
        const periodText = getHistorySharePeriodText();
        const hasMixedCurrencies = historyCurrency === 'ALL' && historyByCurrency.length > 1;
        const sign = historyTotal >= 0 ? '+' : '−';
        const amount = hasMixedCurrencies
          ? historyShareCopy.mixedCurrencies
          : `${sign}${historyCurrencySymbol}${formatMoney(Math.abs(historyTotal))}`;
        const amountColor = hasMixedCurrencies ? amber : historyTotal >= 0 ? green : red;
        const wins = historyTrades.filter((item) => Number(item.pnl) >= 0).length;
        const losses = historyTrades.filter((item) => Number(item.pnl) < 0).length;
        const winrate = historyTrades.length ? Math.round((wins / historyTrades.length) * 100) : 0;
        const installUrlObject = new URL('/?install=1', window.location.origin);
        if (referralCode) installUrlObject.searchParams.set('ref', referralCode);
        const installUrl = installUrlObject.toString();

        const gradient = ctx.createLinearGradient(0, 0, 1080, 1350);
        if (dark) {
          gradient.addColorStop(0, '#090a0d');
          gradient.addColorStop(0.64, '#08090b');
          gradient.addColorStop(1, '#111007');
        } else {
          gradient.addColorStop(0, '#ffffff');
          gradient.addColorStop(0.66, '#f7f8fa');
          gradient.addColorStop(1, '#fff8e4');
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1080, 1350);

        const glow = ctx.createRadialGradient(930, 120, 0, 930, 120, 420);
        glow.addColorStop(0, dark ? 'rgba(245,185,31,.15)' : 'rgba(245,185,31,.12)');
        glow.addColorStop(1, 'rgba(245,185,31,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(500, 0, 580, 500);

        // Brand mark.
        roundedCanvasRect(ctx, 72, 72, 86, 86, 23);
        ctx.fillStyle = dark ? '#14171b' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = dark ? '#3b331a' : '#eadba8';
        ctx.lineWidth = 3;
        ctx.stroke();
        const tile = 27, gap = 7, startX = 84, startY = 84;
        [[0,0],[1,0],[0,1],[1,1]].forEach(([cx, cy], idx) => {
          roundedCanvasRect(ctx, startX + cx*(tile+gap), startY + cy*(tile+gap), tile, tile, 7);
          ctx.fillStyle = idx === 1 ? green : dark ? '#262a31' : '#e8ebef';
          ctx.fill();
        });

        ctx.fillStyle = textMain;
        ctx.font = '750 39px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText('AI Trade Journal', 188, 112);
        ctx.fillStyle = textMuted;
        ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        const productLine = traderMode
          ? `${historyShareCopy.myResults} · PRO`
          : `${resolveOnboardingLanguage(language) === 'ru' ? 'Денежный календарь' : historyShareCopy.myResults} · FREE`;
        ctx.fillText(productLine, 188, 148);

        // Hero result — one obvious focal point.
        roundedCanvasRect(ctx, 72, 225, 936, 380, 42);
        ctx.fillStyle = panel;
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = amber;
        ctx.font = '750 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(historyShareCopy.myResults.toUpperCase(), 120, 288);
        ctx.fillStyle = textMuted;
        ctx.font = '520 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(periodText, 120, 335);

        const amountSize = fitCanvasText(ctx, amount, 830, 92, 44, 780);
        ctx.font = `780 ${amountSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
        ctx.fillStyle = amountColor;
        ctx.fillText(amount, 120, 465);

        ctx.fillStyle = textMuted;
        ctx.font = '520 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(
          traderMode ? `${historyTrades.length} ${historyShareCopy.trades}` : `${historyTrades.length} ${historyShareCopy.records}`,
          120,
          535,
        );

        const cards = traderMode
          ? [
              [historyShareCopy.profitable, String(wins), green],
              [historyShareCopy.losing, String(losses), red],
              [historyShareCopy.winrate, `${winrate}%`, amber],
            ]
          : [
              [historyShareCopy.income, hasMixedCurrencies ? '—' : `+${historyCurrencySymbol}${formatMoneyShort(historyIncome)}`, green],
              [historyShareCopy.expense, hasMixedCurrencies ? '—' : `−${historyCurrencySymbol}${formatMoneyShort(historyExpense)}`, red],
              [historyShareCopy.records, String(historyTrades.length), amber],
            ];

        const cardY = 655, cardW = 292, cardH = 205, cardGap = 30;
        cards.forEach(([label, value, color], index) => {
          const x = 72 + index * (cardW + cardGap);
          roundedCanvasRect(ctx, x, cardY, cardW, cardH, 30);
          ctx.fillStyle = panelSoft;
          ctx.fill();
          ctx.strokeStyle = border;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = textMuted;
          ctx.font = '620 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
          ctx.fillText(label, x + 28, cardY + 58);
          const valueSize = fitCanvasText(ctx, value, cardW - 56, 43, 27, 760);
          ctx.font = `760 ${valueSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText(value, x + 28, cardY + 132);
        });

        // Viral install CTA + QR. No duplicate result block.
        roundedCanvasRect(ctx, 72, 925, 936, 310, 38);
        ctx.fillStyle = dark ? '#101216' : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = border;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = amber;
        ctx.font = '760 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(historyShareCopy.installCta.toUpperCase(), 116, 992);

        ctx.fillStyle = textMain;
        ctx.font = '760 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        drawWrappedCanvasText(
          ctx,
          historyShareCopy.viralTagline,
          116,
          1040,
          555,
          43,
          2,
        );

        ctx.fillStyle = textMuted;
        ctx.font = '520 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(historyShareCopy.scanToInstall, 116, 1138);

        if (referralCode) {
          roundedCanvasRect(ctx, 116, 1162, 520, 48, 15);
          ctx.fillStyle = dark ? 'rgba(245,185,31,.08)' : '#fff8df';
          ctx.fill();
          ctx.strokeStyle = dark ? 'rgba(245,185,31,.20)' : '#f0d36f';
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = amber;
          ctx.font = '760 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
          ctx.fillText(historyShareCopy.referralBonus, 136, 1193);
        }

        const qrMatrix = createQrMatrix(installUrl);
        roundedCanvasRect(ctx, 750, 955, 224, 224, 26);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        drawQrToCanvas(ctx, qrMatrix, 756, 961, 212, { quiet: 4, background: '#ffffff', foreground: '#111111' });

        let installHost = '';
        try { installHost = new URL(installUrl).host; } catch { installHost = 'AI Trade Journal'; }
        ctx.textAlign = 'center';
        ctx.fillStyle = textMuted;
        ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(installHost, 862, 1207);
        ctx.textAlign = 'left';

        ctx.fillStyle = amber;
        roundedCanvasRect(ctx, 72, 1280, 70, 5, 3);
        ctx.fill();
        ctx.fillStyle = textMuted;
        ctx.font = '620 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';
        ctx.fillText(traderMode ? 'PRO' : 'FREE', 158, 1288);
        ctx.textAlign = 'right';
        ctx.fillText(historyShareCopy.createdWith, 1008, 1288);
        ctx.textAlign = 'left';

        canvas.toBlob((blob) => {
          if (!blob) reject(new Error('IMAGE_EXPORT_FAILED'));
          else resolve(blob);
        }, 'image/png', 0.96);
      } catch (error) {
        reject(error);
      }
    });
  }

  async function openHistoryShare() {
    if (!historyTrades.length) return;
    setHistoryShareOpen(true);
    setHistoryShareBusy(true);
    try {
      const blob = await createHistoryShareBlob();
      historyShareBlobRef.current = blob;
      if (historyShareUrl) URL.revokeObjectURL(historyShareUrl);
      setHistoryShareUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error('Share image error:', error);
      setHistoryShareOpen(false);
    } finally {
      setHistoryShareBusy(false);
    }
  }

  function closeHistoryShare() {
    setHistoryShareOpen(false);
  }

  function downloadHistoryShareImage() {
    const blob = historyShareBlobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-trade-journal-results.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareHistoryResult() {
    const blob = historyShareBlobRef.current;
    if (!blob) return;

    const periodText = getHistorySharePeriodText();
    const hasMixedCurrencies = historyCurrency === 'ALL' && historyByCurrency.length > 1;
    const resultText = hasMixedCurrencies
      ? historyShareCopy.mixedCurrencies
      : `${historyTotal >= 0 ? '+' : '−'}${historyCurrencySymbol}${formatMoney(Math.abs(historyTotal))}`;

    const inviteUrlObject = new URL('/?install=1', window.location.origin);
    if (referralCode) inviteUrlObject.searchParams.set('ref', referralCode);
    const inviteUrl = inviteUrlObject.toString();

    const invitationLine = referralCode
      ? historyShareCopy.shareBonusLine
      : historyShareCopy.shareGenericLine;

    // Keep the URL inside the text as well as in the Web Share `url` field.
    // Some social targets preserve only one of them when an image file is attached.
    const shareText = [
      `${historyShareCopy.caption}: ${resultText} · ${periodText}`,
      '',
      historyShareCopy.shareInviteLine,
      invitationLine,
      inviteUrl,
    ].join('\n');

    const file = new File([blob], 'ai-trade-journal-results.png', { type: 'image/png' });

    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        await navigator.share({
          title: historyShareCopy.shareTitle,
          text: shareText,
          url: inviteUrl,
          files: [file],
        });
        return;
      }

      if (navigator.share) {
        await navigator.share({
          title: historyShareCopy.shareTitle,
          text: shareText,
          url: inviteUrl,
        });
        downloadHistoryShareImage();
        return;
      }

      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        // PNG download below remains the fallback.
      }
      downloadHistoryShareImage();
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Native share error:', error);
        try {
          await navigator.clipboard.writeText(shareText);
        } catch {
          // ignore clipboard failure
        }
        downloadHistoryShareImage();
      }
    }
  }

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
    // Every click moves one complete 7-day window, which reads naturally on mobile.
    end.setDate(end.getDate() - (freeTimelineOffset * 7));
    const points = [];
    for (let i = 6; i >= 0; i -= 1) {
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

  const renderHistoryCategoryPicker = (className = '') => {
    const ActiveIcon = historyNameFilter ? getHistoryCategoryIcon(historyNameFilter) : CircleDollarSign;
    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setHistoryCategoryMenuOpen((open) => !open)}
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors ${
            isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-amber-400/50' : 'border-zinc-800 bg-black/20 text-zinc-200 hover:border-amber-400/35'
          }`}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${
            isLight
              ? 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white text-amber-600 shadow-sm'
              : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.10] to-zinc-950 text-amber-400'
          }`}>
            <ActiveIcon className="h-4 w-4 stroke-[1.8]" />
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-data">{historyNameFilter || t('all')}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform ${historyCategoryMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {historyCategoryMenuOpen && (
          <div className={`absolute left-0 top-full z-40 mt-2 w-full min-w-[210px] overflow-hidden rounded-2xl border p-1.5 shadow-2xl ${
            isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'
          }`}>
            <div className="max-h-64 overflow-y-auto pr-1">
              {[{ name: '', Icon: CircleDollarSign, label: t('all') }, ...historyNameOptions.map((name) => ({ name, Icon: getHistoryCategoryIcon(name), label: name }))].map(({ name, Icon, label }) => {
                const active = historyNameFilter === name;
                return (
                  <button
                    key={name || '__all__'}
                    type="button"
                    onClick={() => { setHistoryNameFilter(name); setHistoryCategoryMenuOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors ${
                      active
                        ? 'bg-amber-400/12 text-amber-600'
                        : isLight ? 'text-zinc-700 hover:bg-zinc-50' : 'text-zinc-300 hover:bg-zinc-900'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      active
                        ? 'border-amber-400/25 bg-amber-400/[0.12] text-amber-600'
                        : isLight
                          ? 'border-zinc-200 bg-white text-zinc-500 shadow-sm'
                          : 'border-white/[0.06] bg-white/[0.03] text-zinc-400'
                    }`}>
                      <Icon className="h-4 w-4 stroke-[1.8]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  function openHistory() {
    setHistoryOpen(true);
    setHistoryVisible(true);
    setHistoryFiltersOpen(false);
    setProFiltersOpen(false);
    setProHistoryTab('overview');
    setConfirmingClear(false);
    setHistoryAnalysisOpen(false);
    setFreeHistoryPanel(null);
    setFreeTimelineSelected(null);
    setFreeTimelineOffset(0);
  }

  function closeHistory() {
    setHistoryVisible(false);
    setHistoryFiltersOpen(false);
    setProFiltersOpen(false);
    setConfirmingClear(false);
    setTimeout(() => setHistoryOpen(false), 180);
  }

  function editTradeFromHistory(trade) {
    setHistoryVisible(false);
    setHistoryOpen(false);
    setHistoryFiltersOpen(false);
    setHistoryCategoryMenuOpen(false);
    openModal(trade, trade.dateKey);
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
    const range = (exportPeriodPreset === 'currentPeriod' || exportPeriodPreset === 'Текущий период')
      ? { from: dateFrom, to: dateTo }
      : getPresetRange(exportPeriodPreset, today);
    return Object.entries(manualTrades)
      .flatMap(([dateKey, arr]) => (arr || []).map((item) => ({ ...item, dateKey })))
      .filter((item) => item.dateKey >= range.from && item.dateKey <= range.to)
      .filter((item) => historyCurrency === 'ALL' || (item.currency || 'USD') === historyCurrency)
      .filter((item) => historyWinLoss === 'all' || (historyWinLoss === 'win' ? item.pnl >= 0 : item.pnl < 0));
  }, [manualTrades, exportPeriodPreset, dateFrom, dateTo, today, historyCurrency, historyWinLoss]);

  function handleExportCsv() {
    const range = (exportPeriodPreset === 'currentPeriod' || exportPeriodPreset === 'Текущий период')
      ? { from: dateFrom, to: dateTo }
      : getPresetRange(exportPeriodPreset, today);
    const title = `${traderMode ? 'AI Trade Journal' : t('titleMoney')} — ${t('csvPeriodTitle')}`;
    const periodLabel = `${formatDateLabel(range.from)} — ${formatDateLabel(range.to)}`;
    const rows = exportTrades.map((item) => [
      formatDateLabel(item.dateKey),
      item.time || '',
      item.instrument || (traderMode ? 'Trade' : t('catOther')),
      item.pnl >= 0 ? (traderMode ? t('profitTrade') : t('income')) : (traderMode ? t('lossTrade') : t('expense')),
      formatAmountInCurrency(item.pnl, item.currency || 'USD'),
      item.comment || '',
    ]);
    const totalIncome = exportTrades.reduce((sum, item) => sum + (item.pnl > 0 ? item.pnl : 0), 0);
    const totalExpense = exportTrades.reduce((sum, item) => sum + (item.pnl < 0 ? Math.abs(item.pnl) : 0), 0);
    const currencyMeta = historyCurrency === 'ALL' ? null : getCurrencyMeta(historyCurrency);
    const summary = currencyMeta ? [
      [],
      [t('csvPeriodSummary')],
      [t('income'), `+${currencyMeta.symbol}${formatMoney(totalIncome)}`],
      [t('expense'), `−${currencyMeta.symbol}${formatMoney(totalExpense)}`],
      [t('balanceLabel'), `${totalIncome - totalExpense >= 0 ? '+' : '−'}${currencyMeta.symbol}${formatMoney(Math.abs(totalIncome - totalExpense))}`]
    ] : [];
    const csvRows = [
      [title],
      [`${t('currentPeriod')}: ${periodLabel}`],
      [],
      [t('csvDate'), t('csvTime'), t('csvCategory'), t('csvType'), t('csvAmount'), t('csvComment')],
      ...rows,
      ...summary
    ];
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
    try {
      const input = window.prompt('Размер депозита для расчёта %:', depositSize > 0 ? String(depositSize) : '1000');
      if (!input) return;
      const value = parseFloat(input);
      if (Number.isNaN(value) || value <= 0) return;
      setDepositSize(value);
    } catch (e) {
      console.warn('[AI Trade Journal] prompt not available:', e);
    }
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
        /* Premium light theme — stronger hierarchy and readable contrast */
        .theme-light.premium-shell {
          background-color: #f3f6fa;
          background-image:
            radial-gradient(circle at 10% -10%, rgba(245,185,31,.10), transparent 30%),
            radial-gradient(circle at 92% 0%, rgba(59,130,246,.045), transparent 24%);
        }
        .theme-light .bg-zinc-950,
        .theme-light .bg-zinc-900 { background-color: #ffffff !important; }
        .theme-light .bg-zinc-800 { background-color: #eef2f7 !important; }
        .theme-light .bg-zinc-100 { background-color: #f3f6fa !important; }
        .theme-light .bg-zinc-50 { background-color: #f8fafc !important; }
        .theme-light .bg-white { background-color: #ffffff !important; }
        .theme-light .text-zinc-50,
        .theme-light .text-zinc-100 { color: #0b1220 !important; }
        .theme-light .text-zinc-200 { color: #172033 !important; }
        .theme-light .text-zinc-300 { color: #263449 !important; }
        .theme-light .text-zinc-400 { color: #475569 !important; }
        .theme-light .text-zinc-500 { color: #526071 !important; }
        .theme-light .text-zinc-600 { color: #334155 !important; }
        .theme-light .text-zinc-700 { color: #1f2a3b !important; }
        .theme-light .border-zinc-800,
        .theme-light .border-zinc-700 { border-color: #d6dee9 !important; }
        .theme-light .border-zinc-200 { border-color: #d9e1eb !important; }
        .theme-light .border-zinc-300 { border-color: #cbd5e1 !important; }

        /* PRO history has its own clean, premium hierarchy. */
        .pro-history-premium > section,
        .pro-history-premium .pro-premium-card {
          border-radius: 22px;
        }
        .theme-light .pro-history-premium > section,
        .theme-light .pro-history-premium .pro-premium-card {
          border-color: #d9e1eb !important;
          background: #ffffff !important;
          box-shadow: 0 12px 34px rgba(15,23,42,.065);
        }
        .theme-light .pro-history-premium > section .opacity-50,
        .theme-light .pro-history-premium > section .opacity-60 {
          opacity: .78 !important;
        }
        .theme-light .pro-history-premium > section h3 {
          color: #111827 !important;
        }
        .theme-light .pro-history-premium select,
        .theme-light .pro-history-premium input[type="range"] {
          color: #172033;
        }

        /* Extra light-theme contrast for glassy/low-opacity surfaces. */
        .theme-light .bg-white\/\[0\.025\],
        .theme-light .bg-white\/\[0\.02\],
        .theme-light .bg-white\/\[0\.035\],
        .theme-light .bg-white\/\[0\.04\],
        .theme-light .bg-white\/\[0\.045\] {
          background-color: #ffffff !important;
        }
        .theme-light .bg-black\/20,
        .theme-light .bg-black\/10,
        .theme-light .bg-black\/15 {
          background-color: #f4f7fb !important;
        }
        .theme-light .pro-history-premium .text-zinc-500 {
          color: #475569 !important;
        }
        .theme-light .pro-history-premium .text-zinc-400 {
          color: #334155 !important;
        }
        .theme-light .pro-history-premium .border-white\/\[0\.06\],
        .theme-light .pro-history-premium .border-white\/\[0\.07\],
        .theme-light .pro-history-premium .border-white\/\[0\.08\] {
          border-color: #d7e0ea !important;
        }
        /* Clean scrollbars */
        * { scrollbar-width: thin; scrollbar-color: #52525b transparent; }
        *::-webkit-scrollbar { height: 6px; width: 6px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: #52525b; border-radius: 9999px; }
        .theme-light *::-webkit-scrollbar-thumb { background-color: #cbd5e1; }
        .theme-light { scrollbar-color: #cbd5e1 transparent; }
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
        .day-amount { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
        .day-amount-short, .day-amount-full { min-width: 0; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pro-calendar-day .day-amount { position: absolute; left: 8px; right: 8px; bottom: 8px; transition: bottom .24s ease, transform .24s ease; }
        .pro-calendar-day .day-amount-full { display: none; }
        @media (min-width: 640px) { .pro-calendar-day .day-amount { left: 14px; right: 14px; bottom: 14px; } }
        @media (hover: hover) and (pointer: fine) {
          .pro-calendar-day:hover { z-index: 2; }
          .pro-calendar-day:hover .day-amount { bottom: 50%; transform: translateY(50%); text-align: center; font-size: clamp(12px, 1.25vw, 20px); }
          .pro-calendar-day:hover .day-amount-short { display: none; }
          .pro-calendar-day:hover .day-amount-full { display: block; overflow: hidden; text-overflow: ellipsis; }
        }
        @media (prefers-reduced-motion: reduce) { .pro-calendar-day .day-amount { transition: none; } }
        @keyframes premiumFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .premium-shell { min-height: 100dvh; }
        /* Reserve the dock's space in the scrollable calendar, including iOS's home indicator. */
        .calendar-section { padding-bottom: calc(112px + env(safe-area-inset-bottom, 0px)); }
        .history-fab { bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
        .premium-shell { font-size: 15px; }
        .premium-shell .font-data { letter-spacing: .055em; }
        @media (max-width: 640px) { .premium-shell { font-size: 16px; } .premium-shell p, .premium-shell button { -webkit-font-smoothing: antialiased; } }
        @keyframes proEmber { 0%,100% { opacity:.55; transform:scale(.85) } 50% { opacity:1; transform:scale(1.15) } }
        .pro-ember { animation: proEmber 1.8s ease-in-out infinite; }
        @keyframes slideInNext { 0% { opacity: .12; transform: translateX(36px) scale(.985); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
        @keyframes slideInPrev { 0% { opacity: .12; transform: translateX(-36px) scale(.985); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
        .animate-slide-next { animation: slideInNext 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .animate-slide-prev { animation: slideInPrev 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation-duration:.01ms !important; transition-duration:.01ms !important; } }
        @media (max-width: 639px) {
          .calendar-days-grid { flex: 1 0 auto; grid-auto-rows: minmax(76px, 1fr); }
        }
      `}</style>

      {/* HEADER */}
      {ctraderNotice?.kind === 'success' && (
        <div role="status" aria-live="polite" className={`fixed bottom-24 left-4 right-4 sm:left-auto sm:w-96 z-[200] rounded-2xl border p-5 shadow-xl ${isLight ? 'bg-white text-zinc-900 border-zinc-200' : 'bg-zinc-900 text-zinc-100 border-zinc-700'}`}>
          <button aria-label={t('ctClose')} onClick={() => setCtraderNotice(null)} className="absolute right-2 top-2 p-2"><X className="h-4 w-4" /></button>
          <>
            <div className="flex items-center gap-2 pr-5 font-semibold"><CheckCircle2 className="h-5 w-5 text-emerald-500" />{ctraderNotice.inserted === 0 ? t('ctNoNew') : `${t('ctAdded')}${ctraderNotice.inserted}`}</div>
            <p className="mt-2 text-sm opacity-80">{t(ctraderNotice.refreshed ? 'ctUpdated' : 'ctRefresh')}</p>
            {ctraderNotice.skipped > 0 && <p className="mt-1 text-xs opacity-60">{t('ctSkipped')}{ctraderNotice.skipped}</p>}
            {ctraderNotice.refreshed && <button className="mt-3 text-sm font-semibold text-emerald-600" onClick={() => { closeConnectModal(); handlePresetChange('Вся история'); setPlatformFilter('ALL'); setHistoryCurrency('ALL'); setHistoryNameFilter(''); setHistoryWinLoss('all'); setHistoryOpen(true); setCtraderNotice(null); }}>{t('ctHistory')}</button>}
            {ctraderNotice.refreshed && <button className="mt-3 block text-sm font-semibold text-amber-600" onClick={showImportedCalendar}>{t('ctCalendar')}</button>}
          </>
        </div>
      )}
      <Header
        monthSummary={monthSummary}
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
        platformFilter={platformFilter} platformOptions={['ALL', 'cTrader']}
        calendarTypeFilter={calendarTypeFilter} setCalendarTypeFilter={setCalendarTypeFilter}
        openConnectModal={openConnectModal} ctraderConnected={ctraderConnected}
        installInfoRef={installInfoRef} handleInstallClick={handleInstallClick}
        pendingSyncCount={pendingSyncCount} installInfoOpen={installInfoOpen} installInstructions={installInstructions} isPwaInstalled={isPwaInstalled}
        proAccessActive={proAccessActive} proAccessLoading={proAccessLoading} proAccessUntil={proAccessUntil}
        openReferralHub={openReferralHub} invitedCount={invitedCount} referralLabel={proAccessCopy.invitesTab}
        periodStats={periodStats} periodTrades={periodTrades} currencySymbol={currencySymbol} formatMoney={formatMoney}
      />

      <div className="px-3 sm:px-5">
        <MonthlyGoal
          year={year}
          month={month}
          currency={currency}
          currencySymbol={currencySymbol}
          currentPnl={monthSummary.total}
          language={language}
          isLight={isLight}
          userId={validUserId}
        />
      </div>

      {/* PRO controls live in Header: one clean control center, no floating duplicate block. */}
      <CalendarGrid
        notes={calendarNotes} noteLabel={t('calendarDayNote')}
        traderMode={traderMode}
        onNextMonth={goToNextMonth}
        onPreviousMonth={goToPrevMonth}
        key={`${year}-${month}-${animKey}`}
        slideDirection={slideDirection}
        cells={cells} selectedKey={selectedKey} isLight={isLight} monthMaxAbsPnl={monthMaxAbsPnl}
        tradesForDayFiltered={tradesForDayFiltered} totalPnlForDay={totalPnlForDay}
        formatPnlDisplay={formatPnlDisplay} onSelectDay={(dateKey) => {
          if (firstRunGuideStep === 1 && dateKey === todayKey && !traderMode) {
            setFirstRunGuideStep(2);
            openModal(null, todayKey);
            return;
          }
          setSelectedKey(dateKey);
        }}
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

      {firstRunGuideStep === 1 && !traderMode && (
        <>
          <style>{`
            [data-today-cell="true"] {
              position: relative !important;
              border-color: rgba(251,191,36,.98) !important;
              box-shadow: 0 0 0 3px rgba(251,191,36,.24), 0 0 38px rgba(245,158,11,.42) !important;
              animation: firstRunGuidePulse 1.35s ease-in-out infinite !important;
              z-index: 31 !important;
            }
            @keyframes firstRunGuidePulse {
              0%,100% { transform: scale(1); }
              50% { transform: scale(1.045); }
            }
            @media (prefers-reduced-motion: reduce) {
              [data-today-cell="true"] { animation: none !important; }
            }
          `}</style>
          <div className="pointer-events-none fixed inset-0 z-[24] bg-black/30 backdrop-blur-[1px]" />
          <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex justify-center px-4 sm:bottom-8">
            <div className={`pointer-events-auto w-full max-w-sm rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${
              isLight ? 'border-amber-200 bg-white/95 text-zinc-900' : 'border-amber-400/25 bg-zinc-950/95 text-zinc-100'
            }`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-400 text-zinc-950">
                  <Calendar className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{onboardingCopy.guideTapToday}</p>
                  <p className={`mt-1 text-xs leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{onboardingCopy.guideTapTodayHint}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={markFirstRunGuideComplete}
                className={`mt-3 w-full rounded-xl px-3 py-2 text-xs transition-colors ${isLight ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-500 hover:bg-zinc-900'}`}
              >
                {onboardingCopy.guideSkip}
              </button>
            </div>
          </div>
        </>
      )}

      {firstRunGuideStep === 3 && (
        <>
          <style>{`
            [data-today-cell="true"] {
              animation: firstRunGuideSuccess 900ms ease-out 1 !important;
            }
            @keyframes firstRunGuideSuccess {
              0% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); }
              55% { box-shadow: 0 0 0 8px rgba(16,185,129,.12), 0 0 34px rgba(16,185,129,.28); }
              100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
            }
          `}</style>
          <div className="fixed inset-x-0 bottom-5 z-[95] flex justify-center px-4 sm:bottom-8">
            <div className={`w-full max-w-sm rounded-2xl border px-4 py-4 shadow-2xl ${
              isLight ? 'border-emerald-200 bg-white text-zinc-800' : 'border-emerald-500/20 bg-zinc-950 text-zinc-100'
            }`}>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
                <p className="text-sm font-medium leading-snug">{onboardingCopy.guideSuccess}</p>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedKey(todayKey); setFirstRunGuideStep(4); }}
                  className="flex-1 rounded-xl bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-400"
                >
                  {onboardingCopy.guideMore}
                </button>
                <button
                  type="button"
                  onClick={markFirstRunGuideComplete}
                  className={`rounded-xl px-3 py-2.5 text-xs ${isLight ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-900 text-zinc-400'}`}
                >
                  {onboardingCopy.guideSkip}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {firstRunGuideStep === 4 && !traderMode && (
        <div className="fixed inset-x-0 bottom-5 z-[95] flex justify-center px-4 sm:bottom-8">
          <div className={`w-full max-w-sm rounded-2xl border p-4 shadow-2xl ${
            isLight ? 'border-amber-200 bg-white text-zinc-900' : 'border-amber-400/20 bg-zinc-950 text-zinc-100'
          }`}>
            <p className="text-sm font-semibold">{onboardingCopy.guideDayTip}</p>
            <p className={`mt-1 text-xs leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{onboardingCopy.guideDayTipHint}</p>
            <button
              type="button"
              onClick={markFirstRunGuideComplete}
              className="mt-3 w-full rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-amber-300"
            >
              {onboardingCopy.guideDone}
            </button>
          </div>
        </div>
      )}

      {/* DAY VIEW — bottom sheet, tap the dimmed backdrop anywhere to return to the calendar */}
      {selectedKey && (
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onMouseDown={handleBackdropMouseDown}
        onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) setSelectedKey(null); }}
      >
      <div
        className={`absolute inset-x-0 bottom-0 max-h-[82vh] rounded-t-2xl border-t shadow-2xl overflow-y-auto transition-colors duration-200 ${isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-950'}`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          if (e.target.closest('button, input, textarea, select, a, label, summary, [role="button"], [contenteditable="true"]')) return;
          if (window.getSelection()?.toString()) return;
          e.stopPropagation();
          setSelectedKey(null);
        }}
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

          <div className="flex items-center self-start">
            <button
              onClick={() => openModal()}
              disabled={isFutureSelected}
              title={isFutureSelected ? (traderMode ? 'Нельзя добавить сделку на будущую дату' : t('recordFutureBlocked')) : undefined}
              className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 px-4 py-2.5 text-xs sm:text-sm font-bold text-zinc-950 shadow-md shadow-amber-500/25 hover:shadow-lg hover:shadow-amber-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 transition-transform duration-200 group-hover:rotate-90">
                <Plus className="h-3.5 w-3.5 stroke-[3] text-zinc-950" />
              </span>
              <span>{traderMode ? t('addTrade') : t('addRecord')}</span>
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

          {traderMode && <DayNote key={`${validUserId || 'guest'}:${selectedKey}`} userId={validUserId} dateKey={selectedKey} isLight={isLight} language={language} onLogin={handleGoogleLogin} onSaved={() => setNotesRevision(v => v + 1)} />}

          {selectedDayTrades.length > 0 ? (
            <div className={`rounded-lg border divide-y ${isLight ? 'border-zinc-300 bg-zinc-50 divide-zinc-200' : 'border-zinc-800 bg-zinc-900 divide-zinc-800'}`}>
              {selectedDayTrades.map((trade) => (
                <div key={trade.id} className="px-4 py-3 group">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4 min-w-0 flex-wrap">
                      <span className={`font-data text-xs w-12 shrink-0 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>{trade.time}</span>
                      <span className={`text-sm font-medium truncate ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{trade.instrument}</span>
                      <span
                        className={[
                          'font-data text-[11px] tracking-wider px-2 py-0.5 rounded-full shrink-0',
                          trade.pnl >= 0
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-red-500/10 text-red-500',
                        ].join(' ')}
                      >
                        {trade.pnl >= 0 ? (traderMode ? 'Прибыль' : 'Доход') : (traderMode ? 'Убыток' : 'Расход')}
                      </span>
                      <span className={`font-data text-[10px] shrink-0 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{trade.platform}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`font-data text-sm font-medium whitespace-nowrap tabular-nums ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {formatAmountInCurrency(trade.pnl, trade.currency || 'USD')}
                      </span>
                      <button
                        onClick={() => openModal(trade)}
                        className={`grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-xl transition-colors sm:opacity-0 sm:group-hover:opacity-100 ${
                          isLight ? 'bg-zinc-100 text-zinc-500 hover:text-amber-600' : 'bg-white/[0.05] text-zinc-500 hover:text-amber-400'
                        }`}
                        aria-label={traderMode ? 'Редактировать сделку' : t('editRecord')}
                        title={traderMode ? 'Редактировать сделку' : t('editRecord')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrade(trade.dateKey, trade.id)}
                        className={`grid h-10 w-10 sm:h-8 sm:w-8 place-items-center rounded-xl transition-colors sm:opacity-0 sm:group-hover:opacity-100 ${
                          isLight ? 'bg-zinc-100 text-zinc-500 hover:text-red-500' : 'bg-white/[0.05] text-zinc-500 hover:text-red-400'
                        }`}
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
                <p className={`text-sm ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{traderMode ? t('noTradesDay') : t('noRecordsDay')}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
      )}

      {/* Floating Action Dock: Prominent Center "+" Add Button + History */}
      <div className="history-fab fixed inset-x-0 flex justify-center items-center z-30 pointer-events-none px-4">
        <div className={`pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 rounded-full border p-1.5 sm:p-2 backdrop-blur-2xl transition-all duration-300 ${
          isLight
            ? 'border-zinc-200/90 bg-white/95 shadow-[0_16px_45px_rgba(0,0,0,0.14)]'
            : 'border-zinc-800/90 bg-zinc-950/90 shadow-[0_16px_50px_rgba(0,0,0,0.45)]'
        }`}>
          {/* History Button */}
          <button
            type="button"
            onClick={openHistory}
            className={`group flex items-center gap-2 rounded-full px-3.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 ${
              isLight
                ? 'text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100/80'
                : 'text-zinc-300 hover:text-white hover:bg-zinc-900/90'
            }`}
          >
            <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-amber-400/10 transition-colors group-hover:bg-amber-400/20">
              <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500 transition-transform duration-200 group-hover:-rotate-12" />
            </span>
            <span className="relative font-medium">{t('history')}{traderMode && <span className="ml-1 text-amber-400">✦</span>}</span>
          </button>

          {/* Central Add '+' Button — sleek, elegant, calm */}
          <button
            type="button"
            onClick={() => openModal()}
            title={traderMode ? t('addTrade') : t('addRecord')}
            aria-label={traderMode ? t('addTrade') : t('addRecord')}
            className={`group relative flex items-center gap-2 rounded-full px-4 sm:px-5 py-2 sm:py-2.5 font-medium transition-all duration-200 active:scale-[0.97] border ${
              isLight
                ? 'border-slate-800 bg-slate-900 text-white hover:bg-slate-800 shadow-sm'
                : 'border-zinc-700/80 bg-zinc-900 text-zinc-100 hover:border-amber-400/50 hover:bg-zinc-800 shadow-sm'
            }`}
          >
            <span className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full transition-transform duration-200 group-hover:rotate-90 ${
              isLight ? 'bg-white/15 text-amber-300' : 'bg-amber-400/15 text-amber-400'
            }`}>
              <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[2.5]" />
            </span>
            <span className="text-xs sm:text-sm font-semibold tracking-tight">
              {traderMode ? t('addTrade') : t('addRecord')}
            </span>
          </button>
        </div>
      </div>

      {/* HISTORY MODAL — улучшен визуал для светлой темы + кнопка синхронизации cTrader */}
      {historyOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-0 pt-10 sm:items-center sm:px-4 sm:pt-0 transition-opacity duration-300 ${
            historyVisible ? 'opacity-100' : 'opacity-0'
          }`}
          onMouseDown={handleBackdropMouseDown}
          onClick={(e) => { if (e.target === e.currentTarget && mouseDownOnBackdrop.current) closeHistory(); }}
        >
          <div
            className={`relative w-full ${traderMode ? 'sm:max-w-5xl' : 'sm:max-w-lg'} flex flex-col overflow-hidden rounded-t-[28px] border shadow-2xl transition-all duration-300 ease-out sm:rounded-[24px] ${
              historyVisible
                ? 'opacity-100 translate-y-0 sm:scale-100'
                : 'opacity-0 translate-y-full sm:translate-y-0 sm:scale-95'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
            style={{ maxHeight: 'min(92dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 8px))' }}
          >
            <div className="flex shrink-0 justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className={`h-1 w-11 rounded-full ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            </div>
            <div className={`flex items-center justify-between px-5 sm:px-6 pt-3.5 sm:pt-5 pb-4 border-b ${isLight ? 'border-zinc-200' : 'border-zinc-800/80'}`}>
              <div>
                <p className="font-data text-[10px] tracking-[0.22em] text-amber-400 uppercase mb-1">
                  {traderMode ? t('tradesHistory') : t('myMoney')}
                </p>
                <h2 className={`font-display text-xl font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>
                  {traderMode
                    ? (periodPreset === 'Вся история' ? t('allHistory') : dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`)
                    : t('financialHistory')}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={openHistoryShare}
                  disabled={historyTrades.length === 0}
                  className={`group inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-35 ${
                    isLight
                      ? 'border-zinc-200 bg-white text-zinc-600 shadow-sm hover:border-amber-300 hover:text-amber-700'
                      : 'border-white/[0.08] bg-white/[0.035] text-zinc-300 hover:border-amber-400/25 hover:text-amber-300'
                  }`}
                  aria-label={historyShareCopy.share}
                  title={historyShareCopy.share}
                >
                  <Share2 className="h-4 w-4 stroke-[1.8] transition-transform group-hover:-translate-y-0.5" />
                  <span className="hidden sm:inline">{historyShareCopy.share}</span>
                </button>
                <button
                  onClick={closeHistory}
                  className={`grid h-10 w-10 place-items-center rounded-xl border transition-colors ${
                    isLight
                      ? 'border-zinc-200 bg-white text-zinc-500 shadow-sm hover:bg-zinc-100 hover:text-zinc-800'
                      : 'border-white/[0.08] bg-white/[0.035] text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200'
                  }`}
                  aria-label={t('close')}
                >
                  <X className="h-4 w-4 stroke-[1.8]" />
                </button>
              </div>
            </div>

            {traderMode && (
              <div className={`shrink-0 border-b px-4 py-3 sm:px-6 ${
                isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-950'
              }`}>
                <div className={`grid grid-cols-3 rounded-xl p-1 ${
                  isLight ? 'bg-slate-100' : 'bg-white/[0.045]'
                }`}>
                  {[
                    ['overview', proHistoryCopy.overview],
                    ['analytics', proHistoryCopy.analytics],
                    ['trades', proHistoryCopy.trades],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setProHistoryTab(key)}
                      className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-all duration-200 ${
                        proHistoryTab === key
                          ? isLight
                            ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200'
                            : 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/[0.06]'
                          : isLight
                            ? 'text-slate-500 hover:text-slate-900'
                            : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                    isLight ? 'text-slate-500' : 'text-zinc-500'
                  }`}>
                    {proAccessCopy.currencyTitle}
                  </p>
                  <p className={`mt-0.5 text-[10px] leading-4 ${
                    isLight ? 'text-slate-500' : 'text-zinc-600'
                  }`}>
                    {historyCurrency === 'ALL' && historyByCurrency.length > 1
                      ? proAccessCopy.mixedCurrencyHint
                      : proAccessCopy.currencyHint}
                  </p>
                </div>

                <div className={`inline-flex shrink-0 gap-1 rounded-xl border p-1 ${
                  isLight
                    ? 'border-slate-200 bg-slate-100'
                    : 'border-white/[0.07] bg-white/[0.035]'
                }`}>
                  {[{ code: 'ALL', symbol: t('all'), label: t('allCurrencies') }, ...CURRENCIES].map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => setHistoryCurrency(c.code)}
                      title={c.label || c.code}
                      className={`rounded-lg px-2.5 py-1.5 text-[10px] font-data transition-all ${
                        historyCurrency === c.code
                          ? isLight
                            ? 'bg-white text-amber-700 shadow-sm ring-1 ring-amber-300/70'
                            : 'bg-amber-400/15 text-amber-400 ring-1 ring-amber-400/20'
                          : isLight
                            ? 'text-slate-600 hover:bg-white hover:text-slate-950'
                            : 'text-zinc-500 hover:text-zinc-200'
                      }`}
                    >
                      {c.symbol}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            )}

            <div
              ref={historyScrollRef}
              onScroll={handleHistoryScroll}
              className={`overflow-y-auto px-4 py-5 sm:px-7 sm:py-6 flex-1 min-h-0 ${
                traderMode ? 'pro-history-premium' : ''
              } ${isLight ? 'bg-[#f5f7fa]' : ''}`}
              style={{ overscrollBehavior: 'contain' }}
            >
              {/* FREE — История сначала, аналитика по запросу */}
              {!traderMode && (
                <section className="mb-4">
                  <div className={`grid grid-cols-2 gap-2 rounded-2xl border p-1.5 ${
                    isLight ? 'border-zinc-200 bg-zinc-100/70' : 'border-zinc-800 bg-black/20'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setFreeHistoryPanel((panel) => panel === 'dynamics' ? null : 'dynamics')}
                      aria-expanded={freeHistoryPanel === 'dynamics'}
                      className={`min-h-12 rounded-xl px-3 py-2.5 text-left transition-all ${
                        freeHistoryPanel === 'dynamics'
                          ? isLight
                            ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200'
                            : 'bg-zinc-900 text-zinc-100 shadow-sm ring-1 ring-white/10'
                          : isLight
                            ? 'text-zinc-600 hover:bg-white/65'
                            : 'text-zinc-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                          freeHistoryPanel === 'dynamics'
                            ? 'border-amber-400/20 bg-amber-400/[0.10] text-amber-500'
                            : isLight ? 'border-zinc-200 bg-white text-zinc-500' : 'border-white/[0.06] bg-white/[0.03] text-zinc-500'
                        }`}>
                          <TrendingUp className="h-3.5 w-3.5 stroke-[1.8]" />
                        </span>
                        <span className="text-xs font-semibold">{t('freeDynamicsBtn')}</span>
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${freeHistoryPanel === 'dynamics' ? 'rotate-180' : ''}`} />
                      </span>
                      <span className="mt-1 block truncate font-data text-[9px] text-zinc-500">
                        {historyTimeline.from} — {historyTimeline.to}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFreeHistoryPanel((panel) => panel === 'analysis' ? null : 'analysis')}
                      aria-expanded={freeHistoryPanel === 'analysis'}
                      disabled={historyTrades.length === 0}
                      className={`min-h-12 rounded-xl px-3 py-2.5 text-left transition-all disabled:opacity-40 ${
                        freeHistoryPanel === 'analysis'
                          ? isLight
                            ? 'bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200'
                            : 'bg-zinc-900 text-zinc-100 shadow-sm ring-1 ring-white/10'
                          : isLight
                            ? 'text-zinc-600 hover:bg-white/65'
                            : 'text-zinc-400 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${
                          freeHistoryPanel === 'analysis'
                            ? 'border-amber-400/20 bg-amber-400/[0.10] text-amber-500'
                            : isLight ? 'border-zinc-200 bg-white text-zinc-500' : 'border-white/[0.06] bg-white/[0.03] text-zinc-500'
                        }`}>
                          <Wallet className="h-3.5 w-3.5 stroke-[1.8]" />
                        </span>
                        <span className="text-xs font-semibold">{t('freeAnalysisTitle')}</span>
                        <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${freeHistoryPanel === 'analysis' ? 'rotate-180' : ''}`} />
                      </span>
                      <span className="mt-1 block truncate font-data text-[9px] text-zinc-500">
                        {historyTrades.length} {t('records')}
                      </span>
                    </button>
                  </div>

                  {freeHistoryPanel === 'dynamics' && (
                    <div className={`mt-2 overflow-hidden rounded-2xl border p-3.5 sm:p-5 ${
                      isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-950/70'
                    }`}>
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <p className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{t('freeDynamicsBtn')}</p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">{historyTimeline.from} — {historyTimeline.to}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={t('earlier')}
                            onClick={() => setFreeTimelineOffset((v) => v + 1)}
                            className={`grid h-9 w-9 place-items-center rounded-full border text-sm transition-colors ${
                              isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-600 active:bg-zinc-100' : 'border-zinc-800 bg-zinc-900 text-zinc-400 active:bg-zinc-800'
                            }`}
                          >
                            ←
                          </button>
                          <button
                            type="button"
                            aria-label={t('later')}
                            disabled={freeTimelineOffset === 0}
                            onClick={() => setFreeTimelineOffset((v) => Math.max(0, v - 1))}
                            className={`grid h-9 w-9 place-items-center rounded-full border text-sm transition-colors disabled:opacity-25 ${
                              isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-600 active:bg-zinc-100' : 'border-zinc-800 bg-zinc-900 text-zinc-400 active:bg-zinc-800'
                            }`}
                          >
                            →
                          </button>
                        </div>
                      </div>

                      <div className="mb-3 flex items-center gap-3 text-[10px]">
                        <span className="inline-flex items-center gap-1.5 text-zinc-500"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t('incomeLabel')}</span>
                        <span className="inline-flex items-center gap-1.5 text-zinc-500"><span className="h-2 w-2 rounded-full bg-red-400" />{t('expenseLabel')}</span>
                        <span className="ml-auto text-zinc-500">{t('clickColumnHint')}</span>
                      </div>

                      {historyCurrency === 'ALL' && (
                        <p className="mb-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-relaxed text-zinc-500">
                          {t('allCurrenciesNotice')}
                        </p>
                      )}

                      <div className={`rounded-2xl border px-2.5 pt-3 pb-2 ${
                        isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-white/[0.06] bg-black/20'
                      }`}>
                        <div className="grid h-40 grid-cols-7 items-end gap-1 sm:h-44 sm:gap-2">
                          {historyTimeline.points.map((point) => {
                            const incomeH = point.income ? Math.max(8, Math.round((point.income / historyTimeline.max) * 100)) : 2;
                            const expenseH = point.expense ? Math.max(8, Math.round((point.expense / historyTimeline.max) * 100)) : 2;
                            const active = point.income || point.expense;
                            const selected = freeTimelineSelected === point.key;
                            return (
                              <button
                                type="button"
                                key={point.key}
                                onClick={() => setFreeTimelineSelected(selected ? null : point.key)}
                                className={`group flex h-full min-w-0 flex-col justify-end rounded-xl px-0.5 pb-1 pt-1.5 transition-all ${
                                  selected
                                    ? isLight
                                      ? 'bg-white shadow-sm ring-1 ring-amber-400/35'
                                      : 'bg-white/[0.04] ring-1 ring-amber-400/30'
                                    : 'active:bg-zinc-500/[0.06]'
                                }`}
                              >
                                <span className={`mb-1 min-h-[24px] truncate text-center font-data text-[8px] leading-tight sm:text-[9px] ${
                                  !active ? 'text-zinc-400' : point.net >= 0 ? 'text-emerald-500' : 'text-red-400'
                                }`}>
                                  {active ? `${point.net >= 0 ? '+' : '−'}${formatMoneyShort(Math.abs(point.net))}` : '—'}
                                </span>
                                <span className="flex min-h-0 flex-1 items-end justify-center gap-[2px]">
                                  <span className="w-2 rounded-t-full bg-emerald-500/80 transition-[height] duration-300 sm:w-2.5" style={{ height: `${incomeH}%` }} />
                                  <span className="w-2 rounded-t-full bg-red-400/80 transition-[height] duration-300 sm:w-2.5" style={{ height: `${expenseH}%` }} />
                                </span>
                                <span className="mt-2 truncate text-center text-[8px] text-zinc-500 sm:text-[9px]">{point.label.slice(0, 2)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {(() => {
                        const fallback = [...historyTimeline.points].reverse().find((x) => x.income || x.expense)?.key || historyTimeline.points[historyTimeline.points.length - 1]?.key;
                        const p = historyTimeline.points.find((x) => x.key === (freeTimelineSelected || fallback));
                        return p ? (
                          <div className={`mt-3 grid grid-cols-3 gap-2 rounded-xl border p-2.5 text-center ${
                            isLight ? 'border-zinc-200 bg-zinc-50/70' : 'border-zinc-800 bg-zinc-900/50'
                          }`}>
                            <div>
                              <p className="text-[9px] text-zinc-500">{t('incomeLabel')}</p>
                              <p className="mt-1 truncate font-data text-xs text-emerald-500">+{historyCurrencySymbol}{formatMoneyShort(p.income)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-zinc-500">{t('expenseLabel')}</p>
                              <p className="mt-1 truncate font-data text-xs text-red-400">−{historyCurrencySymbol}{formatMoneyShort(p.expense)}</p>
                            </div>
                            <div>
                              <p className="text-[9px] text-zinc-500">{p.label} · {p.count}</p>
                              <p className={`mt-1 truncate font-data text-xs ${p.net >= 0 ? 'text-emerald-500' : 'text-red-400'}`}>
                                {p.net >= 0 ? '+' : '−'}{historyCurrencySymbol}{formatMoneyShort(Math.abs(p.net))}
                              </p>
                            </div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}

                  {freeHistoryPanel === 'analysis' && historyTrades.length > 0 && (
                    <div className={`mt-2 overflow-hidden rounded-2xl border p-4 sm:p-5 ${
                      isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-950/70'
                    }`}>
                      <div className={`mb-4 rounded-xl border px-4 py-3 ${
                        isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/20'
                      }`}>
                        <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{t('financialSummary')}</p>
                        <p className={`text-sm font-medium leading-relaxed ${
                          historyIncome > historyExpense ? 'text-emerald-600' : historyExpense > 0 ? 'text-red-500' : isLight ? 'text-zinc-600' : 'text-zinc-400'
                        }`}>
                          {historyIncome > historyExpense ? t('flowSummaryPositive') : historyExpense > 0 ? t('flowSummaryNegative') : t('flowSummaryEmpty')}
                        </p>
                      </div>

                      <div className="space-y-5">
                        <div>
                          <div className="mb-4 grid grid-cols-3 gap-2">
                            <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                              <p className="mb-1 text-[10px] text-zinc-500">{t('incomeLabel')}</p>
                              <p className="truncate font-data text-xs tabular-nums text-emerald-600">+{historyCurrencySymbol}{formatMoney(historyIncome)}</p>
                            </div>
                            <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                              <p className="mb-1 text-[10px] text-zinc-500">{t('expenseLabel')}</p>
                              <p className="truncate font-data text-xs tabular-nums text-red-600">−{historyCurrencySymbol}{formatMoney(historyExpense)}</p>
                            </div>
                            <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                              <p className="mb-1 text-[10px] text-zinc-500">{t('recordsCount')}</p>
                              <p className="font-data text-sm">{historyTrades.length}</p>
                            </div>
                          </div>
                          {historyCurrency === 'ALL'
                            ? <p className="text-xs text-zinc-500">{t('allCurrenciesNotice')}</p>
                            : <HistoryChart entries={historyAnalysis.dailyEntries} isLight={isLight} t={t} formatAmount={(amount) => formatAmountInCurrency(amount, historyCurrency)} />}
                        </div>

                        <div>
                          <p className={`mb-2 text-xs font-semibold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{t('fromWhere')}</p>
                          <div className="space-y-3">
                            {historyAnalysis.incomeSources.length ? historyAnalysis.incomeSources.slice(0, 5).map(([name, value]) => (
                              <div key={name}>
                                <div className="mb-1 flex justify-between gap-3 text-xs">
                                  <span className="truncate font-medium">{name}</span>
                                  <span className="font-data tabular-nums text-emerald-600">+{historyCurrencySymbol}{formatMoney(value)}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-500/10">
                                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(5, (value / (historyIncome || 1)) * 100)}%` }} />
                                </div>
                              </div>
                            )) : <p className="py-5 text-center text-sm text-zinc-500">{t('noIncomePeriod')}</p>}
                          </div>
                        </div>

                        <div>
                          <p className={`mb-2 text-xs font-semibold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{t('whereGo')}</p>
                          <div className="space-y-3">
                            {historyAnalysis.expenseCategories.length ? historyAnalysis.expenseCategories.slice(0, 5).map(([name, value]) => (
                              <div key={name}>
                                <div className="mb-1 flex justify-between gap-3 text-xs">
                                  <span className="truncate font-medium">{name}</span>
                                  <span className="font-data tabular-nums text-red-600">−{historyCurrencySymbol}{formatMoney(value)}</span>
                                </div>
                                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-500/10">
                                  <div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${Math.max(5, (value / (historyExpense || 1)) * 100)}%` }} />
                                </div>
                              </div>
                            )) : <p className="py-5 text-center text-sm text-zinc-500">{t('noExpensePeriod')}</p>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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
                          <button key={p} onClick={() => { handlePresetChange(p); setHistoryPeriodMenuOpen(false); }} className={`block w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${periodPreset === p ? 'bg-amber-400/10 text-amber-600' : isLight ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'}`}>{periodLabel(p)}</button>
                        ))}
                        <button onClick={() => { setSelectedKey(null); setPeriodPreset('custom'); setHistoryPeriodMenuOpen(false); }} className={`block w-full rounded-xl px-3 py-2 text-left text-xs transition-colors ${periodPreset === 'custom' ? 'bg-amber-400/10 text-amber-600' : isLight ? 'text-zinc-600 hover:bg-zinc-100' : 'text-zinc-400 hover:bg-zinc-900'}`}>{t('customPeriod')}</button>
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
                    <div className={`mb-4 overflow-visible rounded-2xl border p-3.5 shadow-sm ${
                      isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-900/70'
                    }`}>
                      <div className="mb-3 flex items-center justify-between">
                        <span className="font-data text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500">{periodPreset === 'custom' ? t('dateRange') : periodButtonLabel}</span>
                      </div>
                      {periodPreset === 'custom' && <div className="grid grid-cols-2 gap-2 mb-3">
                        <label className={`relative rounded-xl border px-3 py-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/20'}`}>
                          <span className="block text-[9px] font-data uppercase tracking-wider text-zinc-500">{t('fromDate')}</span>
                          <span className={`mt-1 block text-sm font-data font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-100'}`}>{formatDateLabel(dateFrom)}</span>
                          <input aria-label={t('fromDate')} type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </label>
                        <label className={`relative rounded-xl border px-3 py-2.5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/20'}`}>
                          <span className="block text-[9px] font-data uppercase tracking-wider text-zinc-500">{t('toDate')}</span>
                          <span className={`mt-1 block text-sm font-data font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-100'}`}>{formatDateLabel(dateTo)}</span>
                          <input aria-label={t('toDate')} type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </label>
                      </div>}
                      <div className="mb-3">
                        <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-zinc-500">{t('category')}</span>
                        {renderHistoryCategoryPicker()}
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

                  <div className={`mb-2 flex items-center justify-between gap-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-xs">{historyTrades.length} {t('records')}{historyNameFilter ? ` · ${historyNameFilter}` : ''}</p>
                      {periodPreset !== 'Вся история' && (
                        <button onClick={() => setHistoryFiltersOpen(true)} className={`mt-0.5 text-[10px] ${isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-600 hover:text-zinc-300'} transition-colors`}>
                          {t('changePeriod')}
                        </button>
                      )}
                    </div>
                    <div className={`inline-flex shrink-0 gap-1 rounded-xl border p-1 ${
                      isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800 bg-zinc-950'
                    }`}>
                      {[{ code: 'ALL', symbol: t('all'), label: t('allCurrencies') }, ...CURRENCIES].map((c) => (
                        <button key={c.code} type="button" onClick={() => setHistoryCurrency(c.code)} title={c.label}
                          className={`rounded-lg px-2 py-1 text-[10px] font-data transition-all ${
                            historyCurrency === c.code
                              ? 'bg-amber-400/15 text-amber-500 ring-1 ring-amber-400/20 font-semibold'
                              : isLight ? 'text-zinc-500 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
                          }`}>
                          {c.symbol}
                        </button>
                      ))}
                    </div>
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
                            onClick={() => editTradeFromHistory(entry)}
                            aria-label={t('editRecord')}
                            className={`group w-full min-h-[64px] px-3.5 py-3 flex items-center gap-3 text-left border-b last:border-b-0 transition-colors ${
                              isLight
                                ? 'border-zinc-200 hover:bg-zinc-50 active:bg-zinc-100 text-zinc-800'
                                : 'border-zinc-800/80 hover:bg-zinc-900 active:bg-zinc-800/80 text-zinc-100'
                            }`}
                          >
                            <span className={`h-11 w-11 shrink-0 rounded-2xl border flex items-center justify-center shadow-sm ${
                              entry.pnl >= 0
                                ? (isLight ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white text-emerald-600' : 'border-emerald-400/15 bg-gradient-to-br from-emerald-500/[0.12] to-zinc-950 text-emerald-400')
                                : (isLight ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white text-rose-600' : 'border-red-400/15 bg-gradient-to-br from-red-500/[0.12] to-zinc-950 text-red-400')
                            }`}>
                              <Icon className="h-[18px] w-[18px] stroke-[1.8]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className={`block text-sm font-medium truncate ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{entry.instrument || t('catOther')}</span>
                              <span className={`block text-[11px] mt-0.5 truncate ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{formatDateLabel(entry.dateKey)} · {entry.time}{entry.comment ? ` · ${entry.comment}` : ''}</span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className={`font-data text-sm font-medium tabular-nums whitespace-nowrap ${entry.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {formatAmountInCurrency(entry.pnl, entry.currency || 'USD')}
                              </span>
                              <span className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                                isLight ? 'bg-zinc-100 text-zinc-500 group-hover:text-amber-600' : 'bg-white/[0.05] text-zinc-500 group-hover:text-amber-400'
                              }`}>
                                <Pencil className="h-4 w-4" />
                              </span>
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
                      <p className={`text-sm ${isLight ? 'text-zinc-600' : 'text-zinc-500'}`}>{t('emptyHistoryTitle')}</p>
                      <p className={`text-xs mt-1 ${isLight ? 'text-zinc-500' : 'text-zinc-700'}`}>{t('emptyHistoryDesc')}</p>
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
                      {t('downloadReport')}
                    </button>
                      <p className={`mt-1 px-1 text-[10px] leading-tight ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{t('downloadReportSubtitle')}</p>
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
                      {confirmingClear ? t('confirmClearHistory') : t('clearHistory')}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* PRO HISTORY — premium, sectioned experience. */}
                  {proHistoryTab === 'overview' && (
                    <>
                      {(() => {
                        const total = historyTrades.reduce((sum, item) => sum + Number(item.pnl || 0), 0);
                        const wins = historyTrades.filter((item) => Number(item.pnl || 0) >= 0).length;
                        const winrate = historyTrades.length ? Math.round((wins / historyTrades.length) * 100) : 0;
                        const average = historyTrades.length ? total / historyTrades.length : 0;

                        return (
                          <section className={`pro-premium-card relative mb-4 overflow-hidden border p-5 sm:p-6 ${
                            isLight
                              ? 'border-slate-200 bg-white'
                              : 'border-amber-400/15 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black'
                          }`}>
                            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-400/[0.08] blur-3xl" />
                            <div className="pointer-events-none absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-emerald-500/[0.05] blur-3xl" />

                            <div className="relative">
                              <p className="font-data text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500">
                                {proHistoryCopy.commandCenter}
                              </p>
                              <h3 className={`mt-2 font-display text-xl font-semibold tracking-tight sm:text-2xl ${
                                isLight ? 'text-slate-950' : 'text-white'
                              }`}>
                                {proHistoryCopy.commandTitle}
                              </h3>
                              <p className={`mt-2 max-w-2xl text-xs leading-5 sm:text-sm ${
                                isLight ? 'text-slate-600' : 'text-zinc-400'
                              }`}>
                                {proHistoryCopy.commandSubtitle}
                              </p>

                              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                                {[
                                  [proHistoryCopy.result, `${total >= 0 ? '+' : '−'}${currencySymbol}${formatMoneyShort(Math.abs(total))}`, total >= 0 ? 'text-emerald-500' : 'text-red-500'],
                                  [proHistoryCopy.winrate, `${winrate}%`, 'text-amber-500'],
                                  [proHistoryCopy.tradesCount, String(historyTrades.length), isLight ? 'text-slate-950' : 'text-zinc-100'],
                                  [proHistoryCopy.averageTrade, `${average >= 0 ? '+' : '−'}${currencySymbol}${formatMoneyShort(Math.abs(average))}`, average >= 0 ? 'text-emerald-500' : 'text-red-500'],
                                ].map(([label, value, tone]) => (
                                  <div
                                    key={label}
                                    className={`rounded-2xl border px-3.5 py-3 ${
                                      isLight
                                        ? 'border-slate-200 bg-slate-50'
                                        : 'border-white/[0.06] bg-white/[0.025]'
                                    }`}
                                  >
                                    <p className={`text-[10px] font-medium ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                                      {label}
                                    </p>
                                    <p className={`mt-1.5 font-data text-base font-bold tabular-nums sm:text-lg ${tone}`}>
                                      {value}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div className={`mt-5 border-t pt-4 ${
                                isLight ? 'border-slate-200' : 'border-white/[0.06]'
                              }`}>
                                <p className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${
                                  isLight ? 'text-slate-500' : 'text-zinc-500'
                                }`}>
                                  {proHistoryCopy.proValue}
                                </p>

                                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {[
                                    [Link2, proHistoryCopy.platform, proHistoryCopy.platformHint],
                                    [TrendingUp, proHistoryCopy.curve, proHistoryCopy.curveHint],
                                    [FileText, proHistoryCopy.discipline, proHistoryCopy.disciplineHint],
                                    [Repeat2, proHistoryCopy.comparison, proHistoryCopy.comparisonHint],
                                  ].map(([Icon, label, hint]) => (
                                    <div key={label} className="flex min-w-0 items-start gap-2.5">
                                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${
                                        isLight ? 'bg-amber-50 text-amber-600' : 'bg-amber-400/[0.08] text-amber-300'
                                      }`}>
                                        <Icon className="h-3.5 w-3.5 stroke-[1.8]" />
                                      </span>
                                      <span className="min-w-0">
                                        <span className={`block text-[11px] font-semibold leading-4 ${
                                          isLight ? 'text-slate-800' : 'text-zinc-200'
                                        }`}>
                                          {label}
                                        </span>
                                        <span className={`mt-0.5 block text-[9px] leading-3.5 ${
                                          isLight ? 'text-slate-500' : 'text-zinc-500'
                                        }`}>
                                          {hint}
                                        </span>
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </section>
                        );
                      })()}

                  {/* ── Compact toolbar (currency · deposit · sync) — always visible ── */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
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
                    {ctraderConnected && (
                      <button onClick={handleSyncCtraderTrades} disabled={syncingCtrader}
                        className={`ml-auto flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all ${
                          isLight ? 'border-emerald-300/80 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}>
                        <RefreshCw className={`h-3 w-3 ${syncingCtrader ? 'animate-spin' : ''}`} />
                        {syncingCtrader ? t('syncing') : t('synchronize')}
                      </button>
                    )}
                  </div>

                  <PnlCurve key={validUserId || 'guest'} userId={validUserId} trades={historyTrades} comparisonTrades={historyFilteredTrades} dateFrom={periodPreset === 'Вся история' ? null : dateFrom} dateTo={dateTo} accounts={ctraderAccounts} language={language} isLight={isLight} />
                  {/* ── Luxury Donut + Stats Header ─────────────────────── */}
                  {(() => {
                    const hTrades = historyTrades;
                    const hWin = hTrades.filter(t => t.pnl >= 0).length;
                    const hLoss = hTrades.length - hWin;
                    const hWinrate = hTrades.length > 0 ? Math.round((hWin / hTrades.length) * 100) : 0;
                    const hTotal = hTrades.reduce((s, t) => s + t.pnl, 0);
                    const r = 38;
                    const circ = 2 * Math.PI * r;
                    const offset = circ - (hWinrate / 100) * circ;
                    const lossOffset = circ - ((hLoss / (hTrades.length || 1)) * circ);
                    return (
                      <div className={`relative mb-4 overflow-hidden rounded-2xl border p-4 sm:p-5 ${
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
                    const wins = trades.filter((tr) => tr.pnl >= 0);
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
                    const scoreLabel = score >= 85 ? 'Элитный трейдер' : score >= 70 ? 'Уверенная рука' : score >= 55 ? 'Стабильная база' : score >= 40 ? 'Есть над чем работать' : 'Требует дисциплины';
                    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';
                    const scoreCirc = 238.76;

                    const insight = longestLossStreak >= 3
                      ? `Самая длинная серия убытков в выборке: ${longestLossStreak}. Сопоставьте этот период с заметками к торговым дням: по одним результатам сделок нельзя определить причины убытков или эмоциональное состояние.`
                      : (payoffRatio > 0 && payoffRatio < 1 && winrate >= 50)
                      ? 'Винрейт хороший, но средний убыток крупнее среднего профита — похоже, прибыль фиксируется слишком рано.'
                      : (profitFactor !== Infinity && profitFactor < 1)
                      ? 'Profit Factor ниже 1 — за период убытки перевешивают прибыль. Стоит пересмотреть risk/reward.'
                      : profitFactor >= 1.5
                      ? 'Сильный период: Profit Factor выше 1.5 говорит о стабильном преимуществе стратегии.'
                      : 'Данных пока немного — статистика станет точнее по мере накопления сделок.';

                    return (
                      <div className="mb-4 space-y-3">
                        <div className="space-y-3">
                        <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-7 ${isLight ? 'bg-gradient-to-br from-white to-zinc-50 shadow-[0_1px_0_rgba(0,0,0,.04),0_16px_40px_rgba(0,0,0,.06)]' : 'bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_24px_70px_rgba(0,0,0,.5)]'}`}>
                          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/[0.07] blur-3xl" />
                          <div className="relative flex items-center justify-between mb-5">
                            <span className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-[0.28em] text-amber-500 font-bold"><Zap className="h-3 w-3" /> PRO Scorecard</span>
                            <span className={`rounded-full px-2.5 py-1 font-data text-[10px] font-bold tracking-wide ${score >= 80 ? 'bg-emerald-500/15 text-emerald-500' : score >= 60 ? 'bg-amber-400/15 text-amber-500' : score >= 40 ? 'bg-orange-500/15 text-orange-500' : 'bg-red-500/15 text-red-500'}`}>Грейд {grade}</span>
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
                                <span className={`mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>SCORE</span>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-base font-semibold leading-tight ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{scoreLabel}</p>
                              <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto sm:mx-0">На основе Profit Factor, винрейта, payoff и серий убытков за текущий фильтр истории.</p>
                              <div className={`mt-4 inline-flex items-baseline gap-2 border-t pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-500">Profit Factor</span>
                                <span className={`font-display text-2xl font-bold tabular-nums ${profitFactor >= 1.5 ? 'text-emerald-500' : profitFactor >= 1 ? (isLight ? 'text-zinc-800' : 'text-zinc-200') : 'text-red-500'}`}>{profitFactor === Infinity ? 'MAX' : profitFactor.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`grid grid-cols-3 divide-x rounded-2xl px-1 py-4 ${isLight ? 'divide-zinc-200' : 'divide-zinc-800'}`}>
                          <div className="px-3 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5">Payoff</p>
                            <p className={`font-display text-lg font-semibold tabular-nums ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{payoffRatio > 0 ? `1:${payoffRatio.toFixed(2)}` : '—'}</p>
                          </div>
                          <div className="px-3 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500/70" /> Средний +</p>
                            <p className="font-data text-lg font-semibold text-emerald-500 tabular-nums">+{historyCurrencySymbol}{formatMoney(avgWin)}</p>
                          </div>
                          <div className="px-3 text-center">
                            <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-center gap-1"><TrendingDown className="h-3 w-3 text-red-500/70" /> Средний −</p>
                            <p className="font-data text-lg font-semibold text-red-500 tabular-nums">-{historyCurrencySymbol}{formatMoney(avgLoss)}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${isLight ? 'from-emerald-50 to-white' : 'from-emerald-500/[0.09] to-transparent'}`}>
                            <TrendingUp className="absolute -right-2 -bottom-2 h-14 w-14 text-emerald-500/10" />
                            <p className="relative text-[9px] uppercase tracking-wider text-emerald-600/80 mb-1.5">Лучший день</p>
                            <p className="relative font-display text-xl font-bold text-emerald-500 tabular-nums">{formatSignedShort(bestDay[1])}</p>
                            <p className="relative mt-1 text-[10px] text-zinc-500">{formatDateLabel(bestDay[0])}</p>
                          </div>
                          <div className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${isLight ? 'from-red-50 to-white' : 'from-red-500/[0.09] to-transparent'}`}>
                            <TrendingDown className="absolute -right-2 -bottom-2 h-14 w-14 text-red-500/10" />
                            <p className="relative text-[9px] uppercase tracking-wider text-red-500/80 mb-1.5">Худший день</p>
                            <p className="relative font-display text-xl font-bold text-red-500 tabular-nums">{formatSignedShort(worstDay[1])}</p>
                            <p className="relative mt-1 text-[10px] text-zinc-500">{formatDateLabel(worstDay[0])}</p>
                          </div>
                        </div>

                        <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] font-data ${isLight ? 'border-zinc-200 text-zinc-600' : 'border-zinc-800 text-zinc-400'}`}>
                          <span className="inline-flex items-center gap-1.5"><Award className="h-3 w-3 text-amber-500/80" /> Частый инструмент <span className={isLight ? 'text-zinc-900 font-semibold' : 'text-zinc-100 font-semibold'}>{topInstrument ? topInstrument[0] : '—'}</span></span>
                          {longestLossStreak >= 2 && (
                            <>
                              <span className="text-zinc-400/40">·</span>
                              <span className="inline-flex items-center gap-1.5 text-red-400"><Flame className="h-3 w-3" /> Серия убытков <span className="font-semibold">{longestLossStreak}</span></span>
                            </>
                          )}
                        </div>

                        <section className={`rounded-2xl border ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950/50'}`}>
                          <button type="button" aria-expanded={instrumentBreakdownOpen} aria-controls="history-instrument-breakdown"
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

                        <div className={`relative overflow-hidden rounded-2xl border p-4 ${isLight ? 'border-amber-300/70 bg-gradient-to-br from-amber-50 to-white' : 'border-amber-400/25 bg-gradient-to-br from-amber-400/[0.08] via-zinc-950 to-zinc-950'}`}>
                          <div className="absolute -right-6 -top-8 select-none pointer-events-none font-display text-7xl font-bold tracking-tighter text-amber-400/[0.06]">PRO</div>
                          <div className="relative flex items-start gap-2.5 mb-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-500"><Sparkles className="h-4 w-4" /></span>
                            <div>
                              <p className={`text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Наблюдение по статистике</p>
                              <p className="text-[11px] text-zinc-500">На основе сделок за выбранный период</p>
                            </div>
                          </div>
                          <p className={`relative rounded-xl border px-3 py-2.5 text-xs leading-relaxed mb-3 ${isLight ? 'border-zinc-200 bg-white text-zinc-700' : 'border-zinc-800 bg-black/25 text-zinc-300'}`}>{insight}</p>

                        </div>
                      </div>
                      </div>
                    );
                  })()}

                    </>
                  )}

                  {proHistoryTab === 'analytics' && (
                    <>
                      <section className={`pro-premium-card mb-4 border p-4 sm:p-5 ${
                        isLight
                          ? 'border-slate-200 bg-white'
                          : 'border-white/[0.07] bg-white/[0.025]'
                      }`}>
                        <p className="font-data text-[10px] font-bold uppercase tracking-[0.20em] text-amber-500">
                          {proHistoryCopy.analytics}
                        </p>
                        <h3 className={`mt-2 text-lg font-semibold tracking-tight ${
                          isLight ? 'text-slate-950' : 'text-zinc-100'
                        }`}>
                          {proHistoryCopy.deeperTitle}
                        </h3>
                        <p className={`mt-1.5 max-w-2xl text-xs leading-5 ${
                          isLight ? 'text-slate-600' : 'text-zinc-400'
                        }`}>
                          {proHistoryCopy.deeperBody}
                        </p>
                      </section>

                      <NoteInsights userId={validUserId} trades={historyTrades} revision={notesRevision} language={language} isLight={isLight} onDay={jumpToTradeDate} />

                  {/* ── Аналитика — непрерывная лента ── */}
                  <section className="mb-4">
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
                      <div className={`rounded-2xl border p-3 sm:p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-white/5 bg-black/20'}`}>
                        <div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-semibold">{t('currencyDynamics')}</p><p className="mt-1 text-[10px] text-zinc-500">{t('currenciesNotMixed')}</p></div><span className="text-[10px] text-amber-500">PRO</span></div>
                        <div className="grid gap-2">
                          {historyByCurrency.map(([code, stats]) => { const meta = getCurrencyMeta(code); return <button key={code} onClick={() => setHistoryCurrency(code)} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800/80 bg-zinc-900/40'}`}><span><span className="block text-xs font-medium">{meta.symbol} {code}</span><span className="mt-0.5 block text-[10px] text-zinc-500">{stats.count} {t('transactions')}</span></span><span className={`font-data text-sm ${stats.balance >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>{stats.balance >= 0 ? '+' : '−'}{meta.symbol}{formatMoney(Math.abs(stats.balance))}</span></button>; })}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={`relative mb-5 overflow-hidden rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/5 bg-black/20'}`}>
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
                      <PeriodDynamics trades={historyTrades} language={language} isLight={isLight} />
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
                      <div className={`rounded-2xl border p-4 ${isLight ? 'border-amber-200 bg-amber-50/40' : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.07] to-transparent'}`}><p className="font-data text-[10px] uppercase tracking-[0.18em] text-amber-500">{t('financialRadar')}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('periodPower')}</p><p className="mt-1 text-sm font-semibold">{historyExpense > 0 ? `${(historyIncome / historyExpense).toFixed(1)}×` : historyIncome > 0 ? t('positive') : '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('mainSource')}</p><p className="mt-1 text-sm font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('attentionZone')}</p><p className="mt-1 text-sm font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p></div>
                        <div className={`rounded-xl p-3 ${isLight ? 'bg-white/80' : 'bg-black/20'}`}><p className="text-xs text-zinc-500">{t('bestDay')}</p><p className="mt-1 text-sm font-semibold">{historyAnalysis.dailyEntries.length ? historyAnalysis.dailyEntries.reduce((best, item) => item[1].income - item[1].expense > best[1].income - best[1].expense ? item : best)[0] : '—'}</p></div>
                      </div></div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('activity')}</p><p className="mt-2 text-lg font-semibold">{historyTrades.length}</p><p className="text-xs text-zinc-500">{t('transactions')}</p></div>
                      <div className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('frequentIncome')}</p><p className="mt-2 text-sm font-semibold truncate">{historyAnalysis.incomeSources[0]?.[0] || '—'}</p><p className="text-xs text-zinc-500">{t('incomeSources')}</p></div>
                      <div className={`rounded-2xl border p-4 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-black/20'}`}><p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('expensePattern')}</p><p className="mt-2 text-sm font-semibold truncate">{historyAnalysis.expenseCategories[0]?.[0] || '—'}</p><p className="text-xs text-zinc-500">{t('expenseStructure')}</p></div>
                    </div>
                  </div>
                    </div>
                  </div>
                  ) : (
                    <div className={`rounded-2xl border border-dashed px-6 py-14 text-center ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                      <p className={`text-sm ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('emptyHistoryDesc')}</p>
                    </div>
                  )}
                    </div>
                  </section>

                    </>
                  )}

                  {proHistoryTab === 'trades' && (
                    <>
                      <section className={`pro-premium-card mb-4 border p-4 sm:p-5 ${
                        isLight
                          ? 'border-slate-200 bg-white'
                          : 'border-white/[0.07] bg-white/[0.025]'
                      }`}>
                        <p className="font-data text-[10px] font-bold uppercase tracking-[0.20em] text-amber-500">
                          {proHistoryCopy.trades}
                        </p>
                        <h3 className={`mt-2 text-lg font-semibold tracking-tight ${
                          isLight ? 'text-slate-950' : 'text-zinc-100'
                        }`}>
                          {proHistoryCopy.tradesTitle}
                        </h3>
                        <p className={`mt-1.5 text-xs leading-5 ${
                          isLight ? 'text-slate-600' : 'text-zinc-400'
                        }`}>
                          {proHistoryCopy.tradesBody}
                        </p>
                      </section>

                  {/* ── Сделки — единый блок фильтров: быстрый win/loss, "Фильтры" и валюта вместе ── */}
                  <div ref={historyDealsRef} tabIndex={-1} className={`mb-4 flex scroll-mt-4 items-center gap-2 border-t pt-4 outline-none ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                    <span className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-[0.28em] text-amber-500 font-bold">
                      <History className="h-3 w-3" /> {t('trades')}
                    </span>
                    <button type="button" aria-expanded={proFiltersOpen} onClick={() => setProFiltersOpen(v => !v)} className={`ml-auto rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${isLight ? 'border-zinc-200 text-zinc-600 hover:border-amber-400/40 hover:text-amber-600' : 'border-zinc-800 text-zinc-400 hover:border-amber-400/30 hover:text-amber-400'}`}>{t('filters')} · {periodButtonLabel}</button>
                  </div>

                  <div className={`flex gap-1 mb-2 rounded-xl border p-1 ${
                    isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-black/20'
                  }`}>
                    {[
                      { key: 'all', label: t('all') },
                      { key: 'win', label: `✦ ${t('profit')}` },
                      { key: 'loss', label: `− ${t('loss')}` },
                    ].map((opt) => (
                      <button key={opt.key} onClick={() => setHistoryWinLoss(opt.key)}
                        className={`flex-1 rounded-lg py-2 font-data text-xs font-medium transition-all ${
                          historyWinLoss === opt.key
                            ? opt.key === 'win'
                              ? 'bg-emerald-500/15 text-emerald-600 ring-1 ring-emerald-400/25'
                              : opt.key === 'loss'
                              ? 'bg-red-500/15 text-red-500 ring-1 ring-red-400/20'
                              : (isLight ? 'bg-white text-zinc-900 shadow-sm' : 'bg-amber-400/12 text-amber-400 ring-1 ring-amber-400/20')
                            : isLight ? 'text-zinc-500 hover:text-zinc-800' : 'text-zinc-500 hover:text-zinc-300'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className={`text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {historyTrades.length} {t('trades')} {periodPreset !== 'Вся история' ? `· ${periodButtonLabel}` : ''}
                      {platformFilter !== 'ALL' ? ` · ${platformFilter}` : ''}
                      {historyCurrency !== 'ALL' ? ` · ${historyCurrency}` : ''}
                    </p>
                  </div>

                  {/* Expanded filters beside the currency toolbar */}
                  {proFiltersOpen && (
                  <div className={`mb-3 rounded-2xl border p-3 ${
                    isLight ? 'border-zinc-200 bg-white shadow-sm' : 'border-zinc-800/80 bg-zinc-950/60'
                  }`}>
                    {/* Period row: native select opens all presets with one tap. */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`shrink-0 font-data text-[9px] uppercase tracking-[0.18em] mr-1 ${isLight ? 'text-zinc-400 font-semibold' : 'text-zinc-600'}`}>{t('period')}</span>
                      <select
                        value={periodPreset}
                        onChange={(e) => e.target.value === 'custom' ? setPeriodPreset('custom') : handlePresetChange(e.target.value)}
                        className={`min-w-0 flex-1 appearance-none rounded-xl border px-3 py-2 pr-8 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                          isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-zinc-800 bg-zinc-900/50 text-zinc-300'
                        }`}
                      >
                        {PERIOD_PRESETS.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
                        <option value="custom">{t('customPeriod')}</option>
                      </select>
                    </div>

                    {/* Date range only appears for a custom period. */}
                    {periodPreset === 'custom' && (
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5 mb-3">
                        <input type="date" value={dateFrom} onChange={(e) => handleDateFromChange(e.target.value)}
                          className={`min-w-0 rounded-xl border px-2 py-1.5 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                            isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          }`} />
                        <span className={`text-center text-xs ${isLight ? 'text-zinc-300' : 'text-zinc-700'}`}>—</span>
                        <input type="date" value={dateTo} onChange={(e) => handleDateToChange(e.target.value)}
                          className={`min-w-0 rounded-xl border px-2 py-1.5 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                            isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-800' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          }`} />
                      </div>
                    )}

                    {/* Platform row */}
                    <div className="flex gap-1.5 flex-wrap">
                      {/* Platform select */}
                      <div className="relative flex-1 min-w-[110px]">
                        <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}
                          className={`w-full appearance-none rounded-xl border px-3 py-2 pr-7 text-xs font-data focus:outline-none focus:border-amber-400/60 ${
                            isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-zinc-900 border-zinc-700 text-zinc-200'
                          }`}>
                          <option value="ALL">{t('allSources')}</option>
                          {['cTrader'].map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg>
                        </span>
                      </div>

                    </div>
                    <div className="mt-2">
                      <span className={`mb-1.5 block font-data text-[9px] uppercase tracking-[0.16em] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('category')}</span>
                      {renderHistoryCategoryPicker()}
                    </div>
                  </div>

                  )}
                  {/* ── Trades list ────────────────────────────────────── */}
                  {historyTrades.length > 0 ? (
                    <div className={`rounded-2xl border overflow-hidden divide-y ${
                      isLight ? 'border-zinc-200 bg-white divide-zinc-100' : 'border-zinc-800 bg-zinc-950 divide-zinc-800/70'
                    }`}>
                      {historyTrades.map((trade) => (
                        <button
                          key={trade.id}
                          onClick={() => jumpToTradeDate(trade.dateKey)}
                          className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all group ${
                            isLight ? 'hover:bg-zinc-50/80' : 'hover:bg-zinc-900/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border font-data text-[10px] font-bold transition-transform group-hover:scale-105 ${
                              trade.pnl >= 0
                                ? isLight ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                                : isLight ? 'border-red-200 bg-red-50 text-red-700' : 'border-red-500/20 bg-red-500/10 text-red-400'
                            }`}>
                              {trade.pnl >= 0 ? '+' : '−'}
                            </span>
                            <span className="min-w-0">
                              <span className={`block text-sm font-medium truncate ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                                {trade.instrument}
                              </span>
                              <span className={`block text-[11px] mt-0.5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {formatDateLabel(trade.dateKey)} · {trade.time}
                                {trade.platform && trade.platform !== 'Manual' ? ` · ${trade.platform}` : ''}
                              </span>
                            </span>
                          </div>
                          <span className={`font-data text-sm font-semibold shrink-0 tabular-nums ${trade.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {formatPnlDisplay(trade.pnl)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={`rounded-2xl border border-dashed px-6 py-14 text-center ${
                      isLight ? 'border-zinc-200' : 'border-zinc-800'
                    }`}>
                      <p className={`text-sm ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('noTradesPeriod')}</p>
                    </div>
                  )}

                  {/* ── Footer: Total + actions ─────────────────────────── */}
                  <div className={`flex items-center justify-between rounded-xl border px-4 py-3 mt-3 ${
                    isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-800'
                  }`}>
                    <span className={`font-data text-xs uppercase tracking-wide ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>{t('total')}</span>
                    <span className={`font-data text-base font-bold tabular-nums ${historyTotal >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {historyTotal >= 0 ? '+' : '−'}{historyCurrencySymbol}{formatMoney(Math.abs(historyTotal))}
                    </span>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setExportOpen(true)} disabled={historyTrades.length === 0}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 font-data text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                        isLight ? 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                        : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}>
                      <Download className="h-3.5 w-3.5" />
                      {t('downloadReport')}
                    </button>
                    <button onClick={handleClearHistory}
                      className={[
                        'flex-1 rounded-xl border px-3 py-2.5 font-data text-xs font-medium transition-all',
                        confirmingClear
                          ? 'border-red-500/60 bg-red-500/10 text-red-500'
                          : isLight ? 'border-zinc-200 bg-white text-zinc-500 hover:border-red-400/50 hover:text-red-500'
                          : 'border-zinc-800 text-zinc-600 hover:border-red-500/40 hover:text-red-400',
                      ].join(' ')}>
                      {confirmingClear ? t('confirmClearHistory') : t('clearHistory')}
                    </button>
                  </div>
                    </>
                  )}
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
            className={`relative my-auto w-full max-w-[360px] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl border px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl transition-all duration-300 ease-[cubic-bezier(.22,1,.36,1)] will-change-transform sm:flex sm:max-h-[calc(100vh-3rem)] sm:max-w-[560px] sm:flex-col sm:overflow-hidden sm:px-5 sm:py-5 ${
              modalVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-[0.97] sm:translate-y-2'
            } ${
              isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
            }`}
          >
            <button
              onClick={closeModal}
              className={`absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
                isLight ? 'text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
              aria-label={t('close')}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-between pr-8">
              <div>
                <p className="font-data text-[10px] tracking-[0.18em] text-amber-400 uppercase">
                  {traderMode
                    ? (editingTrade ? t('editTrade') : t('newTrade'))
                    : (editingTrade ? t('editRecord') : t('addRecord'))}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="date"
                    max={todayKey}
                    value={modalDateKey || targetDateKey}
                    onChange={(e) => {
                      if (e.target.value && e.target.value <= todayKey) {
                        setModalDateKey(e.target.value);
                      }
                    }}
                    className={`rounded-lg border px-2 py-0.5 font-data text-xs outline-none transition-colors cursor-pointer ${
                      isLight
                        ? 'border-zinc-200 bg-zinc-100 text-zinc-800 hover:border-amber-400/60 focus:border-amber-500'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-200 hover:border-amber-400/50 focus:border-amber-400'
                    }`}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 sm:min-h-0 sm:overflow-y-auto sm:overscroll-contain sm:pr-1">
              {firstRunGuideStep === 2 && !editingTrade && !traderMode && (
                <div className={`mb-4 rounded-2xl border p-3 sm:p-4 ${
                  isLight ? 'border-amber-200 bg-amber-50/70' : 'border-amber-400/20 bg-amber-400/[0.06]'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{onboardingCopy.guideChooseType}</p>
                      <p className={`mt-1 text-xs leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{onboardingCopy.guideChooseTypeHint}</p>
                    </div>
                    <button type="button" onClick={markFirstRunGuideComplete} className="shrink-0 text-[11px] text-zinc-500 hover:text-zinc-300">{onboardingCopy.guideSkip}</button>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {[
                      ['expense', '🛒', onboardingCopy.guideExpense],
                      ['income', '💰', onboardingCopy.guideIncome],
                      ['note', '💭', onboardingCopy.guideNote],
                    ].map(([type, icon, label]) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => chooseFirstRunGuideType(type)}
                        className={`flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all sm:min-h-16 sm:justify-center sm:px-4 ${
                          firstRunGuideChoice === type
                            ? 'border-amber-400 bg-amber-400/10 ring-1 ring-amber-400/20'
                            : isLight ? 'border-zinc-200 bg-white hover:border-amber-300' : 'border-zinc-800 bg-zinc-950 hover:border-amber-500/40'
                        }`}
                      >
                        <span className="text-lg">{icon}</span>
                        <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{label}</span>
                      </button>
                    ))}
                  </div>
                  {firstRunGuideChoice && (
                    <p className={`mt-3 rounded-xl px-3 py-2 text-xs ${isLight ? 'bg-white text-zinc-600' : 'bg-zinc-950 text-zinc-400'}`}>
                      {firstRunGuideChoice === 'note' ? onboardingCopy.guideNoteHint : onboardingCopy.guideAmountHint}
                    </p>
                  )}
                </div>
              )}

            {/* Income / expense: the first and fastest decision */}
              <div className={`grid grid-cols-2 gap-1 rounded-xl p-1 ${
                isLight ? 'bg-zinc-100/70' : 'bg-zinc-950/70'
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
                  {traderMode ? t('profitTrade') : t('income')}
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
                  {traderMode ? t('lossTrade') : t('expense')}
                </button>
              </div>

              {/* Amount is the visual focus */}
              <div className={`relative mt-3 rounded-2xl border px-10 py-4 transition-all duration-200 focus-within:-translate-y-0.5 focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/10 ${
                isLight ? 'border-zinc-200 bg-zinc-50/70 shadow-sm' : 'border-zinc-800 bg-black/20 shadow-inner'
              }`}>
                <span className={`pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 font-data text-sm font-semibold ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {CURRENCIES.find((c) => c.code === form.currency)?.symbol || form.currency}
                </span>
                <input
                  ref={guideAmountRef}
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  enterKeyHint="done"
                  autoComplete="off"
                  autoFocus
                  value={form.pnl}
                  onChange={(e) => {
                    const nextValue = e.target.value.replace(',', '.');
                    if (!/^\d*(?:\.\d*)?$/.test(nextValue)) return;
                    setForm((f) => ({ ...f, pnl: nextValue }));
                    setFormError('');
                  }}
                  className={`w-full bg-transparent text-center font-data text-4xl sm:text-5xl font-semibold tracking-[-0.035em] outline-none placeholder:text-zinc-700 ${
                    isLight ? 'text-zinc-900' : 'text-zinc-100'
                  }`}
                  placeholder="0"
                  aria-label={traderMode ? t('result') : t('amount')}
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
                      'min-w-10 rounded-lg border px-3 py-1.5 font-data text-xs transition-all duration-200',
                      form.currency === c.code
                        ? 'border-amber-400/55 bg-amber-400/10 text-amber-600 shadow-sm'
                        : isLight
                        ? 'border-transparent bg-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700'
                        : 'border-transparent bg-transparent text-zinc-600 hover:bg-zinc-800/70 hover:text-zinc-300',
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
                {detailsOpen ? t('hideDetails') : t('moreDetails')}
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
                          {t('instrument')}
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
                          placeholder={t('instrumentPlaceholder')}
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
                        {['Manual', 'cTrader', ...(!['Manual', 'cTrader'].includes(form.platform) ? [form.platform] : [])].map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </>
                  ) : (
                    <div>
                      <label className={`mb-1.5 block font-data text-[10px] tracking-widest uppercase ${
                        isLight ? 'text-zinc-600' : 'text-zinc-600'
                      }`}>
                        {t('category')}
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
                        placeholder={t('ownCategory')}
                      />
                    </div>
                  )}

                  <textarea
                    ref={guideCommentRef}
                    value={form.comment}
                    onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                    rows={2}
                    className={`w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none focus:border-amber-400/60 ${
                      isLight
                        ? 'bg-white border-zinc-300 text-zinc-900'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-100'
                    }`}
                    placeholder={traderMode ? t('notePlaceholderTrade') : t('recordNotePlaceholder')}
                  />
                </div>
              )}

              {formError && <p className="mt-2 text-center text-xs text-red-600">{formError}</p>}

              <button
                onClick={handleSaveTrade}
                disabled={isSaving}
                className="sticky bottom-0 mt-3 block w-full rounded-xl bg-amber-400 px-4 py-3 text-base font-bold text-zinc-950 hover:bg-amber-300 transition-colors shadow-lg shadow-amber-500/20 disabled:opacity-60"
              >
                {isSaving ? t('saving') : (editingTrade ? t('saveChanges') : (traderMode ? t('saveTrade') : t('saveRecord')))}
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
              <div>
                <p className="font-data text-[10px] uppercase tracking-[0.22em] text-amber-500">
                  {traderMode ? t('titlePro') : t('titleMoney')}
                </p>
                <h3 className="mt-1 font-semibold">{t('downloadReport')}</h3>
              </div>
              <button onClick={() => setExportOpen(false)} aria-label={t('close')} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-500/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm font-medium">{t('allRecordsForPeriod')}</p>
              <p className="mt-1 text-xs text-zinc-500">{t('exportNotice')}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  { key: 'currentPeriod', label: t('currentPeriod') },
                  { key: 'today', label: t('today') },
                  { key: 'currentWeek', label: t('currentWeek') },
                  { key: 'currentMonth', label: t('currentMonth') },
                  { key: 'threeMonths', label: t('threeMonths') },
                  { key: 'allHistory', label: t('allHistory') },
                ].map((preset) => {
                  const isSelected = exportPeriodPreset === preset.key || exportPeriodPreset === preset.label;
                  return (
                    <button
                      key={preset.key}
                      onClick={() => setExportPeriodPreset(preset.key)}
                      className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                        isSelected
                          ? 'border-amber-400/50 bg-amber-400/10 text-amber-600 font-semibold'
                          : isLight ? 'border-zinc-200 hover:bg-zinc-50 text-zinc-700' : 'border-zinc-800 hover:bg-zinc-900 text-zinc-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <div className={`mt-4 rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/40'}`}>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">{t('inReport')}</p>
                <p className="mt-1 text-sm font-medium">{t('inReportDetails')}</p>
                <p className="mt-1 text-xs text-zinc-500">{exportTrades.length} {t('recordsWithFilter')}</p>
              </div>
              <button
                onClick={handleExportCsv}
                disabled={!exportTrades.length}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                {t('downloadCashReport')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* cTrader control center: only the working integration is exposed. */}
      {connectOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 transition-opacity duration-200 ${connectVisible ? 'opacity-100' : 'opacity-0'}`} onMouseDown={handleBackdropMouseDown} onClick={handleConnectBackdropClick}>
          <div role="dialog" aria-modal="true" aria-label="cTrader" className={`relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-3xl border p-5 shadow-2xl sm:p-6 ${isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-zinc-800 bg-zinc-950 text-zinc-100'}`}>
            <button onClick={closeConnectModal} aria-label={t('close')} className="absolute right-3 top-3 rounded-lg p-2 text-zinc-500 hover:text-amber-500"><X className="h-4 w-4" /></button>
            <CtraderControl t={t} isLight={isLight} connected={ctraderConnected} reconnect={ctraderReconnect} loading={ctraderLoading} syncing={syncingCtrader} accounts={ctraderAccounts} accountId={ctraderAccountId} onConnect={handleConnectCtrader} onSelect={handleSelectCtraderAccount} onSync={handleSyncCtraderTrades} onDisconnect={handleDisconnectCtrader} />
            {ctraderNotice?.kind === 'error' && !(ctraderNotice.stage === 'accounts' && ctraderReconnect) && (
              <p role="status" className="mt-4 text-sm leading-relaxed text-amber-600">
                {t(ctraderNotice.code === 'RECONNECT_REQUIRED' ? 'ctReconnect' : ctraderNotice.code === 'UNAUTHORIZED' ? 'ctLogin' : ctraderNotice.code === 'OFFLINE' ? 'ctOffline' : 'ctError')}
                {ctraderNotice.stage === 'disconnect' && <span className="mt-2 block font-mono text-[11px] opacity-70">disconnect · {ctraderNotice.code}{ctraderNotice.status ? ` · HTTP ${ctraderNotice.status}` : ''}{ctraderNotice.backendStage ? ` · ${ctraderNotice.backendStage}` : ''}</span>}
              </p>
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
            className={`relative w-full max-w-md max-h-[85dvh] overflow-y-auto overscroll-contain rounded-xl border p-6 shadow-xl transition-all duration-200 ${
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

            <p className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'} mb-4`}>{analysisStats.count} {traderMode ? 'сделок' : 'операций'} в выборке</p>

            {moneyAnalysis && (
              <div className="mb-4 space-y-5">
                <>
                    <div className={`grid grid-cols-3 gap-2 rounded-xl border p-2 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                      {[
                        ['Доходы', moneyAnalysis.income, 'text-emerald-600'],
                        ['Расходы', moneyAnalysis.expenses, 'text-red-600'],
                        ['Баланс', moneyAnalysis.balance, moneyAnalysis.balance >= 0 ? 'text-emerald-600' : 'text-red-600'],
                      ].map(([label, amount, color]) => (
                        <div key={label} className={`min-w-0 rounded-lg border p-2 text-left ${isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-900/60'}`}>
                          <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>{label}</p>
                          <p className={`truncate font-data text-sm ${color}`}>{amount < 0 ? '-' : ''}{currencySymbol}{formatMoney(Math.abs(amount))}</p>
                        </div>
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
                <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                    <div className="mb-3"><p className={`text-sm font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Откуда пришли деньги</p><p className="text-[11px] text-zinc-500">Источники дохода за выбранный период</p></div>
                    <div className="space-y-3">{moneyAnalysis.topIncomeSources.length ? moneyAnalysis.topIncomeSources.map(([source, amount]) => <div key={source}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-zinc-500">{source}</span><span className="font-data text-emerald-500">+{currencySymbol}{formatMoney(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800/70"><div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${Math.max(6, Math.round((amount / moneyAnalysis.income) * 100))}%` }} /></div></div>) : <p className="py-6 text-center text-xs text-zinc-500">За период пока нет доходов</p>}</div>
                  </div>
                <div className={`rounded-xl border p-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-950'}`}>
                    <div className="mb-3"><p className={`text-sm font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Куда уходят деньги</p><p className="text-[11px] text-zinc-500">Самые крупные категории расходов</p></div>
                    <div className="space-y-3">{moneyAnalysis.topCategories.length ? moneyAnalysis.topCategories.map(([category, amount]) => <div key={category}><div className="mb-1 flex justify-between gap-3 text-xs"><span className="truncate text-zinc-500">{category}</span><span className="font-data text-red-500">−{currencySymbol}{formatMoney(amount)}</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800/70"><div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${Math.max(6, Math.round((amount / moneyAnalysis.expenses) * 100))}%` }} /></div></div>) : <p className="py-6 text-center text-xs text-zinc-500">За период пока нет расходов</p>}</div>
                  </div>
              </div>
            )}

            {traderMode && basicAnalysis && traderScore && (
              <div className="mb-4 space-y-3">
                {/* ── PRO Scorecard hero ─────────────────────────────── */}
                <div className={`relative overflow-hidden rounded-2xl p-5 sm:p-7 ${
                  isLight
                    ? 'bg-gradient-to-br from-white to-zinc-50 shadow-[0_1px_0_rgba(0,0,0,.04),0_16px_40px_rgba(0,0,0,.06)]'
                    : 'bg-gradient-to-br from-zinc-900 via-zinc-950 to-black shadow-[0_24px_70px_rgba(0,0,0,.5)]'
                }`}>
                  <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-amber-400/[0.07] blur-3xl" />
                  <div className="relative flex items-center justify-between mb-5">
                    <span className="flex items-center gap-1.5 font-data text-[10px] uppercase tracking-[0.28em] text-amber-500 font-bold">
                      <Zap className="h-3 w-3" /> PRO Scorecard
                    </span>
                    <span className={`rounded-full px-2.5 py-1 font-data text-[10px] font-bold tracking-wide ${
                      traderScore.score >= 80 ? 'bg-emerald-500/15 text-emerald-500'
                      : traderScore.score >= 60 ? 'bg-amber-400/15 text-amber-500'
                      : traderScore.score >= 40 ? 'bg-orange-500/15 text-orange-500'
                      : 'bg-red-500/15 text-red-500'
                    }`}>
                      Грейд {traderScore.grade}
                    </span>
                  </div>

                  <div className="relative flex flex-col items-center text-center gap-4 sm:flex-row sm:text-left sm:gap-8">
                    <div className="relative flex shrink-0 items-center justify-center" style={{ width: 132, height: 132 }}>
                      <svg width="132" height="132" viewBox="0 0 96 96" className="-rotate-90">
                        <circle cx="48" cy="48" r="40" strokeWidth="6" stroke={isLight ? '#eef0f3' : '#1c1c1f'} fill="none" />
                        <circle
                          cx="48" cy="48" r="40" strokeWidth="6"
                          stroke={traderScore.score >= 80 ? '#10b981' : traderScore.score >= 60 ? '#f59e0b' : traderScore.score >= 40 ? '#f97316' : '#ef4444'}
                          strokeDasharray={251.2}
                          strokeDashoffset={251.2 - (traderScore.score / 100) * 251.2}
                          strokeLinecap="round"
                          fill="none"
                          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(.4,0,.2,1)' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
                        <span className={`font-display text-4xl font-bold tabular-nums tracking-tight ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>{traderScore.score}</span>
                        <span className={`mt-1.5 text-[8px] font-bold uppercase tracking-[0.2em] ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>SCORE</span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-base font-semibold leading-tight ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{traderScore.label}</p>
                      <p className="mt-1.5 text-[11px] text-zinc-500 leading-relaxed max-w-xs mx-auto sm:mx-0">Композитная оценка на основе Profit Factor, винрейта, payoff и серий убытков за выбранный период.</p>
                      <div className={`mt-4 inline-flex items-baseline gap-2 border-t pt-3 sm:border-t-0 sm:pt-0 sm:border-l sm:pl-5 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500">Profit Factor</span>
                        <span className={`font-display text-2xl font-bold tabular-nums ${basicAnalysis.profitFactor >= 1.5 ? 'text-emerald-500' : basicAnalysis.profitFactor >= 1 ? (isLight ? 'text-zinc-800' : 'text-zinc-200') : 'text-red-500'}`}>
                          {basicAnalysis.profitFactor === Infinity ? 'MAX' : basicAnalysis.profitFactor.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Secondary metrics — borderless stat row, no boxes ─ */}
                <div className={`grid grid-cols-3 divide-x rounded-2xl px-1 py-4 ${isLight ? 'divide-zinc-200' : 'divide-zinc-800'}`}>
                  <div className="px-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5">Payoff</p>
                    <p className={`font-display text-lg font-semibold tabular-nums ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
                      {basicAnalysis.payoffRatio > 0 ? `1:${basicAnalysis.payoffRatio.toFixed(2)}` : '—'}
                    </p>
                  </div>
                  <div className="px-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500/70" /> Средний +</p>
                    <p className="font-data text-lg font-semibold text-emerald-500 tabular-nums">+${formatMoney(basicAnalysis.avgWin)}</p>
                  </div>
                  <div className="px-3 text-center">
                    <p className="text-[9px] uppercase tracking-wider text-zinc-500 mb-1.5 flex items-center justify-center gap-1"><TrendingDown className="h-3 w-3 text-red-500/70" /> Средний −</p>
                    <p className="font-data text-lg font-semibold text-red-500 tabular-nums">-${formatMoney(basicAnalysis.avgLoss)}</p>
                  </div>
                </div>

                {/* ── Best / worst day spotlight ─────────────────────── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${isLight ? 'from-emerald-50 to-white' : 'from-emerald-500/[0.09] to-transparent'}`}>
                    <TrendingUp className="absolute -right-2 -bottom-2 h-14 w-14 text-emerald-500/10" />
                    <p className="relative text-[9px] uppercase tracking-wider text-emerald-600/80 mb-1.5">Лучший день</p>
                    <p className="relative font-display text-xl font-bold text-emerald-500 tabular-nums">{formatSignedShort(basicAnalysis.bestDay[1])}</p>
                    <p className="relative mt-1 text-[10px] text-zinc-500">{formatDateLabel(basicAnalysis.bestDay[0])}</p>
                  </div>
                  <div className={`relative overflow-hidden rounded-2xl p-4 bg-gradient-to-br ${isLight ? 'from-red-50 to-white' : 'from-red-500/[0.09] to-transparent'}`}>
                    <TrendingDown className="absolute -right-2 -bottom-2 h-14 w-14 text-red-500/10" />
                    <p className="relative text-[9px] uppercase tracking-wider text-red-500/80 mb-1.5">Худший день</p>
                    <p className="relative font-display text-xl font-bold text-red-500 tabular-nums">{formatSignedShort(basicAnalysis.worstDay[1])}</p>
                    <p className="relative mt-1 text-[10px] text-zinc-500">{formatDateLabel(basicAnalysis.worstDay[0])}</p>
                  </div>
                </div>

                {/* ── Insight ticker — quiet terminal strip instead of loud badges ── */}
                <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] font-data ${isLight ? 'border-zinc-200 text-zinc-600' : 'border-zinc-800 text-zinc-400'}`}>
                  <span className="inline-flex items-center gap-1.5">
                    <Award className="h-3 w-3 text-amber-500/80" /> Частый инструмент <span className={isLight ? 'text-zinc-900 font-semibold' : 'text-zinc-100 font-semibold'}>{basicAnalysis.topInstrument[0]}</span>
                  </span>
                  {basicAnalysis.longestLossStreak >= 2 && (
                    <>
                      <span className="text-zinc-400/40">·</span>
                      <span className="inline-flex items-center gap-1.5 text-red-400">
                        <Flame className="h-3 w-3" /> Серия убытков <span className="font-semibold">{basicAnalysis.longestLossStreak}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {traderMode ? (
              <div className={`relative overflow-hidden rounded-2xl border p-4 ${
                isLight ? 'border-amber-300/70 bg-gradient-to-br from-amber-50 to-white' : 'border-amber-400/25 bg-gradient-to-br from-amber-400/[0.08] via-zinc-950 to-zinc-950'
              }`}>
                <div className="absolute -right-6 -top-8 select-none pointer-events-none font-display text-7xl font-bold tracking-tighter text-amber-400/[0.06]">PRO</div>
                <div className="relative flex items-start gap-2.5 mb-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-400/10 text-amber-500"><Sparkles className="h-4 w-4" /></span>
                  <div>
                    <p className={`text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Наблюдение по статистике</p>
                    <p className="text-[11px] text-zinc-500">На основе сделок за выбранный период</p>
                  </div>
                </div>
                <p className={`relative rounded-xl border px-3 py-2.5 text-xs leading-relaxed mb-3 ${isLight ? 'border-zinc-200 bg-white text-zinc-700' : 'border-zinc-800 bg-black/25 text-zinc-300'}`}>
                  {traderInsight}
                </p>

              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}


      {setupStep && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className={`w-full max-w-sm rounded-2xl border p-6 shadow-2xl ${
            isLight ? 'border-zinc-300 bg-white' : 'border-zinc-800 bg-zinc-900'
          }`}>
            <p className="font-data text-[10px] tracking-widest text-amber-400 uppercase mb-2">
              {setupStep === 'language'
                ? '1 / 4'
                : `${onboardingCopy.setup} ${setupStep === 'currency' ? '2' : setupStep === 'theme' ? '3' : '4'} ${onboardingCopy.of} 4`}
            </p>

            {setupStep === 'language' ? (
              <div className="mb-4">
                <h2 className={`font-display text-xl font-semibold leading-snug ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>
                  Выберите язык · Choose language · Alege limba
                </h2>
                <p className={`mt-2 text-xs leading-relaxed ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Язык интерфейса · Interface language · Limba interfeței
                </p>
              </div>
            ) : setupStep !== 'intro' ? (
              <h2 className={`font-display text-xl font-semibold mb-4 ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>
                {setupStep === 'currency' ? onboardingCopy.chooseCurrency : onboardingCopy.chooseTheme}
              </h2>
            ) : null}

            {setupStep === 'language' && <div className="grid grid-cols-3 gap-2">{LANGUAGES.map((item) => <button key={item.code} onClick={() => handleOnboardingLanguageSelect(item)} className={`rounded-lg border px-3 py-3 font-data text-sm hover:border-amber-400 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>{item.label}</button>)}</div>}
            {setupStep === 'currency' && (
              <div className={`mb-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 ${
                isLight ? 'border-amber-200/80 bg-amber-50/70 text-zinc-600' : 'border-amber-400/15 bg-amber-400/[0.05] text-zinc-400'
              }`}>
                <CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-xs leading-relaxed">{onboardingCopy.currencyHint}</p>
              </div>
            )}
            {setupStep === 'currency' && <div className="grid grid-cols-2 gap-2">{CURRENCIES.map((item) => <button key={item.code} onClick={() => { setCurrency(item.code); setSetupStep('theme'); }} className={`rounded-lg border px-3 py-3 font-data text-sm hover:border-amber-400 ${
              isLight ? 'border-zinc-300' : 'border-zinc-700'
            }`}>{item.symbol} {item.code}</button>)}</div>}
            {setupStep === 'theme' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setTheme('light'); setSetupStep('intro'); }}
                  className={`rounded-lg border px-3 py-3 hover:border-amber-400 ${
                    isLight ? 'border-zinc-300' : 'border-zinc-700'
                  }`}
                >
                  ☀ {onboardingCopy.light}
                </button>
                <button
                  onClick={() => { setTheme('dark'); setSetupStep('intro'); }}
                  className={`rounded-lg border px-3 py-3 hover:border-amber-400 ${
                    isLight ? 'border-zinc-300' : 'border-zinc-700'
                  }`}
                >
                  🌙 {onboardingCopy.dark}
                </button>
              </div>
            )}

            {setupStep === 'intro' && (() => {
              const selectedCurrency = CURRENCIES.find((item) => item.code === currency);
              const currencyLabel = selectedCurrency?.symbol || currency;
              return (
                <div>
                  <h2 className={`font-display text-2xl font-semibold leading-tight ${isLight ? 'text-zinc-900' : 'text-zinc-50'}`}>
                    {onboardingCopy.title}
                  </h2>
                  <p className={`mt-2 text-sm leading-relaxed ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {onboardingCopy.subtitle}
                  </p>

                  <div className={`mt-5 overflow-hidden rounded-2xl border ${
                    isLight ? 'border-zinc-200 bg-zinc-50' : 'border-zinc-800 bg-zinc-950/60'
                  }`}>
                    <div className={`flex items-center justify-between border-b px-4 py-3 ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
                      <span className={`font-display text-sm font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{onboardingCopy.exampleDate}</span>
                      <span className="font-data text-[10px] uppercase tracking-widest text-zinc-500">{onboardingCopy.exampleDay}</span>
                    </div>
                    <div className="space-y-3 px-4 py-4 text-sm">
                      <div className="flex items-center justify-between gap-3"><span>☕ {onboardingCopy.coffee}</span><span className="font-data font-semibold text-red-400">−45 {currencyLabel}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>🛒 {onboardingCopy.groceries}</span><span className="font-data font-semibold text-red-400">−380 {currencyLabel}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>💰 {onboardingCopy.sideJob}</span><span className="font-data font-semibold text-emerald-500">+487 {currencyLabel}</span></div>
                      <div className="flex items-center justify-between gap-3"><span>💭 {onboardingCopy.greatDay}</span><span className="text-zinc-500">{onboardingCopy.noAmount}</span></div>
                    </div>
                    <div className={`flex items-center justify-between border-t px-4 py-3 ${isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800 bg-zinc-900/70'}`}>
                      <span className={`text-xs font-medium ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{onboardingCopy.total}</span>
                      <span className="font-data text-sm font-bold text-emerald-500">+62 {currencyLabel}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setTraderMode(false); setSetupStep(null); setFirstRunGuideChoice(null); setFirstRunGuideStep(1); }}
                    className="mt-5 w-full rounded-xl bg-amber-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 active:scale-[0.99]"
                  >
                    {onboardingCopy.create}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSetupStep(null); markFirstRunGuideComplete(); }}
                    className={`mt-2 w-full rounded-xl px-4 py-2.5 text-sm transition-colors ${
                      isLight ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800' : 'text-zinc-500 hover:bg-zinc-800/70 hover:text-zinc-300'
                    }`}
                  >
                    {onboardingCopy.skip}
                  </button>
                </div>
              );
            })()}
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

      {referralNotice && (
        <div className="fixed left-1/2 top-[max(16px,env(safe-area-inset-top))] z-[120] w-[calc(100%-24px)] max-w-sm -translate-x-1/2">
          <div className={`flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-2xl backdrop-blur-xl ${
            isLight
              ? 'border-emerald-200 bg-white/95 text-zinc-900 shadow-zinc-900/10'
              : 'border-emerald-400/15 bg-zinc-950/95 text-zinc-100 shadow-black/40'
          }`}>
            <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
              isLight ? 'bg-emerald-50 text-emerald-600' : 'bg-emerald-500/[0.10] text-emerald-400'
            }`}>
              <CheckCircle2 className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{referralNotice.title}</p>
              <p className={`mt-1 text-xs leading-5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                {referralNotice.body}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReferralNotice(null)}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                isLight ? 'text-zinc-400 hover:bg-zinc-100' : 'text-zinc-500 hover:bg-white/[0.05]'
              }`}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* PRO ACCESS — value-first server entitlement gate */}
      {proAccessPromptOpen && (
        <div
          className="fixed inset-0 z-[96] flex items-end justify-center bg-black/75 px-0 pt-8 backdrop-blur-sm sm:items-center sm:px-4 sm:pt-0"
          onClick={(event) => { if (event.target === event.currentTarget) setProAccessPromptOpen(false); }}
        >
          <div className={`flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] border shadow-2xl sm:rounded-3xl ${
            isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/[0.08] bg-zinc-950 text-zinc-100'
          }`}>
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className={`h-1 w-11 rounded-full ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            </div>

            <div className={`flex items-start justify-between gap-4 border-b px-5 pb-4 pt-4 sm:px-6 sm:pt-6 ${
              isLight ? 'border-zinc-200' : 'border-white/[0.06]'
            }`}>
              <div className="min-w-0">
                <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 ${
                  isLight
                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                    : 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300'
                }`}>
                  <Zap className="h-3.5 w-3.5" />
                  <span className="font-data text-[9px] font-bold tracking-[0.2em]">{proAccessCopy.eyebrow}</span>
                </div>

                <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-[28px]">
                  {proOfferTab === 'invites' ? proAccessCopy.invitesHubTitle : proAccessCopy.title}
                </h3>
                <p className={`mt-2 max-w-lg text-sm leading-6 ${
                  isLight ? 'text-zinc-600' : 'text-zinc-400'
                }`}>
                  {proOfferTab === 'invites' ? proAccessCopy.invitesHubBody : proAccessCopy.body}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setProAccessPromptOpen(false)}
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition-colors ${
                  isLight
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                    : 'border-white/[0.08] bg-white/[0.04] text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200'
                }`}
                aria-label={proAccessCopy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`shrink-0 border-b px-5 py-3 sm:px-6 ${
              isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-950'
            }`}>
              <div className={`grid grid-cols-2 rounded-xl p-1 ${
                isLight ? 'bg-zinc-100' : 'bg-white/[0.045]'
              }`}>
                <button
                  type="button"
                  onClick={() => setProOfferTab('offer')}
                  className={`min-h-10 rounded-lg px-3 text-xs font-semibold transition-all ${
                    proOfferTab === 'offer'
                      ? isLight
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : isLight
                        ? 'text-zinc-500 hover:text-zinc-800'
                        : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {proAccessCopy.offerTab}
                </button>

                <button
                  type="button"
                  onClick={() => setProOfferTab('invites')}
                  className={`flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition-all ${
                    proOfferTab === 'invites'
                      ? isLight
                        ? 'bg-white text-zinc-900 shadow-sm'
                        : 'bg-zinc-800 text-zinc-100 shadow-sm'
                      : isLight
                        ? 'text-zinc-500 hover:text-zinc-800'
                        : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <span>{proAccessCopy.invitesTab}</span>
                  <span className={`rounded-full px-1.5 py-0.5 font-data text-[10px] ${
                    invitedCount > 0
                      ? 'bg-amber-400/15 text-amber-500'
                      : isLight ? 'bg-zinc-200 text-zinc-500' : 'bg-white/[0.06] text-zinc-500'
                  }`}>
                    {invitedCount}
                  </span>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {proOfferTab === 'offer' ? (
                <>
              <p className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                isLight ? 'text-zinc-500' : 'text-zinc-500'
              }`}>
                {proAccessCopy.featuresTitle}
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  [Link2, proAccessCopy.featurePlatform, proAccessCopy.featurePlatformHint],
                  [TrendingUp, proAccessCopy.featureAnalytics, proAccessCopy.featureAnalyticsHint],
                  [ChartCandlestick, proAccessCopy.featureJournal, proAccessCopy.featureJournalHint],
                  [FileText, proAccessCopy.featureInsights, proAccessCopy.featureInsightsHint],
                ].map(([Icon, title, hint]) => (
                  <div
                    key={title}
                    className={`rounded-2xl border p-3.5 ${
                      isLight
                        ? 'border-zinc-200 bg-zinc-50/80'
                        : 'border-white/[0.06] bg-white/[0.025]'
                    }`}
                  >
                    <span className={`grid h-9 w-9 place-items-center rounded-xl border ${
                      isLight
                        ? 'border-amber-200/80 bg-white text-amber-600 shadow-sm'
                        : 'border-amber-400/15 bg-amber-400/[0.07] text-amber-300'
                    }`}>
                      <Icon className="h-4 w-4 stroke-[1.8]" />
                    </span>
                    <p className="mt-3 text-sm font-semibold leading-tight">{title}</p>
                    <p className={`mt-1 text-[11px] leading-4 ${
                      isLight ? 'text-zinc-500' : 'text-zinc-500'
                    }`}>
                      {hint}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-2xl border p-4 ${
                  isLight
                    ? 'border-amber-200/80 bg-gradient-to-br from-amber-50 to-white'
                    : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.08] to-white/[0.02]'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{proAccessCopy.freeTitle}</p>
                      <p className={`mt-1.5 text-xs leading-5 ${
                        isLight ? 'text-zinc-600' : 'text-zinc-400'
                      }`}>
                        {proAccessCopy.freeBody}
                      </p>
                    </div>
                    <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                      isLight
                        ? 'border-amber-200 bg-white text-amber-600 shadow-sm'
                        : 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300'
                    }`}>
                      <Award className="h-4.5 w-4.5" />
                    </span>
                  </div>

                  <div className={`mt-4 rounded-xl border px-3 py-3 ${
                    isLight
                      ? 'border-zinc-200 bg-white/75'
                      : 'border-white/[0.06] bg-black/10'
                  }`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-[11px] font-semibold ${
                        isLight ? 'text-zinc-600' : 'text-zinc-400'
                      }`}>
                        {proAccessCopy.invitedLabel}
                      </span>
                      <span className="font-data text-xs font-bold text-amber-500">
                        {Math.min(invitedCount, 1)} / 1
                      </span>
                    </div>

                    <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${
                      isLight ? 'bg-zinc-200' : 'bg-white/[0.07]'
                    }`}>
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
                        style={{ width: invitedCount > 0 ? '100%' : '0%' }}
                      />
                    </div>

                    <p className={`mt-2 text-[10px] leading-4 ${
                      rewardedCount > 0
                        ? 'text-emerald-500'
                        : invitedCount > 0
                          ? 'text-amber-500'
                          : isLight ? 'text-zinc-500' : 'text-zinc-500'
                    }`}>
                      {rewardedCount > 0
                        ? proAccessCopy.inviteDone
                        : invitedCount > 0 || pendingCount > 0
                          ? proAccessCopy.invitePending
                          : proAccessCopy.inviteWaiting}
                    </p>
                  </div>

                  <div className={`mt-3 rounded-xl border px-3 py-2.5 ${
                    isLight
                      ? 'border-amber-200/80 bg-white/80'
                      : 'border-amber-400/10 bg-black/15'
                  }`}>
                    <p className="font-data text-[15px] font-bold text-amber-500">{proAccessCopy.reward}</p>
                    <p className={`mt-0.5 text-[11px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      {proAccessCopy.rewardHint}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={openReferralShare}
                    disabled={Boolean(user) && !referralCode}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/10 transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] disabled:cursor-wait disabled:opacity-55"
                  >
                    <Share2 className="h-4 w-4 stroke-[2]" />
                    {!user
                      ? proAccessCopy.signIn
                      : referralCode
                        ? proAccessCopy.share
                        : proAccessCopy.preparing}
                  </button>
                </div>

                <div className={`relative overflow-hidden rounded-2xl border p-4 ${
                  isLight
                    ? 'border-zinc-200 bg-white'
                    : 'border-white/[0.08] bg-white/[0.025]'
                }`}>
                  <div className={`pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full blur-3xl ${
                    isLight ? 'bg-emerald-100/60' : 'bg-emerald-500/[0.06]'
                  }`} />

                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{proAccessCopy.buyTitle}</p>
                        <p className={`mt-1.5 text-xs leading-5 ${
                          isLight ? 'text-zinc-600' : 'text-zinc-400'
                        }`}>
                          {proAccessCopy.buyBody}
                        </p>
                      </div>
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                        isLight
                          ? 'border-zinc-200 bg-zinc-50 text-zinc-600'
                          : 'border-white/[0.08] bg-white/[0.04] text-zinc-300'
                      }`}>
                        <CreditCard className="h-4.5 w-4.5" />
                      </span>
                    </div>

                    <div className="mt-4 flex items-end gap-1">
                      <span className="font-data text-3xl font-bold tracking-tight">{proAccessCopy.buyPrice}</span>
                      <span className={`pb-1 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                        {proAccessCopy.buyPeriod}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartProCheckout}
                      disabled={proCheckoutLoading || proAccessActive}
                      aria-busy={proCheckoutLoading}
                      className={`mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${
                        isLight
                          ? 'border-zinc-900 bg-zinc-900 text-white shadow-lg shadow-zinc-900/10 hover:bg-zinc-800'
                          : 'border-white/80 bg-white text-zinc-950 shadow-lg shadow-black/20 hover:bg-zinc-100'
                      }`}
                    >
                      {proCheckoutLoading
                        ? <RefreshCw className="h-4 w-4 animate-spin stroke-[1.8]" />
                        : <CreditCard className="h-4 w-4 stroke-[1.8]" />}
                      {!user
                        ? proAccessCopy.buySignIn
                        : proAccessActive
                          ? proAccessCopy.buyActive
                          : proCheckoutLoading
                            ? proAccessCopy.buyLoading
                            : `${proAccessCopy.buyButton} — ${proAccessCopy.buyPrice}`}
                    </button>

                    <p className={`mt-2 text-center text-[10px] leading-4 ${
                      proCheckoutError
                        ? 'text-red-500'
                        : isLight ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {proCheckoutError ? proAccessCopy.buyError : proAccessCopy.comingSoon}
                    </p>
                  </div>
                </div>
              </div>
                </>
              ) : (
                <div>
                  {!user ? (
                    <div className={`rounded-2xl border p-5 text-center ${
                      isLight ? 'border-zinc-200 bg-zinc-50' : 'border-white/[0.06] bg-white/[0.025]'
                    }`}>
                      <History className={`mx-auto h-6 w-6 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />
                      <p className={`mt-3 text-sm leading-6 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                        {proAccessCopy.signInHistory}
                      </p>
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-400 px-4 text-sm font-bold text-zinc-950 hover:bg-amber-300"
                      >
                        {proAccessCopy.signIn}
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className={`mb-4 overflow-hidden rounded-2xl border ${
                        isLight
                          ? 'border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white'
                          : 'border-amber-400/15 bg-gradient-to-br from-amber-400/[0.08] via-white/[0.025] to-transparent'
                      }`}>
                        <div className="flex items-center justify-between gap-4 px-4 py-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-500" />
                              <p className="text-sm font-semibold">{proAccessCopy.myPro}</p>
                            </div>

                            {proAccessActive ? (
                              <>
                                <p className="mt-2 font-data text-2xl font-bold text-amber-500">
                                  {proAccessCopy.proRemaining}: {proDaysRemaining} {proAccessCopy.daysShort}
                                </p>
                                <p className={`mt-1 text-[10px] ${
                                  isLight ? 'text-slate-500' : 'text-zinc-500'
                                }`}>
                                  {proAccessCopy.proUntil} {formatProUntilDate(proAccessUntil)}
                                </p>
                              </>
                            ) : (
                              <p className={`mt-2 text-sm ${
                                isLight ? 'text-slate-600' : 'text-zinc-400'
                              }`}>
                                {proAccessCopy.proInactive}
                              </p>
                            )}
                          </div>

                          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${
                            proAccessActive
                              ? isLight
                                ? 'border-amber-200 bg-white text-amber-600 shadow-sm'
                                : 'border-amber-400/20 bg-amber-400/[0.08] text-amber-300'
                              : isLight
                                ? 'border-slate-200 bg-slate-50 text-slate-400'
                                : 'border-white/[0.06] bg-white/[0.03] text-zinc-600'
                          }`}>
                            <Award className="h-5 w-5" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                        {[
                          [Inbox, proAccessCopy.invitedPeople, invitedCount, 'text-amber-500'],
                          [CheckCircle2, proAccessCopy.activatedPeople, rewardedCount, 'text-emerald-500'],
                          [History, proAccessCopy.waitingPeople, pendingCount, 'text-zinc-500'],
                          [Award, proAccessCopy.earnedDays, `${rewardedCount * 26} ${proAccessCopy.daysShort}`, 'text-amber-500'],
                        ].map(([Icon, label, value, valueClass]) => (
                          <div
                            key={label}
                            className={`rounded-2xl border p-3.5 ${
                              isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-white/[0.06] bg-white/[0.025]'
                            }`}
                          >
                            <Icon className={`h-4 w-4 ${valueClass}`} />
                            <p className={`mt-3 text-[10px] uppercase tracking-[0.12em] ${
                              isLight ? 'text-zinc-500' : 'text-zinc-500'
                            }`}>
                              {label}
                            </p>
                            <p className={`mt-1 font-data text-xl font-bold ${valueClass}`}>{value}</p>
                          </div>
                        ))}
                      </div>

                      <div className={`mt-4 overflow-hidden rounded-2xl border ${
                        isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-white/[0.02]'
                      }`}>
                        <div className={`flex items-center justify-between border-b px-4 py-3 ${
                          isLight ? 'border-zinc-200' : 'border-white/[0.06]'
                        }`}>
                          <div>
                            <p className="text-sm font-semibold">{proAccessCopy.historyTitle}</p>
                            <p className={`mt-0.5 text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                              {proAccessCopy.invitedPeople}: {invitedCount}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={openReferralShare}
                            disabled={!referralCode}
                            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors disabled:opacity-45 ${
                              isLight
                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                : 'border-amber-400/15 bg-amber-400/[0.06] text-amber-300 hover:bg-amber-400/[0.10]'
                            }`}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                            {proAccessCopy.inviteMore}
                          </button>
                        </div>

                        {recentInvites.length === 0 ? (
                          <div className="px-5 py-8 text-center">
                            <Gift className={`mx-auto h-6 w-6 ${isLight ? 'text-zinc-300' : 'text-zinc-700'}`} />
                            <p className="mt-3 text-sm font-semibold">{proAccessCopy.noInvitesTitle}</p>
                            <p className={`mx-auto mt-1.5 max-w-sm text-xs leading-5 ${
                              isLight ? 'text-zinc-500' : 'text-zinc-500'
                            }`}>
                              {proAccessCopy.noInvitesBody}
                            </p>
                            <button
                              type="button"
                              onClick={openReferralShare}
                              disabled={!referralCode}
                              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-xs font-bold text-zinc-950 hover:bg-amber-300 disabled:opacity-45"
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              {proAccessCopy.share}
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-zinc-200/70 dark:divide-white/[0.05]">
                            {recentInvites.map((invite, index) => {
                              const isRewarded = invite.status === 'rewarded';
                              const isQualified = invite.status === 'qualified';
                              const statusText = isRewarded
                                ? proAccessCopy.rewardedStatus
                                : isQualified
                                  ? proAccessCopy.qualifiedStatus
                                  : proAccessCopy.pendingStatus;

                              return (
                                <div key={invite.id} className="flex items-center gap-3 px-4 py-3.5">
                                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${
                                    isRewarded
                                      ? isLight
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
                                        : 'border-emerald-400/15 bg-emerald-500/[0.08] text-emerald-400'
                                      : isLight
                                        ? 'border-zinc-200 bg-zinc-50 text-zinc-500'
                                        : 'border-white/[0.06] bg-white/[0.035] text-zinc-500'
                                  }`}>
                                    {isRewarded
                                      ? <CheckCircle2 className="h-4 w-4" />
                                      : <History className="h-4 w-4" />}
                                  </span>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="truncate text-sm font-semibold">
                                        {proAccessCopy.invitesTab} #{Math.max(invitedCount - index, 1)}
                                      </p>
                                      <span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-semibold ${
                                        isRewarded
                                          ? 'bg-emerald-500/10 text-emerald-500'
                                          : isQualified
                                            ? 'bg-amber-400/10 text-amber-500'
                                            : isLight
                                              ? 'bg-zinc-100 text-zinc-500'
                                              : 'bg-white/[0.05] text-zinc-500'
                                      }`}>
                                        {statusText}
                                      </span>
                                    </div>

                                    <div className={`mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] ${
                                      isLight ? 'text-zinc-500' : 'text-zinc-500'
                                    }`}>
                                      <span>
                                        {proAccessCopy.joinedAt}: {formatReferralHistoryDate(invite.created_at)}
                                      </span>
                                      {invite.rewarded_at && (
                                        <span>
                                          {proAccessCopy.rewardedAt}: {formatReferralHistoryDate(invite.rewarded_at)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className={`shrink-0 border-t px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 ${
              isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-950'
            }`}>
              <button
                type="button"
                onClick={() => setProAccessPromptOpen(false)}
                className={`min-h-10 w-full rounded-xl px-4 text-sm transition-colors ${
                  isLight
                    ? 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800'
                    : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300'
                }`}
              >
                {proAccessCopy.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REFERRAL INVITATION — personal QR share card */}
      {referralShareOpen && (
        <div
          className="fixed inset-0 z-[97] flex items-end justify-center bg-black/75 px-0 pt-10 backdrop-blur-sm sm:items-center sm:px-4 sm:pt-0"
          onClick={(event) => { if (event.target === event.currentTarget) closeReferralShare(); }}
        >
          <div className={`w-full max-w-md overflow-hidden rounded-t-[28px] border shadow-2xl sm:rounded-3xl ${
            isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/[0.08] bg-zinc-950 text-zinc-100'
          }`}>
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className={`h-1 w-11 rounded-full ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            </div>

            <div className={`flex items-center justify-between border-b px-5 py-4 ${
              isLight ? 'border-zinc-200' : 'border-white/[0.06]'
            }`}>
              <div>
                <p className="font-data text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-500">
                  {referralShareCopy.preview}
                </p>
                <h3 className="mt-1 font-display text-lg font-semibold">{referralShareCopy.shareTitle}</h3>
              </div>
              <button
                type="button"
                onClick={closeReferralShare}
                className={`grid h-10 w-10 place-items-center rounded-xl border ${
                  isLight
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-500'
                    : 'border-white/[0.08] bg-white/[0.04] text-zinc-400'
                }`}
                aria-label={referralShareCopy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`max-h-[70dvh] overflow-y-auto p-4 sm:p-5 ${
              isLight ? 'bg-zinc-50/70' : 'bg-black/20'
            }`}>
              {referralShareBusy ? (
                <div className={`grid aspect-[4/5] place-items-center rounded-2xl border ${
                  isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-900'
                }`}>
                  <div className="text-center">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-amber-500" />
                    <p className="mt-3 text-xs text-zinc-500">{referralShareCopy.preparing}</p>
                  </div>
                </div>
              ) : referralShareUrl ? (
                <img
                  src={referralShareUrl}
                  alt={referralShareCopy.shareTitle}
                  className={`block w-full rounded-2xl border object-cover shadow-xl ${
                    isLight ? 'border-zinc-200' : 'border-white/[0.08]'
                  }`}
                />
              ) : null}
            </div>

            <div className={`grid grid-cols-2 gap-2 border-t px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5 ${
              isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-950'
            }`}>
              <button
                type="button"
                onClick={downloadReferralShareImage}
                disabled={referralShareBusy || !referralShareUrl}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  isLight
                    ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100'
                    : 'border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
                }`}
              >
                <Download className="h-4 w-4 stroke-[1.8]" />
                {referralShareCopy.saveImage}
              </button>

              <button
                type="button"
                onClick={shareReferralCard}
                disabled={referralShareBusy || !referralShareUrl}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/10 transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] disabled:opacity-40"
              >
                <Share2 className="h-4 w-4 stroke-[2]" />
                {referralShareCopy.share}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHARE RESULTS — native image preview + Web Share API */}
      {historyShareOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/75 px-0 pt-10 backdrop-blur-sm sm:items-center sm:px-4 sm:pt-0"
          onClick={(event) => { if (event.target === event.currentTarget) closeHistoryShare(); }}
        >
          <div className={`w-full max-w-md overflow-hidden rounded-t-[28px] border shadow-2xl sm:rounded-3xl ${
            isLight ? 'border-zinc-200 bg-white text-zinc-900' : 'border-white/[0.08] bg-zinc-950 text-zinc-100'
          }`}>
            <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
              <span className={`h-1 w-11 rounded-full ${isLight ? 'bg-zinc-300' : 'bg-zinc-700'}`} />
            </div>

            <div className={`flex items-center justify-between border-b px-5 py-4 ${isLight ? 'border-zinc-200' : 'border-white/[0.06]'}`}>
              <div>
                <p className="font-data text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-500">{historyShareCopy.preview}</p>
                <h3 className="mt-1 font-display text-lg font-semibold">{historyShareCopy.shareTitle}</h3>
              </div>
              <button
                type="button"
                onClick={closeHistoryShare}
                className={`grid h-10 w-10 place-items-center rounded-xl border ${
                  isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-500' : 'border-white/[0.08] bg-white/[0.04] text-zinc-400'
                }`}
                aria-label={historyShareCopy.close}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className={`max-h-[70dvh] overflow-y-auto p-4 sm:p-5 ${isLight ? 'bg-zinc-50/70' : 'bg-black/20'}`}>
              {historyShareBusy ? (
                <div className={`grid aspect-[4/5] place-items-center rounded-2xl border ${
                  isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-900'
                }`}>
                  <div className="text-center">
                    <RefreshCw className="mx-auto h-5 w-5 animate-spin text-amber-500" />
                    <p className="mt-3 text-xs text-zinc-500">{historyShareCopy.preparing}</p>
                  </div>
                </div>
              ) : historyShareUrl ? (
                <img
                  src={historyShareUrl}
                  alt={historyShareCopy.shareTitle}
                  className={`block w-full rounded-2xl border object-cover shadow-xl ${
                    isLight ? 'border-zinc-200' : 'border-white/[0.08]'
                  }`}
                />
              ) : null}
            </div>

            <div className={`border-t px-4 py-2.5 text-center text-[10px] leading-4 sm:px-5 ${
              isLight
                ? 'border-zinc-200 bg-white text-zinc-500'
                : 'border-white/[0.06] bg-zinc-950 text-zinc-500'
            }`}>
              {historyShareCopy.shareLinkHint}
              {referralCode && (
                <span className="ml-1 font-semibold text-amber-500">· +7 дней PRO</span>
              )}
            </div>

            <div className={`grid grid-cols-2 gap-2 border-t px-4 pt-3 pb-[max(14px,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5 ${
              isLight ? 'border-zinc-200 bg-white' : 'border-white/[0.06] bg-zinc-950'
            }`}>
              <button
                type="button"
                onClick={downloadHistoryShareImage}
                disabled={historyShareBusy || !historyShareUrl}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  isLight ? 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100' : 'border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.07]'
                }`}
              >
                <Download className="h-4 w-4 stroke-[1.8]" />
                {historyShareCopy.saveImage}
              </button>
              <button
                type="button"
                onClick={shareHistoryResult}
                disabled={historyShareBusy || !historyShareUrl}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-500/10 transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.99] disabled:opacity-40"
              >
                <Share2 className="h-4 w-4 stroke-[2]" />
                {historyShareCopy.share}
              </button>
            </div>
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
