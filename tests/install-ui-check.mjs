import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
const { chromium, webkit } = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1';
const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const browser = process.env.DAYRIS_TEST_WEBKIT ? await webkit.launch({ headless: true }) : await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const device of ['iphone', 'android', 'desktop']) {
    const context = await browser.newContext({ viewport: { width: device === 'desktop' ? 1280 : 390, height: 844 }, userAgent: device === 'iphone' ? iphone : device === 'android' ? android : undefined, serviceWorkers: 'block' });
    await context.addInitScript(() => {
      localStorage.setItem('atj_language', 'ru'); localStorage.setItem('atj_theme', 'gold');
      localStorage.setItem('dayris_onboarding_v2_completed', '1'); localStorage.setItem('calendar_guide_completed', '1');
      // An old install flag must not hide the browser's install control.
      localStorage.setItem('atj_pwa_installed', 'true');
    });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/')) return route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '[]' });
      if (url.origin !== 'http://install.test') return route.abort();
      const file = path.resolve('dist', url.pathname === '/' ? 'index.html' : '.' + url.pathname);
      if (!file.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
      return route.fulfill({ body: fs.readFileSync(file), contentType: file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html' });
    });
    await installStoryAccount(context);
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://install.test');
    const trigger = page.locator('[data-site-element="install"]');
    try { await trigger.click(); }
    catch (error) {
      console.log('PAGE', await page.locator('body').innerText(), 'ERRORS', errors);
      await page.screenshot({ path: 'tests/install-failure.png' });
      throw error;
    }
    const dialog = page.locator('dialog.dayris-install-dialog');
    await dialog.waitFor({ state: 'visible' });
    assert.equal(await dialog.locator('li').count(), device === 'desktop' ? 2 : 3);
    if (device === 'iphone') assert.match(await dialog.innerText(), /В Chrome нажми «Поделиться»/);
    if (device === 'android') assert.match(await dialog.innerText(), /Установка на Android/);
    for (const width of [320, 390, 428, 1280]) {
      await page.setViewportSize({ width, height: width === 1280 ? 900 : 700 });
      const box = await dialog.boundingBox();
      assert.ok(box.x >= 15 && box.x + box.width <= width - 15, `${device} stays within ${width}px`);
      assert.ok(box.y >= 0 && box.y + box.height <= (width === 1280 ? 900 : 700), 'Fits viewport vertically');
    }
    await page.setViewportSize({ width: device === 'desktop' ? 1280 : 390, height: 844 });
    await page.screenshot({ path: `tests/install-${device}.png` });
    await dialog.getByRole('button', { name: 'Понятно', exact: true }).click();
    await page.keyboard.press('Tab');
    await trigger.click(); await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
    if (device === 'android') {
      // Capture before CalendarScreen mounts, as happens on fast page loads.
      await page.addInitScript(() => {
        const event = { prompt: () => { window.promptCalls = (window.promptCalls || 0) + 1; }, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
        window.__atjInstallPrompt = event;
      });
      await page.reload(); await trigger.click();
      assert.equal(await page.evaluate(() => window.promptCalls), 1);
      await dialog.waitFor({ state: 'visible' });
      await dialog.getByRole('button', { name: 'Понятно', exact: true }).click();
      await trigger.click();
      assert.equal(await page.evaluate(() => window.promptCalls), 1, 'Dismissed event is never reused');
      await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
      await dialog.waitFor({ state: 'hidden' });
      assert.equal(await trigger.count(), 0);
    }
    await page.goto('http://install.test/?install=1');
    if (device === 'iphone') {
      await page.locator('.dayris-install-guide').waitFor();
      assert.match(await page.locator('.dayris-install-guide').innerText(), /Chrome/);
    } else {
      await page.getByRole('button', { name: /установ/i }).click();
      await page.locator('.dayris-install-guide').waitFor();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS ${device}: platform instructions, viewport 320–1280px, dismissal, install page${device === 'android' ? ', early native prompt, one-shot consumption, installed state' : ''}`);
    await context.close();
  }
} finally { await browser.close(); }
