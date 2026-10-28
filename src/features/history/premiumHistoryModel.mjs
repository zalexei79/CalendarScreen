import {summarizeFreeHistory} from './freeHistoryModel.js';
import {previousPeriod} from '../trades-sync/lib/periodComparison.mjs';

const pnl = row => Number(row.pnl);
const valid = row => Number.isFinite(pnl(row));
const sum = (rows, positive) => rows.reduce((total, row) => total + (positive ? Math.max(0, pnl(row)) : Math.max(0, -pnl(row))), 0);
const change = (current, previous) => previous ? Math.round((current / previous - 1) * 100) : null;

// Row filters never redefine the overall result. Currencies remain separate.
export function premiumHistoryModel(source, {currency, from, to, today, isTrading = () => false}) {
  const all = source.filter(valid).filter(row => currency === 'ALL' || (row.currency || 'USD') === currency);
  const rows = all.filter(row => row.dateKey >= from && row.dateKey <= to);
  const summary = summarizeFreeHistory(rows, currency);
  const groups = positive => {
    const values = new Map();
    rows.filter(row => positive ? pnl(row) > 0 : pnl(row) < 0).forEach(row => {
      const name = row.instrument || 'Другое', group = values.get(name) || {name, amount: 0, count: 0};
      group.amount += Math.abs(pnl(row)); group.count += 1; values.set(name, group);
    });
    return summary.mixed ? [] : [...values.values()].sort((a, b) => b.amount - a.amount);
  };
  const expenses = groups(false), incomes = groups(true);
  const range = previousPeriod(from, to);
  const previous = range ? all.filter(row => (row.currency || 'USD') === summary.currency && row.dateKey >= range.from && row.dateKey <= range.to) : [];
  const trading = rows.filter(isTrading), wins = rows.filter(row => pnl(row) > 0), losses = rows.filter(row => pnl(row) < 0);
  let peak = 0, running = 0, maxDrawdown = 0;
  if (!summary.mixed) [...rows].sort((a, b) => a.dateKey.localeCompare(b.dateKey) || String(a.time || '').localeCompare(String(b.time || '')) || String(a.id).localeCompare(String(b.id))).forEach(row => {
    running += pnl(row); peak = Math.max(peak, running); maxDrawdown = Math.max(maxDrawdown, peak - running);
  });
  const positive = sum(wins, true), negative = sum(losses, false);
  const daily = new Map();
  rows.forEach(row => {const value=daily.get(row.dateKey)||{income:0,expense:0};value.income+=Math.max(0,pnl(row));value.expense+=Math.max(0,-pnl(row));daily.set(row.dateKey,value);});
  const recurring = expenses.find(group => group.count >= 2 && rows.some(row => row.instrument === group.name && !isTrading(row)));
  const finitePeriod = from >= '1900-01-01' && to < '2100-01-01';
  const elapsed = finitePeriod && today >= from && today < to ? (Date.parse(today + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 + 1 : 0;
  const days = finitePeriod ? (Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000 + 1 : 0;
  return {rows, summary, expenses, incomes, dailyEntries:[...daily].sort((a,b)=>a[0].localeCompare(b[0])), hasTrading: trading.length > 0, recurring,
    comparison: !summary.mixed && previous.length ? {
      range, income: change(sum(rows, true), sum(previous, true)), expense: change(sum(rows, false), sum(previous, false)),
      previousIncome:sum(previous,true), previousExpense:sum(previous,false),
      previousTotal:sum(previous,true)-sum(previous,false),
      difference:summary.total-(sum(previous,true)-sum(previous,false)),
    } : null,
    projectedExpense: !summary.mixed && !trading.length && elapsed && rows.length ? sum(rows.filter(row=>row.dateKey<=today), false) / elapsed * days : null,
    winCount: wins.length, lossCount: losses.length, breakevenCount: rows.length - wins.length - losses.length,
    winrate: rows.length ? Math.round(wins.length / rows.length * 100) : null,
    profitFactor: summary.mixed ? null : negative ? positive / negative : positive ? Infinity : null,
    maxDrawdown: summary.mixed ? null : maxDrawdown,
  };
}

const optionalNumber = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function premiumHistoryAccountKey(row) {
  return `${row.platform || 'Manual'}:${premiumTradeFacts(row).account ?? 'unknown'}`;
}
export function premiumTradeFacts(row) {
  const commission = optionalNumber(row.commission), swap = optionalNumber(row.swap);
  const gross = optionalNumber(row.gross_profit);
  const marker = String(row.comment || '').match(/\[DAYRIS:(MT[45]):([^:\]]+):(\d+):(\d+)\]/);
  return {entry: optionalNumber(row.entry_price), exit: optionalNumber(row.exit_price), volume: optionalNumber(row.volume),
    commission, swap, gross: gross ?? (commission !== null && swap !== null ? pnl(row) - commission - swap : null),
    account: row.ctrader_account_id ?? marker?.[3] ?? null,
    ticket: row.ctrader_deal_id ?? marker?.[4] ?? null,
    note: String(row.comment || '').replace(/\[DAYRIS:[^\]]*\]/g, '').trim(),
    takeProfit: optionalNumber(row.take_profit), stopLoss: optionalNumber(row.stop_loss),
  };
}
