import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, X } from 'lucide-react';
import { platformText } from '../platforms/PlatformConnections';
import { calculateLotSize } from './lotSizing';
import './LotCalculator.css';

const initial = { balance: '', risk: '1', stop: '', tickValue: '', minimum: '0.01', step: '0.01', maximum: '100', commission: '0' };

export default function LotCalculator({ enabled, language, isLight, currency = 'USD' }) {
  const t = (r, e, m, z) => platformText(language, r, e, m, z);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const [accountCurrency, setAccountCurrency] = useState(currency);
  const dialog = useRef(null), trigger = useRef(null);
  const id = useId();
  const title = t('Калькулятор лота', 'Lot calculator', 'Calculator de lot', '手数计算器');
  const result = calculateLotSize(values);
  const locale = language === 'md' || language === 'ro' ? 'ro-RO' : language === 'zh' ? 'zh-CN' : language === 'en' ? 'en-US' : 'ru-RU';
  const number = (value, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);
  const money = value => `${number(value)} ${accountCurrency}`;
  useEffect(() => { if (!enabled) setOpen(false); }, [enabled]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    dialog.current.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      if (trigger.current?.isConnected && !trigger.current.disabled) trigger.current.focus();
    };
  }, [open]);
  const set = (key, value) => setValues(current => ({ ...current, [key]: value }));
  function field(key, label, hint) {
    return <label className="lot-field" htmlFor={`${id}-${key}`}><span id={`${id}-${key}-label`}>{label}</span><input aria-labelledby={`${id}-${key}-label`} aria-describedby={hint ? `${id}-${key}-hint` : undefined} id={`${id}-${key}`} value={values[key]} onChange={event => set(key, event.target.value)} type="text" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder={key === 'balance' ? '10000' : key === 'stop' ? '20' : key === 'tickValue' ? '10' : undefined} />{hint && <small id={`${id}-${key}-hint`}>{hint}</small>}</label>;
  }
  return <>
    <button ref={trigger} type="button" disabled={!enabled} className="pro-control pro-control-platform pro-control-lot" onClick={() => setOpen(true)} aria-label={title} aria-haspopup="dialog"><Calculator aria-hidden="true"/><span className="pro-platform-label"><strong>{t('Лот', 'Lot', 'Lot', '手数')}</strong><small>{t('Калькулятор', 'Calculator', 'Calculator', '计算器')}</small></span></button>
    {open && createPortal(<dialog ref={dialog} className="lot-calculator" data-light={isLight} aria-labelledby={`${id}-title`} onCancel={event => { event.preventDefault(); setOpen(false); }} onClick={event => { if (event.target !== event.currentTarget) return; const box = dialog.current.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false); }}>
      <header><div><span className="lot-eyebrow">DAYRIS · TRADER</span><h2 id={`${id}-title`}>{title}</h2></div><button type="button" onClick={() => setOpen(false)} aria-label={t('Закрыть калькулятор', 'Close calculator', 'Închide calculatorul', '关闭计算器')}><X size={20}/></button></header>
      <p className="lot-intro">{t('Размер позиции по твоему риску и стоп-лоссу.', 'Position size from your risk and stop-loss.', 'Mărimea poziției după risc și stop-loss.', '根据风险和止损计算仓位。')}</p>
      <div className="lot-fields">
        {field('balance', t('Баланс счёта', 'Account balance', 'Soldul contului', '账户余额'))}
        <label className="lot-field" htmlFor={`${id}-currency`}><span id={`${id}-currency-label`}>{t('Валюта счёта', 'Account currency', 'Moneda contului', '账户货币')}</span><select aria-labelledby={`${id}-currency-label`} id={`${id}-currency`} value={accountCurrency} onChange={event => { setAccountCurrency(event.target.value); setValues(current => ({ ...current, balance: '', tickValue: '', commission: '0' })); }}>{[...new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'MDL', 'RUB', 'CNY', currency])].map(code => <option key={code}>{code}</option>)}</select></label>
        {field('risk', t('Риск на сделку, %', 'Risk per trade, %', 'Risc per tranzacție, %', '单笔风险，%'))}
        {field('stop', t('Стоп-лосс, пипсов / тиков', 'Stop-loss, pips / ticks', 'Stop-loss, pips / tick-uri', '止损，点 / 跳'))}
      </div>
      <div className="lot-tick-value">{field('tickValue', t(`Цена пипса / тика за 1 лот, ${accountCurrency}`, `Pip / tick value per lot, ${accountCurrency}`, `Valoare pip / tick per lot, ${accountCurrency}`, `每手点 / 跳价值，${accountCurrency}`), t('Возьми из спецификации инструмента у брокера. Стоп и стоимость должны быть в одной единице: пипсы с пипсами, тики с тиками.', 'Use your broker’s symbol specification. Match the stop and value units: pips with pips, ticks with ticks.', 'Folosește specificația instrumentului de la broker. Stopul și valoarea trebuie să aibă aceeași unitate.', '使用经纪商的品种规格。止损和价值的单位须一致：点对应点，跳对应跳。'))}</div>
      <details className="lot-specification"><summary>{t('Параметры брокера и комиссия', 'Broker limits and commission', 'Limitele brokerului și comision', '经纪商限制和佣金')}</summary><div className="lot-fields">
        {field('minimum', t('Минимальный лот', 'Minimum lot', 'Lot minim', '最小手数'))}
        {field('step', t('Шаг лота', 'Lot step', 'Pasul lotului', '手数步长'))}
        {field('maximum', t('Максимальный лот', 'Maximum lot', 'Lot maxim', '最大手数'))}
        {field('commission', t(`Комиссия за 1 лот, ${accountCurrency}`, `Commission per lot, ${accountCurrency}`, `Comision per lot, ${accountCurrency}`, `每手佣金，${accountCurrency}`), t('Открытие + закрытие.', 'Entry + exit.', 'Deschidere + închidere.', '开仓 + 平仓。'))}
      </div></details>
      <section className="lot-result" aria-label={t('Результат расчёта', 'Calculation result', 'Rezultatul calculului', '计算结果')} aria-live="polite" aria-atomic="true">
        {!result.error ? <><span>{t('Размер позиции', 'Position size', 'Mărimea poziției', '仓位大小')}</span><strong data-lot-result>{number(result.lots, 8)} <small>{t('лота', 'lots', 'loturi', '手')}</small></strong><div className="lot-result-row"><span>{t('Убыток по стопу + комиссия', 'Stop loss + commission', 'Pierdere la stop + comision', '止损亏损 + 佣金')}</span><b data-lot-loss>{money(result.loss)}</b></div><div className="lot-result-row"><span>{t('Фактический риск', 'Actual risk', 'Risc efectiv', '实际风险')}</span><b>{number(result.actualRisk, 4)}%</b></div><p>{t('Округлено вниз по шагу лота.', 'Rounded down to the lot step.', 'Rotunjit în jos la pasul lotului.', '按手数步长向下取整。')}{result.capped && ` ${t('Ограничено максимальным лотом брокера.', 'Capped at the broker’s maximum lot.', 'Limitat la lotul maxim al brokerului.', '已限制为经纪商的最大手数。')}`}</p></> : <p className="lot-empty">{result.error === 'incomplete' ? t('Укажи баланс, риск, стоп и стоимость пипса / тика — размер лота появится здесь.', 'Enter balance, risk, stop and pip / tick value to see your lot size.', 'Introdu soldul, riscul, stopul și valoarea pip / tick pentru a vedea lotul.', '输入余额、风险、止损和每点 / 跳价值，即可查看手数。') : result.error === 'belowMinimum' ? t(`Минимальный лот превышает твой риск. Для него убыток составит ${money(result.minimumLoss)} при лимите ${money(result.budget)}.`, `Minimum lot exceeds your risk. Its loss would be ${money(result.minimumLoss)} against a ${money(result.budget)} budget.`, `Lotul minim depășește riscul: pierdere ${money(result.minimumLoss)}, limită ${money(result.budget)}.`, `最小手数超出风险预算。亏损为 ${money(result.minimumLoss)}，预算为 ${money(result.budget)}。`) : t('Проверь значения: нужны положительные числа, риск до 100%, максимум не меньше минимума. Комиссия может быть нулевой.', 'Check the values: positive numbers, risk up to 100%, maximum at least minimum. Commission may be zero.', 'Verifică valorile: numere pozitive, risc până la 100%, maximul cel puțin egal cu minimul. Comisionul poate fi zero.', '请检查数值：正数、风险不超过100%、最大手数不小于最小手数。佣金可为零。')}</p>}
      </section>
      <p className="lot-footnote">{t('Расчёт по введённым параметрам. Проскальзывание, спред, своп и требования к марже здесь не учитываются.', 'Estimate from your inputs. Slippage, spread, swap and margin requirements are not included.', 'Estimare pe baza datelor introduse. Alunecarea, spread-ul, swap-ul și marja nu sunt incluse.', '根据输入参数估算。不含滑点、点差、隔夜利息及保证金要求。')}</p>
    </dialog>, document.body)}
  </>;
}
