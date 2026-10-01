import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE);
const bundled = await build({ entryPoints: ['src/features/auth/persistentAuthStorage.js'], bundle: true, write: false, format: 'iife', globalName: 'authStorage', platform: 'browser' });
const script = bundled.outputFiles[0].text;
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext();
  await context.route('http://dayris.test/**', route => route.fulfill({ contentType: 'text/html', body: `<script>${script}</script>` }));
  const page = await context.newPage();
  await page.goto('http://dayris.test/');
  await page.evaluate(async () => {
    localStorage.setItem('session', 'legacy-token');
    window.store = authStorage.createPersistentAuthStorage();
    if (await store.getItem('session') !== 'legacy-token') throw Error('Migration failed');
    await store.setItem('session', 'rotated-token');
    localStorage.removeItem('session');
  });
  await page.reload();
  assert.equal(await page.evaluate(async () => {
    window.store = authStorage.createPersistentAuthStorage();
    return store.getItem('session');
  }), 'rotated-token', 'Reload restores the latest token from persistent storage');
  await page.evaluate(async () => {
    await store.removeItem('session');
    localStorage.setItem('session', 'stale-token');
  });
  await page.reload();
  assert.equal(await page.evaluate(() => authStorage.createPersistentAuthStorage().getItem('session')), null, 'Logout tombstone blocks stale token restoration');
  await page.evaluate(async () => {
    Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage blocked'); } });
    const store = authStorage.createPersistentAuthStorage();
    await store.setItem('blocked-local', 'saved-token');
    if (await store.getItem('blocked-local') !== 'saved-token') throw Error('Fallback failed');
  });
  await page.reload();
  assert.equal(await page.evaluate(() => authStorage.createPersistentAuthStorage().getItem('blocked-local')), 'saved-token');
  console.log('Auth persistence: migration, rotation, reload, blocked localStorage and logout passed');
} finally { await browser.close(); }
