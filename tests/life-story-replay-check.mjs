import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const records = {
  '2026-10-03': [{ id: 'guest-expense-eur', time: '12:00', pnl: -37.5, currency: 'EUR', instrument: 'Продукты', platform: 'Manual', traderMode: false }],
  '2026-10-05': [
    { id: 'guest-income', time: '09:00', pnl: 250, currency: 'MDL', instrument: 'Зарплата', platform: 'Manual', traderMode: false },
    { id: 'guest-expense', time: '10:00', pnl: -80, currency: 'MDL', instrument: 'Продукты', platform: 'Manual', traderMode: false },
  ],
};
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(records => {
    localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_currency', 'MDL'); localStorage.setItem('atj_theme', 'dark');
    localStorage.setItem('dayris_onboarding_v2_completed', '1'); localStorage.setItem('calendar_guide_completed', '1');
    localStorage.setItem('dayris_birthday_v1_guest', '1998-03-14');
    localStorage.setItem('money_calendar_guest_trades_cache', JSON.stringify(records));
  }, records);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://calendar.test') return route.abort();
    const name = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!name.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(name)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html', body: fs.readFileSync(name) });
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
  await page.goto('http://calendar.test/');
  await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  assert.equal(await page.locator('.life-story').count(), 0, 'Completed onboarding stays completed');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: 'Посмотреть мою историю', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.calendarTarget === 'live');
  assert.equal(await page.getByLabel('Дата рождения', { exact: true }).count(), 0, 'Saved birthday starts replay directly');
  await page.clock.runFor(32);
  await page.clock.fastForward(3500);
  const money = page.locator('.life-money-value[data-active="true"][data-source="calendar"][data-tone="expense"] .life-money-current');
  assert.equal(await page.locator('.life-money-value[data-active="true"][data-source="illustration"]').count(), 1, 'An existing account retains the fast life-history stream');
  await page.clock.fastForward(5000);
  assert.equal(await money.locator('.life-money-number').innerText(), '−80', 'The latest real entry keeps its exact amount');
  assert.equal(await money.locator('small').innerText(), 'MDL', 'EUR records are never relabelled to the selected currency');
  await page.screenshot({ path: 'tests/life-story-replay-money.png', animations: 'disabled' });
  await page.clock.runFor(200);
  assert.equal(await money.locator('.life-money-number').innerText(), '−80', 'Real amounts remain still long enough to read');
  await page.clock.fastForward(6000);
  await page.waitForFunction(() => !document.querySelector('.life-story'));
  assert.equal(await page.locator('.first-entry-whisper').count(), 0, 'Replaying an existing history never asks for a first entry');
  assert.equal(await page.locator('.first-calendar-entry-hint').count(), 0);
  assert.ok(await page.locator('[data-today-cell="true"]').isVisible());
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('money_calendar_guest_trades_cache'))), records, 'Watching the story never changes saved records');
  await page.screenshot({ path: 'tests/life-story-replay-calendar.png', animations: 'disabled' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(32);
  await page.getByRole('button', { name: 'Посмотреть мою историю', exact: true }).click();
  await page.clock.runFor(32);
  await page.waitForFunction(() => !document.querySelector('.life-story'));
  assert.equal(await page.locator('.first-entry-whisper').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Settings replay: direct start with saved birthday, exact signed amounts in the selected currency, untouched records in all currencies, existing calendar arrival, no first-entry prompt and reduced motion passed.');
} finally { await browser.close(); }
