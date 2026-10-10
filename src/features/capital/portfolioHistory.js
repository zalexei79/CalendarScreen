import { MONEY_SCALE, parseScaled } from './decimal.js';

const RANGE_DAYS = { week: 7, month: 30, quarter: 90, year: 365 };

export function filterPortfolioSnapshots(rows, range = 'all', today = new Date()) {
  const valid = (rows || []).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.sampled_on || '')));
  const days = RANGE_DAYS[range];
  if (!days) return valid.slice().sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
  const cutoff = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const dateKey = cutoff.toISOString().slice(0, 10);
  return valid.filter(row => row.sampled_on >= dateKey).sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
}

export function buildPortfolioChart(rows) {
  const sorted = (rows || []).slice().sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
  if (sorted.length < 2) return { linePath: '', areaPath: '', rows: sorted, points: [] };
  const values = sorted.map(row => parseScaled(row.portfolio_value, MONEY_SCALE));
  const min = values.reduce((a, b) => a < b ? a : b);
  const max = values.reduce((a, b) => a > b ? a : b);
  const span = max - min || 1n;
  const points = values.map((value, index) => ({
    x: 12 + index * (296 / (values.length - 1)),
    y: 100 - Number((value - min) * 7600n / span) / 100,
    value,
    date: sorted[index].sampled_on,
  }));
  const linePath = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = points.at(-1);
  const areaPath = `${linePath} L${last.x.toFixed(1)} 112 L${points[0].x.toFixed(1)} 112 Z`;
  return { linePath, areaPath, rows: sorted, points, min, max };
}
