import React from 'react';
import { dateLabel, money, tradeCount } from './botCalendarModel.js';

export default function BotAdjustments({ summary, currency = 'USD' }) {
  if (!summary?.count) return null;
  return <details className="bot-adjustments">
    <summary>С учётом корректировок владельца · {tradeCount(summary.count)}</summary>
    <p>Владелец исключил указанные сделки из результата бота. Исходный результат счёта сохранён.</p>
    <dl><div><dt>До корректировки</dt><dd>{money(summary.original_pnl,currency,true)}</dd></div><div><dt>Исключено из расчёта</dt><dd>{money(summary.excluded_pnl,currency,true)}</dd></div><div><dt>После корректировки</dt><dd>{money(summary.adjusted_pnl,currency,true)}</dd></div></dl>
    {summary.trades.map(trade=><article key={trade.deal_id}><span>{dateLabel(trade.date_key,{day:'numeric',month:'short'})} · {String(trade.time).slice(0,5)} · {trade.instrument} · {trade.direction==='LONG'?'Buy':'Sell'}</span><strong>{money(trade.pnl,currency,true)}</strong><small>{trade.reason}</small></article>)}
  </details>;
}
