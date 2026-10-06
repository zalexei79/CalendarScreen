import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { lifeWeeks, lifeWeekRhythm, lifeMoneyEvents, lifeMoneyFlow, reserveLifePresent, calendarMoneyEvents } from './lifeStoryModel';
import { createCalendarBridge } from './lifeCalendarBridge';
import { lifeCalendarMotion, lifeCameraFrame, lifeLatticeFrame, LIFE_COUNT_END, LIFE_MOTION_END } from './lifeCalendarMotion';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import './LifeStory.css';

export const LIFE_COPY = {
  ru: {
    seeStory: 'Увидеть мою историю',
    birthdayTitle: 'Когда началась\nтвоя история?', birthdayHint: 'Укажи дату рождения, чтобы увидеть время в масштабе.', birthdayLabel: 'Дата рождения', birthdayNote: 'Дата останется на этом устройстве.', noDate: 'Продолжить без даты', invalid: 'Укажи настоящую дату рождения, не позднее сегодняшнего дня.',
    life: 'Это время твоей жизни.', lifeHint: 'Доходы и расходы — часть каждого дня.\nЗаписывай их в календарь — день за днём.', money: 'Деньги — часть этой истории.', moneyHint: 'Каждая запись окрашивает день.\nА календарь показывает всю картину.', today: 'А это — сегодня.', todayHint: 'Один день. И место для нового начала.', ready: 'Начни с сегодняшнего дня.', readyHint: 'Пусть твоя финансовая история станет чуть яснее.', weeks: 'прожитых недель', generic: 'Каждая неделя — часть истории', legend: 'Одна точка — одна неделя', future: 'История продолжается', entry: 'Сделать первую запись', empty: 'Здесь появится твоя первая запись', replay: 'Посмотреть ещё раз', back: 'Изменить дату', skip: 'Перейти к календарю', continue: 'Продолжить', week: 'Эта неделя', todayLabel: 'Сегодня',
  },
  en: {
    seeStory: 'See my story',
    birthdayTitle: 'When did your\nstory begin?', birthdayHint: 'Enter your birthday to see time in perspective.', birthdayLabel: 'Date of birth', birthdayNote: 'Your date stays on this device.', noDate: 'Continue without a date', invalid: 'Enter a valid birthday no later than today.',
    life: 'This is your time.', lifeHint: 'Income and expenses are part of every day.\nTrack them in your calendar, day by day.', money: 'Money is part of that story.', moneyHint: 'Every entry gives a day its color.\nYour calendar brings the picture together.', today: 'And this is today.', todayHint: 'One day. Room for a new beginning.', ready: 'Start with today.', readyHint: 'Bring a little clarity to your financial story.', weeks: 'weeks lived', generic: 'Every week is part of a story', legend: 'One dot is one week', future: 'Your story continues', entry: 'Create my first entry', empty: 'Your first entry will appear here', replay: 'Watch again', back: 'Change birthday', skip: 'Go to calendar', continue: 'Continue', week: 'This week', todayLabel: 'Today',
  },
  ro: {
    seeStory: 'Descoperă povestea mea',
    birthdayTitle: 'Când a început\npovestea ta?', birthdayHint: 'Introdu data nașterii pentru a vedea timpul în perspectivă.', birthdayLabel: 'Data nașterii', birthdayNote: 'Data rămâne pe acest dispozitiv.', noDate: 'Continuă fără dată', invalid: 'Introdu o dată validă, nu mai târziu de azi.',
    life: 'Acesta este timpul tău.', lifeHint: 'Veniturile și cheltuielile fac parte din fiecare zi.\nNotează-le în calendar, zi de zi.', money: 'Și banii fac parte din poveste.', moneyHint: 'Fiecare înregistrare colorează o zi.\nCalendarul arată imaginea de ansamblu.', today: 'Iar aceasta este ziua de azi.', todayHint: 'O zi. Loc pentru un nou început.', ready: 'Începe cu ziua de azi.', readyHint: 'Adu puțină claritate în povestea ta financiară.', weeks: 'săptămâni trăite', generic: 'Fiecare săptămână face parte din poveste', legend: 'Un punct este o săptămână', future: 'Povestea continuă', entry: 'Prima mea înregistrare', empty: 'Prima ta înregistrare va apărea aici', replay: 'Privește din nou', back: 'Schimbă data', skip: 'Mergi la calendar', continue: 'Continuă', week: 'Săptămâna aceasta', todayLabel: 'Astăzi',
  },
  zh: {
    seeStory: '看看我的故事',
    birthdayTitle: '你的故事\n从何时开始？', birthdayHint: '输入出生日期，换一个角度看时间。', birthdayLabel: '出生日期', birthdayNote: '日期仅保存在此设备。', noDate: '不填写日期，继续', invalid: '请输入不晚于今天的有效出生日期。',
    life: '这是你走过的时间。', lifeHint: '收入和支出伴随每一天。\n逐日记录，在日历中看见全貌。', money: '金钱，也是故事的一部分。', moneyHint: '每条记录都为一天添上颜色。\n日历将它们汇成清晰的全貌。', today: '而这一格，是今天。', todayHint: '一天，一个新的开始。', ready: '从今天开始。', readyHint: '让你的财务故事更清晰一点。', weeks: '已走过的周数', generic: '每一周都是故事的一部分', legend: '一个点代表一周', future: '故事仍在继续', entry: '创建第一条记录', empty: '你的第一条记录将在这里出现', replay: '再看一次', back: '修改日期', skip: '前往日历', continue: '继续', week: '本周', todayLabel: '今天',
  },
};

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
const mix = (a, b, t) => a + (b - a) * t;
const inverseEase = value => value < .5 ? Math.cbrt(value / 4) : 1 - Math.cbrt((1 - value) / 4);
const MONEY_LEGEND = {
  ru: ['Нейтрально', 'Доход', 'Расход', 'Пример'],
  en: ['Neutral', 'Income', 'Expense', 'Example'],
  ro: ['Neutru', 'Venit', 'Cheltuială', 'Exemplu'],
  zh: ['平常', '收入', '支出', '示例'],
};
const FIRST_ENTRY = { ru: 'Добавить первую запись', en: 'Add your first entry', ro: 'Adaugă prima înregistrare', zh: '添加第一条记录' };
const MONEY_EXAMPLES = { ru: 'Примеры отдельных сумм', en: 'Examples of individual amounts', ro: 'Exemple de sume individuale', zh: '单笔收支示例' };
const MONEY_QUESTION = {
  ru: ['А ты знаешь, где эти деньги сейчас?', 'Сделай свою первую запись.', 'Сделай свою первую запись.\nНачни видеть, куда уходят деньги.', 'Деньги приходили. Деньги уходили.'],
  en: ['Do you know where that money is now?', 'Create your first entry.', 'Create your first entry.\nStart seeing where your money goes.', 'Money came in. Money went out.'],
  ro: ['Știi unde sunt acești bani acum?', 'Fă prima ta înregistrare.', 'Fă prima ta înregistrare.\nVezi unde se duc banii tăi.', 'Banii veneau. Banii plecau.'],
  zh: ['你知道这些钱现在在哪里吗？', '记下你的第一笔收支。', '记下你的第一笔收支，\n开始看清钱的去向。', '钱进来了，钱又花出去了。'],
};
const EMPTY_RECORDS = [];

