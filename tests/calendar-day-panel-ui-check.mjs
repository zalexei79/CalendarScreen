import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
import { calendarDayCopy } from '../src/shared/i18n/calendarDay.js';
import { receiptComment } from '../src/features/receipts/receiptModel.js';

const { chromium, webkit } = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const engine = process.env.DAYRIS_TEST_WEBKIT ? 'webkit' : 'edge';
const browser = await (engine === 'webkit' ? webkit.launch({ headless: true }) : chromium.launch({ channel: 'msedge', headless: true }));
const output = 'artifacts/day-panel';
fs.mkdirSync(output, { recursive: true });
const records = {
  '2026-10-26': [
    { id: 'income', time: '12:00', pnl: 450, currency: 'USD', instrument: 'Зарплата', platform: 'Manual' },
    { id: 'expense', time: '11:00', pnl: -123.45, currency: 'USD', instrument: 'Продукты', platform: 'Manual', comment: 'Покупки на неделю' },
    { id: 'eur', time: '10:00', pnl: 230.25, currency: 'EUR', instrument: 'Фриланс', platform: 'Manual' },
  ],
  '2026-10-25': Array.from({ length: 22 }, (_, index) => ({ id: `long-${index}`, time: `10:${String(index).padStart(2, '0')}`, pnl: -123456.78, currency: 'USD', instrument: 'Очень длинная собственная категория покупок', platform: 'Manual', comment: 'Длинный комментарий к записи, который должен оставаться в пределах панели.' })),
  '2026-10-24': [{ id: 'receipt', time: '09:00', pnl: -20, currency: 'USD', instrument: 'Продукты', platform: 'Manual', comment: receiptComment({ merchant: 'Local Store', currency: 'USD', items: [{ name: 'Milk', quantity: '2', unit: 'pcs', unitPrice: '10.00', total: '20.00' }] }, 'ru') }],
  '2026-10-23': [{ id: 'only-eur', time: '09:00', pnl: 80, currency: 'EUR', instrument: 'Фриланс', platform: 'Manual' }],
};

