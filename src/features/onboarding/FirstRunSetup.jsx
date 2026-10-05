import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sun, Moon } from 'lucide-react';
import { CURRENCIES } from '../../shared/config/constants';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import LifeStory, { LIFE_COPY } from './LifeStory.jsx';
import { birthdayStorageKey, lifeWeeks, localDateValue } from './lifeStoryModel';

const COPY = {
  zh: {
    steps: ['语言', '你的节奏', '第一天'], next: '继续', back: '返回', skip: '自行探索',
    languageTitle: '用你熟悉的语言。', languageHint: '选择你喜欢的语言。',
    currencyTitle: '为你量身设置。', currencyHint: '使用哪种货币记账？',
    later: '可以随时在设置中更改货币和外观。', appearance: '外观', light: '浅色', dark: '深色',
    introTitle: '财务全貌。\n从每一条记录开始。', introHint: '收入和支出记录每一天，日历将这些日子汇成清晰的财务全貌。',
    create: '我的第一条记录', example: '示例 · 不会保存', coffee: '咖啡', income: '兼职收入', balance: '当日结余',
    tagline: '每一天\n都重要。', caption: '你的资金，你的选择，你的节奏。',
    currencies: ['美元', '欧元', '摩尔多瓦列伊', '俄罗斯卢布', '人民币'], finish: '最后一步：添加第一条记录。',
  },
  ru: {
    steps: ['Язык', 'Твой ритм', 'Первый день'], next: 'Продолжить', back: 'Назад', skip: 'Осмотрюсь сам',
    languageTitle: 'Давай на твоём языке.', languageHint: 'Выбери язык, на котором тебе удобно.',
    currencyTitle: 'Настроим под тебя.', currencyHint: 'В какой валюте будем считать?',
    later: 'Валюту и оформление можно изменить в настройках.', appearance: 'Оформление', light: 'Светлое', dark: 'Тёмное',
    introTitle: 'Большая картина.\nИз маленьких записей.', introHint: 'Доходы и расходы складываются в историю дня. А дни — в понятный календарь.',
    create: 'Моя первая запись', example: 'Пример · без сохранения', coffee: 'Кофе', income: 'Подработка', balance: 'Итог дня',
    tagline: 'Каждый день\nимеет значение.', caption: 'Твои деньги. Твои решения. Твой ритм.',
    currencies: ['Доллар США', 'Евро', 'Молдавский лей', 'Российский рубль', 'Китайский юань'],
    finish: 'Последний шаг — твоя первая запись.',
  },
  en: {
    steps: ['Language', 'Your rhythm', 'First day'], next: 'Continue', back: 'Back', skip: 'Explore on my own',
    languageTitle: 'Let’s speak your language.', languageHint: 'Choose the language you feel at home in.',
    currencyTitle: 'Make it yours.', currencyHint: 'Which currency will you use?',
    later: 'You can change currency and appearance in Settings.', appearance: 'Appearance', light: 'Light', dark: 'Dark',
    introTitle: 'The big picture.\nOne entry at a time.', introHint: 'Income and expenses tell the story of a day. Your calendar brings those days together.',
    create: 'My first entry', example: 'Example · not saved', coffee: 'Coffee', income: 'Side job', balance: 'Daily balance',
    tagline: 'Every day\nmatters.', caption: 'Your money. Your choices. Your rhythm.',
    currencies: ['US dollar', 'Euro', 'Moldovan leu', 'Russian ruble', 'Chinese yuan'], finish: 'One last step: your first entry.',
  },
  ro: {
    steps: ['Limba', 'Ritmul tău', 'Prima zi'], next: 'Continuă', back: 'Înapoi', skip: 'Explorez singur',
    languageTitle: 'Să vorbim pe limba ta.', languageHint: 'Alege limba în care te simți confortabil.',
    currencyTitle: 'Pe gustul tău.', currencyHint: 'În ce monedă vei ține evidența?',
    later: 'Poți schimba moneda și aspectul din Setări.', appearance: 'Aspect', light: 'Luminos', dark: 'Întunecat',
    introTitle: 'Imaginea de ansamblu.\nÎnregistrare cu înregistrare.', introHint: 'Veniturile și cheltuielile spun povestea zilei. Calendarul adună toate aceste zile.',
    create: 'Prima mea înregistrare', example: 'Exemplu · nu se salvează', coffee: 'Cafea', income: 'Venit suplimentar', balance: 'Bilanțul zilei',
    tagline: 'Fiecare zi\ncontează.', caption: 'Banii tăi. Alegerile tale. Ritmul tău.',
    currencies: ['Dolar american', 'Euro', 'Leu moldovenesc', 'Rublă rusească', 'Yuan chinezesc'], finish: 'Ultimul pas: prima ta înregistrare.',
  },
};
const LANGUAGES = [{ code: 'ru', name: 'Русский', hint: 'Russian' }, { code: 'en', name: 'English', hint: 'English' }, { code: 'md', name: 'Română', hint: 'Romanian' }, { code: 'zh-CN', name: '简体中文', hint: 'Simplified Chinese' }];

