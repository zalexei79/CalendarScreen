import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';
const runtime = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = runtime('playwright');
const require = createRequire(path.resolve('package.json'));
const bundle = await require('esbuild').build({ entryPoints: ['tests/metatrader-ui.jsx'], bundle: true, write: false, format: 'iife', loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"production"' } });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const actions = [];
  await page.route('http://127.0.0.1:17865/**', route => {
    actions.push(new URL(route.request().url()).pathname);
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ csv: 'platform;server;account;ticket;date;time;symbol;direction;profit;swap;commission;currency\nACCOUNT;MT5;Broker-Demo;42;Broker;Demo;1000;USD;2026-09-30 01:00:00\nMT5;Broker-Demo;42;123;2026-09-29;12:30:00;EURUSD;buy;20;0;-1;USD\nEND' }) });
  });
  await page.route('http://localhost:5173/**', route => route.fulfill({ contentType: 'text/html', body: `<html><meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles[0].text}</script></html>` }));
  await page.goto('http://localhost:5173');
  assert.equal(await page.getByRole('button', { name: 'Выбрать папку DAYRIS' }).isVisible(), false);
  await page.getByRole('button', { name: 'Подключить MT5', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('#saved').textContent === '1');
  await page.getByRole('button', { name: 'Синхронизировать', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Добавлено: 0' }).waitFor();
  assert.equal(await page.locator('#saved').textContent(), '1');
  await page.locator('#owner').click();
  await page.getByRole('button', { name: 'Подключить MT5', exact: true }).waitFor();
  assert.equal(await page.locator('#saved').textContent(), '0');
  await page.waitForFunction(() => JSON.parse(document.querySelector('#connection').textContent).connected === false);
  assert.ok(actions.includes('/disconnect'));
  await page.locator('#owner').click();
  assert.equal(await page.locator('#saved').textContent(), '1');
  assert.deepEqual(errors, []);
  console.log('Companion UI: connect imports, duplicate skip, owner revocation and history isolation PASS');
} finally { await browser.close(); }
