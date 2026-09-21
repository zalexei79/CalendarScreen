import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, CalendarClock, Check, ChevronDown, Repeat2, X } from 'lucide-react';
import { CURRENCIES } from '../../shared/config/constants';

const COPY = {
  ru: {
    header: 'DAYRIS · НАПОМИНАНИЕ', newTitle: 'Новое событие', editTitle: 'Изменить напоминание', close: 'Закрыть',
    event: 'Событие', eventHint: 'что произойдёт', placeholder: 'Например, платёж по кредиту', amount: 'Сумма', amountHint: 'можно указать позже',
    expense: '− Расход', income: '＋ Доход', schedule: 'Расписание', repeat: 'Повторять', notify: 'Напомнить', time: 'Время события', localTime: 'по местному времени',
    end: 'Закончить', endHint: 'дата последнего повтора', noEnd: 'Без даты окончания', atTime: 'в момент события', one: 'Один раз', weekly: 'Каждую неделю',
    monthly: (day) => `Каждый месяц · ${day} числа`, yearly: 'Каждый год', before: (value) => `заранее · ${value}`, day: (day) => `DAYRIS будет напоминать каждого ${day} числа`,
    until: (date) => `до ${date}`, untilHint: 'Повтор прекратится после этой даты.', late: 'Раннее окно для ближайшего события уже прошло. Первое уведомление придёт в момент события, а следующие — по выбранному правилу.',
    editNote: 'Изменения применятся к этому напоминанию. Уже отправленные уведомления не дублируются.', createNote: 'План появится в календаре сразу. В баланс и статистику он попадёт только после подтверждения.',
    saving: 'Сохраняю…', save: 'Сохранить изменения', create: 'Создать напоминание', later: 'Сумму можно добавить позже — напоминание сохранится без неё.', future: 'Событие должно быть в будущем. Для ближайшего события выбери более позднюю дату или время.',
    invalidUntil: 'Дата окончания должна быть не раньше даты события.', quick: [['Кредит', 'Платёж по кредиту', 'expense'], ['Мобильная связь', 'Пополнение мобильного', 'expense'], ['Аренда', 'Аренда', 'expense'], ['Зарплата', 'Зарплата', 'income']],
  },
  en: {
    header: 'DAYRIS · REMINDER', newTitle: 'New event', editTitle: 'Edit reminder', close: 'Close',
    event: 'Event', eventHint: 'what will happen', placeholder: 'For example, credit payment', amount: 'Amount', amountHint: 'can be added later',
    expense: '− Expense', income: '＋ Income', schedule: 'Schedule', repeat: 'Repeat', notify: 'Remind me', time: 'Event time', localTime: 'local time',
    end: 'End repeat', endHint: 'last occurrence date', noEnd: 'No end date', atTime: 'at event time', one: 'Once', weekly: 'Every week',
    monthly: (day) => `Every month · day ${day}`, yearly: 'Every year', before: (value) => `in advance · ${value}`, day: (day) => `DAYRIS will remind you every ${day}th`,
    until: (date) => `until ${date}`, untilHint: 'Repeating stops after this date.', late: 'The early reminder window has passed. The first notification will arrive at the event time; future occurrences keep this rule.',
    editNote: 'Changes apply to this reminder. Already sent notifications will not be duplicated.', createNote: 'The plan appears in the calendar now. It enters balance and statistics only after confirmation.',
    saving: 'Saving…', save: 'Save changes', create: 'Create reminder', later: 'You can add the amount later — the reminder will still be saved.', future: 'The event must be in the future. Choose a later date or time.',
    invalidUntil: 'The end date must be on or after the event date.', quick: [['Credit', 'Credit payment', 'expense'], ['Mobile top-up', 'Mobile top-up', 'expense'], ['Rent', 'Rent', 'expense'], ['Salary', 'Salary', 'income']],
  },
  ro: {
    header: 'DAYRIS · MEMENTOU', newTitle: 'Eveniment nou', editTitle: 'Editează mementoul', close: 'Închide',
    event: 'Eveniment', eventHint: 'ce se va întâmpla', placeholder: 'De exemplu, plata creditului', amount: 'Sumă', amountHint: 'poate fi adăugată mai târziu',
    expense: '− Cheltuială', income: '＋ Venit', schedule: 'Program', repeat: 'Repetă', notify: 'Amintește-mi', time: 'Ora evenimentului', localTime: 'ora locală',
    end: 'Încheie repetarea', endHint: 'data ultimei repetări', noEnd: 'Fără dată de final', atTime: 'la ora evenimentului', one: 'O singură dată', weekly: 'În fiecare săptămână',
    monthly: (day) => `În fiecare lună · ziua ${day}`, yearly: 'În fiecare an', before: (value) => `în avans · ${value}`, day: (day) => `DAYRIS îți amintește în fiecare zi de ${day}`,
    until: (date) => `până la ${date}`, untilHint: 'Repetarea se oprește după această dată.', late: 'Fereastra de notificare anticipată a trecut. Prima notificare va veni la ora evenimentului, iar următoarele vor păstra regula.',
    editNote: 'Modificările se aplică acestui memento. Notificările deja trimise nu se repetă.', createNote: 'Planul apare imediat în calendar. Intră în sold și statistici doar după confirmare.',
    saving: 'Se salvează…', save: 'Salvează modificările', create: 'Creează memento', later: 'Poți adăuga suma mai târziu — mementoul va fi salvat.', future: 'Evenimentul trebuie să fie în viitor. Alege o dată sau o oră mai târzie.',
    invalidUntil: 'Data de final trebuie să fie după sau egală cu data evenimentului.', quick: [['Credit', 'Plata creditului', 'expense'], ['Telefon mobil', 'Reîncărcare mobil', 'expense'], ['Chirie', 'Chirie', 'expense'], ['Salariu', 'Salariu', 'income']],
  },
};
const OFFSET_MINUTES = { at_time: 0, '1_day': 1440, '3_days': 4320, '1_week': 10080 };

