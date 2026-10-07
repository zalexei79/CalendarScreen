import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { LIFE_MOTION_END, lifeCalendarMotion } from '../src/features/onboarding/lifeCalendarMotion.js';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const desktop = process.argv.includes('--desktop');
const dark = desktop || process.argv.includes('--dark');
const reference = process.argv.includes('--reference');
const compact = process.argv.includes('--compact');
const phoneHeight = compact ? 760 : 844;
const currency = desktop ? 'RUB' : 'MDL';
const suffix = desktop ? reference ? '-desktop-reference' : '-desktop' : compact ? '-compact' : dark ? '-dark' : '';
const screenshotPath = stage => `tests/life-story-app${suffix}-${stage}.png`;
try {
  const context = await browser.newContext({ viewport: desktop ? reference ? { width: 1145, height: 976 } : { width: 1440, height: 1000 } : { width: 390, height: phoneHeight }, serviceWorkers: 'block' });
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
  await installStoryAccount(context);
  await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://calendar.test/');
  await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  await page.screenshot({ path: screenshotPath('language') });
  if (!desktop) {
    await page.setViewportSize({ width: 320, height: phoneHeight });
    await page.screenshot({ path: screenshotPath('language-narrow') });
    await page.setViewportSize({ width: 390, height: phoneHeight });
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
  const money = page.locator('.life-money-value[data-active="true"]');
  assert.equal(await money.count(), 1, 'Individual amounts pass through one fixed window');
  assert.equal(await page.locator('.life-money-columns').count(), 0, 'There are no columns that could be mistaken for lifetime totals');
  const moneyAnchor = await money.boundingBox();
  assert.ok((await money.evaluateAll(nodes => nodes.map(node => node.dataset.source))).every(source => source === 'illustration'));
  assert.equal(await page.locator('.life-money-flow-event').count(), 0, 'No amounts flash over the colored cells');
  const moneyLayout = await page.evaluate(() => {
    const region = document.querySelector('.life-money-area').getBoundingClientRect();
    const scene = document.querySelector('.life-story-scene').getBoundingClientRect();
    const legend = document.querySelector('.life-story-legend').getBoundingClientRect();
    const tools = document.querySelector('.life-story-tools').getBoundingClientRect();
    const gridBottom = Number(document.querySelector('.life-story').dataset.gridBottom);
    return { region: region.toJSON(), scene: scene.toJSON(), legend: legend.toJSON(), tools: tools.toJSON(), gridBottom, height: innerHeight };
  });
  assert.ok(Math.abs(moneyLayout.region.top - moneyLayout.gridBottom - 10) < 1 && moneyLayout.region.bottom <= moneyLayout.legend.top && moneyLayout.legend.bottom <= moneyLayout.tools.top && moneyLayout.tools.bottom <= moneyLayout.height, `The large amount is directly below the lattice, ahead of its legend and navigation: ${JSON.stringify(moneyLayout)}`);
  assert.ok(await money.evaluate(node => parseFloat(getComputedStyle(node).fontSize)) >= (desktop ? 42 : 34), 'The monetary stream uses larger, readable figures');
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
    window.moneyNodes = [...document.querySelectorAll('.life-money-value')];
    new MutationObserver(changes => { for (const change of changes) if (change.attributeName === 'aria-label') window.moneyBeats.push(change.target.getAttribute('aria-label')); }).observe(document.querySelector('.life-money-area'), { attributes: true, subtree: true });
  });
  let previousOpacity;
  for (let frame = 0; frame < 63; frame++) {
    await page.clock.runFor(16);
    const opacity = await money.evaluateAll(nodes => nodes.map(node => ({ current: Number(node.querySelector('.life-money-current').style.opacity), previous: Number(node.querySelector('.life-money-previous').style.opacity), start: node.dataset.start, value: node.querySelector('.life-money-current').textContent, oldValue: node.querySelector('.life-money-previous').textContent })));
    assert.ok(opacity.every(({ current, previous }) => Math.abs(current + previous - 1) < .001), 'An exchange never blanks out both amounts');
    if (previousOpacity) assert.ok(opacity.every((state, index) => state.start === previousOpacity[index].start ? Math.abs(state.current - previousOpacity[index].current) < .65 : state.oldValue === previousOpacity[index].value && state.previous > .94), 'The rapid exchange preserves the previous amount, without blank flashes');
    previousOpacity = opacity;
  }
  const beats = await page.evaluate(() => window.moneyBeats);
  assert.ok(beats.length >= 8 && beats.length <= 13, 'The fixed window conveys more individual money events at a faster cadence');
  assert.ok(beats.every(amount => amount.endsWith(currency)), 'Every transaction uses the selected currency');
  assert.deepEqual(await money.boundingBox(), moneyAnchor, 'The transaction window stays in exactly the same place as weeks advance');
  assert.equal(await page.locator('.life-money-amounts > .life-money-label').innerText(), 'Примеры отдельных сумм', 'The explanatory caption stays still while only amounts change');
  assert.ok(await page.evaluate(() => window.moneyNodes.every(node => node.isConnected)), 'A fixed pool of labels avoids mounting new UI each frame');
  assert.equal(await page.locator('.life-story-heading h1').innerText(), firstHeading, 'Counting and financial examples share one stable narrative');
  if (dark) assert.equal(await page.locator('.life-story').evaluate(element => getComputedStyle(element, '::before').display), 'none', 'Dark mode has no grain texture');
  await seek(6500);
  assert.equal(await page.locator('.life-story').getAttribute('data-stage'), 'question');
  assert.equal(await page.locator('.life-story-heading h1').innerText(), firstHeading, 'The grid keeps a stable heading as the financial area poses its question');
  assert.equal(await page.locator('.life-money-question p').innerText(), 'А ты знаешь, где эти деньги сейчас?');
  assert.equal(await page.locator('.life-money-question > span').innerText(), 'Сделай свою первую запись.');
  assert.equal(await page.locator('.life-money-question').evaluate(node => Number(getComputedStyle(node).opacity)), 1);
  assert.equal(await page.locator('.life-money-amounts').evaluate(node => Number(getComputedStyle(node).opacity)), 0, 'Amounts leave the same area before the question, rather than competing with it');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-counter strong')?.textContent.replace(/\D/g, '')) > 1200);
  const filled = Number(await page.locator('.life-story-counter strong').innerText().then(text => text.replace(/\D/g, '')));
  assert.ok((await money.evaluateAll(nodes => nodes.map(node => Number(node.dataset.week)))).every(week => week <= filled));
  const focusDistance = await page.locator('.life-story').evaluate(element => Math.abs(Number(element.dataset.focusWeek) - Number(element.dataset.currentWeek)));
  assert.ok(focusDistance <= 6, 'The focused week remains adjacent to the chronological present, including row edges');
  assert.equal(await page.locator('.life-story').getAttribute('data-theme'), dark ? 'dark' : 'light');
  assert.equal(await page.locator('.life-story-paper').evaluate(element => getComputedStyle(element).backgroundColor), dark ? 'rgb(17, 23, 20)' : 'rgb(247, 244, 236)');
  if (desktop) assert.ok(Number(await page.locator('.life-story').getAttribute('data-grid-width')) > (reference ? 540 : 570), 'The desktop life panel uses the available screen height to make the weeks legible');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'The financial area never adds horizontal scrolling');
  if (!desktop) await page.setViewportSize({ width: 320, height: phoneHeight });
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
  assert.ok(await page.evaluate(() => {
    const region = document.querySelector('.life-money-area').getBoundingClientRect();
    const question = document.querySelector('.life-money-question p').getBoundingClientRect();
    const tools = document.querySelector('.life-story-tools').getBoundingClientRect();
    const dialog = document.querySelector('.first-run-dialog');
    return question.left >= 0 && question.right <= innerWidth && region.bottom <= tools.top && tools.bottom <= innerHeight && dialog.scrollHeight <= dialog.clientHeight + 1;
  }), 'The question and navigation fit without scrolling, including a narrow phone');
  if (!desktop) await page.setViewportSize({ width: 390, height: phoneHeight });
  await page.clock.runFor(700);
  await page.screenshot({ path: screenshotPath('weeks'), animations: 'disabled' });
  await seek(8200);
  assert.ok(await page.locator('.life-story').evaluate(story => {
    const cells = [...story.querySelectorAll('.life-calendar-cell')];
    const sources = cells.map(cell => Number(cell.dataset.sourceWeek));
    const first = sources[0];
    const firstDay = cells[0], lastDay = cells[6];
    const a = new DOMMatrixReadOnly(firstDay.style.transform), b = new DOMMatrixReadOnly(lastDay.style.transform);
    const width = parseFloat(firstDay.style.width) * a.a;
    return sources.every((week, index) => week === first + Math.floor(index / 7)) && new Set(sources).size === cells.length / 7 && story.dataset.currentWeek === story.dataset.focusWeek && Number(story.dataset.weekDivision) === 0 && Math.abs(b.m41 + width - a.m41 - Number(story.dataset.weekWidth)) < .1;
  }), 'Seven adjacent days initially occupy one real weekly parent; only five/six consecutive weeks become the month');
  await seek(8500);
  assert.equal(await page.locator('.life-story').getAttribute('data-stage'), 'today');
  assert.equal(await money.count(), 0, 'Illustrative money leaves before arriving at today');
  assert.ok(await page.locator('.life-calendar-week').evaluateAll(cells => cells.every(cell => Number(getComputedStyle(cell).opacity) === 1)), 'Subdividing a week preserves its brightness rather than crossfading two partially transparent copies');
  const presentColors = await page.locator('.life-calendar-week').evaluateAll(cells => cells.map(cell => getComputedStyle(cell).backgroundColor));
  await seek(9000);
  const copyFrame = await page.evaluate(() => {
    const story = document.querySelector('.life-story');
    const heading = story.querySelector('.life-story-heading');
    const grid = story.querySelector('.life-story-grid');
    return { time: Number(story.dataset.time), scale: new DOMMatrixReadOnly(getComputedStyle(heading).transform).a, opacity: Number(getComputedStyle(heading).opacity), headingBottom: heading.getBoundingClientRect().bottom, apertureTop: Number(story.dataset.apertureTop), gridTop: Number(story.dataset.gridTop), mask: getComputedStyle(grid).maskImage, bridgeMask: getComputedStyle(story.querySelector('.life-calendar-bridge')).maskImage };
  });
  assert.ok(Math.abs(copyFrame.opacity - lifeCalendarMotion(copyFrame.time).copyOpacity) < .001 && copyFrame.opacity < .65, 'Copy opacity follows the camera directly, without a delayed CSS transition');
  assert.ok(copyFrame.scale < .97 && Math.abs(copyFrame.scale - (1 - .09 * lifeCalendarMotion(copyFrame.time).copyRetreat)) < .001, 'The text recedes in depth while the calendar grows forward');
  assert.ok(copyFrame.headingBottom < copyFrame.gridTop - 20 && copyFrame.mask.includes('linear-gradient') && copyFrame.bridgeMask === copyFrame.mask, 'The expanding cells remain feathered away from the heading area');
  assert.ok(copyFrame.apertureTop < copyFrame.gridTop - 25 && copyFrame.apertureTop - copyFrame.headingBottom < 80 && copyFrame.apertureTop - 28 > copyFrame.headingBottom, 'The feathered window moves up into the retiring copy space, without covering its text or leaving a large blank gap');
  await page.screenshot({ path: screenshotPath('copy-exit'), animations: 'disabled' });
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
  await seek(9900);
  if (process.argv.includes('--resize-motion')) {
    const viewport = page.viewportSize();
    const resized = { ...viewport, width: desktop ? viewport.width - 120 : 320 };
    await page.setViewportSize(resized);
    await page.waitForFunction(width => document.querySelector('.life-story-grid')?.width === Math.round(width * Math.min(devicePixelRatio, 2)), resized.width);
    await page.clock.runFor(16);
    await page.setViewportSize(viewport);
    await page.waitForFunction(width => document.querySelector('.life-story-grid')?.width === Math.round(width * Math.min(devicePixelRatio, 2)), viewport.width);
    await page.clock.runFor(16);
    assert.equal(await page.locator('.life-story').getAttribute('data-calendar-target'), 'live', 'Resizing during the optical flight keeps the real calendar target');
  }
  const sharedGrid = await page.evaluate(() => {
    const story = document.querySelector('.life-story');
    const cells = [...document.querySelectorAll('.life-calendar-cell')];
    const cell = cells[0];
    const matrix = new DOMMatrixReadOnly(getComputedStyle(cell).transform);
    const canvas = story.querySelector('canvas');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let paintAlpha = 0;
    for (let index = 3; index < pixels.length; index += 4) paintAlpha = Math.max(paintAlpha, pixels[index]);
    return { backgroundWidth: Number(story.dataset.latticeWidth), backgroundHeight: Number(story.dataset.latticeHeight), firstWidth: parseFloat(cell.style.width) * matrix.a, firstHeight: parseFloat(cell.style.height) * matrix.d, context: Number(story.dataset.contextExit), canvasOpacity: Number(getComputedStyle(canvas).opacity), paintAlpha, sharedPlane: canvas.parentElement === cell.closest('.life-story-projection'), tilt: Number(story.dataset.planeTilt) };
  });
  assert.ok(Math.abs(sharedGrid.backgroundWidth - sharedGrid.firstWidth) < .1 && Math.abs(sharedGrid.backgroundHeight - sharedGrid.firstHeight) < .1 && sharedGrid.context === 1 && sharedGrid.paintAlpha === 0, 'Surrounding history has cleared before the selected weeks expand into the month');
  assert.ok(sharedGrid.sharedPlane && sharedGrid.tilt === 0, 'The calendar stays on a flat plane throughout the reveal');
  await page.screenshot({ path: screenshotPath('shared-lattice'), animations: 'disabled' });
  await seek(10250);
  assert.equal(await page.locator('.life-story-heading').evaluate(element => Number(getComputedStyle(element).opacity)), 0, 'The heading is gone when the lattice occupies the viewport');
  assert.equal(await page.locator('.life-calendar-bridge').evaluate(element => getComputedStyle(element).maskImage), 'none', 'The aperture fully opens before the native calendar reveal');
  assert.equal(await page.locator('.life-story-grid').evaluate(element => getComputedStyle(element).maskImage), 'none', 'The life grid stays unmasked during the final zoom; there is no closing window');
  const coherentCrop = await page.evaluate(() => {
    const cells = [...document.querySelectorAll('.life-calendar-cell')].map(cell => cell.getBoundingClientRect());
    return cells.every((cell, index) => index % 7 === 0 || Math.abs(cell.y - cells[index - 1].y) < .1 && cell.x > cells[index - 1].x);
  });
  assert.ok(coherentCrop, `Every source row remains contiguous, including a current week at the 52-column edge: ${JSON.stringify(await page.locator('.life-calendar-cell').evaluateAll(cells => cells.map(cell => { const r = cell.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })))}`);
  assert.ok(lifeCalendarMotion(Number(await page.locator('.life-story').getAttribute('data-time'))).skin > .09, 'Dates and cell paint arrive before the surrounding history leaves');
  assert.equal(await page.locator('.first-calendar-entry-hint').evaluate(element => Number(getComputedStyle(element).opacity)), 0, 'Guidance waits for arrival instead of overlapping departing history');
  const approachingColors = await page.locator('.life-calendar-week').evaluateAll(cells => [...new Set(cells.map(cell => getComputedStyle(cell).backgroundColor))]);
  const neutralColors = dark ? ['rgb(91, 98, 94)', 'rgb(47, 53, 50)'] : ['rgb(191, 184, 167)', 'rgb(222, 217, 206)'];
  assert.ok(approachingColors.every(color => neutralColors.includes(color)), 'The approaching month already contains only neutral past/future cells');
  await page.screenshot({ path: screenshotPath('approach'), animations: 'disabled' });
  const layoutSizes = await page.locator('.life-calendar-cell').evaluateAll(cells => cells.map(cell => [cell.style.width, cell.style.height]));
  const movingDay = await page.locator('.life-calendar-cell').first().boundingBox();
  const framing = await page.locator('.life-calendar-cell').evaluateAll(cells => {
    const rects = cells.map(cell => cell.getBoundingClientRect());
    const native = [...document.querySelectorAll('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button')].map(cell => cell.getBoundingClientRect());
    return { left: Math.min(...rects.map(r => r.left)), right: Math.max(...rects.map(r => r.right)), top: Math.min(...rects.map(r => r.top)), bottom: Math.max(...rects.map(r => r.bottom)), nativeCenter: (Math.min(...native.map(r => r.top)) + Math.max(...native.map(r => r.bottom))) / 2 - new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.premium-shell')).transform).m42, width: innerWidth, height: innerHeight };
  });
  assert.ok(framing.right - framing.left > Math.min(framing.width - 48, 820) * .65 && framing.bottom - framing.top > framing.height * .25 && framing.left >= 12 && framing.right <= framing.width - 12 && Math.abs((framing.top + framing.bottom) / 2 - framing.nativeCenter) < 17, `The growing month remains in its calendar area throughout the curved camera move: ${JSON.stringify(framing)}`);
  await seek(11200);
  assert.ok(await page.evaluate(() => {
    const canvas = document.querySelector('.life-story-grid');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const dpr = canvas.width / canvas.clientWidth;
    const header = document.querySelector('.dayris-header').getBoundingClientRect();
    const firstDay = document.querySelector('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button').getBoundingClientRect();
    let max = 0;
    for (let y = Math.floor(header.top * dpr); y < Math.floor((firstDay.top - 16) * dpr); y++) for (let x = 0; x < canvas.width; x++) max = Math.max(max, pixels[(y * canvas.width + x) * 4 + 3] || 0);
    return max < 12;
  }), 'Enlarged financial history clears behind native controls and weekday labels without hiding the month');
  assert.ok(await page.evaluate(() => {
    const canvas = document.querySelector('.life-story-signal');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const content = [...document.querySelectorAll('.life-calendar-face > *')];
    return pixels.some((value, index) => index % 4 === 3 && value > 0) && content.some(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).m42 > 0);
  }), 'A single traveling edge signal and materializing date content accompany the continuous camera');
  const unfoldingDay = await page.locator('.life-calendar-cell').first().boundingBox();
  assert.ok(unfoldingDay.width > movingDay.width + 2 && unfoldingDay.height > movingDay.height + 8 && Math.abs(unfoldingDay.y - movingDay.y) > 1, 'Calendar arrival changes real position and shape during the reveal, rather than only opacity');
  assert.ok(await page.locator('.life-story-paper').evaluate(element => Number(element.style.opacity) < .95), 'Calendar chrome follows the visible dates as the past rows clear its space');
  await page.screenshot({ path: screenshotPath('reveal'), animations: 'disabled' });
  await seek(12350);
  assert.ok(await page.evaluate(() => {
    const canvas = document.querySelector('.life-story-signal');
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    return getComputedStyle(document.querySelector('.life-story-projection')).transform === 'none' && !pixels.some((value, index) => index % 4 === 3 && value > 0) && [...document.querySelectorAll('.life-calendar-face > *')].every(node => Math.abs(new DOMMatrixReadOnly(getComputedStyle(node).transform).m42) < .001);
  }), 'The optical plane and light signal land cleanly before the live calendar takes over');
  assert.deepEqual(await page.locator('.life-calendar-cell').evaluateAll(cells => cells.map(cell => [cell.style.width, cell.style.height])), layoutSizes, 'Revealing days scales ready cells without resizing their layout every frame');
  await page.waitForFunction(() => Number(document.querySelector('.life-story-paper')?.style.opacity || 1) < .97);
  assert.equal(await page.locator('.life-story').getAttribute('data-life-opacity'), '0');
  await page.screenshot({ path: screenshotPath('morph'), animations: 'disabled' });
  await seek(12800);
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
  await seek(LIFE_MOTION_END - 150);
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
