import React, { useEffect, useRef } from 'react';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import './CalendarStart.css';

export const CALENDAR_START_DURATION = 1400;
const COPY = {
  ru: ['Твоя история начинается сегодня.', 'Запиши первую трату прямо в календаре.', 'Перейти к календарю'],
  uk: ['Твоя історія починається сьогодні.', 'Запиши першу витрату прямо в календарі.', 'Перейти до календаря'],
  en: ['Your story starts today.', 'Add your first expense right in the calendar.', 'Go to calendar'],
  ro: ['Povestea ta începe astăzi.', 'Notează prima cheltuială direct în calendar.', 'Mergi la calendar'],
  zh: ['你的故事，从今天开始。', '在日历中记下第一笔支出。', '前往日历'],
};

// No birthday means no lifetime estimate. Reveal the actual, already-mounted
// calendar and its normal first-entry guidance instead of an empty life grid.
export default function CalendarStart({ lang, theme, onArrive }) {
  const overlay = useRef(null);
  const arrive = useRef(onArrive);
  arrive.current = onArrive;
  const copy = COPY[lang] || COPY.en;
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-life-motion');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const grid = document.querySelector('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid');
    let animation, timer, frame, finished = false;
    const finish = () => { if (!finished) { finished = true; arrive.current?.(); } };
    root.setAttribute('data-life-motion', 'true');
    if (media.matches) finish();
    else {
      const started = performance.now();
      const draw = now => {
        const progress = Math.max(0, Math.min(1, (now - started - 650) / 750));
        overlay.current.style.opacity = String(1 - progress ** 3 * (10 - 15 * progress + 6 * progress ** 2));
        if (progress < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
      animation = grid?.animate?.([
        { transform: 'translate3d(0,10px,0)' },
        { transform: 'translate3d(0,0,0)' },
      ], { duration: 900, delay: 450, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
      timer = window.setTimeout(finish, CALENDAR_START_DURATION);
    }
    const preference = () => { if (media.matches) finish(); };
    media.addEventListener('change', preference);
    return () => {
      window.clearTimeout(timer); cancelAnimationFrame(frame); animation?.cancel(); media.removeEventListener('change', preference);
      if (previous === null) root.removeAttribute('data-life-motion'); else root.setAttribute('data-life-motion', previous);
    };
  }, []);
  return <div ref={overlay} className="calendar-start" data-theme={theme}>
    <header><span><BrandIcon className="h-7 w-7" /> DAYRIS</span><button type="button" onClick={() => arrive.current?.()}>{copy[2]} →</button></header>
    <div className="calendar-start-copy"><h1 id="first-run-heading" tabIndex={-1}>{copy[0]}</h1><p>{copy[1]}</p></div>
  </div>;
}
