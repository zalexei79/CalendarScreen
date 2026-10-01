import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import path from 'node:path';

const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const { build } = createRequire(path.resolve('package.json'))('esbuild');
const bundle = await build({ entryPoints: ['tests/monthly-goal-ui.jsx'], bundle: true,
  write: false, format: 'iife', define: { 'process.env.NODE_ENV': '"development"' } });
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://goal.test/**', route => route.fulfill({ contentType: 'text/html',
    body: `<html><div id="root"></div><script>${bundle.outputFiles[0].text}</script></html>` }));
  await page.goto('http://goal.test/');
  const panel = page.locator('.monthly-goal-bar');
  async function save(amount) {
    await panel.getByRole('button', { name: /^(Monthly goal|Monthly goal.*progress)/ }).click();
    await panel.getByRole('button', { name: /^(Set goal|Edit goal)$/ }).click();
    await panel.locator('input').fill(String(amount));
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
  }
  await save(100);
  assert.match(await panel.innerText(), /42%/);
  await page.getByRole('button', { name: 'August', exact: true }).click();
  await panel.getByRole('button', { name: 'Set goal', exact: true }).waitFor({ state: 'attached' });
  assert.doesNotMatch(await panel.innerText(), /100%/);
  assert.equal(await page.evaluate(() => localStorage.getItem('goal_celebrated_2026-08_USD:alice')), null,
    'switching must never acknowledge the previous goal under the new month');
  assert.equal(await page.locator('.pro-goal-celebration-card').count(), 0);
  await save(200);
  assert.match(await panel.innerText(), /71%/);
  await page.getByRole('button', { name: 'September', exact: true }).click();
  assert.match(await panel.innerText(), /42%/);
  await panel.getByRole('button', { name: /^Monthly goal/ }).click();
  await panel.getByRole('button', { name: 'Edit goal', exact: true }).click();
  await panel.locator('input').fill('999');
  await page.getByRole('button', { name: 'August', exact: true }).click();
  assert.equal(await panel.locator('input').count(), 0, 'drafts reset on month changes');
  assert.match(await panel.innerText(), /71%/);
  for (const scope of ['Year', 'Currency', 'User']) {
    await page.getByRole('button', { name: scope, exact: true }).click();
    assert.match(await panel.innerText(), /Set goal/);
    await page.getByRole('button', { name: scope, exact: true }).click();
    assert.match(await panel.innerText(), /71%/);
  }
  await page.reload();
  assert.match(await panel.innerText(), /42%/);
  await page.getByRole('button', { name: 'August', exact: true }).click();
  assert.match(await panel.innerText(), /71%/);
  await page.getByRole('button', { name: 'September', exact: true }).click();
  await page.getByRole('button', { name: 'Earn', exact: true }).click();
  await page.locator('.pro-goal-celebration-card').waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('goal_celebrated_2026-09_USD:alice')), '100');
  await page.getByRole('button', { name: 'August', exact: true }).click();
  await page.getByRole('button', { name: 'September', exact: true }).click();
  assert.equal(await page.locator('.pro-goal-celebration-card').count(), 0, 'returning to achieved month never replays confetti');
  await page.reload();
  await page.getByRole('button', { name: 'Earn', exact: true }).click();
  assert.equal(await page.locator('.pro-goal-celebration-card').count(), 0, 'reload keeps achievement acknowledged');
  assert.deepEqual(errors, []);
  console.log('Monthly goals: month/year/currency/user isolation, drafts, celebration and persistence passed.');
} finally {
  await browser.close();
}
