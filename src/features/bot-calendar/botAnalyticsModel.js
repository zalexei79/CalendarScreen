const clamp = value => Math.max(0, Math.min(1, value));

// A descriptive journal score, not a forecast, safety rating or recommendation.
// The thresholds and weights are displayed alongside the result in the UI.
export function performanceScore(stats) {
  if (!stats || Number(stats.total) < 30 || Number(stats.active_days) < 5) return null;
  const pf = Number(stats.gross_loss) > 0 ? Number(stats.profit_factor) : Number(stats.gross_profit) > 0 ? 2 : 0;
  const recovery = Number(stats.max_drawdown) > 0 ? Number(stats.pnl) / Number(stats.max_drawdown) : Number(stats.pnl) > 0 ? 3 : 0;
  const parts = [
    { label: 'Profit factor', value: clamp(pf / 2), weight: 35, rule: 'PF / 2, максимум 1' },
    { label: 'Прибыльные дни', value: clamp(Number(stats.positive_days) / Number(stats.active_days)), weight: 25, rule: 'Прибыльные / торговые дни' },
    { label: 'Восстановление', value: clamp(recovery / 3), weight: 25, rule: 'Результат / просадка / 3, от 0 до 1' },
    { label: 'Доля прибыльных сделок', value: clamp(Number(stats.win_rate) / 100), weight: 15, rule: 'Прибыльные / все закрытые сделки' },
  ];
  return { value: Math.round(parts.reduce((sum, part) => sum + part.value * part.weight, 0)), parts };
}

export function plotGeometry(curve = [], mode = 'total', width = 720, height = 220) {
  const series = [0, ...curve.map(point => Number(point[mode]) || 0)];
  let min = Math.min(0, ...series), max = Math.max(0, ...series);
  const padding = max === min ? 1 : (max - min) * .12;
  min -= padding; max += padding;
  const x = i => 18 + i / Math.max(1, series.length - 1) * (width - 36);
  const y = value => 16 + (max - value) / (max - min) * (height - 32);
  const points = series.map((value, i) => ({ x: x(i), y: y(value), value }));
  return { points, line: points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' '),
    zero: y(0), min, max, width, height };
}
