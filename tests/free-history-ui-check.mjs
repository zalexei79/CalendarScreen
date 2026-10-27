import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { translate } from '../src/shared/i18n/index.js';
const require = createRequire(path.resolve('package.json'));
const runtime = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle = await require('esbuild').build({
  stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: "import React from 'react';import {createRoot} from 'react-dom/client';import CalendarScreen from './CalendarScreen.jsx';createRoot(document.getElementById('root')).render(<CalendarScreen/>);" },
  bundle: true, write: false, outfile: 'free-history.js', format: 'iife',
  loader: { '.svg': 'file', '.mp4': 'file', '.webp': 'file' },
  define: { 'import.meta.env.VITE_SUPABASE_URL': JSON.stringify('https://local-fixture.supabase.co'), 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify('local-test-key'), 'import.meta.env.VITE_CTRADER_CLIENT_ID': JSON.stringify(''), 'import.meta.env.VITE_VAPID_PUBLIC_KEY': JSON.stringify(''), 'import.meta.env.DEV': 'false' },
  plugins: [{ name: 'free-account-fixture', setup(build) {
    build.onResolve({ filter: /\/useAuth$/ }, () => ({ path: 'auth', namespace: 'fixture' }));
    build.onResolve({ filter: /useProAccess\.js$/ }, () => ({ path: 'pro', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: name }) => ({ resolveDir: process.cwd(), contents: name === 'auth'
      ? "export function useAuth(){return {user:{id:'22222222-2222-4222-8222-222222222222',email:'test@example.test',user_metadata:{nickname:'Test'}},validUserId:'22222222-2222-4222-8222-222222222222',authReady:true,setupStep:null,setSetupStep:()=>{},handleGoogleLogin:()=>{},handleGoogleLogout:()=>{},handleTelegramLogin:()=>{}};}"
      : "export const useProAccess=()=>({active:Boolean(window.__historyProFixture),loading:false,until:null,refresh:async()=>false});" }));
  } }],
});
const assets = 'dist/assets';
const css = fs.readFileSync(path.join(assets, fs.readdirSync(assets).find(file => /^main-.*\.css$/.test(file))), 'utf8') + bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const script = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const browser = await runtime('playwright')[process.env.DAYRIS_TEST_WEBKIT === '1' ? 'webkit' : 'chromium'].launch(process.env.DAYRIS_TEST_WEBKIT === '1' ? {} : { channel: 'msedge', headless: true });
const compact = text => text.replace(/[\s\u00a0\u202f]/g, '');
const numericAmount = text => { const value = text.replace(/[^\d+−.,-]/g, '').replace('−', '-'); return Number(value.slice(0, -3).replace(/[.,]/g, '') + '.' + value.slice(-2)); };
fs.mkdirSync('artifacts', { recursive: true });
const scenarios = [[320, 'dark', 'ru'], [390, 'dark', 'ru'], [1280, 'dark', 'ru'], [390, 'light', 'ru'], [1280, 'light', 'ru'], [320, 'dark', 'uk'], [390, 'light', 'zh-CN'], [390, 'dark', 'md'], [390, 'dark', 'en'], [390, 'dark', 'ru', true], [1280, 'light', 'en', true]];
const checks = process.env.DAYRIS_HISTORY_SMOKE === '1' ? scenarios.filter(([width, theme, language, pro]) => language === 'ru' && (width === 320 || width === 390 && theme === 'light') || pro && width === 1280) : scenarios;
try {
  for (const [width, theme, language, pro] of checks) {
    const context = await browser.newContext({ viewport: { width, height: 960 }, isMobile: width < 640, hasTouch: width < 640 });
    await context.addInitScript(({ theme, language, pro }) => {
      window.__historyProFixture = Boolean(pro);
      for (const [key, value] of Object.entries({ dayris_onboarding_v2_completed: '1', calendar_guide_completed: '1', atj_language: language, atj_pro_view: pro ? '1' : '0', atj_trader_mode: '0', atj_currency: 'MDL', atj_theme: theme })) localStorage.setItem(key, value);
      const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`, older = `${now.getFullYear() - 1}-01-10`;
      const row = (id, instrument, pnl, currency = 'MDL') => ({ id, instrument, pnl, currency, time: '12:00', platform: 'Manual' });
      localStorage.setItem('money_calendar_trades_22222222-2222-4222-8222-222222222222', JSON.stringify({
        [today]: [row('salary', 'Зарплата', 32000), row('food', 'Продукты', -1249), row('transport', 'Транспорт', -264), row('coffee', 'Кофе', -120), row('health', 'Здоровье', -500), row('home', 'Дом', -4000), row('side', 'Подработка с очень длинным названием заказа', 2500), row('usd-in', 'Проект', 1500, 'USD'), row('usd-out', 'Покупки', -120, 'USD')],
        [older]: [row('old-income', 'Проект', 8000), row('old-expense', 'Дом', -2500)],
      }));
    }, { theme, language, pro });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'free-history.test') return route.abort();
      if (url.pathname.startsWith('/brand-') && url.pathname.endsWith('.png')) return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(path.join('public', path.basename(url.pathname))) });
      return route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}body{margin:0}</style><div id="root"></div><script>${script}</script>` });
    });
    try {
      await page.goto('http://free-history.test');
      await page.getByRole('button', { name: translate(language, 'history'), exact: true }).click();
      if (pro) {
        const dialog = page.locator('.financial-history-dialog'); await dialog.waitFor();
        assert.equal(await page.locator('.free-history-card').count(), 0);
        assert.equal(await dialog.locator('.financial-record-row').count(), 9, 'PRO is not paginated by FREE controls');
        assert.match(compact(await dialog.locator('.financial-amount').innerText()), /33.*867/);
        await dialog.getByRole('button', { name: translate(language, 'income'), exact: true }).click();
        assert.equal(await dialog.locator('.financial-record-row').count(), 3);
        assert.match(compact(await dialog.locator('.financial-amount').innerText()), /42.*500/);
        assert.deepEqual(errors, []); console.log('PASS PRO boundary', width, theme, language); continue;
      }
      const dialog = page.locator('.free-history-dialog');
      await dialog.waitFor(); await page.waitForTimeout(400);
      const amount = dialog.locator('.free-history-amount');
      assert.equal(numericAmount(await amount.innerText()), 33867);
      assert.equal(await dialog.locator('.free-history-record-row').count(), 3);
      assert.equal(await dialog.locator('.financial-overview').count(), 0);
      assert(await dialog.locator('.free-history-card').evaluate(el => el.getBoundingClientRect().top < el.closest('.free-history-dialog').getBoundingClientRect().top + 150), 'overall result is the first screen');
      assert(await dialog.locator('.free-history-balance').evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'amount and currency fit');
      assert(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'dialog fits');
      if (width === 390 && theme === 'light' && language === 'ru') {
        assert.equal(await dialog.locator('.free-history-record-list').evaluate(el => getComputedStyle(el).backgroundColor.replace(/\s/g, '')), 'rgba(0,0,0,0)', 'the light theme must not add a second white card behind entries');
      }
      await dialog.screenshot({ path: `artifacts/free-history-${width}-${theme}-${language}.png`, animations: 'disabled' });
      await dialog.locator('.free-history-scopes button').nth(2).click();
      assert((await amount.innerText()).includes('33'), 'record scope does not replace the overall result');
      await dialog.locator('.free-history-scopes button').first().click();
      await dialog.locator('.free-history-more').click(); assert.equal(await dialog.locator('.free-history-record-row').count(), 9);
      await dialog.locator('.free-history-controls select').nth(1).selectOption('ALL'); assert.equal(await amount.innerText(), '—'); assert.equal(await dialog.locator('.free-history-totals strong').first().innerText(), '—');
      await dialog.locator('.free-history-controls select').nth(1).selectOption('USD'); assert.equal(numericAmount(await amount.innerText()), 1380);
      await dialog.locator('.free-history-controls select').nth(1).selectOption('CNY'); assert.equal(numericAmount(await amount.innerText()), 0);
      await dialog.locator('.free-history-controls select').nth(1).selectOption('MDL');
      await dialog.locator('.free-history-controls select').first().selectOption('Текущий месяц'); assert.equal(numericAmount(await amount.innerText()), 28367);
      await dialog.locator('.free-history-controls select').first().selectOption('Вся история');
      if (width === 390 && language === 'ru' && theme === 'dark') {
        await dialog.locator('.free-history-controls select').first().selectOption('custom');
        const older = `${new Date().getFullYear() - 1}-01-10`;
        await dialog.getByLabel(translate(language, 'fromDate'), { exact: true }).fill(older);
        await dialog.getByLabel(translate(language, 'toDate'), { exact: true }).fill(older);
        assert.equal(numericAmount(await amount.innerText()), 5500, 'custom date range drives the overall result');
        await dialog.locator('.free-history-controls select').first().selectOption('Вся история');
      }
      await dialog.locator('.free-history-tabs button').nth(1).click(); assert(await dialog.locator('.free-history-records').isHidden()); assert(await dialog.locator('.free-history-details').isVisible());
      await dialog.locator('.free-history-tabs button').nth(2).click(); assert(await dialog.locator('.free-history-details').isVisible());
      await dialog.locator('.free-history-tabs button').first().click(); assert(await dialog.locator('.free-history-records').isVisible());
      await page.emulateMedia({ reducedMotion: 'reduce' }); await dialog.locator('.free-history-controls select').nth(1).selectOption('USD');
      assert.equal(await dialog.locator('.free-history-balance').evaluate(el => el.getAnimations().filter(animation => animation.playState === 'running').length), 0);
      if (language === 'ru') { await dialog.locator('.free-history-controls select').nth(1).selectOption('MDL'); await dialog.locator('.free-history-record-row').first().click(); await page.locator('.quick-money-composer').waitFor(); }
      assert.deepEqual(errors, []);
      console.log('PASS', width, theme, language);
    } catch (error) { await page.screenshot({ path: 'artifacts/free-history-failure.png', fullPage: true }).catch(() => {}); console.error(errors); throw error; }
    finally { await context.close(); }
  }
} finally { await browser.close(); }
