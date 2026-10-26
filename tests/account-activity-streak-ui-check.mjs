import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { updateActivityStreak } from '../src/shared/lib/activityStreak.js';
const require = createRequire(import.meta.url);
const { chromium } = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
let serverDay = '2026-10-26';
const server = new Map(); const imported = new Set(); const calls = [];
const bundle = await require('esbuild').build({
  stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import ActivityStreak from './src/shared/ui/ActivityStreak.jsx';
    import {translate} from './src/shared/i18n/index.js';
    function App(){const[owner,setOwner]=useState('${owner}'),[opened,setOpened]=useState(null);
      window.setStreakOwner=id=>{window.sessionOwner=id;setOwner(id);setOpened(null)};
      return <><ActivityStreak ownerId={owner} t={key=>translate('ru',key)} onOpen={setOpened}
        onChange={next=>setOpened(current=>current?.ownerId===next.ownerId?next:current)}/>
        <output id="opened-count">{opened?.currentStreak||''}</output></>;
    }createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, outfile: 'streak.js', format: 'iife', plugins: [{ name: 'streak-client', setup(build) {
    build.onResolve({ filter: /supabaseClient\.js$/ }, () => ({ path: 'client', namespace: 'streak-test' }));
    build.onLoad({ filter: /.*/, namespace: 'streak-test' }, () => ({ contents: `export const supabase=window.streakClient;` }));
  } }],
});
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const pages = [];
try {
  for (const count of [4, 8]) {
    const context = await browser.newContext();
    await context.exposeBinding('streakRpc', async (_, token, parameters) => {
      calls.push({ token, parameters });
      let state = updateActivityStreak(server.get(token), serverDay);
      const importKey = `${token}:${parameters.p_legacy_device}`;
      if (parameters.p_legacy_device && !imported.has(importKey)) {
        imported.add(importKey);
        const candidate = updateActivityStreak({ currentStreak: parameters.p_legacy_count,
          lastActiveDate: parameters.p_legacy_date, paused: parameters.p_legacy_paused }, serverDay);
        if (candidate.currentStreak > state.currentStreak) state = candidate;
      }
      server.set(token, state);
      return { data: { ...state, accountId: token, timeZone: 'Europe/Bucharest' }, error: null };
    });
    await context.addInitScript(({ owner, count }) => {
      window.sessionOwner = owner;
      localStorage.setItem(`dayris_activity_streak:${owner}`, JSON.stringify({ currentStreak: count, lastActiveDate: '2026-10-26', paused: false }));
      window.streakClient = {
        auth: { getSession: async () => ({ data: { session: { user: { id: window.sessionOwner }, access_token: window.sessionOwner } } }) },
        rpc(name, params) {
          let token; const builder = {
            setHeader(name, value) { token = value.slice(7); return builder; }, abortSignal() { return builder; },
            then(resolve, reject) { return Promise.resolve().then(() => {
              if (window.streakOffline) throw new Error('Offline');
              return window.streakRpc(token, params);
            }).then(resolve, reject); }
          }; return builder;
        },
        channel() { const channel = { on(_, __, callback) { window.streakRealtime = callback; return channel; }, subscribe() { return channel; } }; return channel; },
        removeChannel() {},
      };
    }, { owner, count });
    const page = await context.newPage(); pages.push(page);
    await page.route('https://streak-account.test/**', route => route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>` }));
    await page.goto('https://streak-account.test/');
    await page.waitForFunction(count => document.querySelector('.activity-streak-value').textContent === count + ' дн.', count);
    if (count === 4) await page.locator('.activity-streak').click();
  }
  await pages[0].evaluate(() => window.streakRealtime());
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '8 дн.');
  assert.equal(await pages[0].locator('#opened-count').textContent(), '8', 'an already open panel updates too');
  for (const page of pages) {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => document.querySelector('.activity-streak').getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('.activity-streak-value').textContent(), '8 дн.');
  }
  serverDay = '2026-10-27';
  await pages[0].evaluate(() => { window.streakOffline = true; window.dispatchEvent(new Event('focus')); });
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak').title.includes('не синхронизирован'));
  assert.equal(await pages[0].locator('.activity-streak-value').textContent(), '8 дн.', 'offline cache never increments independently');
  await pages[0].evaluate(() => { window.streakOffline = false; window.dispatchEvent(new Event('online')); });
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '9 дн.');
  await pages[1].evaluate(() => window.streakRealtime());
  await pages[1].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '9 дн.');
  await pages[0].evaluate(other => window.setStreakOwner(other), other);
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '1 дн.');
  assert.equal(await pages[0].locator('#opened-count').textContent(), '');
  assert.ok(calls.filter(call => call.token === other).every(call => !call.parameters.p_legacy_count), 'new account never imports previous user days');
  console.log('PASS: two isolated browsers merge 4/8 to 8, open panel sync, no double increment, offline recovery, realtime refresh and account switching');
} finally { await browser.close(); }
