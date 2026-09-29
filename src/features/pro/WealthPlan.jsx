import React, { useState } from 'react';

export default function WealthPlan({ trades, isTrading, currency, symbol, formatMoney, language, isLight, onReview }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(10);
  const ru = language === 'ru';
  const ro = language === 'ro' || language === 'md';
  const copy = (r, e, m) => ru ? r : ro ? m : e;
  const mixed = currency === 'ALL';
  const personal = trades.filter(item => !isTrading(item));
  const income = personal.reduce((sum, item) => sum + Math.max(0, Number(item.pnl) || 0), 0);
  const expenses = personal.reduce((sum, item) => sum + Math.max(0, -(Number(item.pnl) || 0)), 0);
  const groups = new Map();
  personal.filter(item => item.pnl < 0).forEach(item => {
    const name = item.instrument || copy('Без категории', 'Uncategorized', 'Fără categorie');
    const group = groups.get(name) || { name, amount: 0, count: 0 };
    group.amount += Math.abs(item.pnl);
    group.count++;
    groups.set(name, group);
  });
  const categories = [...groups.values()].sort((a, b) => b.amount - a.amount);
  const top = categories[0];
  const trading = trades.filter(isTrading);
  const tradingNet = trading.reduce((sum, item) => sum + (Number(item.pnl) || 0), 0);
  const saving = top ? top.amount * percent / 100 : 0;
  const card = isLight ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/20';
  return <section className={`mt-4 rounded-2xl border p-4 sm:p-5 ${isLight ? 'border-amber-200 bg-amber-50/50' : 'border-amber-400/20 bg-amber-400/[0.04]'}`}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-amber-400 px-4 py-3 text-left font-semibold text-zinc-950 hover:bg-amber-300">
      <span>✦ {copy('Стать богаче', 'Grow your wealth', 'Mai mulți bani')}</span><span aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    <p className="mt-2 text-xs leading-5 text-zinc-500">{copy('Ваш план: как оставлять больше денег · по записям выбранного периода', 'Your plan to keep more money · based on entries in this period', 'Planul tău pentru a păstra mai mulți bani · din perioada selectată')}</p>
    {open && <div className="mt-4 space-y-3">
      {mixed ? <p className="text-sm">{copy('Выберите одну валюту для расчёта плана: разные валюты нельзя складывать.', 'Choose one currency to calculate your plan.', 'Alege o singură monedă pentru calcul.')}</p> : <>
        <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('1. Понять, что остаётся', '1. See what remains', '1. Vezi ce rămâne')}</h4>
          <p className="mt-2 text-sm leading-6">{copy('Личные доходы', 'Personal income', 'Venituri personale')}: {symbol}{formatMoney(income)} · {copy('расходы', 'expenses', 'cheltuieli')}: {symbol}{formatMoney(expenses)}.</p>
          <p className="mt-1 text-sm leading-6">{expenses > income ? copy(`Не хватает ${symbol}${formatMoney(expenses - income)}. Первое действие — проверить крупнейшие личные расходы.`, `Shortfall: ${symbol}${formatMoney(expenses - income)}. Review your largest personal expenses first.`, `Deficit: ${symbol}${formatMoney(expenses - income)}. Verifică cheltuielile personale principale.`) : copy(`Остаётся ${symbol}${formatMoney(income - expenses)}. Решите, какую часть этой разницы отложить до новых покупок.`, `${symbol}${formatMoney(income - expenses)} remains. Decide how much to set aside before new purchases.`, `Rămân ${symbol}${formatMoney(income - expenses)}. Decide cât să pui deoparte înainte de alte cumpărături.`)}</p>
          {!personal.length && <p className="mt-2 text-xs text-zinc-500">{copy('Личных записей нет — добавьте доходы и бытовые расходы, чтобы получить план.', 'Add personal income and spending to build a plan.', 'Adaugă venituri și cheltuieli personale pentru un plan.')}</p>}
        </div>
        {top && <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('2. Проверить сценарий экономии', '2. Explore a savings scenario', '2. Explorează un scenariu de economisire')}</h4>
          <p className="mt-2 text-sm">{top.name}: {symbol}{formatMoney(top.amount)} · {top.count} {copy('операций', 'entries', 'înregistrări')}</p>
          <label className="mt-3 block text-xs" htmlFor="wealth-saving">{copy('Если сократить эту категорию на', 'If you reduce this category by', 'Dacă reduci categoria cu')} {percent}%</label>
          <input id="wealth-saving" type="range" min="0" max="30" step="5" value={percent} onChange={event => setPercent(Number(event.target.value))} className="mt-2 w-full accent-amber-400" />
          <p className="mt-2 text-lg font-semibold text-emerald-500">+{symbol}{formatMoney(saving)} {copy('останется', 'kept', 'păstrați')}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{copy('Сценарий за тот же период, не обещание. Проверьте, какие покупки можно пропустить без ущерба обязательным платежам.', 'Scenario for the same period, not a promise. Review which purchases you can skip while protecting essential payments.', 'Scenariu pentru aceeași perioadă. Verifică ce cumpărături poți evita păstrând plățile esențiale.')}</p>
          <button type="button" onClick={() => onReview(top.name, 'expense')} className="mt-3 min-h-11 rounded-xl border border-amber-400/30 px-4 text-xs font-semibold">{copy('Выбрать, что сократить →', 'Review what to reduce →', 'Vezi ce poți reduce →')}</button>
        </div>}
        <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('3. Один шаг на эту неделю', '3. One step this week', '3. Un pas săptămâna aceasta')}</h4>
          <p className="mt-2 text-sm leading-6">{copy('Просмотрите операции, выберите одну необязательную трату и установите для себя предел. Через неделю сравните фактические расходы с этим решением.', 'Review entries, choose one optional purchase and set a limit. In a week compare actual spending with your decision.', 'Verifică înregistrările, alege o cheltuială opțională și stabilește o limită. Compară cheltuielile reale peste o săptămână.')}</p>
          {trading.length > 0 && <div className="mt-3 border-t border-zinc-500/20 pt-3"><p className="text-xs leading-5 text-zinc-500">{copy('Торговля выделена отдельно. Результат', 'Trading is separate. Net result', 'Tranzacționarea este separată. Rezultat net')}: {symbol}{formatMoney(tradingNet)}. {copy('Торговые убытки не считаются бытовыми тратами и не входят в сценарий экономии.', 'Trading losses are excluded from the personal savings scenario.', 'Pierderile din tranzacționare sunt excluse din scenariul de economisire.')}</p><button type="button" onClick={() => onReview(trading[0].instrument, 'all')} className="mt-2 min-h-11 text-xs font-semibold text-amber-500">{copy('Посмотреть торговые операции →', 'Review trading entries →', 'Vezi tranzacțiile →')}</button></div>}
        </div>
      </>}
    </div>}
  </section>;
}
