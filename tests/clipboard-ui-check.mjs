import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const bundle = await require('esbuild').build({ stdin: { resolveDir: process.cwd(), contents: `
  import { copyText } from './src/shared/lib/copyText.js';
  window.nativeClipboard = navigator.clipboard;
  const nativeWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
  window.readClipboard = navigator.clipboard.readText.bind(navigator.clipboard);
  window.seedClipboard = nativeWrite;
  const nativeCommand = document.execCommand.bind(document);
  window.configureCopy = ({ preferSelection, modern, selection }) => {
    window.copyOptions = { preferSelection, container: document.getElementById('sheet') };
    window.modernCalls = 0; window.selectionCalls = 0;
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: modern === 'missing' ? undefined : {
      writeText: text => { window.modernCalls++;
        return modern === 'denied' ? Promise.reject(new DOMException('Denied', 'NotAllowedError')) : nativeWrite(text);
      }
    } });
    document.execCommand = command => { window.selectionCalls++; return selection === 'denied' ? false : nativeCommand(command); };
  };
  document.getElementById('copy').onclick = async () => {
    window.copyOutcome = 'pending';
    window.focusBeforeCopy = document.activeElement.id;
    try { await copyText(document.getElementById('caption').textContent, window.copyOptions); window.copyOutcome = 'ok'; }
    catch { window.copyOutcome = 'failed'; }
  };
` }, bundle: true, write: false, format: 'iife' });
const caption = 'Я сохранил огонёк уже 5 дней 🔥\nПопробуй — https://dayris.test/?install=1&ref=ABCD1234';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await context.newPage();
  await page.route('https://clipboard.test/**', route => route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><div id="sheet"><p id="caption"></p><button id="copy">Copy</button></div><script>${bundle.outputFiles[0].text}</script>` }));
  await page.goto('https://clipboard.test/');
  await page.evaluate(text => { document.getElementById('caption').textContent = text; }, caption);
  for (const scenario of [
    { preferSelection: true, modern: 'denied', selection: 'native' },
    { preferSelection: true, modern: 'missing', selection: 'native' },
    { preferSelection: true, modern: 'native', selection: 'denied' },
    { preferSelection: false, modern: 'denied', selection: 'native' },
    { preferSelection: false, modern: 'missing', selection: 'native' },
    { preferSelection: false, modern: 'native', selection: 'denied' },
  ]) {
    await page.evaluate(scenario => window.configureCopy(scenario), scenario);
    await page.evaluate(() => window.seedClipboard('before-copy'));
    await page.locator('#copy').click();
    await page.waitForFunction(() => window.copyOutcome !== 'pending');
    assert.equal(await page.evaluate(() => window.copyOutcome), 'ok', JSON.stringify(scenario));
    const clipboardText = await page.evaluate(() => window.readClipboard());
    assert.equal(clipboardText.replace(/\r\n/g, '\n'), caption, 'the real OS clipboard contains the full caption and personal referral');
    assert.equal(await page.locator('[data-clipboard-temporary]').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement.id), await page.evaluate(() => window.focusBeforeCopy));
    if (scenario.preferSelection && scenario.selection === 'native') assert.equal(await page.evaluate(() => window.modernCalls), 0, 'selection-copy runs before any async call');
  }
  await page.evaluate(() => window.configureCopy({ preferSelection: true, modern: 'denied', selection: 'denied' }));
  await page.evaluate(() => window.seedClipboard('unchanged'));
  await page.locator('#copy').click();
  await page.waitForFunction(() => window.copyOutcome !== 'pending');
  assert.equal(await page.evaluate(() => window.copyOutcome), 'failed', 'never report success when both writes fail');
  assert.equal(await page.evaluate(() => window.readClipboard()), 'unchanged');
  assert.equal(await page.locator('[data-clipboard-temporary]').count(), 0);
  console.log('PASS: actual OS clipboard contents, iOS selection-first path, missing/denied API fallback, focus cleanup and honest failure');
} finally { await browser.close(); }
