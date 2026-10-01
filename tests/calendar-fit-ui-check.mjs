import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || import.meta.url);
const result = await createRequire(path.resolve('package.json'))('esbuild').build({ entryPoints: ['tests/calendar-fit-ui.jsx'], bundle: true, write: false, outfile: 'fixture.js', format: 'iife', define: { 'process.env.NODE_ENV': '"production"' } });
const js = result.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
const builtCss = fs.readFileSync(path.join('dist/assets', fs.readdirSync('dist/assets').find(name => name.endsWith('.css'))), 'utf8');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://dayris.test/**', route => {
    const name = new URL(route.request().url()).pathname;
    if (name.endsWith('.png')) return route.fulfill({ path: path.join('public', name), contentType: 'image/png' });
    return route.fulfill({ contentType: 'text/html', body: `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${builtCss}\n${css}</style><div id="root"></div><script>${js}</script>` });
  });
  for (const [width, height] of [[412,915], [430,932], [393,852], [360,800], [390,844], [360,740], [360,640], [320,568]]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://dayris.test/');
    await page.locator('.calendar-days-grid').waitFor();
    for (const trader of [false, true]) {
      if (trader) await page.getByRole('switch').click();
      for (const month of [9, 2]) {
        await page.evaluate(month => window.testMonth(month), month);
        await page.waitForTimeout(650);
        await page.evaluate(() => window.scrollTo(0, 0));
        if (height >= 800 || height === 740 && month === 9) await page.waitForFunction(() => {
          const grid = document.querySelector('.calendar-days-grid').getBoundingClientRect();
          const dock = document.querySelector('.history-fab').getBoundingClientRect();
          return dock.top - grid.bottom >= 10 && dock.top - grid.bottom <= 13;
        });
        const box = await page.locator('.calendar-days-grid').boundingBox();
        const dock = await page.locator('.history-fab').boundingBox();
        const cell = await page.locator('.calendar-days-grid > button').first().boundingBox();
        const count = await page.locator('.calendar-days-grid > button').count();
        assert.ok(cell.height >= 56, 'days retain enough space for date and PnL');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow');
        if (height >= 800 || height === 740 && count === 35) {
          assert.ok(box.y + box.height <= dock.y - 10, `${width}x${height}, trader=${trader}, ${count} days clear the dock: ${JSON.stringify({box,dock,cell})}`);
          assert.ok(dock.y - box.y - box.height <= 13, 'calendar uses all space up to the controls');
          assert.ok(Math.abs(height - dock.y - dock.height - 12) < 1, 'no arbitrary navigation padding');
          assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), 'fitted month has no empty scroll tail');
        } else {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          const last = await page.locator('.calendar-days-grid > button').last().boundingBox();
          assert.ok(last.y + last.height < dock.y, 'short screens scroll the last week above controls');
        }
        if (width === 412 && month === 9) await page.screenshot({ path: `tests/android-calendar-${trader ? 'trader' : 'pro'}.png` });
      }
    }
  }
  // Header disclosure and a changing viewport both recompute the rows.
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto('http://dayris.test/');
  await page.getByRole('switch').click();
  await page.waitForTimeout(650);
  await page.setViewportSize({ width: 412, height: 800 });
  await page.waitForFunction(() => {
    const grid = document.querySelector('.calendar-days-grid').getBoundingClientRect();
    const dock = document.querySelector('.history-fab').getBoundingClientRect();
    return dock.top - grid.bottom >= 10 && dock.top - grid.bottom <= 13;
  });
  const grid = await page.locator('.calendar-days-grid').boundingBox();
  const dock = await page.locator('.history-fab').boundingBox();
  assert.ok(grid.y + grid.height <= dock.y - 10, 'fits when Android browser bars reduce viewport');
  // Simulate a browser-reported iOS home-indicator inset. Both the dock and
  // calendar must follow it, without adding another hard-coded phone margin.
  await page.evaluate(() => document.documentElement.style.setProperty('--dayris-dock-safe', '34px'));
  await page.waitForFunction(() => {
    const grid = document.querySelector('.calendar-days-grid').getBoundingClientRect();
    const dock = document.querySelector('.history-fab').getBoundingClientRect();
    return Math.abs(innerHeight - dock.bottom - 46) < 1 && dock.top - grid.bottom >= 10 && dock.top - grid.bottom <= 13;
  });
  const iosDock = await page.locator('.history-fab').boundingBox();
  const iosGrid = await page.locator('.calendar-days-grid').boundingBox();
  assert.ok(Math.abs(800 - iosDock.y - iosDock.height - 46) < 1);
  assert.ok(iosDock.y - iosGrid.y - iosGrid.height >= 10 && iosDock.y - iosGrid.y - iosGrid.height <= 13);
  assert.deepEqual(errors, []);
  console.log('PASS: mobile PRO/trader, five/six weeks, 320–412px screens, short-screen scrolling, viewport resize, no dock overlap.');
} finally { await browser.close(); }
