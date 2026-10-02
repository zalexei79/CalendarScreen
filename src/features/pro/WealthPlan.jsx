import React, { useState } from 'react';
import {getMoneyCategoryLabel} from '../../shared/config/constants.js';
import '../../shared/ui/MotionSystem.css';

export default function WealthPlan({ trades, isTrading, currency, symbol, formatMoney, language, isLight, onReview, onStartReview }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(10);
  const ru = language === 'ru';
  const ro = language === 'ro' || language === 'md';
  const copy = (r, e, m, z) => language === 'zh-CN' ? z : ru ? r : ro ? m : e;
  const mixed = currency === 'ALL';
  const personal = trades.filter(item => !isTrading(item));
  const income = personal.reduce((sum, item) => sum + Math.max(0, Number(item.pnl) || 0), 0);
  const expenses = personal.reduce((sum, item) => sum + Math.max(0, -(Number(item.pnl) || 0)), 0);
  const groups = new Map();
  personal.filter(item => item.pnl < 0).forEach(item => {
    const name = item.instrument || copy('Без категории', 'Uncategorized', 'Fără categorie', "未分类");
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
  return <section className={`mb-4 rounded-2xl border p-3 sm:p-4 ${isLight ? 'border-slate-200 bg-white' : 'border-white/[0.08] bg-white/[0.02]'}`}>
    <button type="button" aria-expanded={open} onClick={() => setOpen(value => !value)} className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors ${isLight ? 'text-slate-900 hover:bg-slate-50' : 'text-zinc-100 hover:bg-white/[0.04]'}`}>
      <span><span className="mr-2 text-amber-500">✦</span>{copy('Стать богаче', 'Grow your wealth', 'Mai mulți bani', "积累更多财富")}<span className="ml-2 text-[9px] tracking-widest text-amber-500">PRO</span></span><span aria-hidden="true" className="text-zinc-500">{open ? '−' : '+'}</span>
    </button>
    <p className="mt-2 text-xs leading-5 text-zinc-500">{copy('Ваш план: как оставлять больше денег · по записям выбранного периода', 'Your plan to keep more money · based on entries in this period', 'Planul tău pentru a păstra mai mulți bani · din perioada selectată', "根据该时段记录制定保留更多资金的计划")}</p>
    <div className="dayris-details-reveal" data-open={open} aria-hidden={!open} inert={open ? undefined : ''}><div className="min-h-0 overflow-hidden"><div className="pt-4 space-y-3">
      {mixed ? <p className="text-sm">{copy('Выберите одну валюту для расчёта плана: разные валюты нельзя складывать.', 'Choose one currency to calculate your plan.', 'Alege o singură monedă pentru calcul.', "选择一种货币计算计划。")}</p> : <>
        <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('1. Понять, что остаётся', '1. See what remains', '1. Vezi ce rămâne', "1. 看看剩余资金")}</h4>
          <p className="mt-2 text-sm leading-6">{copy('Личные доходы', 'Personal income', 'Venituri personale', "个人收入")}: {symbol}{formatMoney(income)} · {copy('расходы', 'expenses', 'cheltuieli', "支出")}: {symbol}{formatMoney(expenses)}.</p>
          <p className="mt-1 text-sm leading-6">{expenses > income ? copy(`Не хватает ${symbol}${formatMoney(expenses - income)}. Первое действие — проверить крупнейшие личные расходы.`, `Shortfall: ${symbol}${formatMoney(expenses - income)}. Review your largest personal expenses first.`, `Deficit: ${symbol}${formatMoney(expenses - income)}. Verifică cheltuielile personale principale.`, `资金缺口：${symbol}${formatMoney(expenses - income)}。请先检查最大的个人支出。`) : copy(`Остаётся ${symbol}${formatMoney(income - expenses)}. Решите, какую часть этой разницы отложить до новых покупок.`, `${symbol}${formatMoney(income - expenses)} remains. Decide how much to set aside before new purchases.`, `Rămân ${symbol}${formatMoney(income - expenses)}. Decide cât să pui deoparte înainte de alte cumpărături.`, `剩余 ${symbol}${formatMoney(income - expenses)}，请在下次购物前决定留存多少资金。`)}</p>
          {!personal.length && <p className="mt-2 text-xs text-zinc-500">{copy('Личных записей нет — добавьте доходы и бытовые расходы, чтобы получить план.', 'Add personal income and spending to build a plan.', 'Adaugă venituri și cheltuieli personale pentru un plan.', "添加个人收入和支出，制定计划。")}</p>}
        </div>
        {!top && <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('2. Проверить сценарий экономии', '2. Explore a savings scenario', '2. Explorează un scenariu de economisire', "2. 评估节省方案")}</h4>
          <p className="mt-2 text-sm leading-6">{copy('В выбранных записях нет личных расходов. Добавьте бытовые траты или измените фильтры — тогда здесь появится расчёт возможной экономии.', 'No personal expenses in the selected entries. Add spending or change filters to see a savings scenario.', 'Nu există cheltuieli personale selectate. Adaugă cheltuieli sau schimbă filtrele pentru un scenariu.', "所选记录中没有个人支出，添加支出或更改筛选条件后可查看节省方案。")}</p>
        </div>}
        {top && <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('2. Проверить сценарий экономии', '2. Explore a savings scenario', '2. Explorează un scenariu de economisire', "2. 评估节省方案")}</h4>
          <p className="mt-2 text-sm">{getMoneyCategoryLabel(top.name, language)}: {symbol}{formatMoney(top.amount)} · {top.count} {copy('операций', 'entries', 'înregistrări', "条记录")}</p>
          <label className="mt-3 block text-xs" htmlFor="wealth-saving">{copy('Если сократить эту категорию на', 'If you reduce this category by', 'Dacă reduci categoria cu', "如果该类别支出减少")} {percent}%</label>
          <input id="wealth-saving" type="range" min="0" max="30" step="5" value={percent} onChange={event => setPercent(Number(event.target.value))} className="mt-2 w-full accent-amber-400" />
          <p className="mt-2 text-lg font-semibold text-emerald-500">+{symbol}{formatMoney(saving)} {copy('останется', 'kept', 'păstrați', "可保留")}</p>
          <p className="mt-1 text-xs leading-5 text-zinc-500">{copy('Сценарий за тот же период, не обещание. Проверьте, какие покупки можно пропустить без ущерба обязательным платежам.', 'Scenario for the same period, not a promise. Review which purchases you can skip while protecting essential payments.', 'Scenariu pentru aceeași perioadă. Verifică ce cumpărături poți evita păstrând plățile esențiale.', "这是同一时段的模拟方案，并非承诺。请保留必要付款，考虑哪些购物可以减少。")}</p>
          <button type="button" onClick={() => onStartReview(top.name)} className="mt-3 min-h-11 rounded-xl border border-amber-400/30 px-4 text-xs font-semibold">{copy('Выбрать, что сократить →', 'Review what to reduce →', 'Vezi ce poți reduce →', "选择要减少的支出 →")}</button>
        </div>}
        <div className={`rounded-xl border p-4 ${card}`}>
          <h4 className="text-sm font-semibold">{copy('3. Один шаг на эту неделю', '3. One step this week', '3. Un pas săptămâna aceasta', "3. 本周迈出一步")}</h4>
          <p className="mt-2 text-sm leading-6">{copy('Просмотрите операции, выберите одну необязательную трату и установите для себя предел. Через неделю сравните фактические расходы с этим решением.', 'Review entries, choose one optional purchase and set a limit. In a week compare actual spending with your decision.', 'Verifică înregistrările, alege o cheltuială opțională și stabilește o limită. Compară cheltuielile reale peste o săptămână.', "查看记录，选择一项非必要购物并设定限额。一周后对比实际支出与计划。")}</p>
          {trading.length > 0 && <div className="mt-3 border-t border-zinc-500/20 pt-3"><p className="text-xs leading-5 text-zinc-500">{copy('Торговля выделена отдельно. Результат', 'Trading is separate. Net result', 'Tranzacționarea este separată. Rezultat net', "交易单独计算，净结果")}: {symbol}{formatMoney(tradingNet)}. {copy('Торговые убытки не считаются бытовыми тратами и не входят в сценарий экономии.', 'Trading losses are excluded from the personal savings scenario.', 'Pierderile din tranzacționare sunt excluse din scenariul de economisire.', "交易亏损不计入个人节省方案。")}</p><button type="button" onClick={() => onReview(trading[0].instrument, 'all')} className="mt-2 min-h-11 text-xs font-semibold text-amber-500">{copy('Посмотреть торговые операции →', 'Review trading entries →', 'Vezi tranzacțiile →', "查看交易记录 →")}</button></div>}
        </div>
      </>}
    </div></div></div>
  </section>;
}
