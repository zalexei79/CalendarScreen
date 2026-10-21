import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const result = await require('esbuild').build({
  stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React, { useMemo, useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import Dialog from './src/shared/ui/ActivityStreakDialog.jsx';
    import { translate } from './src/shared/i18n/index.js';
    function App() {
      const [config, setConfig] = useState({ days: 5, language: 'ru', paused: false });
      window.configureStreak = setConfig;
      const streak = useMemo(() => ({ currentStreak: config.days, paused: config.paused }), [config.days, config.paused]);
      return <Dialog open streak={streak} user={{ email: 'private@example.test' }}
        isLight={config.light || false} language={config.language} t={key => translate(config.language, key)}
        referralCode="64511641" onClose={() => {}} />;
    }
    createRoot(document.getElementById('root')).render(<App />);
  ` }, bundle: true, write: false, outfile: 'streak.js', format: 'iife',
});
const js = result.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = result.outputFiles.find(file => file.path.endsWith('.css')).text;
await mkdir('artifacts/streak-review', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const platform of ['iPhone', 'Android']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: platform, isMobile: true, hasTouch: true });
    await context.addInitScript(() => {
      window.drawnText = [];
      const original = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function(text, x, y, ...args) {
        const metric = this.measureText(text);
        window.drawnText.push({ text, top: y - metric.actualBoundingBoxAscent, bottom: y + metric.actualBoundingBoxDescent });
        return original.call(this, text, x, y, ...args);
      };
      Object.defineProperty(navigator, 'share', { value: async payload => { window.sharedStreak = payload; }, configurable: true });
      Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true });
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('https://streak.test/**', async route => {
      if (new URL(route.request().url()).pathname.endsWith('.webp')) {
        return route.fulfill({ contentType: 'image/webp', body: await readFile('public/images/streak/momentum-glass-v1.webp') });
      }
      return route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#09090b;color:#fff;font-family:Arial}*{box-sizing:border-box}${css}</style><div id="root"></div><script>${js}</script>` });
    });
    await page.goto('https://streak.test/');
    for (const [days, language, paused] of [[1, 'ru', false], [5, 'ru', false], [10, 'ru', false], [100, 'ru', false], [10000, 'en', true], [5, 'uk', false], [21, 'md', false], [28, 'zh-CN', false]]) {
      const previousUrl = await page.locator('.activity-streak-preview').getAttribute('src').catch(() => null);
      await page.evaluate(config => { window.drawnText = []; window.configureStreak(config); }, { days, language, paused });
      await page.waitForFunction(previous => {
        const preview = document.querySelector('.activity-streak-preview');
        const button = document.querySelector('.activity-streak-primary');
        return preview && preview.src !== previous && !button.disabled;
      }, previousUrl);
      const bounds = await page.evaluate(days => {
        const number = window.drawnText.find(item => item.text === String(days));
        const index = window.drawnText.indexOf(number);
        return { number, unit: window.drawnText[index + 1], pathOverlays: window.drawnText.filter(item => item.bottom > 825 && item.top < 1170), width: document.documentElement.scrollWidth };
      }, days);
      assert.ok(bounds.number.bottom <= 710.01, `${platform} ${language} ${days}: number fits reserved area`);
      assert.ok(bounds.number.bottom + 16 < bounds.unit.top, `${platform} ${language} ${days}: number and caption do not overlap`);
      assert.deepEqual(bounds.pathOverlays, [], `${platform} ${language} ${days}: no text over the glass path`);
      assert.ok(bounds.width <= 390, 'dialog fits phone width');
      if (language === 'ru' && days === 5) {
        await page.getByRole('heading', { name: 'Как сохранить огонёк' }).waitFor();
        assert.equal(await page.locator('.activity-streak-rule-steps li').count(), 3);
        await page.locator('.activity-streak-primary').click();
        const payload = await page.evaluate(() => ({ text: window.sharedStreak.text, url: window.sharedStreak.url, name: window.sharedStreak.files[0].name, type: window.sharedStreak.files[0].type }));
        assert.equal(payload.name, 'dayris-streak-5.png'); assert.equal(payload.type, 'image/png');
        assert.ok(payload.text.startsWith('Я сохранил огонёк уже 5 дней 🔥\nПопробуй —'));
        assert.ok((payload.url || payload.text).includes('ref=64511641'));
        const bytes = await page.evaluate(async () => Array.from(new Uint8Array(await window.sharedStreak.files[0].arrayBuffer())));
        await writeFile(`artifacts/streak-review/${platform}-5.png`, Buffer.from(bytes));
        await page.screenshot({ path: `artifacts/streak-review/${platform}-dialog.png` });
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`PASS ${platform}: glyph bounds, consecutive-days labels, rules, five locales and file-share payload`);
  }
} finally { await browser.close(); }
