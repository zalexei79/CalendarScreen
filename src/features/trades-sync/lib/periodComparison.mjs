import { pnlCurve } from './pnlCurve.mjs';

export const curveGroupKey = trade => `${trade.ctrader_account_id || trade.platform || 'Manual'}|${trade.currency || 'USD'}`;

export function previousPeriod(from, to) {
  const parse = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || value < '1900-01-01') return NaN;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : NaN;
  };
  const start = parse(from), end = parse(to), day = 86400000;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || to === '9999-12-31') return null;
  const previousStart = start - (end - start + day);
  if (previousStart < Date.parse('1900-01-01T00:00:00Z')) return null;
  return { from: new Date(previousStart).toISOString().slice(0, 10), to: new Date(start - day).toISOString().slice(0, 10) };
}

export function comparePeriod(trades, groupKey, range, current) {
  if (!range || !groupKey) return null;
  const previous = trades.filter(t => curveGroupKey(t) === groupKey && t.dateKey >= range.from && t.dateKey <= range.to);
  if (!previous.length) return null;
  const curve = pnlCurve(previous);
  return { count: previous.length, pnlDelta: current.total - curve.total, drawdownDelta: current.maxDrawdown - curve.maxDrawdown };
}
