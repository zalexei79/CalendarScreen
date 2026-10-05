import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const desktop = process.argv.includes('--desktop');
const suffix = desktop ? '-desktop' : '';
const screenshotPath = stage => `tests/life-story-app${suffix}-${stage}.png`;
try {
  const context = await browser.newContext({ viewport: desktop ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(desktop => { localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', desktop ? 'dark' : 'light'); localStorage.setItem('calendar_guide_completed', '1'); localStorage.setItem('dayris_voice_feedback', 'off'); }, desktop);
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
  const next = () => page.getByRole('button', { name: 'Увидеть мою историю', exact: true }).click();
  const choose = async () => {
    assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).count(), 0);
    await page.getByRole('button', { name: /Русский/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).count(), 0);
    await page.getByRole('button', { name: /MDL/ }).click();
  };
  await choose();
  // A week at column 51 used to split the selected month across two grid rows.
  const edgeBirthday = new Date(Date.UTC(2026, 9, 5) - (28 * 52 + 51) * 7 * 86400000).toISOString().slice(0, 10);
  await page.getByLabel('Дата рождения', { exact: true }).fill(desktop ? edgeBirthday : '1998-03-14');
  assert.equal(await page.locator('#life-birthday').evaluate(element => getComputedStyle(element).colorScheme), desktop ? 'dark' : 'light');
  await page.screenshot({ path: screenshotPath('birthday') });
  await next();
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.calendarTarget === 'live');
  await page.mouse.move(0, 0);
  await page.clock.runFor(32);
  await page.clock.fastForward(4700);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.stage === 'money');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-counter strong')?.textContent.replace(/\D/g, '')) > 1200);
  assert.equal(await page.locator('.life-story').getAttribute('data-theme'), desktop ? 'dark' : 'light');
  assert.equal(await page.locator('.life-story-paper').evaluate(element => getComputedStyle(element).backgroundColor), desktop ? 'rgb(17, 23, 20)' : 'rgb(247, 244, 236)');
  if (!desktop) await page.setViewportSize({ width: 320, height: 844 });
  await page.clock.runFor(32);
  const counterLayout = await page.evaluate(() => {
    const counter = document.querySelector('.life-story-counter');
    const number = counter.querySelector('strong').getBoundingClientRect();
    const caption = counter.querySelector('span').getBoundingClientRect();
    const gridTop = Number(document.querySelector('.life-story').dataset.gridTop);
    return { number: number.toJSON(), caption: caption.toJSON(), gridTop, width: innerWidth };
  });
  const { number, caption, gridTop, width } = counterLayout;
  assert.ok(number.bottom <= caption.top && caption.bottom + 12 < gridTop && caption.height <= 15 && number.left >= 0 && number.right <= width, `A four-digit counter and its caption fit above the grid, even at 320px: ${JSON.stringify(counterLayout)}`);
  if (!desktop) await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: screenshotPath('weeks'), animations: 'disabled' });
  await page.clock.fastForward(2800);
  const coherentCrop = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.life-calendar-cell')].map(cell => cell.getBoundingClientRect());
    return cells.every((cell, index) => index % 7 === 0 || Math.abs(cell.y - cells[index - 1].y) < .1 && cell.x > cells[index - 1].x);
  });
  assert.ok(coherentCrop, 'Every source row remains contiguous, including a current week at the 52-column edge');
  assert.equal(await page.locator('.life-story-paper').evaluate(element => element.style.opacity), '1', 'No app chrome behind the life-grid zoom');
  assert.deepEqual(await page.locator('.life-calendar-week').evaluateAll(cells => [...new Set(cells.map(cell => getComputedStyle(cell).backgroundColor))]), [desktop ? 'rgb(91, 98, 94)' : 'rgb(191, 184, 167)'], 'The entire approaching month is neutral; historical illustration is never presented as existing entries');
  await page.screenshot({ path: screenshotPath('approach'), animations: 'disabled' });
  await page.clock.fastForward(2400);
  await page.waitForFunction(() => Number(document.querySelector('.life-story-paper')?.style.opacity || 1) < .97);
  assert.equal(await page.locator('.life-story').getAttribute('data-life-opacity'), '0');
  await page.screenshot({ path: screenshotPath('morph'), animations: 'disabled' });
  await page.clock.fastForward(1000);
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
  await page.clock.fastForward(600);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.settled === 'true');
  const before = await page.screenshot({ path: screenshotPath('settled'), animations: 'disabled' });
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
  await page.screenshot({ path: screenshotPath('calendar') });
  await first.click();
  await page.getByRole('button', { name: 'Доходы', exact: true }).waitFor();
  await page.getByText('Укажи сумму и сохрани — запись появится в сегодняшнем дне.', { exact: true }).waitFor();
  await page.clock.runFor(750);
  await page.screenshot({ path: screenshotPath('entry'), animations: 'disabled' });
  assert.equal(await page.getByText('Что уже произошло сегодня?', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Выбери один вариант. Я подготовлю форму, а ты дополнишь её как хочешь.', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(`Production app (${desktop ? 'desktop dark' : 'mobile light'}): contiguous crop, no overlapping life grid/app, exact calendar geometry, invisible removal (pixel difference ${difference.toFixed(3)}), current-day highlight and ordinary entry form passed.`);
} finally { await browser.close(); }
