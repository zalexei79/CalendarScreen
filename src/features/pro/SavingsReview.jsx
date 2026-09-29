import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function SavingsReview({ trades, category, symbol, formatMoney, language, isLight, onClose }) {
  const [step, setStep] = useState(0);
  const [choices, setChoices] = useState({});
  const [checked, setChecked] = useState({});
  const dialog = useRef(null);
  const ru = language === 'ru';
  const ro = language === 'ro' || language === 'md';
  const text = (r, e, m) => ru ? r : ro ? m : e;
  const entries = trades.filter(item => item.pnl < 0 && (!category || item.instrument === category));
  const total = entries.reduce((sum, item) => sum + Math.abs(item.pnl), 0);
  const selected = entries.map((item, index) => ({ ...item, index, percent: choices[index] || 0 })).filter(item => item.percent > 0);
  const savings = selected.reduce((sum, item) => sum + Math.abs(item.pnl) * item.percent / 100, 0);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
      if (event.key === 'Tab') {
        const nodes = [...dialog.current.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]')];
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => { document.removeEventListener('keydown', handleKey, true); previous?.focus?.(); };
  }, [onClose]);
  const panel = isLight ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-white/[0.025]';
  return createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="savings-review-title" className={`flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border shadow-2xl outline-none ${isLight ? 'border-slate-200 bg-white text-slate-900' : 'border-zinc-700 bg-zinc-950 text-zinc-100'}`}>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-500/20 p-5">
        <div><p className="text-[10px] tracking-widest text-amber-500">PRO · {text('ПЛАН ЭКОНОМИИ', 'SAVINGS PLAN', 'PLAN DE ECONOMISIRE')}</p><h3 id="savings-review-title" className="mt-1 text-lg font-semibold">{category || text('Разбор расходов', 'Review expenses', 'Analiza cheltuielilor')}</h3></div>
        <button type="button" onClick={onClose} aria-label={text('Закрыть', 'Close', 'Închide')} className="h-11 w-11 rounded-xl border border-zinc-500/20">×</button>
      </div>
      <div className="flex gap-2 px-5 pt-4" aria-label={text(`Шаг ${step + 1} из 3`, `Step ${step + 1} of 3`, `Pasul ${step + 1} din 3`)}>{[0, 1, 2].map(value => <span key={value} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${value <= step ? 'bg-amber-400' : 'bg-zinc-500/20'}`} />)}</div>
      <div className="overflow-y-auto p-5" style={{ overscrollBehavior: 'contain' }}>
        {step === 0 && <>
          <h4 className="font-semibold">{text('1. Что можно изменить в следующий раз?', '1. What can change next time?', '1. Ce poți schimba data viitoare?')}</h4>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{text('Это ваши реальные прошлые расходы. Для каждого выберите действие на будущее. Обязательные платежи оставляйте без изменений.', 'These are actual past expenses. Choose a future action for each. Keep essential payments unchanged.', 'Acestea sunt cheltuieli reale. Alege o acțiune viitoare pentru fiecare. Păstrează plățile esențiale.')}</p>
          <div className="mt-4 space-y-3">{entries.map((item, index) => <div key={index} className={`rounded-xl border p-3 ${panel}`}>
            <div className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words font-semibold">{item.instrument}</span><span className="shrink-0 tabular-nums">{symbol}{formatMoney(Math.abs(item.pnl))}</span></div>
            <p className="mt-1 text-xs text-zinc-500">{item.dateKey} {item.time || ''}</p>
            {item.comment && <p className="mt-1 break-words text-xs text-zinc-500">{item.comment}</p>}
            <label className="mt-3 block text-xs">{text('Моё решение', 'My decision', 'Decizia mea')}
              <select value={choices[index] || 0} onChange={event => setChoices(current => ({ ...current, [index]: Number(event.target.value) }))} className={`mt-1 min-h-11 w-full rounded-lg border px-2 text-sm ${isLight ? 'border-slate-200 bg-white' : 'border-zinc-700 bg-zinc-900'}`}>
                {[0, 10, 25, 50, 100].map(value => <option key={value} value={value}>{value === 0 ? text('Оставить: необходимая трата', 'Keep: essential expense', 'Păstrează: cheltuială necesară') : value === 100 ? text('Пропустить следующую аналогичную покупку', 'Skip the next similar purchase', 'Evită următoarea cumpărătură similară') : text(`Уменьшить следующую трату на ${value}%`, `Reduce next expense by ${value}%`, `Redu următoarea cheltuială cu ${value}%`)}</option>)}
              </select>
            </label>
          </div>)}</div>
          {!entries.length && <p className="mt-4 text-sm">{text('Нет расходов для разбора в этом периоде и валюте.', 'No expenses in this period and currency.', 'Nu există cheltuieli în perioada și moneda selectate.')}</p>}
        </>}
        {step === 1 && <>
          <h4 className="font-semibold">{text('2. Как изменится результат?', '2. How does the result change?', '2. Cum se schimbă rezultatul?')}</h4>
          <div className={`mt-4 rounded-xl border p-4 ${panel}`}><p className="text-xs text-zinc-500">{text('Выбрано действий', 'Actions selected', 'Acțiuni selectate')}: {selected.length}</p><p className="mt-2 text-2xl font-semibold text-emerald-500">+{symbol}{formatMoney(savings)}</p><p className="mt-2 text-sm">{text('Расходы этой группы в сценарии', 'Category spending in this scenario', 'Cheltuieli în acest scenariu')}: {symbol}{formatMoney(total - savings)}</p></div>
          <p className="mt-3 text-xs leading-5 text-zinc-500">{text('Модель использует те же покупки и ваши решения. Прошлые записи не меняются. Экономия получится, только если похожие траты повторятся и вы выполните план.', 'This models the same purchases with your decisions. Past records stay unchanged. Savings depend on similar future expenses and following the plan.', 'Modelul folosește aceleași cumpărături și deciziile tale. Istoricul rămâne neschimbat. Economisirea depinde de cheltuieli viitoare similare și respectarea planului.')}</p>
        </>}
        {step === 2 && <>
          <h4 className="font-semibold">{text('3. Ваши действия', '3. Your actions', '3. Acțiunile tale')}</h4>
          <p className="mt-2 text-xs leading-5 text-zinc-500">{text('Перед следующей покупкой примените выбранный предел. Отмечайте подготовленные действия в этом окне.', 'Apply the selected limit before your next purchase. Mark prepared actions in this window.', 'Aplică limita înainte de următoarea cumpărătură. Bifează acțiunile pregătite în această fereastră.')}</p>
          {selected.map(item => <label key={item.index} className={`mt-3 flex items-start gap-3 rounded-xl border p-3 ${panel}`}><input type="checkbox" checked={!!checked[item.index]} onChange={event => setChecked(current => ({ ...current, [item.index]: event.target.checked }))} className="mt-1 h-5 w-5 accent-amber-400" /><span className="text-sm leading-6">{item.percent === 100 ? text('Пропустить аналогичную покупку', 'Skip a similar purchase', 'Evită o cumpărătură similară') : text('Установить предел', 'Set a limit', 'Stabilește limita')}: {item.instrument} · {item.dateKey}<br /><b>{symbol}{formatMoney(Math.abs(item.pnl) * (1 - item.percent / 100))}</b><span className="ml-2 text-xs text-emerald-500">+{symbol}{formatMoney(Math.abs(item.pnl) * item.percent / 100)}</span></span></label>)}
          <p className="mt-3 text-xs text-zinc-500">{text('Черновик действует, пока окно открыто. Галочки означают подготовку действия, а не фактически сэкономленные деньги.', 'This draft lasts while the window is open. Checks mean preparation, not money actually saved.', 'Ciorna există cât timp fereastra este deschisă. Bifele indică pregătirea, nu economii reale.')}</p>
        </>}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-zinc-500/20 p-4">
        <div aria-live="polite" className="text-sm font-semibold text-emerald-500">+{symbol}{formatMoney(savings)}</div>
        <div className="flex gap-2">{step > 0 && <button type="button" onClick={() => setStep(value => value - 1)} className="min-h-11 rounded-xl border border-zinc-500/20 px-4 text-xs">{text('Назад', 'Back', 'Înapoi')}</button>}<button type="button" disabled={step < 2 && !selected.length} onClick={() => step < 2 ? setStep(value => value + 1) : onClose()} className="min-h-11 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 text-xs font-semibold text-amber-500 disabled:opacity-40">{step === 2 ? text('Готово', 'Done', 'Gata') : text('Далее →', 'Next →', 'Înainte →')}</button></div>
      </div>
    </div>
  </div>, document.body);
}
