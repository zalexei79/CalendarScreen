import React, { useEffect, useRef } from 'react';
import BrandIcon from '../../shared/ui/BrandIcon.jsx';
import './CalendarStart.css';

export const CALENDAR_START_DURATION = 1400;
const COPY = {
  ru: ['Твоя история начинается сегодня.', 'Сейчас покажем, как день превращается в запись.', 'Как это работает'],
  uk: ['Твоя історія починається сьогодні.', 'Зараз покажемо, як день перетворюється на запис.', 'Як це працює'],
  en: ['Your story starts today.', 'See how a day becomes an entry.', 'See how it works'],
  ro: ['Povestea ta începe astăzi.', 'Vezi cum o zi devine o înregistrare.', 'Vezi cum funcționează'],
  zh: ['你的故事，从今天开始。', '看看如何把一天变成一条记录。', '了解如何使用'],
};

// Without a birthday, today's real date leads into the same first-use tutorial.
export default function CalendarStart({ lang, theme, revealing, onReveal, onArrive }) {
  const overlay = useRef(null);
  const marker = useRef(null);
  const content = useRef(null);
  const finishRef = useRef(null);
  const arrive = useRef(onArrive);
  const reveal = useRef(onReveal);
  arrive.current = onArrive;
  reveal.current = onReveal;
  const copy = COPY[lang] || COPY.en;
  const today = new Date();
  const locale = { ru:'ru-RU', uk:'uk-UA', ro:'ro-RO', zh:'zh-CN', en:'en-US' }[lang] || 'en-US';
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute('data-life-motion');
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer, revealTimer, frame, finished = false, revealed = false;
    const showTutorial = () => { if (!revealed) { revealed = true; reveal.current?.(); } };
    const finish = () => { if (!finished) { finished = true; showTutorial(); arrive.current?.(); } };
    finishRef.current = finish;
    root.setAttribute('data-life-motion', 'true');
    if (media.matches) finish();
    else {
      const started = performance.now();
      const draw = now => {
        const enter = Math.max(0, Math.min(1, (now - started) / 500));
        const rise = 1 - (1 - enter) ** 3;
        marker.current.style.transform = `translate3d(0,${8 * (1 - rise)}px,0) scale(${.94 + .06 * rise})`;
        marker.current.style.opacity = String(.6 + .4 * rise);
        content.current.style.transform = `translate3d(0,${4 * (1 - rise)}px,0)`;
        const progress = Math.max(0, Math.min(1, (now - started - 650) / 750));
        overlay.current.style.opacity = String(1 - progress ** 3 * (10 - 15 * progress + 6 * progress ** 2));
        if (progress < 1) frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
      revealTimer = window.setTimeout(showTutorial, 650);
      timer = window.setTimeout(finish, CALENDAR_START_DURATION);
    }
    const preference = () => { if (media.matches) finish(); };
    media.addEventListener('change', preference);
    return () => {
      window.clearTimeout(timer); window.clearTimeout(revealTimer); cancelAnimationFrame(frame); finishRef.current = null; media.removeEventListener('change', preference);
      if (previous === null) root.removeAttribute('data-life-motion'); else root.setAttribute('data-life-motion', previous);
    };
  }, []);
  return <div ref={overlay} className="calendar-start" data-theme={theme} data-revealing={revealing} aria-hidden={revealing || undefined} inert={revealing ? '' : undefined}>
    <header><span><BrandIcon className="h-7 w-7" /> DAYRIS</span><button type="button" onClick={() => finishRef.current?.()}>{copy[2]} →</button></header>
    <div ref={content} className="calendar-start-copy"><div ref={marker} className="calendar-start-marker" aria-hidden="true"><span>{today.toLocaleDateString(locale,{month:'short'})}</span><strong>{today.getDate()}</strong><i /></div><h1 id={revealing ? undefined : 'first-run-heading'} tabIndex={-1}>{copy[0]}</h1><p>{copy[1]}</p></div>
  </div>;
}
