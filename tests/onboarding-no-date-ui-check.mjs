import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount, storyUserId } from './life-story-auth-fixture.mjs';
import { selectBirthday } from './birthday-test-helper.mjs';
import { LIFE_PLAYBACK_END } from '../src/features/onboarding/lifeStoryPlayback.js';
const { chromium } = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const scenario of [
    { width: 390, theme: 'dark', label: 'Тёмное' },
    { width: 1280, theme: 'light', label: 'Светлое' },
    { width: 390, theme: 'purple', label: 'Аметист', reduced: true },
    { width: 390, theme: 'dark', label: 'Тёмное', birthday: true },
    { width: 1280, theme: 'light', label: 'Светлое', birthday: true },
  ]) {
    const context = await browser.newContext({ viewport: { width: scenario.width, height: 900 }, serviceWorkers: 'block', reducedMotion: scenario.reduced ? 'reduce' : 'no-preference' });
    await context.addInitScript(theme => {
      localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', theme);
      localStorage.setItem('calendar_guide_completed', '1'); localStorage.setItem('dayris_voice_feedback', 'off');
    }, scenario.theme);
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://calendar.test') return route.abort();
      const file = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      if (!file.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
    });
    await installStoryAccount(context);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-28T12:00:00') });
    await page.goto('http://calendar.test');
    await page.clock.pauseAt(new Date('2026-10-28T13:00:00'));
    const dialog = page.locator('.first-run-dialog');
    await dialog.getByRole('button', { name: /Русский/ }).click();
    await dialog.getByRole('button', { name: scenario.label, exact: true }).click();
    await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
    await dialog.getByRole('button', { name: /MDL/ }).click();
    const recordKey = `money_calendar_trades_${storyUserId}`;
    const before = await page.evaluate(key => localStorage.getItem(key), recordKey);
    if (scenario.birthday) {
      await selectBirthday(page, '1998-03-14');
      await dialog.getByRole('button', { name: 'Увидеть мою историю', exact: true }).click();
      await page.clock.runFor(32);
      const seek = async elapsed => {
        const current = Number(await page.locator('.life-story').getAttribute('data-elapsed'));
        await page.clock.runFor(Math.max(0, elapsed - current) + 32);
      };
      assert.equal(await page.locator('.calendar-start').count(), 0);
      await seek(4000);
      assert.ok(Number(await page.locator('.life-story').getAttribute('data-time')) >= 7980);
      assert.ok(Number((await page.locator('.life-story-counter strong').innerText()).replace(/\D/g, '')) > 1400);
      await seek(7350);
      assert.ok(Number(await page.locator('.life-story').getAttribute('data-week-division')) > .99);
      await page.screenshot({ path: 'tests/onboarding-short-story.png', animations: 'disabled' });
      await seek(8450);
      const alignment = await page.evaluate(() => {
        const live = [...document.querySelectorAll('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button')];
        const copies = [...document.querySelectorAll('.life-calendar-cell')];
        return live.every((node, index) => {
          const a = node.getBoundingClientRect(), b = copies[index].getBoundingClientRect();
          return ['x', 'y', 'width', 'height'].every(key => Math.abs(a[key] - b[key]) < .1);
        });
      });
      assert.ok(alignment, 'Shortened story lands exactly on the real calendar');
      await page.clock.runFor(LIFE_PLAYBACK_END - 8450 + 100);
      assert.equal(await page.locator('.life-story').count(), 0, 'Dated story finishes within nine seconds');
    } else {
      await dialog.getByRole('button', { name: 'Продолжить без даты', exact: true }).click();
      await page.clock.runFor(32);
      assert.equal(await page.locator('.life-story').count(), 0, 'No empty lifetime grid without a birthday');
      assert.equal(await page.locator('.life-story-counter').count(), 0);
      if (!scenario.reduced) {
        assert.ok(await page.getByRole('heading', { name: 'Твоя история начинается сегодня.' }).isVisible());
        if (scenario.theme === 'light') assert.equal(await page.locator('.calendar-start').evaluate(node => getComputedStyle(node).color), 'rgb(52, 62, 54)', 'Light-theme introductory text stays readable');
        await page.clock.runFor(350);
        await page.screenshot({ path: `tests/onboarding-no-date-${scenario.theme}-${scenario.width}.png`, animations: 'allow' });
      }
      await page.clock.runFor(1500);
      assert.equal(await dialog.count(), 0, 'No-date route arrives automatically without a film or another confirmation');
      assert.equal(await page.locator('.onboarding-video').count(), 0);
      assert.equal(await page.locator('.calendar-start').count(), 0);
      assert.ok(await page.locator('.calendar-section:not(.calendar-month-preview) [data-today-cell="true"]').isVisible());
      assert.equal(await page.locator('html').getAttribute('data-life-motion'), null);
      assert.equal(await page.evaluate(id => localStorage.getItem(`dayris_birthday_v1_${id}`), storyUserId), null);
      await page.clock.runFor(700);
      await page.screenshot({ path: `tests/onboarding-no-date-${scenario.theme}-calendar.png`, animations: 'disabled' });
    }
    assert.equal(await page.evaluate(key => localStorage.getItem(key), recordKey), before, 'Onboarding never changes records');
    assert.deepEqual(errors, []);
    console.log(`PASS ${scenario.birthday ? 'short dated story' : 'no-date calendar arrival'}: ${scenario.theme}, ${scenario.width}px${scenario.reduced ? ', reduced motion' : ''}.`);
    await context.close();
  }
} finally { await browser.close(); }
