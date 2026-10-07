import BirthdayField from './BirthdayField.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sun, Moon } from 'lucide-react';
import { CURRENCIES } from '../../shared/config/constants';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import LifeStory, { LIFE_COPY } from './LifeStory.jsx';
import { birthdayStorageKey, lifeWeeks, localDateValue } from './lifeStoryModel';
import './FirstRunSetup.css';

const COPY = {
  zh: {
    productType: '财务日历', productTitle: '你的财务，\n尽在日历。', productHint: '记录每天的收入与支出。\n在日历中看清资金流向。', previewTitle: '一天的示例', incomeLabel: '收入', expenseLabel: '支出',
    steps: ['语言', '你的节奏', '第一天'], next: '继续', back: '返回', skip: '自行探索',
    languageTitle: '用你熟悉的语言。', languageHint: '选择你喜欢的语言。',
    currencyTitle: '为你量身设置。', currencyHint: '使用哪种货币记账？',
    later: '可以随时在设置中更改货币和外观。', appearance: '外观', light: '浅色', dark: '深色', purple: '紫水晶', emerald: '翡翠绿',
    introTitle: '财务全貌。\n从每一条记录开始。', introHint: '收入和支出记录每一天，日历将这些日子汇成清晰的财务全貌。',
    create: '我的第一条记录', example: '示例 · 不会保存', coffee: '咖啡', income: '兼职收入', balance: '当日结余',
    tagline: '每一天\n都重要。', caption: '你的资金，你的选择，你的节奏。',
    currencies: ['美元', '欧元', '摩尔多瓦列伊', '俄罗斯卢布', '人民币'], finish: '最后一步：添加第一条记录。',
  },
  ru: {
    productType: 'Денежный календарь', productTitle: 'Твой денежный\nкалендарь.', productHint: 'Записывай доходы и расходы.\nВ календаре видно, куда уходят деньги.', previewTitle: 'Пример дня', incomeLabel: 'Доход', expenseLabel: 'Расход',
    steps: ['Язык', 'Твой ритм', 'Первый день'], next: 'Продолжить', back: 'Назад', skip: 'Осмотрюсь сам',
    languageTitle: 'Давай на твоём языке.', languageHint: 'Выбери язык, на котором тебе удобно.',
    currencyTitle: 'Настроим под тебя.', currencyHint: 'В какой валюте будем считать?',
    later: 'Валюту и оформление можно изменить в настройках.', appearance: 'Оформление', light: 'Светлое', dark: 'Тёмное', purple: 'Аметист', emerald: 'Изумрудное',
    introTitle: 'Большая картина.\nИз маленьких записей.', introHint: 'Доходы и расходы складываются в историю дня. А дни — в понятный календарь.',
    create: 'Моя первая запись', example: 'Пример · без сохранения', coffee: 'Кофе', income: 'Подработка', balance: 'Итог дня',
    tagline: 'Каждый день\nимеет значение.', caption: 'Твои деньги. Твои решения. Твой ритм.',
    currencies: ['Доллар США', 'Евро', 'Молдавский лей', 'Российский рубль', 'Китайский юань'],
    finish: 'Последний шаг — твоя первая запись.',
  },
  en: {
    productType: 'Money calendar', productTitle: 'Your money\ncalendar.', productHint: 'Track income and expenses.\nSee where your money goes, in your calendar.', previewTitle: 'An example day', incomeLabel: 'Income', expenseLabel: 'Expense',
    steps: ['Language', 'Your rhythm', 'First day'], next: 'Continue', back: 'Back', skip: 'Explore on my own',
    languageTitle: 'Let’s speak your language.', languageHint: 'Choose the language you feel at home in.',
    currencyTitle: 'Make it yours.', currencyHint: 'Which currency will you use?',
    later: 'You can change currency and appearance in Settings.', appearance: 'Appearance', light: 'Light', dark: 'Dark', purple: 'Amethyst', emerald: 'Emerald',
    introTitle: 'The big picture.\nOne entry at a time.', introHint: 'Income and expenses tell the story of a day. Your calendar brings those days together.',
    create: 'My first entry', example: 'Example · not saved', coffee: 'Coffee', income: 'Side job', balance: 'Daily balance',
    tagline: 'Every day\nmatters.', caption: 'Your money. Your choices. Your rhythm.',
    currencies: ['US dollar', 'Euro', 'Moldovan leu', 'Russian ruble', 'Chinese yuan'], finish: 'One last step: your first entry.',
  },
  ro: {
    productType: 'Calendar financiar', productTitle: 'Calendarul tău\nfinanciar.', productHint: 'Notează veniturile și cheltuielile.\nVezi în calendar unde se duc banii.', previewTitle: 'O zi, de exemplu', incomeLabel: 'Venit', expenseLabel: 'Cheltuială',
    steps: ['Limba', 'Ritmul tău', 'Prima zi'], next: 'Continuă', back: 'Înapoi', skip: 'Explorez singur',
    languageTitle: 'Să vorbim pe limba ta.', languageHint: 'Alege limba în care te simți confortabil.',
    currencyTitle: 'Pe gustul tău.', currencyHint: 'În ce monedă vei ține evidența?',
    later: 'Poți schimba moneda și aspectul din Setări.', appearance: 'Aspect', light: 'Luminos', dark: 'Întunecat', purple: 'Ametist', emerald: 'Smarald',
    introTitle: 'Imaginea de ansamblu.\nÎnregistrare cu înregistrare.', introHint: 'Veniturile și cheltuielile spun povestea zilei. Calendarul adună toate aceste zile.',
    create: 'Prima mea înregistrare', example: 'Exemplu · nu se salvează', coffee: 'Cafea', income: 'Venit suplimentar', balance: 'Bilanțul zilei',
    tagline: 'Fiecare zi\ncontează.', caption: 'Banii tăi. Alegerile tale. Ritmul tău.',
    currencies: ['Dolar american', 'Euro', 'Leu moldovenesc', 'Rublă rusească', 'Yuan chinezesc'], finish: 'Ultimul pas: prima ta înregistrare.',
  },
};
const EMPTY_RECORDS = [];
const LANGUAGES = [{ code: 'ru', name: 'Русский', hint: 'Russian' }, { code: 'en', name: 'English', hint: 'English' }, { code: 'md', name: 'Română', hint: 'Romanian' }, { code: 'zh-CN', name: '简体中文', hint: 'Simplified Chinese' }];

