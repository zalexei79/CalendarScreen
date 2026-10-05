import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(() => { localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', 'light'); localStorage.setItem('calendar_guide_completed', '1'); localStorage.setItem('dayris_voice_feedback', 'off'); });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://calendar.test') return route.abort();
    const name = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!name.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(name)) return route.fulfill({ status: 404, body: '' });
    const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html';
    return route.fulfill({ contentType, body: fs.readFileSync(name) });
  });
  const page = await context.newPage();
  await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://calendar.test/');
  await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  const next = () => page.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await next(); await next();
  await page.getByLabel('Дата рождения', { exact: true }).fill('1998-03-14');
  await next();
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.calendarTarget === 'live');
  await page.mouse.move(0, 0);
  await page.clock.runFor(32);
  await page.clock.fastForward(4700);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.stage === 'money');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-counter strong')?.textContent.replace(/\D/g, '')) > 1200);
  await page.screenshot({ path: 'tests/life-story-app-weeks.png', animations: 'disabled' });
  await page.clock.fastForward(2400);
  await page.waitForFunction(() => Number(document.querySelector('.life-story-paper')?.style.opacity || 1) < .97);
  await page.waitForFunction(() => Number(document.querySelector('.life-story')?.dataset.time) > 7100);
  await page.screenshot({ path: 'tests/life-story-app-approach.png', animations: 'disabled' });
  await page.clock.fastForward(1200);
  await page.waitForFunction(() => Number(document.querySelector('.life-story')?.dataset.time) > 8300);
  await page.screenshot({ path: 'tests/life-story-app-morph.png', animations: 'disabled' });
  await page.clock.fastForward(1600);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.stage === 'ready');
  const geometry = await page.evaluate(() => {
    const live = [...document.querySelectorAll('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button')];
    const copies = [...document.querySelectorAll('.life-calendar-cell')];
    return live.every((cell, index) => {
      const original = cell.getBoundingClientRect();
      const copy = copies[index]?.getBoundingClientRect();
      const face = copies[index]?.querySelector('.life-calendar-face');
      return copy && ['x', 'y', 'width', 'height'].every(key => Math.abs(original[key] - copy[key]) < .1) && getComputedStyle(cell).padding === getComputedStyle(face).padding && getComputedStyle(cell).backgroundColor === getComputedStyle(face).backgroundColor;
    });
  });
  assert.ok(geometry, 'The moving cells settle onto the real calendar with its exact paint and geometry');
  await page.clock.fastForward(500);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.settled === 'true');
  const before = await page.screenshot({ path: 'tests/life-story-app-settled.png', animations: 'disabled' });
  const todayRect = await page.locator('.calendar-days-grid [data-today-cell="true"]').boundingBox();
  await page.clock.fastForward(800);
  await page.waitForFunction(() => !document.querySelector('.life-story'));
  const after = await page.screenshot({ animations: 'disabled' });
  const hintRect = await page.locator('.first-entry-whisper').boundingBox();
  const difference = await page.evaluate(async ({ before, after, todayRect, hintRect }) => {
    const pixels = async data => {
      const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
      return { data: context.getImageData(0, 0, img.width, img.height).data, width: img.width, height: img.height };
    };
    const a = await pixels(before), b = await pixels(after);
    let total = 0, count = 0;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      // Today begins a requested gentle pulse; the entry hint also appears later.
      if (x > todayRect.x - 24 && x < todayRect.x + todayRect.width + 24 && y > todayRect.y - 24 && y < todayRect.y + todayRect.height + 24) continue;
      if (hintRect && x > hintRect.x - 8 && x < hintRect.x + hintRect.width + 8 && y > hintRect.y - 8 && y < hintRect.y + hintRect.height + 8) continue;
      const index = (y * a.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) { total += Math.abs(a.data[index + channel] - b.data[index + channel]); count++; }
    }
    return total / count;
  }, { before: before.toString('base64'), after: after.toString('base64'), todayRect, hintRect });
  assert.ok(difference < .5, `Closing the scene must not change the interface paint (mean channel difference: ${difference})`);
  const first = page.getByRole('button', { name: 'Добавить первую запись', exact: true });
  await first.waitFor();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.first-entry-whisper')).opacity) > .98);
  assert.ok(await page.locator('[data-today-cell="true"]').isVisible());
  await page.screenshot({ path: 'tests/life-story-app-calendar.png' });
  await first.click();
  await page.screenshot({ path: 'tests/life-story-app-entry.png' });
  await page.getByRole('button', { name: 'Доходы', exact: true }).waitFor();
  assert.equal(await page.getByText('Что уже произошло сегодня?', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Выбери один вариант. Я подготовлю форму, а ты дополнишь её как хочешь.', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(`Production app: exact calendar geometry, invisible dialog removal (pixel difference ${difference.toFixed(3)}), financial colors, current-day highlight and ordinary entry form passed.`);
} finally { await browser.close(); }
