// Deterministic production preview: synthetic account, local assets, no network.
// Build first, then: node tests/life-story-motion-preview.mjs [directory] [--desktop] [--light]
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';

const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const desktop = process.argv.includes('--desktop');
const dark = !process.argv.includes('--light');
const directory = path.resolve(process.env.DAYRIS_MOTION_PREVIEW_DIR || process.argv.slice(2).find(value => !value.startsWith('--')) || 'tests');
const dist = path.resolve('dist');
assert.ok(fs.existsSync(path.join(dist, 'index.html')), 'Build the production app before recording');
fs.mkdirSync(directory, { recursive: true });
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: desktop ? { width: 1440, height: 1000 } : { width: 390, height: 844 }, serviceWorkers: 'block' });
  await context.addInitScript(isDark => {
    localStorage.setItem('atj_language', 'ru');
    localStorage.setItem('atj_theme', isDark ? 'dark' : 'light');
    localStorage.setItem('calendar_guide_completed', '1');
    localStorage.setItem('dayris_voice_feedback', 'off');
  }, dark);
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://calendar.test') return route.abort();
    const filename = path.resolve(dist, url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!filename.startsWith(dist + path.sep) || !fs.existsSync(filename)) return route.fulfill({ status: 404, body: '' });
    const extension = path.extname(filename);
    const contentType = { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }[extension] || 'text/html';
    return route.fulfill({ contentType, body: fs.readFileSync(filename) });
  });
  await installStoryAccount(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.clock.install({ time: new Date('2026-10-05T12:00:00') });
  await page.goto('http://calendar.test/');
  await page.clock.pauseAt(new Date('2026-10-05T13:00:00'));
  await page.getByRole('button', { name: /Русский/ }).click();
  await page.getByRole('button', { name: /USD/ }).click();
  await page.getByLabel('Дата рождения', { exact: true }).fill('1998-03-14');
  await page.getByRole('button', { name: 'Увидеть мою историю', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.life-story')?.dataset.calendarTarget === 'live');
  await page.mouse.move(0, 0);
  await page.clock.runFor(32);
  const elapsed = Number(await page.locator('.life-story').getAttribute('data-time'));
  await page.clock.runFor(Math.max(0, 8000 - elapsed));
  const start = Number(await page.locator('.life-story').getAttribute('data-time'));
  const fps = 24;
  for (let frame = 0; frame <= 6 * fps; frame++) {
    if (frame) await page.clock.runFor(Math.round(frame * 1000 / fps) - Math.round((frame - 1) * 1000 / fps));
    await page.screenshot({ path: path.join(directory, `life-story-preview-frame-${String(frame).padStart(3, '0')}.png`) });
  }
  assert.deepEqual(errors, [], 'The production preview has no browser errors');
  console.log(JSON.stringify({ directory, frames: 6 * fps + 1, fps, startTime: start, endTime: start + 6000, viewport: page.viewportSize(), theme: dark ? 'dark' : 'light' }));
} finally {
  await browser.close();
}
