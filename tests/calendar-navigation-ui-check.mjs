import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
const { chromium } = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const theme of ['gold', 'emerald']) {
    const context = await browser.newContext({ viewport: { width: 428, height: 926 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
    await context.addInitScript(theme => {
      localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', theme);
      localStorage.setItem('atj_pro_view', '1'); localStorage.setItem('atj_trader_mode', '0');
      localStorage.setItem('dayris_onboarding_v2_completed', '1'); localStorage.setItem('calendar_guide_completed', '1');
    }, theme);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://calendar.test') return route.abort();
      const file = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      if (!file.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
    });
    await installStoryAccount(context);
    await context.route('**/rest/v1/rpc/get_my_pro_status', route => route.fulfill({ contentType: 'application/json', body: '{"active":true}' }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-24T12:00:00') });
    await page.goto('http://calendar.test');
    await page.clock.pauseAt(new Date('2026-10-24T13:00:00'));
    await page.locator('.pro-calendar-day').first().waitFor();
    await page.locator('[data-site-element="previous"]').click();
    await page.clock.runFor(600);
    const today = page.locator('[data-site-element="today"]');
    await today.waitFor();
    for (const width of [428, 390, 320, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 950 : 926 });
      await page.clock.runFor(100);
      const position = await page.evaluate(() => {
        const today = document.querySelector('[data-site-element="today"]');
        const rect = node => node.getBoundingClientRect().toJSON();
        return { today: rect(today), wallet: rect(document.querySelector('.wallet-entry')), capital: rect(document.querySelector('.workspace-capital-entry')), trader: rect(document.querySelector('.pro-control-trader')), date: rect(document.querySelector('.dayris-date-navigation')), inRail: !!today.closest('.compact-tool-rail') };
      });
      assert.ok(position.inRail && (width >= 640 || position.today.top >= position.date.bottom - 1), `Today belongs to the tools row: ${JSON.stringify(position)}`);
      assert.ok(position.today.left >= position.capital.right - 1 && position.today.right <= position.trader.left + 1, `Today fits between investments and Trader at ${width}: ${JSON.stringify(position)}`);
      assert.ok(Math.abs(position.today.top + position.today.height / 2 - position.trader.top - position.trader.height / 2) < 2);
      await page.screenshot({ path: `tests/calendar-navigation-${theme}-${width}.png`, animations: 'disabled' });
    }
    await today.click(); await page.clock.runFor(600);
    assert.equal(await today.count(), 0, 'Today returns to the current month');
    assert.ok(await page.locator('.calendar-section:not(.calendar-month-preview) [data-today-cell="true"]').isVisible());
    // The month name still animates, but no layout width is animated anywhere
    // in the header, avoiding repeated glass and calendar-fit recalculation.
    await page.locator('[data-site-element="next"]').click();
    await page.clock.runFor(32);
    assert.ok(await page.locator('.dayris-header').evaluate(header => header.getAnimations({ subtree: true }).every(animation => animation.effect.getKeyframes().every(frame => !Object.hasOwn(frame, 'width')))));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await today.click(); await page.clock.runFor(100);
    assert.equal(await today.count(), 0);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 428, height: 926 }); await page.clock.runFor(100);
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const touch = async (type, x) => {
      await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: 400, id: 1 }] });
      await page.clock.runFor(32);
    };
    await touch('touchStart', 220);
    await touch('touchMove', 155);
    assert.equal(await page.locator('.calendar-month-preview').count(), 1, 'Only one glass preview mounts under CPU throttling');
    await page.evaluate(() => { window.navigationPreview = document.querySelector('.calendar-month-preview'); });
    await touch('touchMove', 125);
    assert.ok(await page.evaluate(() => window.navigationPreview === document.querySelector('.calendar-month-preview')), 'Tracking retains the same preview DOM');
    await touch('touchEnd', 125); await page.clock.runFor(700);
    assert.equal(await page.locator('.calendar-month-preview').count(), 0);
    assert.equal(await today.count(), 1, 'The themed gesture commits the next month');
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await today.click(); await page.clock.runFor(600);
    assert.deepEqual(errors, []);
    console.log(`PASS ${theme}: Today tools-row placement at 320–1280px, current-month return, compositor-only title movement, reduced motion and stable single-preview swipe at 4x CPU throttling.`);
    await context.close();
  }
} finally { await browser.close(); }
