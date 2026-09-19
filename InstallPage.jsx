import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Home,
  MoreVertical,
  Share,
  Smartphone,
  Sparkles,
} from 'lucide-react';

function getLang() {
  try {
    const stored = window.localStorage.getItem('atj_language');
    if (stored === 'en') return 'en';
    if (stored === 'md' || stored === 'ro') return 'ro';
  } catch { /* ignore */ }
  const nav = String(navigator.language || '').toLowerCase();
  if (nav.startsWith('ro')) return 'ro';
  if (nav.startsWith('en')) return 'en';
  return 'ru';
}

function getInitialLight() {
  try {
    const stored = window.localStorage.getItem('atj_theme');
    if (stored === 'light') return true;
    if (stored === 'dark') return false;
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ?? false;
}

const COPY = {
  ru: {
    eyebrow: 'УСТАНОВКА В 1 КАСАНИЕ',
    title: 'AI Trade Journal на главном экране',
    subtitle: 'Открывается как отдельное приложение — без адресной строки и лишних вкладок.',
    install: 'Установить на главный экран',
    showHow: 'Показать как установить',
    open: 'Открыть календарь',
    ready: 'Приложение уже установлено',
    readyHint: 'Можно открыть его прямо с главного экрана телефона.',
    benefit1: 'Быстрый запуск как у обычного приложения',
    benefit2: 'Твоя иконка на главном экране',
    benefit3: 'Не нужен App Store или Google Play',
    iosTitle: 'На iPhone это занимает несколько секунд',
    ios1: 'Нажми «Поделиться» в браузере.',
    ios2: 'Выбери «Добавить на экран Домой».',
    ios3: 'Нажми «Добавить».',
    androidTitle: 'Если системное окно не появилось',
    android1: 'Открой меню браузера',
    android2: 'Выбери «Установить приложение» или «Добавить на главный экран».',
    secure: 'Это та же версия сайта, только запускается как приложение.',
  },
  en: {
    eyebrow: 'INSTALL IN ONE TAP',
    title: 'AI Trade Journal on your Home Screen',
    subtitle: 'Opens like a standalone app — no address bar and no extra browser tabs.',
    install: 'Install on Home Screen',
    showHow: 'Show installation steps',
    open: 'Open calendar',
    ready: 'The app is already installed',
    readyHint: 'You can open it directly from your Home Screen.',
    benefit1: 'Fast launch like a regular app',
    benefit2: 'Your app icon on the Home Screen',
    benefit3: 'No App Store or Google Play required',
    iosTitle: 'On iPhone it only takes a few seconds',
    ios1: 'Tap Share in your browser.',
    ios2: 'Choose “Add to Home Screen”.',
    ios3: 'Tap “Add”.',
    androidTitle: 'If the install prompt does not appear',
    android1: 'Open the browser menu',
    android2: 'Choose “Install app” or “Add to Home screen”.',
    secure: 'It is the same website, simply launched as an app.',
  },
  ro: {
    eyebrow: 'INSTALEAZĂ DINTR-O ATINGERE',
    title: 'AI Trade Journal pe ecranul principal',
    subtitle: 'Se deschide ca o aplicație separată — fără bara de adrese și fără file în plus.',
    install: 'Instalează pe ecranul principal',
    showHow: 'Arată pașii de instalare',
    open: 'Deschide calendarul',
    ready: 'Aplicația este deja instalată',
    readyHint: 'O poți deschide direct de pe ecranul principal.',
    benefit1: 'Pornire rapidă ca o aplicație obișnuită',
    benefit2: 'Pictograma aplicației pe ecranul principal',
    benefit3: 'Nu ai nevoie de App Store sau Google Play',
    iosTitle: 'Pe iPhone durează doar câteva secunde',
    ios1: 'Apasă „Distribuie” în browser.',
    ios2: 'Alege „Adaugă pe ecranul principal”.',
    ios3: 'Apasă „Adaugă”.',
    androidTitle: 'Dacă fereastra de instalare nu apare',
    android1: 'Deschide meniul browserului',
    android2: 'Alege „Instalează aplicația” sau „Adaugă pe ecranul principal”.',
    secure: 'Este același site, doar că se deschide ca o aplicație.',
  },
};

function BrandMark({ isLight }) {
  return (
    <div className={`grid h-16 w-16 grid-cols-2 gap-1 rounded-[20px] border p-2 shadow-xl ${
      isLight ? 'border-amber-200 bg-white shadow-amber-200/30' : 'border-amber-400/20 bg-zinc-950 shadow-black/40'
    }`}>
      <span className={`rounded-md ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
      <span className="rounded-md bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,.45)]" />
      <span className={`rounded-md ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
      <span className={`rounded-md ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`} />
    </div>
  );
}

export default function InstallPage() {
  const lang = useMemo(getLang, []);
  const copy = COPY[lang];
  const [isLight] = useState(getInitialLight);
  const [promptEvent, setPromptEvent] = useState(() => window.__atjInstallPrompt || null);
  const [installed, setInstalled] = useState(() =>
    Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true)
  );
  const [showSteps, setShowSteps] = useState(false);

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  useEffect(() => {
    const onReady = () => setPromptEvent(window.__atjInstallPrompt || null);
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setShowSteps(false);
    };
    window.addEventListener('atj-install-ready', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('atj-install-ready', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installed) {
      window.location.assign('/');
      return;
    }

    const event = window.__atjInstallPrompt || promptEvent;
    if (event) {
      try {
        await event.prompt();
        const choice = await event.userChoice;
        if (choice?.outcome === 'accepted') {
          window.__atjInstallPrompt = null;
          setPromptEvent(null);
        }
      } catch {
        setShowSteps(true);
      }
      return;
    }

    setShowSteps(true);
  }

  const pageClass = isLight
    ? 'bg-[#f7f8fa] text-zinc-950'
    : 'bg-[#08090b] text-zinc-100';
  const cardClass = isLight
    ? 'border-zinc-200 bg-white/90 shadow-[0_30px_80px_-40px_rgba(15,23,42,.35)]'
    : 'border-white/[0.08] bg-zinc-950/88 shadow-[0_30px_90px_-35px_rgba(0,0,0,.75)]';

  return (
    <main className={`relative min-h-[100dvh] overflow-hidden px-4 py-8 sm:px-6 sm:py-12 ${pageClass}`}>
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute -right-24 -top-20 h-80 w-80 rounded-full blur-3xl ${isLight ? 'bg-amber-200/45' : 'bg-amber-400/[0.10]'}`} />
        <div className={`absolute -bottom-36 -left-28 h-96 w-96 rounded-full blur-3xl ${isLight ? 'bg-emerald-100/45' : 'bg-emerald-500/[0.06]'}`} />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-xl items-center justify-center">
        <section className={`w-full overflow-hidden rounded-[30px] border backdrop-blur-xl ${cardClass}`}>
          <div className="px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
            <div className="flex items-center gap-4">
              <BrandMark isLight={isLight} />
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500">{copy.eyebrow}</p>
                <p className={`mt-1 text-sm font-semibold ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>AI Trade Journal</p>
              </div>
            </div>

            <h1 className="mt-7 text-[32px] font-bold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">{installed ? copy.ready : copy.title}</h1>
            <p className={`mt-3 max-w-lg text-sm leading-6 sm:text-[15px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
              {installed ? copy.readyHint : copy.subtitle}
            </p>

            {!installed && (
              <div className="mt-6 grid gap-2.5">
                {[
                  [Smartphone, copy.benefit1],
                  [Home, copy.benefit2],
                  [Sparkles, copy.benefit3],
                ].map(([Icon, label]) => (
                  <div key={label} className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                    isLight ? 'border-zinc-200 bg-zinc-50/80' : 'border-white/[0.06] bg-white/[0.025]'
                  }`}>
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                      isLight ? 'bg-white text-amber-600 shadow-sm' : 'bg-amber-400/[0.08] text-amber-300'
                    }`}>
                      <Icon className="h-4 w-4 stroke-[1.8]" />
                    </span>
                    <span className={`text-sm font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{label}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleInstall}
              className="group mt-7 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-5 text-sm font-bold text-zinc-950 shadow-[0_16px_35px_-18px_rgba(245,185,31,.8)] transition-all hover:from-amber-300 hover:to-amber-400 active:scale-[0.99]"
            >
              {installed ? <ArrowRight className="h-5 w-5" /> : <Download className="h-5 w-5 stroke-[2.2]" />}
              {installed ? copy.open : (promptEvent ? copy.install : copy.showHow)}
            </button>

            {!installed && showSteps && (
              <div className={`mt-4 rounded-2xl border p-4 ${
                isLight ? 'border-amber-200 bg-amber-50/70' : 'border-amber-400/15 bg-amber-400/[0.045]'
              }`}>
                <div className="flex items-center gap-2">
                  {isIOS ? <Share className="h-4 w-4 text-amber-500" /> : <MoreVertical className="h-4 w-4 text-amber-500" />}
                  <p className="text-sm font-semibold">{isIOS ? copy.iosTitle : copy.androidTitle}</p>
                </div>

                <div className="mt-3 space-y-2.5">
                  {(isIOS
                    ? [copy.ios1, copy.ios2, copy.ios3]
                    : [copy.android1, copy.android2]
                  ).map((line, index) => (
                    <div key={line} className="flex items-start gap-3">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-amber-400 text-[11px] font-bold text-zinc-950">{index + 1}</span>
                      <p className={`pt-0.5 text-sm leading-5 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{line}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={`mt-5 flex items-start gap-2.5 rounded-xl px-1 text-xs leading-5 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{copy.secure}</span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