function resolveLanguage(language) {
  const code = String(language || '').toLowerCase();
  if (code === 'en' || code.startsWith('en-')) return 'en';
  if (code === 'ro' || code.startsWith('ro-') || code === 'md') return 'ro';
  return 'ru';
}

function eventDateLabel(dateKey, language) {
  const locale = resolveLanguage(language) === 'en' ? 'en-US' : resolveLanguage(language) === 'ro' ? 'ro-RO' : 'ru-RU';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
}

function shortDateLabel(dateKey, language) {
  const locale = resolveLanguage(language) === 'en' ? 'en-US' : resolveLanguage(language) === 'ro' ? 'ro-RO' : 'ru-RU';
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

function initialTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 10, 0, 0);
  return date.toTimeString().slice(0, 5);
}

function SelectValue({ value, onChange, options, isLight }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selectedLabel = options.find(([optionValue]) => optionValue === value)?.[1] || options[0]?.[1] || '';

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutside);
    return () => document.removeEventListener('mousedown', closeOnOutside);
  }, [open]);

  return <span ref={rootRef} className="relative inline-flex items-center">
    <button
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      onClick={() => setOpen((current) => !current)}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-right text-[11px] font-semibold transition ${
        open
          ? isLight ? 'bg-slate-100 text-slate-900' : 'bg-white/[0.08] text-zinc-100'
          : isLight ? 'text-slate-800 hover:bg-slate-50' : 'text-zinc-200 hover:bg-white/[0.05]'
      }`}
    >
      {selectedLabel}
      <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''} ${isLight ? 'text-slate-400' : 'text-zinc-500'}`} />
    </button>
    {open && <div role="listbox" className={`absolute right-0 top-full z-40 mt-1 min-w-[150px] overflow-hidden rounded-xl border p-1 shadow-2xl ${isLight ? 'border-slate-200 bg-white' : 'border-white/[0.12] bg-[#151719]'}`}>
      {options.map(([optionValue, label]) => <button
        type="button"
        role="option"
        aria-selected={optionValue === value}
        key={optionValue}
        onClick={() => { onChange(optionValue); setOpen(false); }}
        className={`block w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${
          optionValue === value
            ? isLight ? 'bg-slate-100 text-slate-950' : 'bg-white/[0.10] text-zinc-100'
            : isLight ? 'text-slate-600 hover:bg-slate-50 hover:text-slate-950' : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100'
        }`}
      >{label}</button>)}
    </div>}
  </span>;
}