function MoneyCalendarPreview({ copy, currency, lang, className = '' }) {
  const today = new Date();
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ro' ? 'ro-RO' : lang === 'en' ? 'en-US' : 'ru-RU';
  const [income, expense] = ({ USD: [120, 4], EUR: [100, 4], MDL: [1800, 45], RUB: [7000, 250], CNY: [800, 25] })[currency] || [120, 4];
  const money = amount => `${amount.toLocaleString(locale)} ${currency}`;
  return <figure className={`first-run-money-preview ${className}`} aria-label={`${copy.productType} · ${copy.previewTitle}`}>
    <figcaption><span>{copy.previewTitle}</span><time dateTime={localDateValue(today)}>{today.toLocaleDateString(locale, { day: 'numeric', month: 'long' })}</time></figcaption>
    <div className="first-run-preview-week" aria-hidden="true">
      {Array.from({ length: 7 }, (_, index) => {
        const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index - 3);
        return <span key={index} data-tone={index === 1 ? 'expense' : index === 2 ? 'income' : undefined} data-today={index === 3 || undefined} data-future={index > 3 || undefined}>{date.getDate()}</span>;
      })}
    </div>
    <div className="first-run-preview-entries">
      <div data-tone="income"><span><i />{copy.incomeLabel}</span><strong>+{money(income)}</strong></div>
      <div data-tone="expense"><span><i />{copy.expenseLabel}</span><strong>−{money(expense)}</strong></div>
    </div>
  </figure>;
}

