// End-of-day realized PnL, not account equity or intraday drawdown.
export function pnlCurve(trades) {
  const days = new Map();
  for (const trade of trades) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trade.dateKey) || !Number.isFinite(Number(trade.pnl))) continue;
    days.set(trade.dateKey, (days.get(trade.dateKey) || 0) + Number(trade.pnl));
  }
  const dates = [...days.keys()].sort();
  let total = 0, peak = 0, peakDate = dates[0], episode = null, worst = null;
  const points = dates.map(date => {
    total += days.get(date);
    const drawdown = Math.max(0, peak - total);
    if (drawdown > 1e-8) {
      episode ||= { start: peakDate, recovered: null };
      if (!worst || drawdown > worst.amount) worst = { amount: drawdown, episode };
    } else {
      if (episode) episode.recovered = date;
      episode = null;
      peak = Math.max(peak, total);
      peakDate = date;
    }
    return { date, total, drawdown };
  });
  const recoveryDays = worst?.episode.recovered
    ? Math.round((Date.parse(worst.episode.recovered) - Date.parse(worst.episode.start)) / 86400000) : null;
  return { points, total, maxDrawdown: worst?.amount || 0, recoveryDays };
}
