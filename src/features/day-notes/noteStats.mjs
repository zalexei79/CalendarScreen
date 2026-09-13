export const NOTE_TAGS = ['plan', 'rushed', 'tired', 'broke_rules'];

export function noteStats(trades, notes) {
  const days = new Map();
  for (const trade of trades) {
    const pnl = Number(trade.pnl);
    if (!Number.isFinite(pnl) || !trade.dateKey) continue;
    const currency = trade.currency || 'USD';
    const key = `${trade.dateKey}:${currency}`;
    const day = days.get(key) || { date: trade.dateKey, currency, pnl: 0 };
    day.pnl += pnl;
    days.set(key, day);
  }
  return NOTE_TAGS.flatMap(tag => {
    const groups = new Map();
    for (const day of days.values()) {
      if (!notes[day.date]?.tags?.includes(tag)) continue;
      const group = groups.get(day.currency) || { tag, currency: day.currency, days: [], pnl: 0, wins: 0 };
      group.days.push(day);
      group.pnl += day.pnl;
      if (day.pnl > 0) group.wins++;
      groups.set(day.currency, group);
    }
    return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map(group => ({
      ...group, days: group.days.sort((a, b) => b.date.localeCompare(a.date)),
      winRate: Math.round(group.wins / group.days.length * 100),
    }));
  });
}
