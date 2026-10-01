import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
let brokenUpdate = false;
const server = http.createServer((request, response) => {
  const name = new URL(request.url, 'http://localhost').pathname;
  if (brokenUpdate === 'wrong-mime' && name === '/assets/unavailable-build.js') {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<!doctype html><title>Deployment pending</title>'); return;
  }
  const file = path.resolve('dist', name === '/' ? 'index.html' : '.' + name);
  if (!file.startsWith(path.resolve('dist') + path.sep) || !fs.existsSync(file)) {
    response.writeHead(404); response.end(); return;
  }
  const type = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.png') ? 'image/png' : name.endsWith('.json') ? 'application/json' : 'text/html';
  response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  let body = fs.readFileSync(file);
  if (brokenUpdate && (name === '/' || name === '/index.html')) body = body.toString().replace(/\/assets\/[^"'\s<>]+\.js/g, '/assets/unavailable-build.js');
  response.end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    localStorage.setItem('dayris_onboarding_v2_completed', '1');
    localStorage.setItem('atj_language', 'ru');
  });
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.locator('.calendar-days-grid').waitFor();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  const files = await page.evaluate(async () => {
    const cache = await caches.open('atj-cache-v21-offline-startup');
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  assert.ok(files.some(file => file.endsWith('.js') && file.startsWith('/assets/')));
  assert.ok(files.some(file => file.endsWith('.css') && file.startsWith('/assets/')));
  await context.setOffline(true);
  await page.reload();
  await page.getByRole('button', { name: 'Перейти в офлайн', exact: true }).waitFor();
  await page.waitForFunction(() => !document.getElementById('boot-action').disabled);
  assert.equal(await page.locator('#root').evaluate(el => getComputedStyle(el).visibility), 'hidden');
  await page.screenshot({ path: 'tests/offline-startup.png' });
  await page.getByRole('button', { name: 'Перейти в офлайн', exact: true }).click();
  await page.waitForFunction(() => !document.getElementById('boot-screen'));
  await page.getByText('Вы находитесь офлайн', { exact: true }).waitFor();
  await page.locator('.calendar-days-grid').waitFor();
  await page.screenshot({ path: 'tests/offline-calendar.png' });
  await context.setOffline(false);
  await page.getByText('Ура, вы снова в сети!', { exact: true }).waitFor();
  await page.screenshot({ path: 'tests/online-restored.png' });
  await context.setOffline(true);
  await page.getByText('Вы находитесь офлайн', { exact: true }).waitFor();
  assert.equal(await page.getByText('Ура, вы снова в сети!', { exact: true }).count(), 0);
  await context.setOffline(false);
  await page.getByText('Ура, вы снова в сети!', { exact: true }).waitFor();
  await page.waitForTimeout(4800);
  assert.equal(await page.locator('.connection-status').count(), 0);
  // A deploy with an unavailable JS chunk must not replace the usable shell.
  brokenUpdate = true;
  const before = await page.evaluate(async () => (await caches.match('/index.html')).text());
  for (const failure of [true, 'wrong-mime']) {
  brokenUpdate = failure;
  const probe = await context.newPage();
  const probeErrors = [];
  probe.on('pageerror', error => probeErrors.push(error.message));
  await probe.goto(origin, { waitUntil: 'domcontentloaded' });
  await probe.locator('.calendar-days-grid').waitFor();
  await probe.waitForFunction(() => !document.getElementById('boot-screen'));
  assert.deepEqual(probeErrors, [], 'Unavailable deploy keeps the working calendar visible');
  await probe.close();
  }
  const after = await page.evaluate(async () => (await caches.match('/index.html')).text());
  assert.equal(after, before);
  brokenUpdate = false;
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('boot-action').disabled);
  // Reconnection during the splash automatically reveals the prepared app.
  await context.setOffline(false);
  await page.waitForFunction(() => !document.getElementById('boot-screen'));
  await page.locator('.calendar-days-grid').waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: real service-worker JS/CSS precache, offline cold launch and choice, calendar badge, reconnect toast and flapping, failed shell update preserves cache, reconnect at startup.');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
