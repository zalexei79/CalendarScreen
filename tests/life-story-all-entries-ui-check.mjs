import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const entries = Array.from({ length: 32 }, (_, index) => ({ id: `entry-${index}`, time: `10:${String(index).padStart(2, '0')}`, pnl: index % 2 ? -index : index, currency: ['USD','EUR','MDL','RUB','CNY'][index % 5], instrument: index % 3 ? 'Продукты' : 'EURUSD', platform: 'Manual', traderMode: index % 3 === 0 }));
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(({ entries, id }) => {
    localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_currency', 'USD'); localStorage.setItem('atj_theme', 'purple');
    localStorage.setItem('dayris_onboarding_v2_completed', '1'); localStorage.setItem('calendar_guide_completed', '1');
    localStorage.setItem(`money_calendar_trades_${id}`, JSON.stringify({ '2026-10-05': entries }));
  }, { entries, id: storyUserId });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://calendar.test') return route.abort();
    const name = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!name.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(name)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html', body: fs.readFileSync(name) });
  });
  await installStoryAccount(context);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
  await page.goto('http://calendar.test/');
  await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: /Моя история/ }).click();
  assert.equal(await page.getByLabel('Дата рождения', { exact: true }).count(), 0, 'Personal story works without a saved birthday');
  await page.clock.runFor(32);
  const seen = new Set();
  for (let elapsed = 0; elapsed < 8500; elapsed += 100) {
    await page.clock.runFor(100);
    const event = await page.locator('.life-money-value').evaluate(el => ({ id: el.dataset.recordId, source: el.dataset.source, active: el.dataset.active, currency: el.querySelector('.life-money-current small').textContent }));
    if (event.active === 'true') {
      assert.equal(event.source, 'calendar');
      const saved = entries.find(entry => entry.id === event.id);
      assert.ok(saved, 'Every displayed entry belongs to the user');
      assert.equal(event.currency, saved.currency);
      seen.add(event.id);
    }
  }
  assert.deepEqual([...seen], entries.map(entry => entry.id), 'Every saved entry appears in chronological order, including zero amounts, trades and all currencies');
  await page.clock.runFor(8000);
  assert.equal(await page.locator('.life-story').count(), 0, 'Long stories still arrive in the calendar');
  assert.equal(await page.locator('html').getAttribute('data-dayris-theme'), 'purple');
  assert.deepEqual(errors, []);
  console.log('PASS: all 32 entries, five currencies, zero amount, trades, no birthday, adaptive story duration and purple calendar.');
} finally { await browser.close(); }
