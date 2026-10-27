// A presentation total, independent of record-list filters. Never add currencies.
export function summarizeFreeHistory(records, currency) {
  const groups = new Map();
  for (const record of records || []) {
    const code = record.currency || 'USD';
    if (currency !== 'ALL' && code !== currency) continue;
    const group = groups.get(code) || { income: 0, expense: 0, count: 0 };
    const value = Number(record.pnl);
    const amount = Number.isFinite(value) ? value : 0;
    group.income += Math.max(0, amount);
    group.expense += Math.max(0, -amount);
    group.count++;
    groups.set(code, group);
  }
  const count = [...groups.values()].reduce((sum, group) => sum + group.count, 0);
  if (currency === 'ALL' && groups.size > 1) return { mixed: true, currency: 'ALL', count, total: null, income: null, expense: null };
  const code = currency === 'ALL' ? [...groups.keys()][0] || 'ALL' : currency;
  const group = groups.get(code) || { income: 0, expense: 0 };
  // Imported PnL can contain fractions of a cent. Round only after summing,
  // as the existing history does, without altering any stored record.
  const rounded = value => Math.sign(value) * Math.round(Math.abs(value) * 100) / 100;
  return { mixed: false, currency: code, count, income: rounded(group.income), expense: rounded(group.expense), total: rounded(group.income - group.expense) };
}
