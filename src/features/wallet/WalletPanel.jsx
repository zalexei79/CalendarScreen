import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, BriefcaseBusiness, Check, ChevronDown,
  CircleDollarSign, CreditCard, Landmark, Plus, ShoppingBag, Trash2, Wallet, X,
} from 'lucide-react';
import { CURRENCIES, getCurrencyMeta } from '../../shared/config/constants';

const ONBOARDING_KEY = 'dayris_wallet_onboarding_v2';
const fieldClass = 'w-full rounded-2xl border border-white/10 bg-white/[.045] px-4 py-3.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/65 focus:bg-white/[.065]';

const COPY = {
  ru: {
    eyebrow: 'PRO · ЛИЧНЫЕ ДЕНЬГИ', title: 'Мой кошелёк', subtitle: 'Сколько денег у тебя реально сейчас',
    balance: 'Доступный баланс', month: 'за этот месяц', add: 'Добавить деньги', withdraw: 'Вывести деньги',
    recent: 'Последние операции', empty: 'Операций пока нет', emptyHint: 'Добавь деньги, когда они действительно появились в кошельке.',
    howMuch: 'Сколько?', source: 'Откуда деньги?', destination: 'Куда ушли деньги?', comment: 'Комментарий (необязательно)', date: 'Дата',
    tradingProfit: 'Прибыль с торговли', accountTopup: 'Пополнение счёта', otherIncome: 'Другой доход',
    accountWithdrawal: 'Вывел со счёта', expense: 'Расход', otherExpense: 'Другое',
    cancel: 'Отмена', saveAdd: 'Добавить', saveWithdraw: 'Вывести', saving: 'Сохраняю…', clear: 'Очистить историю',
    clearConfirm: 'Удалить всю историю кошелька? Это действие нельзя отменить.',
    introTitle: 'Кошелёк — это реальные деньги', introBody: 'Календарь показывает результат сделок. Кошелёк показывает сумму, которой ты действительно располагаешь.',
    introOne: 'Добавляй деньги только когда они реально поступили.', introTwo: 'Вывод и расходы уменьшают фактический баланс.', introThree: 'Торговый PnL никогда не меняет кошелёк автоматически.', introAction: 'Понятно, начать',
  },
  en: {
    eyebrow: 'PRO · PERSONAL MONEY', title: 'My wallet', subtitle: 'How much money you actually have now',
    balance: 'Available balance', month: 'this month', add: 'Add money', withdraw: 'Take money out',
    recent: 'Recent activity', empty: 'No activity yet', emptyHint: 'Add money when it actually reaches your wallet.',
    howMuch: 'How much?', source: 'Where did it come from?', destination: 'Where did it go?', comment: 'Comment (optional)', date: 'Date',
    tradingProfit: 'Trading profit', accountTopup: 'Account top-up', otherIncome: 'Other income',
    accountWithdrawal: 'Account withdrawal', expense: 'Expense', otherExpense: 'Other',
    cancel: 'Cancel', saveAdd: 'Add', saveWithdraw: 'Withdraw', saving: 'Saving…', clear: 'Clear history',
    clearConfirm: 'Delete the entire wallet history? This cannot be undone.',
    introTitle: 'The wallet is real money', introBody: 'The calendar shows trading performance. The wallet shows money you can actually use.',
    introOne: 'Add money only when it really arrives.', introTwo: 'Withdrawals and expenses reduce the real balance.', introThree: 'Trading PnL never changes the wallet automatically.', introAction: 'Got it, start',
  },
  ro: {
    eyebrow: 'PRO · BANI PERSONALI', title: 'Portofelul meu', subtitle: 'Câți bani ai în realitate acum',
    balance: 'Sold disponibil', month: 'luna aceasta', add: 'Adaugă bani', withdraw: 'Scoate bani',
    recent: 'Operațiuni recente', empty: 'Nu există operațiuni', emptyHint: 'Adaugă bani când au ajuns cu adevărat în portofel.',
    howMuch: 'Cât?', source: 'De unde vin banii?', destination: 'Unde au plecat banii?', comment: 'Comentariu (opțional)', date: 'Data',
    tradingProfit: 'Profit din tranzacționare', accountTopup: 'Alimentare cont', otherIncome: 'Alt venit',
    accountWithdrawal: 'Retragere din cont', expense: 'Cheltuială', otherExpense: 'Altceva',
    cancel: 'Anulează', saveAdd: 'Adaugă', saveWithdraw: 'Retrage', saving: 'Se salvează…', clear: 'Șterge istoricul',
    clearConfirm: 'Ștergi tot istoricul portofelului? Acțiunea nu poate fi anulată.',
    introTitle: 'Portofelul înseamnă bani reali', introBody: 'Calendarul arată rezultatul tranzacțiilor. Portofelul arată banii pe care îi poți folosi.',
    introOne: 'Adaugă bani doar când au intrat în realitate.', introTwo: 'Retragerile și cheltuielile reduc soldul real.', introThree: 'PnL-ul nu schimbă automat portofelul.', introAction: 'Am înțeles',
  },
};