async function scenario({ theme, mode, language = 'ru' }) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Europe/Bucharest', serviceWorkers: 'block', hasTouch: true });
  await context.addInitScript(({ id, theme, mode, language, records }) => {
    for (const [key, value] of Object.entries({ atj_language: language, atj_theme: theme, atj_currency: 'USD', atj_entry_currency: 'MDL', atj_pro_view: mode === 'free' ? '0' : '1', atj_trader_mode: mode === 'trader' ? '1' : '0', dayris_onboarding_v2_completed: '1', calendar_guide_completed: '1', dayris_voice_feedback: 'off', [`dayris_voice_intro_v1:${id}`]: 'seen' })) localStorage.setItem(key, value);
    localStorage.setItem(`money_calendar_trades_${id}`, JSON.stringify(records));
    class Recognition {
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() {}
    }
    window.SpeechRecognition = Recognition;
  }, { id: storyUserId, theme, mode, language, records });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://calendar.test') return route.abort();
    const file = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!file.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
  });
  await installStoryAccount(context);
  await context.route('**/rest/v1/rpc/get_my_pro_status', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ active: mode !== 'free' }) }));
  await context.route('**/rest/v1/reminders?*', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await context.route('**/rest/v1/trading_day_notes?*', route => route.fulfill({ contentType: 'application/json', body: 'null' }));
  const page = await context.newPage(), errors = [], copy = calendarDayCopy(language);
  page.on('pageerror', error => errors.push(error.message));
  page.setDefaultTimeout(12000);
  await page.clock.install({ time: new Date('2026-10-28T12:00:00+02:00') });
  await page.goto('http://calendar.test');
  await page.locator('.calendar-days-grid').waitFor();
  await page.clock.runFor(700);
  assert.equal(await page.locator('.pro-calendar-day').count() > 0, mode !== 'free', `Intended mode: ${mode}`);
  const panel = page.locator('.calendar-day-panel');
  const day = number => page.locator('.calendar-days-grid .calendar-day-surface[data-in-month=true]').filter({ has: page.locator('span', { hasText: new RegExp(`^${number}$`) }) });
  async function open(number) {
    await day(number).click(); await panel.waitFor(); await page.clock.runFor(450);
    // The mocked clock can stop CSS timelines between frames. Inspect settled geometry.
    await panel.evaluate(element => element.getAnimations().forEach(animation => animation.finish()));
  }
  async function close() { await panel.locator('.dayris-sheet-close').click(); await panel.waitFor({ state: 'detached' }); await page.clock.runFor(250); }
  async function fit(empty = false) {
    const geometry = await panel.evaluate(element => {
      const box = element.getBoundingClientRect(), footer = element.querySelector('footer').getBoundingClientRect();
      return { width: box.width, height: box.height, left: box.left, right: box.right, top: box.top, bottom: box.bottom, footerBottom: footer.bottom, viewportWidth: innerWidth, viewportHeight: innerHeight, overflow: element.scrollWidth > element.clientWidth + 1 };
    });
    assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewportWidth + 1 && geometry.top >= 0 && geometry.bottom <= geometry.viewportHeight + 1, JSON.stringify(geometry));
    assert.ok(!geometry.overflow && geometry.footerBottom <= geometry.bottom + 1, 'Panel and primary action fit');
    if (empty) assert.ok(geometry.height < 390, `Empty day stays compact: ${geometry.height}`);
    if (geometry.viewportWidth >= 768) assert.ok(geometry.width <= 522, 'Desktop uses a focused card');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 320 ? 640 : width === 1440 ? 1000 : 844 });
    await open(28); await fit(true);
    assert.match(await panel.innerText(), new RegExp(copy.empty));
    await page.screenshot({ path: `${output}/${engine}-${theme}-${mode}-${language}-empty-${width}.png`, animations: 'disabled' });
    await close();
    await open(26); await fit();
    assert.match(await panel.locator('.calendar-day-balance').innerText(), /326[.,]55\s*USD/);
    assert.equal(await panel.locator('.calendar-day-record').count(), 3);
    assert.match(await panel.locator('.calendar-day-currency-hint').innerText(), /USD/);
    assert.match(await panel.locator('.calendar-day-record-amount').last().innerText(), /230[.,]25\s*EUR/);
    assert.equal(await panel.locator('.calendar-day-metrics > div').count(), mode === 'trader' ? 3 : 2);
    await page.screenshot({ path: `${output}/${engine}-${theme}-${mode}-${language}-records-${width}.png`, animations: 'disabled' });
    await close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await open(26);
  await panel.locator('.calendar-day-add').click(); await page.clock.runFor(500);
  assert.equal(await panel.count(), 0, 'Adding unmounts the day panel');
  assert.equal(await page.locator('[data-sheet-entrance=true]').count(), 1, 'Only the entry composer remains');
  assert.equal(await page.locator('input[type=date]').inputValue(), '2026-10-26', 'Historical selected date survives closing');
  assert.equal(await page.locator('.dayris-swipe-sheet select').filter({ has: page.locator('option[value=MDL]') }).first().inputValue(), 'MDL', 'Entry currency stays independent');
  await page.screenshot({ path: `${output}/${engine}-${theme}-${mode}-${language}-entry.png`, animations: 'disabled' });
  await page.keyboard.press('Escape'); await page.clock.runFor(300);
  assert.equal(await panel.count(), 0, 'Closing the composer returns directly to the calendar');
  await open(26);
  await panel.locator('.calendar-day-record-main').first().click(); await page.clock.runFor(450);
  assert.equal(await panel.count(), 0, 'Editing also unmounts the day');
  assert.equal(await page.locator('input[type=date]').inputValue(), '2026-10-26');
  await page.keyboard.press('Escape'); await page.clock.runFor(300);
  await open(29); await fit(true);
  await panel.locator('.calendar-day-add').click(); await page.clock.runFor(450);
  assert.equal(await panel.count(), 0, 'Planning closes the day panel');
  assert.equal(await page.locator('[data-sheet-entrance=true]').count(), 1);
  await page.locator('.plan-templates button').first().click();
  await page.locator('.plan-primary').click(); await page.clock.runFor(400);
  assert.equal(await page.locator('.plan-dialog input[type=date]').first().inputValue(), '2026-10-29', 'Planning keeps the future date');
  await page.keyboard.press('Escape'); await page.clock.runFor(300);
  await open(23);
  assert.match(await panel.locator('.calendar-day-balance').innerText(), /—\s*USD/, 'Other currencies are never added to the USD total');
  assert.equal(await panel.locator('.calendar-day-record').count(), 1); await close();
  await open(24);
  assert.equal(await panel.locator('.receipt-history').count(), 1, 'Receipt details remain available'); await close();
  await open(25); await fit();
  assert.equal(await panel.locator('.calendar-day-record').count(), 22);
  assert.ok(await panel.locator('.calendar-day-scroll').evaluate(element => element.scrollHeight > element.clientHeight), 'Long history scrolls inside the card');
  await panel.locator('.calendar-day-scroll').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await fit(); await close();
  await open(28);
  await page.keyboard.press('Tab');
  assert.equal(await panel.evaluate(element => element.contains(document.activeElement)), true, 'Focus stays in the day dialog');
  await panel.locator('.calendar-day-voice').focus(); await page.keyboard.press('Tab');
  assert.equal(await panel.locator('.dayris-sheet-close').evaluate(element => element === document.activeElement), true, 'Tab wraps within the dialog');
  await page.keyboard.press('Escape'); await page.clock.runFor(250);
  assert.equal(await panel.count(), 0);
  await open(28); await page.mouse.click(3, 3); await page.clock.runFor(250);
  assert.equal(await panel.count(), 0, 'Backdrop dismisses');
  await open(28); await page.evaluate(() => history.back()); await page.clock.runFor(250);
  assert.equal(await panel.count(), 0, 'Browser Back dismisses');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await open(28);
  assert.equal(await panel.evaluate(element => getComputedStyle(element).animationName), 'none'); await close();
  assert.deepEqual(errors, []);
  console.log(`PASS ${engine} ${theme} ${mode} ${language}: 320/390/1440 layout, currency totals, empty/long/receipt views, add/edit/plan date handoff, focus/close/Back, reduced motion.`);
  await context.close();
}

try {
  for (const mode of ['free', 'pro', 'trader']) {
    for (const theme of mode === 'free' ? ['dark', 'light', 'purple'] : ['dark', 'light', 'purple', 'gold', 'emerald']) await scenario({ theme, mode });
  }
  if (engine === 'edge') for (const language of ['en', 'uk', 'ro', 'zh-CN']) await scenario({ theme: 'light', mode: 'pro', language });
} finally { await browser.close(); }
