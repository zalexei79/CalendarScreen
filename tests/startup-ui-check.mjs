import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'dayris.test') return route.abort();
    const name = url.pathname === '/' ? '/index.html' : url.pathname;
    if (name.endsWith('.js')) await new Promise(resolve => setTimeout(resolve, 2200));
    const file = path.join(process.cwd(), 'dist', name);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html';
    return route.fulfill({ path: file, contentType });
  });
  await page.goto('http://dayris.test/', { waitUntil: 'commit' });
  await page.locator('.boot-mark').waitFor();
  assert.equal(await page.locator('#root').evaluate(el => getComputedStyle(el).visibility), 'hidden');
  assert.equal(await page.locator('.boot-tile').count(), 4);
  const motion = await page.locator('.boot-tile').evaluateAll(tiles => tiles.map(tile => {
    const animation = tile.getAnimations().find(item => item.animationName === 'boot-tile-enter');
    animation.pause(); animation.currentTime = 200;
    return getComputedStyle(tile).transform;
  }));
  assert.ok(motion.every(transform => transform !== 'none'));
  await page.screenshot({ path: 'tests/startup-motion.png' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.boot-tile').first().evaluate(el => getComputedStyle(el).animationName), 'none');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/startup-splash.png' });
  await page.waitForFunction(() => !document.getElementById('boot-screen'));
  assert.equal(await page.locator('#root').evaluate(el => getComputedStyle(el).visibility), 'visible');
  assert.equal(await page.locator('body').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(9, 9, 11)');
  await page.screenshot({ path: 'tests/startup-ready.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: production startup, four animated tiles, hidden unstyled root, reduced motion, styled reveal.');
} finally { await browser.close(); }