function localeOf(language) {
  return language === 'en' ? 'en' : language === 'ro' || language === 'md' ? 'ro' : 'ru';
}

export default function WalletPanel({
  language = 'ru', isLight, currency, transactions, transfers = [], balanceByCurrency,
  loading, error, onSave, onDelete, onClearHistory = async () => {},
}) {
  const copy = COPY[localeOf(language)];
  const [code, setCode] = useState(currency || 'USD');
  const [composer, setComposer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [onboarding, setOnboarding] = useState(() => {
    try { return localStorage.getItem(ONBOARDING_KEY) !== '1'; } catch { return false; }
  });
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const rows = useMemo(() => transactions.filter((item) => item.currency === code), [transactions, code]);
  const balance = balanceByCurrency[code] || 0;
  const symbol = getCurrencyMeta(code).symbol;
  const monthNet = rows.filter((item) => item.dateKey?.startsWith(monthPrefix)).reduce((sum, item) => sum + (item.kind === 'expense' ? -item.amount : item.amount), 0);
  const activities = useMemo(() => [
    ...rows.map((item) => ({ ...item, activityType: item.kind, activityDate: item.dateKey })),
    ...transfers.filter((item) => item.currency === code).map((item) => ({ ...item, id: `legacy-transfer-${item.id}`, activityType: item.to_account === 'wallet' ? 'legacyIncome' : 'legacyExpense', activityDate: item.date_key, amount: Number(item.amount) || 0, title: item.to_account === 'wallet' ? copy.accountTopup : copy.accountWithdrawal })),
  ].sort((a, b) => String(b.activityDate).localeCompare(String(a.activityDate))), [rows, transfers, code, copy]);

  const openComposer = (kind) => {
    setActionError('');
    setComposer({ kind, reason: kind === 'income' ? 'tradingProfit' : 'accountWithdrawal', amount: '', dateKey: today, comment: '' });
  };
  const closeOnboarding = () => {
    try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* best effort */ }
    setOnboarding(false);
  };
  const submit = async (event) => {
    event.preventDefault();
    const reasonLabels = {
      tradingProfit: copy.tradingProfit, accountTopup: copy.accountTopup, otherIncome: copy.otherIncome,
      accountWithdrawal: copy.accountWithdrawal, expense: copy.expense, otherExpense: copy.otherExpense,
    };
    setBusy(true); setActionError('');
    try {
      await onSave({ dateKey: composer.dateKey, time: new Date().toTimeString().slice(0, 5), title: reasonLabels[composer.reason], amount: Number(composer.amount), kind: composer.kind, currency: code, comment: composer.comment });
      setComposer(null);
    } catch (saveError) {
      setActionError(saveError.message || 'SAVE_FAILED');
    } finally { setBusy(false); }
  };

  const reasonOptions = composer?.kind === 'income'
    ? [['tradingProfit', BriefcaseBusiness, copy.tradingProfit], ['accountTopup', CreditCard, copy.accountTopup], ['otherIncome', CircleDollarSign, copy.otherIncome]]
    : [['accountWithdrawal', Landmark, copy.accountWithdrawal], ['expense', ShoppingBag, copy.expense], ['otherExpense', ArrowUpRight, copy.otherExpense]];

  return <section className={`min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-8 sm:py-8 ${isLight ? 'bg-[#f4f6f8]' : 'bg-[#08090c]'}`}>
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <p className="font-data text-[10px] uppercase tracking-[.28em] text-amber-500">{copy.eyebrow}</p>
        <h2 className={`mt-2 text-3xl font-semibold tracking-tight ${isLight ? 'text-zinc-950' : 'text-white'}`}>{copy.title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{copy.subtitle}</p>
      </header>

      <div className="relative overflow-hidden rounded-[30px] border border-amber-400/20 bg-gradient-to-br from-[#211d12] via-[#121317] to-[#090a0d] p-6 shadow-[0_28px_90px_rgba(0,0,0,.35)] sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-amber-300"><Wallet className="h-4 w-4" /><span className="font-data text-[10px] uppercase tracking-[.2em]">Wallet account</span></div><p className="mt-8 text-xs text-zinc-500">{copy.balance}</p><p className={`mt-1 font-data text-4xl font-semibold tracking-tight text-white sm:text-5xl ${loading ? 'animate-pulse opacity-40' : ''}`}>{loading ? '—' : `${balance < 0 ? '−' : ''}${symbol}${Math.abs(balance).toLocaleString(localeOf(language), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</p><p className={`mt-2 text-xs ${monthNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{monthNet >= 0 ? '+' : '−'}{symbol}{Math.abs(monthNet).toFixed(2)} {copy.month}</p></div>
          <div className="relative"><select value={code} onChange={(event) => setCode(event.target.value)} className="appearance-none rounded-xl border border-white/10 bg-[#17181d] py-2.5 pl-3 pr-9 text-xs font-semibold text-zinc-100" style={{ colorScheme: 'dark' }}>{CURRENCIES.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.symbol}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 text-zinc-500" /></div>
        </div>
        <div className="relative mt-8 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => openComposer('income')} className="flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300"><Plus className="h-4 w-4" />{copy.add}</button>
          <button type="button" onClick={() => openComposer('expense')} className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[.05] px-4 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/[.09]"><ArrowUpRight className="h-4 w-4" />{copy.withdraw}</button>
        </div>
      </div>

      {error && <p className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[.06] p-4 text-xs text-red-300">{String(error).includes('MIGRATION') ? 'Wallet sync is not configured in Supabase.' : String(error)}</p>}

      <div className="mt-8 flex items-center gap-2"><CreditCard className="h-4 w-4 text-amber-500" /><h3 className={`text-sm font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{copy.recent}</h3><span className="text-xs text-zinc-500">· {activities.length}</span></div>
      <div className="mt-3 space-y-2">
        {!loading && activities.length === 0 && <div className={`rounded-3xl border border-dashed p-10 text-center ${isLight ? 'border-zinc-300 bg-white' : 'border-white/10 bg-white/[.02]'}`}><Wallet className="mx-auto h-8 w-8 text-zinc-600" /><p className="mt-3 text-sm font-semibold">{copy.empty}</p><p className="mt-1 text-xs text-zinc-500">{copy.emptyHint}</p></div>}
        {activities.map((item) => { const positive = item.activityType === 'income' || item.activityType === 'legacyIncome'; const legacy = item.activityType.startsWith('legacy'); return <div key={item.id} className={`flex items-center gap-3 rounded-2xl border p-3.5 ${isLight ? 'border-zinc-200 bg-white' : 'border-white/[.07] bg-white/[.025]'}`}><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${positive ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'}`}>{positive ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.title}</p><p className="text-xs text-zinc-500">{item.activityDate}{item.comment ? ` · ${item.comment}` : ''}</p></div><span className={`font-data text-sm font-semibold ${positive ? 'text-emerald-500' : 'text-red-500'}`}>{positive ? '+' : '−'}{getCurrencyMeta(item.currency).symbol}{Number(item.amount).toFixed(2)}</span>{!legacy && <button type="button" aria-label="Delete" onClick={() => onDelete(item.id)} className="rounded-lg p-2 text-zinc-600 hover:bg-red-400/10 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>}</div>; })}
      </div>
      {activities.length > 0 && <button type="button" onClick={async () => { if (window.confirm(copy.clearConfirm)) await onClearHistory(); }} className="mt-4 text-xs text-zinc-500 hover:text-red-400">{copy.clear}</button>}
    </div>

    {composer && <div className="fixed inset-0 z-[220] flex items-end justify-center bg-black/65 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setComposer(null); }}><form onSubmit={submit} className="w-full max-w-lg rounded-t-[30px] border border-white/10 bg-[#111216] p-5 shadow-2xl sm:rounded-[30px] sm:p-6"><div className="flex items-start justify-between"><div><p className="font-data text-[10px] uppercase tracking-[.2em] text-amber-400">{composer.kind === 'income' ? copy.add : copy.withdraw}</p><h3 className="mt-1 text-2xl font-semibold text-white">{composer.kind === 'income' ? copy.add : copy.withdraw}</h3></div><button type="button" onClick={() => setComposer(null)} className="rounded-full bg-white/5 p-2 text-zinc-500"><X className="h-4 w-4" /></button></div><label className="mt-6 block text-xs text-zinc-500">{copy.howMuch}<div className="relative mt-2"><span className="absolute left-4 top-3.5 font-data text-lg text-amber-400">{symbol}</span><input autoFocus required type="number" min="0.01" step="0.01" value={composer.amount} onChange={(event) => setComposer({ ...composer, amount: event.target.value })} placeholder="0.00" className={`${fieldClass} pl-10 font-data text-lg`} /></div></label><p className="mt-5 text-xs text-zinc-500">{composer.kind === 'income' ? copy.source : copy.destination}</p><div className="mt-2 grid gap-2">{reasonOptions.map(([key, Icon, label]) => <button key={key} type="button" onClick={() => setComposer({ ...composer, reason: key })} className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm transition ${composer.reason === key ? 'border-amber-400/45 bg-amber-400/[.09] text-amber-300' : 'border-white/[.07] bg-white/[.025] text-zinc-300'}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5"><Icon className="h-4 w-4" /></span>{label}{composer.reason === key && <Check className="ml-auto h-4 w-4" />}</button>)}</div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-xs text-zinc-500">{copy.date}<input required type="date" value={composer.dateKey} onChange={(event) => setComposer({ ...composer, dateKey: event.target.value })} className={`${fieldClass} mt-1.5`} /></label><label className="text-xs text-zinc-500">{copy.comment}<input value={composer.comment} onChange={(event) => setComposer({ ...composer, comment: event.target.value })} className={`${fieldClass} mt-1.5`} /></label></div>{actionError && <p className="mt-3 text-xs text-red-400">{actionError}</p>}<button disabled={busy} className="mt-5 w-full rounded-2xl bg-amber-400 px-4 py-3.5 font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:opacity-60">{busy ? copy.saving : `${composer.kind === 'income' ? copy.saveAdd : copy.saveWithdraw} ${symbol}${composer.amount || '0'}`}</button></form></div>}

    {onboarding && <div className="fixed inset-0 z-[230] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"><div className="w-full max-w-md overflow-hidden rounded-[30px] border border-amber-400/20 bg-gradient-to-br from-[#211d12] to-[#0e0f12] p-6 shadow-2xl"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-zinc-950"><Wallet className="h-6 w-6" /></span><h3 className="mt-5 text-2xl font-semibold text-white">{copy.introTitle}</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{copy.introBody}</p><div className="mt-5 space-y-3">{[copy.introOne, copy.introTwo, copy.introThree].map((text, index) => <div key={text} className="flex gap-3 rounded-2xl bg-white/[.04] p-3 text-sm text-zinc-300"><span className="font-data text-amber-400">0{index + 1}</span><span>{text}</span></div>)}</div><button type="button" onClick={closeOnboarding} className="mt-6 w-full rounded-2xl bg-amber-400 px-4 py-3.5 font-semibold text-zinc-950">{copy.introAction}</button></div></div>}
  </section>;
}