export default function FinancePlanComposer({ open, dateKey, initialPlan = null, defaultCurrency, language = 'ru', isLight, onClose, onCreate, busy, error }) {
  const copy = COPY[resolveLanguage(language)];
  const [title, setTitle] = useState('Платёж по кредиту');
  const [amount, setAmount] = useState('');
  const [kind, setKind] = useState('expense');
  const [currency, setCurrency] = useState(defaultCurrency || 'USD');
  const [time, setTime] = useState(initialTime);
  const [repeatRule, setRepeatRule] = useState('none');
  const [remindOffset, setRemindOffset] = useState('at_time');
  const [repeatUntil, setRepeatUntil] = useState('');

  useEffect(() => {
    if (!open) return;
    setTitle(initialPlan?.title || copy.quick[0][1]);
    setAmount(initialPlan?.amount == null ? '' : String(initialPlan.amount));
    setKind(initialPlan?.kind || 'expense');
    setCurrency(initialPlan?.currency || defaultCurrency || 'USD');
    setTime(String(initialPlan?.local_at || '').match(/(?:T|\s)(\d{2}:\d{2})/)?.[1] || '09:00');
    setRepeatRule(initialPlan?.repeat_rule || 'none');
    setRemindOffset(initialPlan?.remind_offset || 'at_time');
    setRepeatUntil(initialPlan?.repeat_until || '');
  }, [open, dateKey, defaultCurrency, initialPlan?.id, language]);

  const eventAt = useMemo(() => new Date(`${dateKey}T${time}:00`), [dateKey, time]);
  const reminderAt = useMemo(() => new Date(eventAt.getTime() - (OFFSET_MINUTES[remindOffset] || 0) * 60000), [eventAt, remindOffset]);
  const reminderTooLate = remindOffset !== 'at_time' && reminderAt.getTime() <= Date.now();
  const dateLabel = eventDateLabel(dateKey, language);
  const dayNumber = new Date(`${dateKey}T12:00:00`).getDate();
  const repeatSummary = repeatRule === 'monthly' ? copy.monthly(dayNumber) : repeatRule === 'weekly' ? copy.weekly : repeatRule === 'yearly' ? copy.yearly : copy.one;
  const remindSummary = remindOffset === 'at_time' ? copy.atTime : copy.before(remindOffset === '1_day' ? (resolveLanguage(language) === 'en' ? '1 day' : resolveLanguage(language) === 'ro' ? '1 zi' : '1 день') : remindOffset === '3_days' ? (resolveLanguage(language) === 'en' ? '3 days' : resolveLanguage(language) === 'ro' ? '3 zile' : '3 дня') : (resolveLanguage(language) === 'en' ? '1 week' : resolveLanguage(language) === 'ro' ? '1 săptămână' : '1 неделю'));

  if (!open) return null;
  const editing = Boolean(initialPlan);
  const panel = isLight ? 'border-slate-200 bg-white text-slate-950' : 'border-white/[0.09] bg-[#0d0f10] text-zinc-100';
  const field = isLight ? 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400' : 'border-white/[0.09] bg-black/20 text-zinc-100 placeholder:text-zinc-600';
  const quiet = isLight ? 'bg-slate-50 text-slate-600' : 'bg-white/[0.045] text-zinc-300';
  const muted = isLight ? 'text-slate-500' : 'text-zinc-400';
  const errorTone = isLight
    ? 'border-rose-200 bg-rose-50 text-rose-600'
    : 'border-rose-400/15 bg-rose-500/[0.08] text-rose-300';

  function submit(event) {
    event.preventDefault();
    onCreate({ id: globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random()}`, title, amount, currency, kind, time, repeatRule, remindOffset, repeatUntil: repeatRule === 'none' ? null : repeatUntil || null });
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={submit} className={`w-full max-w-[430px] overflow-hidden rounded-[30px] border shadow-[0_28px_90px_rgba(0,0,0,.55)] ${panel}`}>
        <div className="border-b border-white/[0.06] px-5 pb-4 pt-4 sm:px-6">
          <div className="flex items-start justify-between gap-4"><div><p className="font-data text-[10px] uppercase tracking-[0.22em] text-amber-500">{copy.header}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.025em]">{editing ? copy.editTitle : copy.newTitle}</h2></div><button type="button" onClick={onClose} className={`grid h-9 w-9 place-items-center rounded-xl ${quiet}`} aria-label={copy.close}><X className="h-4 w-4" /></button></div>
          <div className={`mt-4 flex items-center gap-2 rounded-2xl px-3.5 py-3 text-sm ${quiet}`}><CalendarClock className="h-4 w-4 shrink-0 text-zinc-400" /><span className="capitalize">{dateLabel}</span><span className="ml-auto font-data text-xs">{time}</span></div>
        </div>

        <div className="max-h-[min(70dvh,610px)] space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <section><div className="mb-2 flex items-center justify-between"><p className={`font-data text-[11px] font-semibold uppercase tracking-[0.16em] ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>{copy.event}</p><span className={`text-[11px] ${muted}`}>{copy.eventHint}</span></div><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} className={`w-full rounded-2xl border px-4 py-3.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/10 ${field}`} placeholder={copy.placeholder} /><div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5">{copy.quick.map(([label, value, type]) => <button type="button" key={label} onClick={() => { setTitle(value); setKind(type); }} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] transition ${title === value ? (isLight ? 'bg-slate-200 text-slate-800' : 'bg-white/[0.09] text-zinc-200') : `${muted} hover:bg-white/[0.05]`}`}>{label}</button>)}</div></section>

          <section><div className="mb-2 flex items-center justify-between"><p className={`font-data text-[11px] font-semibold uppercase tracking-[0.16em] ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>{copy.amount}</p><span className={`text-[11px] ${muted}`}>{copy.amountHint}</span></div><div className={`flex items-center gap-3 rounded-2xl border px-4 py-3.5 transition focus-within:border-amber-400/70 focus-within:ring-2 focus-within:ring-amber-400/10 ${field}`}><input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(',', '.').replace(/[^0-9.]/g, ''))} className="min-w-0 flex-1 bg-transparent font-data text-4xl font-semibold tracking-[-0.04em] outline-none" placeholder="—" aria-label={copy.amount} /><div className={`flex shrink-0 gap-0.5 rounded-xl p-1 ${isLight ? 'bg-slate-100' : 'bg-white/[0.05]'}`}>{CURRENCIES.map((item) => <button type="button" key={item.code} onClick={() => setCurrency(item.code)} className={`grid h-8 min-w-8 place-items-center rounded-lg px-1.5 font-data text-xs transition ${currency === item.code ? (isLight ? 'bg-slate-200 text-slate-900' : 'bg-white/[0.11] text-zinc-100') : muted}`}>{item.symbol}</button>)}</div></div><div className={`mt-2 grid grid-cols-2 gap-1 rounded-xl p-1 ${isLight ? 'bg-slate-100' : 'bg-white/[0.04]'}`}><button type="button" onClick={() => setKind('expense')} className={`rounded-lg py-2 text-xs font-semibold transition ${kind === 'expense' ? (isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/[0.09] text-zinc-100') : muted}`}>{copy.expense}</button><button type="button" onClick={() => setKind('income')} className={`rounded-lg py-2 text-xs font-semibold transition ${kind === 'income' ? (isLight ? 'bg-white text-slate-900 shadow-sm' : 'bg-white/[0.09] text-zinc-100') : muted}`}>{copy.income}</button></div></section>

          <section><div className="mb-2 flex items-center justify-between"><p className={`font-data text-[11px] font-semibold uppercase tracking-[0.16em] ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>{copy.schedule}</p><span className={`text-[11px] ${muted}`}>{repeatSummary}</span></div><div className={`divide-y rounded-2xl border ${isLight ? 'divide-slate-100 border-slate-200 bg-white' : 'divide-white/[0.06] border-white/[0.09] bg-black/15'}`}><label className="flex items-center gap-3 px-4 py-3.5"><Repeat2 className="h-4 w-4 shrink-0 text-zinc-400" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{copy.repeat}</span><span className={`mt-0.5 block text-[11px] ${muted}`}>{repeatSummary}</span></span><SelectValue value={repeatRule} onChange={setRepeatRule} isLight={isLight} options={[['none', copy.one], ['weekly', copy.weekly], ['monthly', copy.monthly(dayNumber)], ['yearly', copy.yearly]]} /></label><label className="flex items-center gap-3 px-4 py-3.5"><BellRing className="h-4 w-4 shrink-0 text-zinc-400" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{copy.notify}</span><span className={`mt-0.5 block text-[11px] ${muted}`}>{remindSummary}</span></span><SelectValue value={remindOffset} onChange={setRemindOffset} isLight={isLight} options={[['at_time', copy.atTime], ['1_day', copy.before(resolveLanguage(language) === 'en' ? '1 day' : resolveLanguage(language) === 'ro' ? '1 zi' : '1 день')], ['3_days', copy.before(resolveLanguage(language) === 'en' ? '3 days' : resolveLanguage(language) === 'ro' ? '3 zile' : '3 дня')], ['1_week', copy.before(resolveLanguage(language) === 'en' ? '1 week' : resolveLanguage(language) === 'ro' ? '1 săptămână' : '1 неделю')]]} /></label><label className="flex items-center gap-3 px-4 py-3.5"><CalendarClock className="h-4 w-4 shrink-0 text-zinc-400" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{copy.time}</span><span className={`mt-0.5 block text-[11px] ${muted}`}>{copy.localTime}</span></span><input required type="time" value={time} onChange={(event) => setTime(event.target.value)} className={`bg-transparent font-data text-sm outline-none ${isLight ? 'text-slate-800' : 'text-zinc-200'} `} /></label>{repeatRule !== 'none' && <label className="flex items-center gap-3 px-4 py-3.5"><CalendarClock className="h-4 w-4 shrink-0 text-zinc-400" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{copy.end}</span><span className={`mt-0.5 block text-[11px] ${muted}`}>{repeatUntil ? copy.until(shortDateLabel(repeatUntil, language)) : copy.noEnd}</span></span><input type="date" min={dateKey} value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} className={`bg-transparent font-data text-[11px] outline-none ${isLight ? 'text-slate-800' : 'text-zinc-200'}`} aria-label={copy.endHint} /></label>}</div>{repeatRule === 'monthly' && <p className={`mt-2 rounded-xl px-3 py-2.5 text-xs ${quiet}`}>{copy.day(dayNumber)} {repeatUntil ? copy.until(shortDateLabel(repeatUntil, language)) : `· ${copy.noEnd.toLowerCase()}`}</p>}{reminderTooLate && <p role="alert" className="mt-2 rounded-xl bg-amber-400/10 px-3 py-2.5 text-xs leading-relaxed text-amber-500">{copy.late}</p>}</section>

          <p className={`rounded-2xl px-3.5 py-3 text-xs leading-relaxed ${quiet}`}>{editing ? copy.editNote : copy.createNote}</p>{error && <p role="alert" className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${errorTone}`}>{String(error).includes('TIME_OUT_OF_RANGE') ? copy.future : String(error).includes('INVALID_REPEAT_UNTIL') ? copy.invalidUntil : String(error).includes('reminders_check') ? copy.later : error}</p>}<button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3.5 text-sm font-bold text-zinc-950 shadow-lg shadow-amber-500/15 transition hover:bg-amber-300 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-45">{busy ? copy.saving : <><Check className="h-4 w-4" />{editing ? copy.save : copy.create}</>}</button>
        </div>
      </form>
    </div>
  );
}