export default function FirstRunSetup({ step, language, currency, theme, profileKey = 'guest', onLanguage, onCurrency, onTheme, onStep, onStart, onArrive, onSkip }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const lang = language === 'zh-CN' ? 'zh' : language === 'md' || language === 'ro' ? 'ro' : language === 'en' ? 'en' : 'ru';
  const copy = COPY[lang];
  const lifeCopy = LIFE_COPY[lang];
  const [birthday, setBirthday] = useState('');
  const [dateError, setDateError] = useState(false);
  const story = step === 'intro';
  const light = theme === 'light';
  const index = step === 'language' ? 0 : step === 'birthday' || story ? 2 : 1;
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';
  const selected = light ? 'border-amber-500 bg-amber-50 shadow-[0_0_0_1px_#f59e0b]' : 'border-amber-400/70 bg-amber-400/[0.08] shadow-[0_0_0_1px_rgba(251,191,36,.25)]';
  const idle = light ? 'border-zinc-200 bg-white hover:border-zinc-400' : 'border-white/10 bg-white/[0.025] hover:border-white/25';

  useEffect(() => {
    try { setBirthday(window.localStorage.getItem(birthdayStorageKey(profileKey)) || ''); }
    catch { setBirthday(''); }
  }, [profileKey]);

  const startStory = (withoutDate = false) => {
    if (!withoutDate && !lifeWeeks(birthday)) { setDateError(true); return; }
    const value = withoutDate ? '' : birthday;
    setBirthday(value);
    setDateError(false);
    try {
      if (value) window.localStorage.setItem(birthdayStorageKey(profileKey), value);
      else window.localStorage.removeItem(birthdayStorageKey(profileKey));
    } catch { /* The scene works without persistent browser storage. */ }
    onStep('intro');
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    if (story) dialogRef.current?.querySelector('#first-run-heading')?.focus();
    else headingRef.current?.focus();
    dialogRef.current?.scrollTo(0, 0);
  }, [step]);

  return (
    <dialog ref={dialogRef} aria-labelledby="first-run-heading" onCancel={(event) => { event.preventDefault(); onSkip(); }}
      className={`first-run-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-black/75 backdrop:backdrop-blur-md ${light ? 'text-zinc-900' : 'text-zinc-100'}`}>
      {story ? <LifeStory birthday={birthday} lang={lang} onStart={onStart} onArrive={onArrive} onSkip={onSkip} onBack={() => onStep('birthday')} /> : <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className={`grid w-full max-w-[940px] overflow-hidden rounded-[28px] border shadow-2xl md:grid-cols-[0.85fr_1.15fr] ${light ? 'border-white bg-[#faf9f6]' : 'border-white/10 bg-[#111214]'}`}>
          <div className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[#171811] p-9 text-white md:flex">
            <div className="pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative flex items-center gap-3"><BrandIcon className="h-10 w-10" /><span className="text-sm font-semibold tracking-[0.16em]">DAYRIS</span></div>
            <div className="relative py-12">
              <h2 className="whitespace-pre-line text-[38px] font-semibold leading-[1.12] tracking-[-0.045em]">{copy.tagline}</h2>
              <div className="mt-8 grid grid-cols-7 gap-1.5" aria-hidden="true">
                {Array.from({ length: 28 }, (_, day) => <div key={day} className={`flex aspect-square items-center justify-center rounded-lg text-[10px] ${day === 19 ? 'bg-amber-300 font-bold text-zinc-950 shadow-[0_4px_25px_rgba(252,211,77,.18)]' : [3, 8, 13, 16, 24].includes(day) ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/[0.04] text-white/30'}`}>{day + 1}</div>)}
              </div>
            </div>
            <p className="relative max-w-[240px] text-xs leading-relaxed text-white/40">{copy.caption}</p>
          </div>

          <div className="flex min-w-0 flex-col p-5 sm:p-9">
            <div className="mb-7 flex items-center gap-2 md:hidden"><BrandIcon className="h-8 w-8" /><span className="text-xs font-semibold tracking-[0.16em]">DAYRIS</span></div>
            <nav aria-label={copy.steps.join(' / ')} className="mb-8 flex gap-2">
              {copy.steps.map((label, item) => <div key={label} aria-current={item === index ? 'step' : undefined} className="min-w-0 flex-1">
                <div className={`mb-2 h-1 rounded-full ${item <= index ? 'bg-amber-400' : light ? 'bg-zinc-200' : 'bg-white/10'}`} />
                <span className={`text-[10px] font-medium ${item === index ? light ? 'text-zinc-800' : 'text-zinc-200' : muted}`}>{String(item + 1).padStart(2, '0')} · {label}</span>
              </div>)}
            </nav>
            <div className="flex-1">
              <h1 id="first-run-heading" ref={headingRef} tabIndex={-1} className="whitespace-pre-line text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] outline-none sm:text-[34px]">{index === 0 ? copy.languageTitle : index === 1 ? copy.currencyTitle : lifeCopy.birthdayTitle}</h1>
              <p className={`mt-3 text-sm leading-relaxed ${muted}`}>{index === 0 ? copy.languageHint : index === 1 ? copy.currencyHint : lifeCopy.birthdayHint}</p>

              {index === 0 && <div className="mt-7 space-y-2.5" role="group" aria-label={copy.languageHint}>
                {LANGUAGES.map((item) => {
                  const active = lang === (item.code === 'md' ? 'ro' : item.code);
                  return <button key={item.code} type="button" aria-pressed={active} onClick={() => onLanguage(item)} className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active ? selected : idle}`}>
                    <span className={`grid h-10 w-10 place-items-center rounded-xl text-xs font-semibold ${light ? 'bg-black/[0.04]' : 'bg-white/[0.05]'}`}>{item.code === 'md' ? 'RO' : item.code.toUpperCase()}</span>
                    <span className="flex-1"><span lang={item.code === 'md' ? 'ro' : item.code} className="block text-sm font-semibold">{item.name}</span><span className={`mt-0.5 block text-[11px] ${muted}`}>{item.hint}</span></span>
                    {active && <Check className="h-4 w-4 text-amber-500" aria-hidden="true" />}
                  </button>;
                })}
              </div>}

              {index === 1 && <>
                <div className="mt-6 grid grid-cols-2 gap-2.5" role="group" aria-label={copy.currencyHint}>
                  {CURRENCIES.map((item, i) => <button key={item.code} type="button" aria-pressed={currency === item.code} onClick={() => onCurrency(item.code)} className={`relative rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${currency === item.code ? selected : idle}`}>
                    {currency === item.code && <Check className="absolute right-3 top-3 h-3.5 w-3.5 text-amber-500" aria-hidden="true" />}
                    <span className="mb-3 block text-2xl font-medium">{item.symbol}</span><span className="block text-xs font-semibold">{item.code}</span><span className={`mt-1 block text-[10px] ${muted}`}>{copy.currencies[i]}</span>
                  </button>)}
                </div>
                <div className="mt-6 flex items-center justify-between gap-3">
                  <span className={`text-xs ${muted}`}>{copy.appearance}</span>
                  <div className={`flex gap-1 rounded-xl p-1 ${light ? 'bg-zinc-200/60' : 'bg-black/25'}`}>
                    {[[true, Sun, copy.light], [false, Moon, copy.dark]].map(([value, Icon, label]) => <button key={label} type="button" aria-pressed={light === value} onClick={() => onTheme(value ? 'light' : 'dark')} className={`flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${light === value ? light ? 'bg-white text-zinc-900 shadow-sm' : 'bg-white/10 text-zinc-100' : muted}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
                  </div>
                </div>
                <p className={`mt-4 text-[11px] leading-relaxed ${muted}`}>{copy.later}</p>
              </>}

              {index === 2 && <form className="mt-8" onSubmit={event => { event.preventDefault(); startStory(); }}>
                <label htmlFor="life-birthday" className={`text-xs ${muted}`}>{lifeCopy.birthdayLabel}</label>
                <input id="life-birthday" className="life-birthday-field" type="date" max={localDateValue()} value={birthday} onChange={event => { setBirthday(event.target.value); setDateError(false); }} aria-invalid={dateError} aria-describedby={dateError ? 'life-birthday-error' : 'life-birthday-note'} />
                <p id="life-birthday-note" className={`mt-3 text-[11px] ${muted}`}>{lifeCopy.birthdayNote}</p>
                {dateError && <p id="life-birthday-error" role="alert" className="mt-3 text-xs text-rose-500">{lifeCopy.invalid}</p>}
                <button type="button" className={`mt-5 min-h-11 text-xs underline underline-offset-4 ${muted}`} onClick={() => startStory(true)}>{lifeCopy.noDate}</button>
              </form>}
            </div>
            <div className="mt-8">
              <div className="flex gap-2">
                {index > 0 && <button type="button" onClick={() => onStep(index === 1 ? 'language' : 'currency')} aria-label={copy.back} className={`grid w-12 shrink-0 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${idle}`}><ArrowLeft className="h-4 w-4" /></button>}
                <button type="button" onClick={() => index === 2 ? startStory() : onStep(index === 0 ? 'currency' : 'birthday')} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">{copy.next}<ArrowRight className="h-4 w-4" /></button>
              </div>
              <button type="button" onClick={onSkip} className={`mt-3 min-h-10 w-full rounded-xl text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${muted} ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}>{copy.skip}</button>
            </div>
          </div>
        </div>
      </div>}
    </dialog>
  );
}
