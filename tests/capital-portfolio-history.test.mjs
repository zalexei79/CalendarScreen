import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPortfolioChart, filterPortfolioSnapshots } from '../src/features/capital/portfolioHistory.js';

const snapshot = (sampled_on, portfolio_value) => ({ sampled_on, portfolio_value });

test('portfolio history uses only valid persisted dates and sorts snapshots', () => {
  const rows = [snapshot('2026-10-09', '120.00'), snapshot('bad-date', '999.00'), snapshot('2026-10-08', '100.00')];
  assert.deepEqual(filterPortfolioSnapshots(rows, 'all').map(row => row.sampled_on), ['2026-10-08', '2026-10-09']);
});

test('portfolio history ranges include the selected day and preceding days', () => {
  const rows = [snapshot('2026-10-01', '90.00'), snapshot('2026-10-04', '100.00'), snapshot('2026-10-10', '120.00')];
  const today = new Date('2026-10-10T14:00:00.000Z');
  assert.deepEqual(filterPortfolioSnapshots(rows, 'week', today).map(row => row.sampled_on), ['2026-10-04', '2026-10-10']);
  assert.deepEqual(filterPortfolioSnapshots(rows, 'month', today).map(row => row.sampled_on), ['2026-10-01', '2026-10-04', '2026-10-10']);
});

test('chart is omitted until two real valuation snapshots exist', () => {
  assert.equal(buildPortfolioChart([]).linePath, '');
  assert.equal(buildPortfolioChart([snapshot('2026-10-10', '120.00')]).areaPath, '');
});

test('chart sorts real snapshots and maps exact decimal values to a stable SVG path', () => {
  const chart = buildPortfolioChart([snapshot('2026-10-10', '150.00'), snapshot('2026-10-08', '100.00')]);
  assert.deepEqual(chart.rows.map(row => row.sampled_on), ['2026-10-08', '2026-10-10']);
  assert.equal(chart.linePath, 'M12.0 100.0 L308.0 24.0');
  assert.equal(chart.areaPath, 'M12.0 100.0 L308.0 24.0 L308.0 112 L12.0 112 Z');
});

test('constant-value history remains flat without fabricating extra points', () => {
  const chart = buildPortfolioChart([snapshot('2026-10-08', '42.50'), snapshot('2026-10-09', '42.50')]);
  assert.equal(chart.linePath, 'M12.0 100.0 L308.0 100.0');
  assert.equal(chart.rows.length, 2);
});
