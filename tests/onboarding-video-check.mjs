import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
import { selectBirthday } from './birthday-test-helper.mjs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
const cases = [
  { name: 'desktop', viewport: { width: 1440, height: 1000 }, target: 'calendar' },
  { name: 'mobile', viewport: { width: 390, height: 844 }, target: 'speaker' },
  { name: 'skip', viewport: { width: 320, height: 760 }, target: 'skip' },
  { name: 'late-skip', viewport: { width: 390, height: 844 }, target: 'late-skip' },
  { name: 'error', viewport: { width: 390, height: 844 }, target: 'error' },
  { name: 'reduced', viewport: { width: 390, height: 844 }, target: 'speaker', reduced: true },
];
try {
  for (const item of cases.filter(item => !process.env.VIDEO_CASE || process.env.VIDEO_CASE.split(',').includes(item.name))) {
    const context = await browser.newContext({ viewport: item.viewport, serviceWorkers: 'block', reducedMotion: item.reduced ? 'reduce' : 'no-preference' });
    const errors = [];
    let releaseVideo;
    await context.addInitScript(() => {
      localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', 'dark');
      localStorage.setItem('calendar_guide_completed', '1'); localStorage.setItem('dayris_voice_feedback', 'off');
    });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'http://calendar.test') return route.abort();
      const name = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      if (!name.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(name) || (item.target === 'error' && name.endsWith('.mp4'))) return route.fulfill({ status: 404, body: '' });
      const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.mp4') ? 'video/mp4' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html';
      if (item.target === 'late-skip' && name.endsWith('.mp4')) await new Promise(resolve => { releaseVideo = resolve; });
      return route.fulfill({ contentType, body: fs.readFileSync(name) });
    });
    await installStoryAccount(context);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
    await page.goto('http://calendar.test/');
    await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
    await page.getByRole('button', { name: /Русский/ }).click();
    await page.locator('.first-run-dialog').getByRole('button', { name: 'Продолжить', exact: true }).click();
    await page.locator('.first-run-dialog').getByRole('button', { name: /USD/ }).click();
    await selectBirthday(page, '1998-03-14');
    await page.getByRole('button', { name: 'Увидеть мою историю', exact: true }).click();
    console.log(`${item.name}: story started`);
    await page.clock.runFor(32);
    await page.clock.fastForward(14500);
    await page.clock.runFor(32);
    await page.locator('.onboarding-video[data-active="true"]').waitFor();
    console.log(`${item.name}: video mounted`);
    if (item.target === 'late-skip') {
      await page.keyboard.press('Escape');
      assert.ok(releaseVideo, 'The test holds video loading');
      releaseVideo();
      await page.clock.runFor(1100);
      await page.waitForFunction(() => !document.querySelector('.first-run-dialog'));
      assert.equal(await page.locator('.premium-shell .calendar-days-grid').evaluate(grid => getComputedStyle(grid).visibility), 'visible');
      assert.equal(await page.getByRole('button', { name: 'Доходы', exact: true }).count(), 0);
      assert.deepEqual(errors, []);
      console.log('late-skip: Escape during loading, delayed media event, calendar restoration passed');
      await context.close();
      continue;
    }
    await page.waitForFunction(() => document.querySelector('.onboarding-video video').readyState >= 2 || document.querySelector('.onboarding-video-fallback'));
    await page.clock.runFor(400);
    if (['desktop', 'mobile'].includes(item.name)) {
      await new Promise(resolve => setTimeout(resolve, 450));
      await page.screenshot({ path: `tests/onboarding-video-${item.name}-transition.png` });
    }
    await page.clock.runFor(1100);
    console.log(`${item.name}: transition settled`);
    const video = page.locator('.onboarding-video video');
    if (item.target === 'error') {
      await page.getByRole('button', { name: 'Добавить первую запись', exact: true }).click();
    } else if (item.target === 'skip') {
      await page.getByRole('button', { name: /Пропустить/ }).click();
    } else {
      assert.equal(await video.evaluate(v => v.videoWidth), item.name === 'desktop' ? 1920 : 1080);
      assert.equal(await page.locator('.onboarding-video-calendar-action').count(), 0, 'No premature entry hotspot');
      if (item.reduced) {
        assert.equal(await video.evaluate(v => v.paused), true, 'Reduced motion waits for a play gesture');
        await page.getByRole('button', { name: 'Продолжить видео', exact: true }).click();
      }
      // Watch real playback: seeking a routed MP4 can reset Chromium's decoder.
      await page.waitForFunction(() => document.querySelector('.onboarding-video video').currentTime > .05);
      await page.locator('.onboarding-video-calendar-action').waitFor();
      assert.ok(await video.evaluate(v => v.currentTime >= 19), 'Actions follow the spoken invitation');
      await page.locator('.onboarding-video[data-phase="ready"]').waitFor();
      const end = await video.evaluate(v => ({ time: v.currentTime, duration: v.duration, paused: v.paused }));
      assert.ok(end.paused && end.time >= end.duration - .05, 'The final video frame remains held');
      await page.clock.runFor(5000);
      assert.equal(await page.locator('.onboarding-video[data-phase="ready"]').count(), 1, 'Final frame never auto-dismisses');
      if (item.name === 'mobile') {
        await page.setViewportSize({ width: 320, height: 760 });
        await page.screenshot({ path: 'tests/onboarding-video-mobile-narrow.png' });
        await page.setViewportSize(item.viewport);
      }
      await page.screenshot({ path: `tests/onboarding-video-${item.name}-ready.png` });
      for (const selector of ['.onboarding-video-calendar-action', '.onboarding-video-speaker-action']) {
        const hit = await page.locator(selector).evaluate(button => { const b = button.getBoundingClientRect(); return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2) === button || button.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)); });
        assert.ok(hit, `${selector} accepts clicks in ${item.name}`);
      }
      await page.locator(item.target === 'calendar' ? '.onboarding-video-calendar-action' : '.onboarding-video-speaker-action').click();
    }
    await page.clock.runFor(1100);
    await page.waitForFunction(() => !document.querySelector('.first-run-dialog'));
    assert.equal(await page.locator('.onboarding-video-ghost').count(), 0);
    assert.equal(await page.locator('html[data-life-motion]').count(), 0, 'Native calendar restored');
    assert.equal(await page.locator('.premium-shell .calendar-days-grid').evaluate(grid => getComputedStyle(grid).visibility), 'visible', 'Transition never leaves the real grid hidden');
    if (item.target !== 'skip') {
      await page.getByRole('button', { name: 'Доходы', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Расходы', exact: true }).waitFor();
      await page.clock.runFor(800);
      await page.screenshot({ path: `tests/onboarding-video-${item.name}-entry.png`, animations: 'disabled' });
    } else assert.equal(await page.getByRole('button', { name: 'Доходы', exact: true }).count(), 0);
    assert.deepEqual(errors, []);
    console.log(`${item.name}: film selection, final frame, action, cleanup passed`);
    await context.close();
  }
} finally { await browser.close(); }
