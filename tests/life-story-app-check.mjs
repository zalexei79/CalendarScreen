import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const desktop = process.argv.includes('--desktop');
const reference = process.argv.includes('--reference');
const currency = desktop ? 'RUB' : 'MDL';
const suffix = desktop ? reference ? '-desktop-reference' : '-desktop' : '';
const screenshotPath = stage => `tests/life-story-app${suffix}-${stage}.png`;
try {
  const context = await browser.newContext({ viewport: desktop ? reference ? { width: 1145, height: 976 } : { width: 1440, height: 1000 } : { width: 390, height: 844 }, serviceWorkers: 'block' });
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
  await page.screenshot({ path: screenshotPath('language') });
  if (!desktop) {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.screenshot({ path: screenshotPath('language-narrow') });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  const next = () => page.getByRole('button', { name: 'Увидеть мою историю', exact: true }).click();
  const choose = async () => {
    assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).count(), 0);
    await page.getByRole('button', { name: /Русский/ }).click();
    assert.equal(await page.getByRole('button', { name: 'Продолжить', exact: true }).count(), 0);
    await page.getByRole('button', { name: new RegExp(currency) }).click();
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
  await page.clock.fastForward(2200);
  assert.equal(await page.locator('.life-story').getAttribute('data-stage'), 'life');
  assert.equal(await page.locator('.life-story-money').getAttribute('data-source'), 'illustration', 'Money appears with childhood events, before the later narrative title');
  const earlyColors = await page.locator('.life-story-grid').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 100 && (pixels[i + 1] - pixels[i] > 12 || pixels[i] - pixels[i + 1] > 18)) colored++;
    return colored;
  });
  assert.ok(earlyColors > 50, 'Income and spending already color the counted weeks during the first scene');
  await page.screenshot({ path: screenshotPath('early'), animations: 'disabled' });
  await page.evaluate(() => {
    window.moneyBeats = [];
    window.moneyDrums = [...document.querySelectorAll('.life-money-track')];
    window.moneyCurrencyX = document.querySelector('.life-money-unit').getBoundingClientRect().x;
    new MutationObserver(changes => { for (const change of changes) if (change.attributeName === 'aria-label') window.moneyBeats.push(change.target.getAttribute('aria-label')); }).observe(document.querySelector('.life-story-money strong'), { attributes: true });
  });
  await page.clock.runFor(800);
  const beats = await page.evaluate(() => [...new Set(window.moneyBeats)]);
  assert.ok(beats.length >= 1 && beats.length <= 3, 'Financial events have room to settle instead of flashing every 80ms');
  assert.ok(beats.every(value => value.endsWith(currency)), 'Every illustrative amount uses the explicitly selected currency');
  assert.ok(await page.evaluate(() => window.moneyDrums.every(node => node.isConnected) && Math.abs(document.querySelector('.life-money-unit').getBoundingClientRect().x - window.moneyCurrencyX) < .1), 'The same drums retain their momentum and the amount keeps its width across events');
  if (desktop) assert.equal(await page.locator('.life-story').evaluate(element => getComputedStyle(element, '::before').display), 'none', 'Dark mode has no grain texture');
  await page.clock.fastForward(1700);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.stage === 'money');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-counter strong')?.textContent.replace(/\D/g, '')) > 1200);
  const money = page.locator('.life-story-money');
  assert.equal(await money.getAttribute('data-source'), 'illustration');
  assert.match(await money.locator('strong').getAttribute('aria-label'), new RegExp(`^[+−].*${currency}$`));
  assert.ok(Number(await money.getAttribute('data-week')) <= Number(await page.locator('.life-story-counter strong').innerText().then(text => text.replace(/\D/g, ''))));
  const focusDistance = await page.locator('.life-story').evaluate(element => Math.abs(Number(element.dataset.focusWeek) - Number(element.dataset.currentWeek)));
  assert.ok(focusDistance <= 6, 'The focused week remains adjacent to the chronological present, including row edges');
  assert.equal(await page.locator('.life-story').getAttribute('data-theme'), desktop ? 'dark' : 'light');
  assert.equal(await page.locator('.life-story-paper').evaluate(element => getComputedStyle(element).backgroundColor), desktop ? 'rgb(17, 23, 20)' : 'rgb(247, 244, 236)');
  if (desktop) assert.ok(Number(await page.locator('.life-story').getAttribute('data-grid-width')) > (reference ? 540 : 570), 'The desktop life panel uses the available screen height to make the weeks legible');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.life-story-money').getBoundingClientRect().bottom < innerHeight), 'The enlarged grid and monetary panel fit in the viewport');
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
  await page.clock.fastForward(3000);
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
  await page.clock.fastForward(900);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.settled === 'true');
  assert.equal(await page.locator('.life-story-money').evaluate(element => getComputedStyle(element).opacity), '0', 'The monetary panel leaves before the calendar becomes interactive');
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
      // Include the guide's soft shadow; its entrance is intentional after handoff.
      if (hintRect && x > hintRect.x - 24 && x < hintRect.x + hintRect.width + 24 && y > hintRect.y - 24 && y < hintRect.y + hintRect.height + 24) continue;
      const index = (y * a.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) { total += Math.abs(a.data[index + channel] - b.data[index + channel]); count++; }
    }
    return total / count;
  }, { before: before.toString('base64'), after: after.toString('base64'), todayRect, hintRect });
  assert.ok(difference < .05, `Closing the scene must not change the interface paint (mean channel difference: ${difference})`);
  const first = page.getByRole('button', { name: 'Добавить первую запись', exact: true });
  await first.waitFor();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.first-entry-whisper')).opacity) > .98);
  assert.ok(await page.locator('[data-today-cell="true"]').isVisible());
  await page.screenshot({ path: screenshotPath('calendar') });
  await page.getByText('Твой денежный календарь', { exact: true }).waitFor();
  assert.ok(await page.getByRole('button', { name: 'Осмотрюсь сам', exact: true }).isVisible(), 'The guide leaves an explicit way to explore freely');
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
