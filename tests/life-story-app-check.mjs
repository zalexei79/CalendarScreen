import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const desktop = process.argv.includes('--desktop');
const dark = desktop || process.argv.includes('--dark');
const reference = process.argv.includes('--reference');
const currency = desktop ? 'RUB' : 'MDL';
const suffix = desktop ? reference ? '-desktop-reference' : '-desktop' : dark ? '-dark' : '';
const screenshotPath = stage => `tests/life-story-app${suffix}-${stage}.png`;
try {
  const context = await browser.newContext({ viewport: desktop ? reference ? { width: 1145, height: 976 } : { width: 1440, height: 1000 } : { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(dark => { localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', dark ? 'dark' : 'light'); localStorage.setItem('calendar_guide_completed', '1'); localStorage.setItem('dayris_voice_feedback', 'off'); }, dark);
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
  assert.equal(await page.locator('#life-birthday').evaluate(element => getComputedStyle(element).colorScheme), dark ? 'dark' : 'light');
  await page.screenshot({ path: screenshotPath('birthday') });
  await next();
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.calendarTarget === 'live');
  await page.mouse.move(0, 0);
  await page.clock.runFor(32);
  const seek = async time => {
    const current = Number(await page.locator('.life-story').getAttribute('data-time'));
    await page.clock.fastForward(Math.max(0, time - current));
    await page.clock.runFor(32);
  };
  await seek(3500);
  assert.equal(await page.locator('.life-story').getAttribute('data-stage'), 'life');
  const money = page.locator('.life-money-flow-event[data-active="true"]');
  assert.ok(await money.count() >= 1 && await money.count() <= 3, 'A limited flow appears alongside the first childhood events');
  assert.ok((await money.evaluateAll(nodes => nodes.map(node => node.dataset.source))).every(source => source === 'illustration'));
  assert.equal(await page.locator('.life-story-money').count(), 0, 'There is no separate monetary card competing with the weeks');
  assert.equal(await page.locator('.life-story-money-note').count(), 0, 'Money no longer sits in a separate footer counter');
  const earlyColors = await page.locator('.life-story-grid').evaluate(canvas => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i + 3] > 100 && (pixels[i + 1] - pixels[i] > 12 || pixels[i] - pixels[i + 1] > 18)) colored++;
    return colored;
  });
  assert.ok(earlyColors > 50, 'Income and spending already color the counted weeks during the first scene');
  await page.screenshot({ path: screenshotPath('early'), animations: 'disabled' });
  const firstHeading = await page.locator('.life-story-heading h1').innerText();
  await page.evaluate(() => {
    window.moneyBeats = [];
    window.moneyNodes = [...document.querySelectorAll('.life-money-flow-event')];
    new MutationObserver(changes => { for (const change of changes) if (change.attributeName === 'aria-label') window.moneyBeats.push(change.target.textContent); }).observe(document.querySelector('.life-money-flow'), { attributes: true, subtree: true });
  });
  await page.clock.runFor(1000);
  const beats = await page.evaluate(() => window.moneyBeats);
  assert.ok(beats.length >= 6 && beats.length <= 8, 'Several transactions flow each second without replacing a single flashing number');
  assert.ok(beats.every(amount => amount.endsWith(currency)), 'Every transaction uses the selected currency');
  assert.ok(await page.evaluate(() => window.moneyNodes.every(node => node.isConnected)), 'A fixed pool of labels avoids mounting new UI each frame');
  assert.equal(await page.locator('.life-story-heading h1').innerText(), firstHeading, 'Counting and financial examples share one stable narrative');
  if (dark) assert.equal(await page.locator('.life-story').evaluate(element => getComputedStyle(element, '::before').display), 'none', 'Dark mode has no grain texture');
  await seek(6500);
  assert.equal(await page.locator('.life-story').getAttribute('data-stage'), 'question');
  assert.equal(await page.locator('.life-story-heading h1').innerText(), 'А ты знаешь, куда ушли эти деньги?');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-counter strong')?.textContent.replace(/\D/g, '')) > 1200);
  const filled = Number(await page.locator('.life-story-counter strong').innerText().then(text => text.replace(/\D/g, '')));
  assert.ok((await money.evaluateAll(nodes => nodes.map(node => Number(node.dataset.week)))).every(week => week <= filled));
  const focusDistance = await page.locator('.life-story').evaluate(element => Math.abs(Number(element.dataset.focusWeek) - Number(element.dataset.currentWeek)));
  assert.ok(focusDistance <= 6, 'The focused week remains adjacent to the chronological present, including row edges');
  assert.equal(await page.locator('.life-story').getAttribute('data-theme'), dark ? 'dark' : 'light');
  assert.equal(await page.locator('.life-story-paper').evaluate(element => getComputedStyle(element).backgroundColor), dark ? 'rgb(17, 23, 20)' : 'rgb(247, 244, 236)');
  if (desktop) assert.ok(Number(await page.locator('.life-story').getAttribute('data-grid-width')) > (reference ? 540 : 570), 'The desktop life panel uses the available screen height to make the weeks legible');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.life-money-flow-event[data-active="true"]')].every(node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= Number(document.querySelector('.life-story').dataset.gridTop) && r.bottom < innerHeight; })), 'The flowing transactions stay inside the calendar scene');
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
  await page.clock.runFor(700);
  await page.screenshot({ path: screenshotPath('weeks'), animations: 'disabled' });
  await seek(8500);
  assert.equal(await page.locator('.life-story').getAttribute('data-stage'), 'today');
  assert.equal(await money.count(), 0, 'Illustrative money leaves before arriving at today');
  const presentColors = await page.locator('.life-calendar-week').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
  await seek(9150);
  assert.deepEqual(await page.locator('.life-calendar-week').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor)), presentColors, 'Arriving at today never repaints the selected month over the history');
  const todayOutline = await page.evaluate(() => {
    const live = [...document.querySelectorAll('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button')];
    const index = live.findIndex(cell => cell.dataset.todayCell === 'true');
    const element = document.querySelectorAll('.life-calendar-week')[index];
    const rect = element.getBoundingClientRect();
    const scale = rect.width / parseFloat(element.parentElement.style.width);
    return { width: rect.width, stroke: parseFloat(getComputedStyle(element).borderLeftWidth) * scale };
  });
  assert.ok(todayOutline.stroke > 0 && todayOutline.stroke <= todayOutline.width * .08, 'Today keeps a thin proportional outline rather than a solid square over historical cells');
  await page.screenshot({ path: screenshotPath('today'), animations: 'disabled' });
  await seek(10600);
  const coherentCrop = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.life-calendar-cell')].map(cell => cell.getBoundingClientRect());
    return cells.every((cell, index) => index % 7 === 0 || Math.abs(cell.y - cells[index - 1].y) < .1 && cell.x > cells[index - 1].x);
  });
  assert.ok(coherentCrop, `Every source row remains contiguous, including a current week at the 52-column edge: ${JSON.stringify(await page.locator('.life-calendar-cell').evaluateAll(cells => cells.map(cell => { const r = cell.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })))}`);
  assert.equal(await page.locator('.life-story-paper').evaluate(element => element.style.opacity), '1', 'No app chrome behind the life-grid zoom');
  const approachingColors = await page.locator('.life-calendar-week').evaluateAll(cells => [...new Set(cells.map(cell => getComputedStyle(cell).backgroundColor))]);
  const neutralColors = dark ? ['rgb(91, 98, 94)', 'rgb(47, 53, 50)'] : ['rgb(191, 184, 167)', 'rgb(222, 217, 206)'];
  assert.ok(approachingColors.every(color => neutralColors.includes(color)), 'The approaching month already contains only neutral past/future cells');
  await page.screenshot({ path: screenshotPath('approach'), animations: 'disabled' });
  const layoutSizes = await page.locator('.life-calendar-cell').evaluateAll(cells => cells.map(cell => [cell.style.width, cell.style.height]));
  const framing = await page.locator('.life-calendar-cell').evaluateAll(cells => {
    const rects = cells.map(cell => cell.getBoundingClientRect());
    return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)), width: innerWidth, height: innerHeight };
  });
  assert.ok(framing.right - framing.left > Math.min(framing.width - 48, 820) * (desktop ? .6 : .65) && framing.left >= 12 && framing.right <= framing.width - 12 && Math.abs((framing.top + framing.bottom) / 2 - framing.height * .51) < framing.height * .1, `The calendar already fills the center when the dense grid disappears: ${JSON.stringify(framing)}`);
  await seek(12000);
  assert.deepEqual(await page.locator('.life-calendar-cell').evaluateAll(cells => cells.map(cell => [cell.style.width, cell.style.height])), layoutSizes, 'Revealing days scales ready cells without resizing their layout every frame');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-paper')?.style.opacity || 1) < .97);
  assert.equal(await page.locator('.life-story').getAttribute('data-life-opacity'), '0');
  await page.screenshot({ path: screenshotPath('morph'), animations: 'disabled' });
  await seek(13200);
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
  await seek(13650);
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.settled === 'true');
  assert.equal(await money.count(), 0, 'The financial flow leaves before the calendar becomes interactive');
  const before = await page.screenshot({ path: screenshotPath('settled'), animations: 'disabled' });
  const todayRect = await page.locator('.calendar-days-grid [data-today-cell="true"]').boundingBox();
  await page.clock.fastForward(800);
  await page.waitForFunction(() => !document.querySelector('.life-story'));
  const after = await page.screenshot({ path: screenshotPath('after'), animations: 'disabled' });
  const hintRect = await page.locator('.first-calendar-entry-hint').boundingBox();
  const difference = await page.evaluate(async ({ before, after, todayRect, hintRect }) => {
    const pixels = async data => {
      const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
      const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
      const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
      return { data: context.getImageData(0, 0, img.width, img.height).data, width: img.width, height: img.height };
    };
    const a = await pixels(before), b = await pixels(after);
    let total = 0, count = 0, max = 0;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      // Today begins a requested gentle pulse; the entry hint also appears later.
      if (x > todayRect.x - 24 && x < todayRect.x + todayRect.width + 24 && y > todayRect.y - 24 && y < todayRect.y + todayRect.height + 24) continue;
      // Include the guide's soft shadow; its entrance is intentional after handoff.
      if (hintRect && x > hintRect.x - 24 && x < hintRect.x + hintRect.width + 24 && y > hintRect.y - 24 && y < hintRect.y + hintRect.height + 24) continue;
      const index = (y * a.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) { const delta = Math.abs(a.data[index + channel] - b.data[index + channel]); total += delta; max = Math.max(max, delta); count++; }
    }
    return { mean: total / count, max };
  }, { before: before.toString('base64'), after: after.toString('base64'), todayRect, hintRect });
  // Removing a compositing layer rounds some gradients by 1–3 RGB levels.
  // Any content movement or changed paint produces much larger differences.
  assert.ok(difference.mean < .2 && difference.max <= 3, `Closing the scene must preserve interface paint and geometry: ${JSON.stringify(difference)}`);
  const first = page.locator('.calendar-section [data-today-cell="true"]');
  await first.waitFor();
  assert.equal(await page.locator('.first-entry-whisper').count(), 0, 'No floating guidance can hide behind the navigation dock');
  assert.ok(await page.locator('[data-today-cell="true"]').isVisible());
  await page.screenshot({ path: screenshotPath('calendar') });
  await page.getByText('Запиши первую трату.', { exact: true }).waitFor();
  const hint = await page.locator('.first-calendar-entry-hint').boundingBox();
  const dock = await page.locator('.history-fab').boundingBox();
  assert.ok(hint.y + hint.height < dock.y, 'The guide lives above the calendar, safely away from the dock');
  assert.ok(await first.locator('.first-calendar-entry-target').isVisible(), 'Today itself offers the native plus action');
  assert.ok(await page.getByRole('button', { name: 'Осмотрюсь сам', exact: true }).isVisible(), 'The guide leaves an explicit way to explore freely');
  await first.click();
  await page.getByRole('button', { name: 'Доходы', exact: true }).waitFor();
  assert.match(await page.getByRole('button', { name: 'Расходы', exact: true }).getAttribute('class'), /bg-red/, 'The first-expense invitation opens the expense form, while income remains available');
  await page.getByText('Укажи сумму и сохрани — запись появится в сегодняшнем дне.', { exact: true }).waitFor();
  await page.clock.runFor(750);
  await page.screenshot({ path: screenshotPath('entry'), animations: 'disabled' });
  assert.equal(await page.getByText('Что уже произошло сегодня?', { exact: true }).count(), 0);
  assert.equal(await page.getByText('Выбери один вариант. Я подготовлю форму, а ты дополнишь её как хочешь.', { exact: true }).count(), 0);
  assert.deepEqual(errors, []);
  console.log(`Production app (${desktop ? 'desktop' : 'mobile'} ${dark ? 'dark' : 'light'}): money flow in the chosen currency, native today action, stable cell layout, exact calendar geometry and removal (mean RGB difference ${difference.mean.toFixed(3)}, max ${difference.max}) passed.`);
} finally { await browser.close(); }