const PALETTES = {
  light: { neutral: [191, 184, 167], future: [222, 217, 206], income: [113, 151, 128], expense: [198, 135, 120], today: 'rgba(77,119,100,.45)' },
  dark: { neutral: [91, 98, 94], future: [47, 53, 50], income: [110, 153, 129], expense: [172, 112, 102], today: 'rgba(142,185,159,.55)' },
};
function weekColor(index, filled, financial, rhythm, palette, arrival = 1) {
  const event = rhythm[index];
  const base = index >= filled ? palette.future : palette.future.map((value, channel) => mix(value, palette.neutral[channel], arrival));
  const tone = index >= filled || event.tone === 'neutral' ? base : palette[event.tone];
  const color = base.map((value, channel) => mix(value, tone[channel], financial * event.strength));
  return `rgb(${color.map(Math.round).join(',')})`;
}

/** A single camera follows the current week, then morphs the cells into the live month. */
export default function LifeStory({ birthday, lang, theme = 'light', currency = 'USD', calendarRecords = EMPTY_RECORDS, onStart, onArrive, onSkip, onBack }) {
  const copy = LIFE_COPY[lang];
  const palette = PALETTES[theme === 'light' ? 'light' : 'dark'];
  const canvasRef = useRef(null);
  const counterRef = useRef(null);
  const sceneRef = useRef(null);
  const paperRef = useRef(null);
  const cellsRef = useRef(null);
  const moneyFlowRef = useRef(null);
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const [run, setRun] = useState(0);
  const [stage, setStage] = useState('life');
  const [reduced, setReduced] = useState(false);
  const today = new Date();
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ro' ? 'ro-RO' : lang === 'en' ? 'en-US' : 'ru-RU';
  const monthLabel = today.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const stats = lifeWeeks(birthday);
  const elapsedWeeks = stats?.weeks ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const story = canvas.closest('.life-story');
    const layer = cellsRef.current;
    const counter = counterRef.current.parentElement;
    const legend = sceneRef.current.querySelector('.life-story-legend');
    const heading = story.querySelector('.life-story-heading');
    const header = story.querySelector('.life-story-top');
    const footer = story.querySelector('.life-story-footer');
    const appShell = document.querySelector('.premium-shell');
    const originalShellTransform = appShell?.style.transform || '';
    const root = document.documentElement;
    root.setAttribute('data-life-motion', 'true');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = media.matches;
    setReduced(reduceMotion);
    let frame;
    let started;
    let previousStage;
    let width = 1;
    let height = 1;
    let scene;
    let targets = [];
    let previousFilled;
    let previousGridBottom;
    let previousMask;
    let hasCalendar = false;
    let snapshotWidth;
    let disposed = false;
    let calendarGrid;
    let originalGridOpacity = '';
    let originals = [];
    const offset = (new Date(today.getFullYear(), today.getMonth(), 1).getDay() + 6) % 7;
    const count = Math.ceil((offset + new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) / 7) * 7;
    const todayIndex = offset + today.getDate() - 1;
    // This is a time canvas, not a prediction of life expectancy.
    const rows = Math.max(32, Math.ceil((elapsedWeeks + 520) / 52));
    const total = rows * 52;
    let rhythm = lifeWeekRhythm(total, birthday || 'dayris');
    const recorded = calendarMoneyEvents(calendarRecords, birthday, today).filter(event => event.currency === currency);
    // Real records can color their known weeks; illustrated history remains labelled.
    for (const event of recorded) if (event.currency === currency && rhythm[event.week]) rhythm[event.week] = { tone: event.tone, strength: 1 };
    const current = Math.min(elapsedWeeks, total - 1);
    const col = current % 52;
    const row = Math.floor(current / 52);
    const monthRows = count / 7;
    // Never wrap the crop across the 52-column edge: that splits the month apart.
    const cropCol = Math.max(0, Math.min(45, col - todayIndex % 7));
    const cropRow = Math.max(0, Math.min(rows - monthRows, row - Math.floor(todayIndex / 7)));
    const sourceIndices = Array.from({ length: count }, (_, index) => (cropRow + Math.floor(index / 7)) * 52 + cropCol + index % 7);
    const selected = new Set(sourceIndices);
    rhythm = reserveLifePresent(rhythm, sourceIndices, current);
    const moneyEvents = lifeMoneyEvents(rhythm, currency);
    const weekTimes = Array.from({ length: total }, (_, week) => week < elapsedWeeks ? inverseEase((week + 1) / elapsedWeeks) * LIFE_COUNT_END : Infinity);
    const flow = lifeMoneyFlow(moneyEvents, elapsedWeeks, LIFE_COUNT_END);
    const moneyArea = moneyFlowRef.current;
    const moneyCaption = moneyArea.querySelector('.life-money-caption');
    moneyCaption.textContent = MONEY_QUESTION[lang][3];
    const moneyAmounts = moneyArea.querySelector('.life-money-amounts');
    const moneyQuestion = moneyArea.querySelector('.life-money-question');
    const moneyNode = moneyArea.querySelector('.life-money-value');
    const currentValue = moneyNode.querySelector('.life-money-current');
    const oldValue = moneyNode.querySelector('.life-money-previous');
    const moneyLabel = moneyArea.querySelector('.life-money-label');
    moneyLabel.textContent = MONEY_EXAMPLES[lang];
    const formatAmount = event => `${event.tone === 'income' ? '+' : '−'}${event.amount.toLocaleString(locale, { maximumFractionDigits: 2 })}`;
    story.dataset.currentWeek = String(current);
    story.dataset.focusWeek = String(sourceIndices[todayIndex]);
    let lastTime = 0;
    const resize = () => {
      if (disposed || !sceneRef.current || !canvas.isConnected) return;
      const bounds = canvas.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene = sceneRef.current.getBoundingClientRect();
      if (appShell) appShell.style.transform = originalShellTransform;
      const buttons = [...document.querySelectorAll('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button')];
      hasCalendar = buttons.length === count && buttons.some(button => button.dataset.todayCell === 'true');
      story.dataset.calendarTarget = hasCalendar ? 'live' : 'preview';
      const newGrid = hasCalendar ? buttons[0].parentElement : null;
      if (newGrid !== calendarGrid) {
        if (calendarGrid) calendarGrid.style.opacity = originalGridOpacity;
        calendarGrid = newGrid;
        originalGridOpacity = calendarGrid?.style.opacity || '';
      }
      // Rebuild only when the real month changes, not on every viewport update.
      if (width !== snapshotWidth || buttons.length !== originals.length || buttons.some((button, index) => button !== originals[index])) {
        layer.replaceChildren();
        originals = buttons;
        layer.classList.toggle('theme-light', Boolean(buttons[0]?.closest('.theme-light')));
        snapshotWidth = width;
      }
      targets = Array.from({ length: count }, (_, index) => {
        const day = new Date(today.getFullYear(), today.getMonth(), 1 - offset + index);
        const cell = hasCalendar ? buttons[index] : null;
        const bounds = cell?.getBoundingClientRect();
        const style = cell ? getComputedStyle(cell) : null;
        const gap = width < 640 ? 4 : 8;
        const fallbackWidth = Math.min(600, scene.width);
        const cellWidth = (fallbackWidth - gap * 6) / 7;
        const cellHeight = Math.min(64, (scene.height - gap * (count / 7 - 1)) / (count / 7));
        const bridge = cell ? targets[index]?.bridge?.wrapper.isConnected ? targets[index].bridge : createCalendarBridge(cell, layer) : null;
        const targetWidth = bounds?.width ?? cellWidth;
        const targetHeight = bounds?.height ?? cellHeight;
        if (bridge) {
          bridge.wrapper.style.width = `${targetWidth}px`;
          bridge.wrapper.style.height = `${targetHeight}px`;
          bridge.wrapper.style.transformOrigin = '0 0';
          bridge.week.style.borderStyle = 'solid';
          bridge.week.style.borderColor = index === todayIndex ? palette.today : 'transparent';
        }
        return { x: bounds?.left ?? (width - fallbackWidth) / 2 + index % 7 * (cellWidth + gap), y: bounds?.top ?? scene.top + Math.floor(index / 7) * (cellHeight + gap), width: targetWidth, height: targetHeight, day: day.getDate(), inMonth: day.getMonth() === today.getMonth(), background: style?.backgroundColor || '#f1f0e9', color: style?.color || '#343e36', radius: parseFloat(style?.borderRadius) || 14, bridge };
      });
      draw(lastTime);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    observer.observe(story.querySelector('.life-story-heading'));
    resize();
    if (calendarGrid) observer.observe(calendarGrid);

    function draw(ms) {
      // Narrative copy can change height without resizing the viewport/canvas.
      scene = sceneRef.current.getBoundingClientRect();
      const time = reduceMotion ? LIFE_MOTION_END : ms;
      const motion = lifeCalendarMotion(time);
      story.dataset.time = String(Math.round(time));
      story.dataset.phase = time < 8200 ? 'life' : !motion.month ? 'focus' : !motion.ready ? 'month' : 'settle';
      story.dataset.lifeOpacity = motion.contextExit < 1 ? '1' : '0';
      const nextStage = time < 5500 ? 'life' : time < 8200 ? 'question' : time < 9200 ? 'today' : !motion.ready ? 'zoom' : 'ready';
      if (nextStage !== previousStage) { previousStage = nextStage; setStage(nextStage); }
      const filled = Math.floor(elapsedWeeks * ease(clamp(time / LIFE_COUNT_END)));
      if (counterRef.current && filled !== previousFilled) {
        counterRef.current.textContent = stats ? filled.toLocaleString(locale) : '—';
        previousFilled = filled;
      }

      // Reserve a stable counter and legend area before fitting any weeks.
      const gridTop = scene.top + 70;
      const gridSpace = Math.max(1, scene.height - 215);
      const unit = Math.min((scene.width - 36) / 52, gridSpace / rows);
      const gridWidth = unit * 52;
      const gridHeight = unit * rows;
      const lifeTop = gridTop + (gridSpace - gridHeight) / 2;
      const lifeBottom = lifeTop + gridHeight;
      story.dataset.gridTop = String(lifeTop);
      story.dataset.gridBottom = String(lifeBottom);
      story.dataset.gridWidth = String(gridWidth);
      const relativeGridBottom = lifeBottom - scene.top;
      if (previousGridBottom !== relativeGridBottom) {
        sceneRef.current.style.setProperty('--life-grid-bottom', `${relativeGridBottom}px`);
        previousGridBottom = relativeGridBottom;
      }
      // The hero fills the middle of the phone before the surrounding grid leaves.
      const compactAspect = hasCalendar ? Math.max(1, Math.min(2, targets[todayIndex].height / targets[todayIndex].width)) : 1.7;
      const compactPitch = Math.min(scene.width * .98 / 7, height * .62 / monthRows / compactAspect);
      const morph = motion.month;
      const paper = hasCalendar ? motion.paperOpacity : 1;
      const handoff = hasCalendar ? motion.handoff : 0;
      const skin = motion.skin;
      const chrome = 1 - ease(clamp((time - 8400) / 450));
      counter.style.opacity = String(chrome);
      counter.style.transform = `translateY(${-12 * (1 - chrome)}px)`;
      legend.style.opacity = String(chrome);
      if (hasCalendar) {
        heading.style.opacity = String(motion.copyOpacity);
        heading.style.transform = `translate3d(0,${-28 * motion.copyRetreat}px,0) scale(${1 - .09 * motion.copyRetreat})`;
        header.style.opacity = String(motion.headerOpacity);
        header.style.transform = `translateY(${-8 * (1 - motion.headerOpacity)}px)`;
        footer.style.opacity = String(chrome);
        if (header.inert !== (motion.headerOpacity === 0)) header.inert = motion.headerOpacity === 0;
        if (footer.inert !== (chrome === 0)) footer.inert = chrome === 0;
      }
      // Follow the retreating text instead of pinning the camera's window to
      // the old grid position. The crop fills the space as the copy leaves.
      const copyEdge = scene.top - 5 - 28 * motion.copyRetreat + 34;
      const movingTop = mix(lifeTop, copyEdge, motion.reframe);
      const maskTop = mix(movingTop, -48, motion.topAperture);
      const maskBottom = mix(lifeBottom, height + 48, motion.bottomAperture);
      story.dataset.apertureTop = String(maskTop);
      const mask = motion.topAperture === 1 && motion.bottomAperture === 1 ? 'none' : `linear-gradient(to bottom, transparent ${maskTop - 28}px, #000 ${maskTop + 20}px, #000 ${maskBottom - 20}px, transparent ${maskBottom + 28}px)`;
      if (previousMask !== mask) {
        canvas.style.maskImage = mask;
        canvas.style.webkitMaskImage = mask;
        layer.style.maskImage = mask;
        layer.style.webkitMaskImage = mask;
        previousMask = mask;
      }
      if (paperRef.current) paperRef.current.style.opacity = String(paper);
      if (appShell) appShell.style.transform = `translate3d(0,${16 * paper}px,0)`;
      story.style.setProperty('--life-paper-opacity', paper);
      if (calendarGrid) calendarGrid.style.opacity = String(handoff);
      if (motion.settled) story.dataset.settled = 'true';
      else delete story.dataset.settled;
      const centerX = scene.left + scene.width / 2;
      const camera = lifeCameraFrame({
        gridLeft: centerX - gridWidth / 2,
        gridTop: gridTop + (gridSpace - gridHeight) / 2,
        unit, cropCol, cropRow, monthRows, compactPitch, compactAspect,
        focusX: centerX, focusY: hasCalendar ? (targets[0].y + targets.at(-1).y + targets.at(-1).height) / 2 : height * .54,
      }, motion);
      const lattice = lifeLatticeFrame({ camera, unit, cropCol, cropRow, targets, initialFill: width >= 760 ? .74 : .65 }, motion);
      const nativeLeft = targets[0].x;
      const nativeTop = targets[0].y;
      story.dataset.contextExit = String(motion.contextExit);
      story.dataset.latticeWidth = String(lattice.width);
      story.dataset.latticeHeight = String(lattice.height);
      const moneyExit = motion.moneyOpacity;
      moneyArea.style.opacity = String(moneyExit);
      moneyArea.style.transform = `translateY(${-4 * (1 - moneyExit)}px) scale(${1 - .025 * (1 - moneyExit)})`;
      moneyAmounts.style.opacity = String(motion.amountsOpacity);
      moneyAmounts.style.transform = `translateY(${-3 * (1 - motion.amountsOpacity)}px)`;
      moneyQuestion.style.opacity = String(motion.questionOpacity);
      moneyQuestion.style.transform = `translateY(${6 * (1 - motion.questionOpacity)}px)`;
      const events = flow.filter(event => event.start <= time);
      const event = events.at(-1);
      if (event) {
        const previous = events.at(-2);
        const progress = ease(clamp((time - event.start) / event.duration));
        if (moneyNode.dataset.start !== String(event.start)) {
          currentValue.querySelector('.life-money-number').textContent = formatAmount(event);
          currentValue.querySelector('small').textContent = event.currency;
          currentValue.dataset.tone = event.tone;
          oldValue.querySelector('.life-money-number').textContent = previous ? formatAmount(previous) : '—';
          oldValue.querySelector('small').textContent = previous?.currency || '';
          oldValue.dataset.tone = previous?.tone || 'neutral';
          moneyNode.dataset.start = String(event.start);
          moneyNode.dataset.source = event.source;
          moneyNode.dataset.week = String(event.week);
          moneyNode.dataset.tone = event.tone;
          moneyNode.setAttribute('aria-label', `${formatAmount(event)} ${event.currency}`);
        }
        if (motion.amountsOpacity > 0 && moneyExit > 0) moneyNode.dataset.active = 'true';
        else delete moneyNode.dataset.active;
        currentValue.style.opacity = String(progress);
        currentValue.style.transform = `translateY(${1 * (1 - progress)}px)`;
        oldValue.style.opacity = String(1 - progress);
        oldValue.style.transform = `translateY(${-1 * progress}px)`;
      } else delete moneyNode.dataset.active;
      context.clearRect(0, 0, width, height);
      if (motion.contextExit < 1) {
        context.save();
        context.globalAlpha = 1 - motion.contextExit;
        const left = Math.max(0, cropCol + Math.floor(-lattice.x / lattice.pitchX));
        const right = Math.min(52, cropCol + Math.ceil((width - lattice.x) / lattice.pitchX));
        const top = Math.max(0, cropRow + Math.floor(-lattice.y / lattice.pitchY));
        const bottom = Math.min(rows, cropRow + Math.ceil((height - lattice.y) / lattice.pitchY));
        for (let row = top; row < bottom; row++) for (let col = left; col < right; col++) {
          const i = row * 52 + col;
          if (selected.has(i)) continue;
          const x = lattice.x + (col - cropCol) * lattice.pitchX;
          const y = lattice.y + (row - cropRow) * lattice.pitchY;
          const age = time - weekTimes[i];
          const reveal = ease(clamp(age / 450));
          context.fillStyle = weekColor(i, filled, reveal, rhythm, palette, ease(clamp(age / 180)));
          if (morph < .01) context.fillRect(x, y, lattice.width, lattice.height);
          else {
            context.beginPath();
            context.roundRect(x, y, lattice.width, lattice.height, targets[0].radius * morph);
            context.fill();
          }
        }
        context.restore();
      }
      targets.forEach((target, index) => {
        const source = sourceIndices[index];
        const isToday = index === todayIndex;
        const col = index % 7, row = Math.floor(index / 7);
        const x = lattice.x + col * lattice.pitchX + (target.x - nativeLeft - col * lattice.finalPitchX) * morph;
        const y = lattice.y + row * lattice.pitchY + (target.y - nativeTop - row * lattice.finalPitchY) * morph;
        const w = lattice.width + (target.width - targets[0].width) * morph;
        const h = lattice.height + (target.height - targets[0].height) * morph;
        const age = time - weekTimes[source];
        const color = weekColor(source, filled, ease(clamp(age / 450)), rhythm, palette, ease(clamp(age / 180)));
        if (target.bridge) {
          const { wrapper, face, week, opacity } = target.bridge;
          const scaleX = w / target.width, scaleY = h / target.height;
          wrapper.style.transform = `translate3d(${x}px,${y}px,0) scale(${scaleX},${scaleY})`;
          wrapper.style.opacity = String(1 - handoff);
          face.style.borderRadius = `${target.radius}px`;
          face.style.setProperty('opacity', String(skin * opacity), 'important');
          week.style.backgroundColor = color;
          week.style.borderRadius = `${target.radius * morph / scaleX}px / ${target.radius * morph / scaleY}px`;
          week.style.opacity = String(1 - skin);
          const todayStroke = Math.min(w * .07, .8) * ease(clamp((time - 8000) / 1200));
          week.style.borderWidth = isToday ? `${todayStroke / scaleY}px ${todayStroke / scaleX}px` : '0';
          return;
        }
        context.save();
        context.globalAlpha = 1 - handoff;
        context.beginPath();
        context.roundRect(x, y, w, h, target.radius * morph);
        context.fillStyle = color;
        context.globalAlpha *= 1 - morph;
        context.fill();
        context.globalAlpha = morph * (1 - handoff);
        context.fillStyle = target.background;
        context.fill();
        context.strokeStyle = isToday ? 'rgba(77,119,100,.55)' : 'rgba(148,163,184,.17)';
        context.lineWidth = 1;
        context.stroke();
        if (morph > .3) {
          context.globalAlpha = ease(clamp((morph - .3) / .7)) * (1 - handoff) * (target.inMonth ? 1 : .4);
          context.font = `500 ${width < 640 ? 11 : 14}px system-ui, sans-serif`;
          context.fillStyle = target.color;
          context.fillText(String(target.day), x + 10, y + 20);
        }
        if (isToday && morph > .9) {
          context.globalAlpha = (1 - handoff) * clamp((morph - .9) / .1);
          context.shadowColor = 'rgba(77,119,100,.18)';
          context.shadowBlur = 18;
          context.strokeStyle = 'rgba(77,119,100,.4)';
          context.stroke();
        }
        context.restore();
      });
    }
    function tick(timestamp) {
      if (disposed) return;
      if (started === undefined) started = timestamp;
      lastTime = timestamp - started;
      draw(lastTime);
      if (!reduceMotion && lastTime < LIFE_MOTION_END) frame = requestAnimationFrame(tick);
      else {
        if (hasCalendar) arriveRef.current?.();
      }
    }
    const onMotionChange = () => { reduceMotion = media.matches; setReduced(reduceMotion); cancelAnimationFrame(frame); frame = requestAnimationFrame(tick); };
    media.addEventListener('change', onMotionChange);
    frame = requestAnimationFrame(tick);
    return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); media.removeEventListener('change', onMotionChange); if (calendarGrid) calendarGrid.style.opacity = originalGridOpacity; if (appShell) appShell.style.transform = originalShellTransform; layer.replaceChildren(); root.removeAttribute('data-life-motion'); };
  }, [birthday, elapsedWeeks, lang, theme, currency, calendarRecords, run]);

  const ready = stage === 'ready';
  const zoom = stage === 'zoom' || ready;
  const question = MONEY_QUESTION[lang];
  const title = ready ? monthLabel : stage === 'life' || stage === 'question' ? copy.life : copy.today;
  const hint = stage === 'life' || stage === 'question' ? copy.lifeHint : question[2];

  return <div className={`life-story ${reduced ? 'life-story--reduced' : ''}`} data-theme={theme} data-stage={stage}>
    <div ref={paperRef} className="life-story-paper" aria-hidden="true" />
    <header className="life-story-top"><span className="life-story-brand"><BrandIcon className="h-7 w-7" /> DAYRIS</span><button type="button" onClick={onSkip}>{copy.skip}<ArrowRight size={14} /></button></header>
    <div className="life-story-heading" aria-live="polite" aria-atomic="true">
      <p className="life-story-eyebrow">{stage === 'life' || stage === 'question' ? copy.future : copy.todayLabel}</p>
      <h1 key={title} id="first-run-heading" tabIndex={-1}>{title}</h1>
      <p key={hint} className="life-story-hint">{hint}</p>
    </div>
    <div ref={sceneRef} className={`life-story-scene ${zoom ? 'is-zooming' : ''} ${ready ? 'is-ready' : ''}`} key={run}>
      <div className="life-story-halo" aria-hidden="true" />
      <div className="life-story-counter" aria-hidden="true"><strong ref={counterRef}>0</strong><span>{stats ? copy.weeks : copy.generic}</span></div>
      <canvas ref={canvasRef} className="life-story-grid" aria-label={stats ? `${elapsedWeeks.toLocaleString(locale)} ${copy.weeks}. ${copy.legend}` : copy.generic} role="img" />
      <div ref={cellsRef} className="life-calendar-bridge" aria-hidden="true" inert="" />
      <div ref={moneyFlowRef} className="life-money-area" key={`money-${run}`}>
        <div className="life-money-amounts" aria-hidden="true">
          <div className="life-money-value">
            <div className="life-money-previous"><span className="life-money-number">—</span><small /></div>
            <div className="life-money-current"><span className="life-money-number">—</span><small /></div>
          </div>
          <p className="life-money-caption">{question[3]}</p>
          <span className="life-money-label">{MONEY_EXAMPLES[lang]}</span>
        </div>
        <div className="life-money-question" aria-hidden={stage !== 'question'}><p>{question[0]}</p><span>{question[1]}</span></div>
      </div>
      <div className="life-story-legend"><p>{copy.legend}</p><div className="life-story-color-key">{MONEY_LEGEND[lang].slice(0, 3).map((label, index) => <span key={label}><i style={{ background: `rgb(${[palette.neutral, palette.income, palette.expense][index].join(',')})` }} />{label}</span>)}</div></div>
    </div>
    <footer className={`life-story-footer ${ready ? 'is-ready' : ''}`}>
      <button type="button" className="life-story-primary" onClick={onStart} disabled={!ready}>{FIRST_ENTRY[lang]}<ArrowRight size={14} /></button>
      <div className="life-story-tools"><button type="button" onClick={onBack}><ArrowLeft size={14} />{copy.back}</button><button type="button" onClick={() => { setStage('life'); setRun(value => value + 1); }}><RotateCcw size={14} />{copy.replay}</button></div>
    </footer>
  </div>;
}