export default function FirstRunSetup({ step, language, currency, theme, calendarRecords = EMPTY_RECORDS, personalStory = false, profileKey = 'guest', onLanguage, onCurrency, onTheme, onStep, onStart, onArrive, onSkip }) {
  const dialogRef = useRef(null);
  const headingRef = useRef(null);
  const lang = language === 'zh-CN' ? 'zh' : language === 'md' || language === 'ro' ? 'ro' : language === 'en' ? 'en' : 'ru';
  const copy = COPY[lang];
  const lifeCopy = LIFE_COPY[lang];
  const [birthday, setBirthday] = useState(() => { try { return localStorage.getItem(birthdayStorageKey(profileKey)) || ''; } catch { return ''; } });
  const [selectedLanguage, setSelectedLanguage] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [dateError, setDateError] = useState(false);
  const story = step === 'intro';
  const light = theme === 'light';
  const index = step === 'language' ? 0 : step === 'birthday' || story ? 2 : 1;
  const muted = light ? 'text-zinc-500' : 'text-zinc-400';
  const selected = light ? 'border-amber-500 bg-amber-50 shadow-[0_0_0_1px_#f59e0b]' : 'border-amber-400/70 bg-amber-400/[0.08] shadow-[0_0_0_1px_rgba(251,191,36,.25)]';
  const idle = light ? 'border-zinc-200 bg-white hover:border-zinc-400' : 'border-white/10 bg-white/[0.025] hover:border-white/25';

  useEffect(() => {
    setSelectedLanguage(null);
    setSelectedCurrency(null);
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
    <dialog ref={dialogRef} lang={lang==='zh'?'zh-CN':lang} data-theme={theme} data-story={story || undefined} aria-labelledby="first-run-heading" onCancel={(event) => { event.preventDefault(); onSkip(); }}
      className={`first-run-dialog fixed inset-0 m-0 h-[100dvh] max-h-none w-full max-w-none overflow-y-auto border-0 bg-transparent p-0 backdrop:bg-black/75 backdrop:backdrop-blur-md ${light ? 'text-zinc-900' : 'text-zinc-100'}`}>
      {story ? <LifeStory birthday={birthday} lang={lang} theme={theme} currency={currency} calendarRecords={calendarRecords} personalStory={personalStory} onStart={onStart} onArrive={onArrive} onSkip={onSkip} onBack={() => onStep('birthday')} /> : <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className={`grid w-full max-w-[940px] overflow-hidden rounded-[28px] border shadow-2xl md:grid-cols-[0.85fr_1.15fr] ${light ? 'border-white bg-[#faf9f6]' : 'border-white/10 bg-[#111214]'}`}>
          <div className="first-run-product-panel relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[#111714] p-9 text-white md:flex">
            <div className="relative flex items-center gap-3"><BrandIcon className="h-10 w-10" /><div><span className="text-sm font-semibold tracking-[0.16em]">DAYRIS</span><p className="first-run-product-type">{copy.productType}</p></div></div>
            <div className="relative py-12">
              <h2 className="whitespace-pre-line text-[38px] font-semibold leading-[1.12] tracking-[-0.045em]">{copy.tagline}</h2>
              <MoneyCalendarPreview copy={copy} currency={currency} lang={lang} className="mt-8 first-run-preview-dark" />
            </div>
            <p className="relative max-w-[240px] text-xs leading-relaxed text-white/40">{copy.caption}</p>
          </div>

          <div className="flex min-w-0 flex-col p-4 sm:p-9">
            <div className="mb-5 flex items-center gap-2 md:hidden"><BrandIcon className="h-8 w-8" /><div><span className="text-xs font-semibold tracking-[0.16em]">DAYRIS</span><p className="first-run-product-type">{copy.productType}</p></div></div>
            <nav aria-label={copy.steps.join(' / ')} className="mb-6 flex gap-2">
              {copy.steps.map((label, item) => <div key={label} aria-current={item === index ? 'step' : undefined} className="min-w-0 flex-1">
                <div className={`mb-2 h-1 rounded-full ${item <= index ? 'bg-amber-400' : light ? 'bg-zinc-200' : 'bg-white/10'}`} />
                <span className={`text-[10px] font-medium ${item === index ? light ? 'text-zinc-800' : 'text-zinc-200' : muted}`}>{String(item + 1).padStart(2, '0')} · {label}</span>
              </div>)}
            </nav>
            <div className="flex-1">
              <h1 id="first-run-heading" ref={headingRef} tabIndex={-1} className={`whitespace-pre-line text-[28px] font-semibold leading-[1.12] tracking-[-0.035em] outline-none sm:text-[34px] ${index === 0 ? 'first-run-product-heading' : ''}`}>{index === 0 ? copy.productTitle : index === 1 ? copy.currencyTitle : lifeCopy.birthdayTitle}</h1>
              <p className={`mt-3 whitespace-pre-line text-sm leading-relaxed ${muted}`}>{index === 0 ? copy.productHint : index === 1 ? copy.currencyHint : lifeCopy.birthdayHint}</p>
              {index === 0 && <MoneyCalendarPreview copy={copy} currency={currency} lang={lang} className="mt-5 md:hidden" />}

              {index === 0 && <div className="mt-5 space-y-2" role="group" aria-label={copy.languageHint}>
                <h2 className="pb-1 text-sm font-medium">{copy.languageTitle}</h2>
                {LANGUAGES.map((item) => {
                  const active = selectedLanguage === item.code;
                  return <button key={item.code} type="button" aria-pressed={active} onClick={() => { setSelectedLanguage(item.code); onLanguage(item); onStep('currency'); }} className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-2.5 sm:py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active ? selected : idle}`}>
                    <span className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-semibold ${light ? 'bg-black/[0.04]' : 'bg-white/[0.05]'}`}>{item.code === 'md' ? 'RO' : item.code === 'zh-CN' ? 'ZH' : item.code.toUpperCase()}</span>
                    <span className="flex-1"><span lang={item.code === 'md' ? 'ro' : item.code} className="block text-sm font-semibold">{item.name}</span><span className={`mt-0.5 block text-[11px] ${muted}`}>{item.hint}</span></span>
                    {active && <Check className="h-4 w-4 text-amber-500" aria-hidden="true" />}
                  </button>;
                })}
              </div>}

              {index === 1 && <>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                  <span className={`text-xs ${muted}`}>{copy.appearance}</span>
                  <div className={`grid w-full grid-cols-2 gap-1 rounded-xl p-1 sm:w-auto ${light ? 'bg-zinc-200/60' : 'bg-black/25'}`}>
                    {[['light', Sun, copy.light], ['dark', Moon, copy.dark], ['purple', Moon, copy.purple], ['emerald', Moon, copy.emerald]].map(([value, Icon, label]) => <button key={value} type="button" data-theme-option={value} aria-pressed={theme === value} onClick={() => onTheme(value)} className={`flex min-h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-1 text-[10px] sm:px-2.5 sm:text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${theme === value ? light ? 'bg-white text-zinc-900 shadow-sm' : 'bg-white/10 text-zinc-100' : muted}`}><Icon className="hidden h-3.5 w-3.5 sm:block" /><span className="theme-option-label">{label}</span></button>)}
                  </div>
                </div>
                <div className="mt-6 grid grid-cols-2 gap-2.5" role="group" aria-label={copy.currencyHint}>
                  {CURRENCIES.map((item, i) => <button key={item.code} type="button" aria-pressed={selectedCurrency === item.code} onClick={() => { setSelectedCurrency(item.code); onCurrency(item.code); onStep('birthday'); }} className={`relative rounded-2xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${selectedCurrency === item.code ? selected : idle}`}>
                    {selectedCurrency === item.code && <Check className="absolute right-3 top-3 h-3.5 w-3.5 text-amber-500" aria-hidden="true" />}
                    <span className="mb-3 block text-2xl font-medium">{item.symbol}</span><span className="block text-xs font-semibold">{item.code}</span><span className={`mt-1 block text-[10px] ${muted}`}>{copy.currencies[i]}</span>
                  </button>)}
                </div>
                <p className={`mt-4 text-[11px] leading-relaxed ${muted}`}>{copy.later}</p>
              </>}

              {index === 2 && <form className="life-birthday-card mt-8" onSubmit={event => { event.preventDefault(); startStory(); }}>
                <BirthdayField value={birthday} onChange={value => { setBirthday(value); setDateError(false); }} lang={lang} label={lifeCopy.birthdayLabel} invalid={dateError} describedBy={dateError?'life-birthday-error':'life-birthday-note'}/>
                <p id="life-birthday-note" className={`mt-3 text-[11px] ${muted}`}>{lifeCopy.birthdayNote}</p>
                {dateError && <p id="life-birthday-error" role="alert" className="mt-3 text-xs text-rose-500">{lifeCopy.invalid}</p>}
                <button type="button" className={`mt-5 min-h-11 text-xs underline underline-offset-4 ${muted}`} onClick={() => startStory(true)}>{lifeCopy.noDate}</button>
              </form>}
            </div>
            <div className={index === 0 ? 'mt-3' : 'mt-8'}>
              <div className="flex gap-2">
                {index > 0 && <button type="button" onClick={() => onStep(index === 1 ? 'language' : 'currency')} aria-label={copy.back} className={`grid min-h-12 w-12 shrink-0 place-items-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${idle}`}><ArrowLeft className="h-4 w-4" /></button>}
                {index === 2 && <button type="button" onClick={() => startStory()} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">{lifeCopy.seeStory}<ArrowRight className="h-4 w-4" /></button>}
              </div>
              <button type="button" onClick={onSkip} className={`${index === 0 ? 'mt-1 min-h-9' : 'mt-3 min-h-10'} w-full rounded-xl text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${muted} ${light ? 'hover:bg-zinc-100' : 'hover:bg-white/5'}`}>{copy.skip}</button>
            </div>
          </div>
        </div>
      </div>}
    </dialog>
  );
}
