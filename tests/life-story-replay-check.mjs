import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const records = {
  '2026-10-03': [{ id: 'guest-expense-eur', time: '12:00', pnl: -37.5, currency: 'EUR', instrument: 'Продукты', platform: 'Manual', traderMode: false }],
  '2026-10-05': [
    { id: 'guest-expense', time: '09:00', pnl: -80, currency: 'USD', instrument: 'Продукты', platform: 'Manual', traderMode: false },
    { id: 'guest-income', time: '10:00', pnl: 55, currency: 'USD', instrument: 'Подарок', platform: 'Manual', traderMode: false },
  ],
};
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(({ records, id }) => {
    localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_currency', 'USD');
    if (!localStorage.getItem('atj_theme')) localStorage.setItem('atj_theme', 'dark');
    localStorage.setItem('dayris_onboarding_v2_completed', '1'); localStorage.setItem('calendar_guide_completed', '1');
    localStorage.setItem(`dayris_birthday_v1_${id}`, '1998-03-14');
    localStorage.setItem(`money_calendar_trades_${id}`, JSON.stringify(records));
  }, { records, id: storyUserId });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://calendar.test') return route.abort();
    const name = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!name.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(name)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : 'text/html', body: fs.readFileSync(name) });
  });
  const page = await context.newPage();
  await installStoryAccount(context);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
  await page.goto('http://calendar.test/');
  await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  assert.equal(await page.locator('.life-story').count(), 0, 'Completed onboarding stays completed');
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: /Моя история/ }).click();
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.calendarTarget === 'live');
  assert.equal(await page.getByLabel('Дата рождения', { exact: true }).count(), 0, 'Saved birthday starts replay directly');
  await page.clock.runFor(32);
  await page.clock.fastForward(1000);
  assert.equal(await page.locator('.life-money-current .life-money-number').innerText(), '−37,5', 'EUR entries appear even when USD is selected');
  assert.equal(await page.locator('.life-money-current small').innerText(), 'EUR');
  await page.clock.fastForward(3500);
  assert.equal(await page.locator('.life-money-value[data-active="true"][data-source="calendar"]').count(), 1, 'Settings replay shows only saved calendar entries');
  assert.equal(await page.locator('.life-money-current .life-money-number').innerText(), '+55');
  assert.equal(await page.locator('.life-money-label').innerText(), 'Записи из календаря');
  assert.equal(await page.locator('.life-money-value[data-source="illustration"]').count(), 0);
  assert.equal(await page.locator('.life-money-current small').innerText(), 'USD');
  await page.clock.fastForward(1700);
  // A saved +55 used to come back at 8s and cover the question in this window.
  for (let time = 6200; time <= 9000; time += 100) {
    const layers = await page.evaluate(() => ({
      amounts: Number(getComputedStyle(document.querySelector('.life-money-amounts')).opacity),
      question: Number(getComputedStyle(document.querySelector('.life-money-question')).opacity),
      active: document.querySelectorAll('.life-money-value[data-active="true"]').length,
    }));
    assert.equal(layers.amounts, 0, 'Saved amounts never return after the money question');
    assert.equal(layers.question, 1, 'The question keeps its own window through the camera approach');
    assert.equal(layers.active, 0);
    if (time === 7200) await page.screenshot({ path: 'tests/life-story-replay-money.png', animations: 'disabled' });
    await page.clock.runFor(100);
  }
  await page.clock.fastForward(6000);
  await page.waitForFunction(() => !document.querySelector('.life-story'));
  assert.equal(await page.locator('.first-entry-whisper').count(), 0, 'Replaying an existing history never asks for a first entry');
  assert.equal(await page.locator('.first-calendar-entry-hint').count(), 0);
  assert.ok(await page.locator('[data-today-cell="true"]').isVisible());
  assert.match(await page.locator('[data-today-cell="true"]').innerText(), /25/, 'The real +55 and −80 still contribute to the native calendar day');
  assert.deepEqual(await page.evaluate(id => JSON.parse(localStorage.getItem(`money_calendar_trades_${id}`)), storyUserId), records, 'Watching the story never changes saved records');
  await page.screenshot({ path: 'tests/life-story-replay-calendar.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: /Оформление/ }).click();
  await page.getByRole('button', { name: 'Фиолетовое', exact: true }).click();
  await page.clock.runFor(600);
  assert.equal(await page.evaluate(() => localStorage.getItem('atj_theme')), 'purple');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.premium-shell')).backgroundColor === 'rgb(17, 16, 21)');
  assert.equal(await page.locator('.premium-shell').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(17, 16, 21)');
  await page.getByRole('button', { name: 'Закрыть настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.reload();
  await page.clock.runFor(1000);
  assert.equal(await page.locator('html').getAttribute('data-dayris-theme'), 'purple', 'Purple theme persists after reload');
  await page.screenshot({ path: 'tests/life-story-purple-calendar.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.getByRole('button', { name: /Оформление/ }).click();
  await page.getByRole('button', { name: 'Изумрудное', exact: true }).click();
  await page.clock.runFor(700);
  assert.equal(await page.evaluate(() => localStorage.getItem('atj_theme')), 'emerald');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.premium-shell')).backgroundColor === 'rgb(7, 28, 22)');
  assert.equal(await page.locator('.premium-shell').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(7, 28, 22)');
  assert.match(await page.locator('.premium-shell').evaluate(el => getComputedStyle(el).transitionProperty), /background-color/);
  await page.getByRole('button', { name: 'Закрыть настройки', exact: true }).click();
  await page.clock.runFor(400);
  await page.reload(); await page.clock.runFor(1000);
  assert.equal(await page.locator('html').getAttribute('data-dayris-theme'), 'emerald');
  await page.screenshot({path:'tests/life-story-emerald-calendar.png',animations:'disabled'});
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.clock.runFor(32);
  await page.getByRole('button', { name: /Моя история/ }).click();
  await page.clock.runFor(32);
  await page.waitForFunction(() => !document.querySelector('.life-story'));
  assert.equal(await page.locator('.first-entry-whisper').count(), 0);
  assert.deepEqual(errors, []);
  console.log('Settings replay: real selected-currency entries, untouched saved records, calendar arrival and reduced motion passed.');
} finally { await browser.close(); }
