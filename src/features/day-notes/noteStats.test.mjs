import test from 'node:test';
import assert from 'node:assert/strict';
import { noteStats } from './noteStats.mjs';

test('aggregates whole days, shares multi-tag days and separates currencies', () => {
  const trades = [
    { dateKey: '2026-09-01', pnl: 100, currency: 'USD' },
    { dateKey: '2026-09-01', pnl: -120, currency: 'USD' },
    { dateKey: '2026-09-01', pnl: 50, currency: 'EUR' },
    { dateKey: '2026-09-02', pnl: 30, currency: 'USD' },
    { dateKey: '2026-09-03', pnl: 0, currency: 'USD' },
    { dateKey: '2026-09-04', pnl: 999, currency: 'USD' },
  ];
  const notes = {
    '2026-09-01': { tags: ['plan', 'tired'] },
    '2026-09-02': { tags: ['plan'] },
    '2026-09-03': { tags: ['plan'] },
  };
  const groups = noteStats(trades, notes);
  const usd = groups.find(g => g.tag === 'plan' && g.currency === 'USD');
  assert.equal(usd.pnl, 10);
  assert.equal(usd.days.length, 3);
  assert.equal(usd.winRate, 33);
  assert.equal(groups.find(g => g.tag === 'plan' && g.currency === 'EUR').pnl, 50);
  assert.equal(groups.find(g => g.tag === 'tired' && g.currency === 'USD').pnl, -20);
});

test('ignores untagged notes, missing trades and invalid amounts', () => {
  assert.deepEqual(noteStats([], { '2026-09-01': { tags: ['tired'] } }), []);
  assert.deepEqual(noteStats([{ dateKey: '2026-09-01', pnl: NaN }], { '2026-09-01': { tags: ['tired'] } }), []);
  assert.deepEqual(noteStats([{ dateKey: '2026-09-01', pnl: 20 }], { '2026-09-01': { note: 'text' } }), []);
});
