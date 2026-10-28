import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { entryStreakState } from '../src/shared/lib/entryActivityStreak.js';
const require = createRequire(import.meta.url);
const { chromium } = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
let serverDay = '2026-10-26';
const server = new Map([[owner,{currentStreak:8,lastActiveDate:serverDay,entryDate:null}]]); const calls = [];
const bundle = await require('esbuild').build({
  stdin: { resolveDir: process.cwd(), loader: 'jsx', contents: `
    import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
    import ActivityStreak from './src/shared/ui/ActivityStreak.jsx';
    import {translate} from './src/shared/i18n/index.js';
    function App(){const[owner,setOwner]=useState('${owner}'),[opened,setOpened]=useState(null);
      window.setStreakOwner=id=>{window.sessionOwner=id;setOwner(id);setOpened(null)};
      return <><ActivityStreak ownerId={owner} isLight={window.lightTheme} t={key=>translate('ru',key)} onOpen={setOpened} onCreateEntry={()=>{window.streakCreateClicked=(window.streakCreateClicked||0)+1;}}
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
    const context = await browser.newContext({viewport:{width:390,height:844},reducedMotion:count===8?'reduce':'no-preference'});
    await context.exposeBinding('streakRpc', async (_, token, parameters) => {
      calls.push({ token, parameters });
      const state = entryStreakState(server.get(token), serverDay);
      return { data: { ...state, accountId: token, timeZone: 'Europe/Bucharest',serverDate:serverDay }, error: null };
    });
    await context.addInitScript(({ owner, count }) => {
      window.sessionOwner = owner;
      window.lightTheme = count === 8;
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
    await page.route('https://streak-account.test/**', route => route.fulfill({ contentType: 'text/html', body: `<meta charset="utf-8"><style>body{background:${count===8?'#f4f4f5':'#111113'};font-family:system-ui}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>` }));
    await page.goto('https://streak-account.test/');
    await page.waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '8 дн.');
    assert.equal(await page.locator('.activity-streak-success').count(),0,'opening the app does not celebrate');
    await page.locator('.activity-streak-pause').waitFor();
    assert.equal(await page.locator('.activity-streak-pause').textContent(),'пауза');
    for(const width of [320,360,390,430,1280]){
      await page.setViewportSize({width,height:844});
      assert.equal(await page.locator('.activity-streak-pause').isVisible(),true,'pause label stays visible on mobile and desktop');
      assert.equal(await page.locator('.activity-streak-pause svg').isVisible(),true);
    }
    await page.setViewportSize({width:390,height:844});
    await page.locator('.activity-streak-reminder').waitFor();
    assert.match(await page.locator('.activity-streak-reminder').textContent(),/Огонёк на паузе.*Создай запись/);
    await page.evaluate(()=>Promise.all(document.querySelector('.activity-streak-reminder').getAnimations().map(a=>a.finished)));
    await page.screenshot({path:`artifacts/streak-review/paused-reminder-${count===8?'light':'dark'}.png`});
    const notice=await page.locator('.activity-streak-reminder').boundingBox();
    assert.ok(notice.height<=90 && notice.x>=0 && notice.x+notice.width<=390,'small reminder fits the screen');
    if(count===4){
      await page.locator('.activity-streak-reminder-copy button').click();
      assert.equal(await page.evaluate(()=>window.streakCreateClicked),1,'reminder action opens entry creation');
    }else await page.locator('.activity-streak-reminder-close').click();
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.activity-streak-reminder').count(),0,'daily reminder does not repeat after focus');
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
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak').getAttribute('aria-busy') === 'false' && !document.querySelector('.activity-streak').title.includes('не синхронизирован'));
  assert.equal(await pages[0].locator('.activity-streak-value').textContent(),'8 дн.','online visits do not extend the streak');
  assert.equal(await pages[0].locator('.activity-streak-success').count(),0);
  await pages[0].locator('.activity-streak-reminder').waitFor();
  server.set(owner,entryStreakState(server.get(owner),serverDay,true));
  await pages[0].evaluate(owner => window.dispatchEvent(new CustomEvent('dayris:streak-entry-saved',{detail:{ownerId:owner}})),owner);
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '9 дн.');
  await pages[0].locator('.activity-streak-success').waitFor();
  assert.equal(await pages[0].locator('.activity-streak-pause').count(),0,'saved entry removes pause');
  assert.equal(await pages[0].locator('.activity-streak-reminder').count(),0,'saved entry removes pause reminder');
  assert.equal(await pages[0].locator('.activity-streak-success').textContent(),'Вы продолжили огонёк');
  await pages[1].evaluate(() => window.streakRealtime());
  await pages[1].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '9 дн.');
  for(const [index,page] of pages.entries()){
    await page.locator('.activity-streak-success').waitFor();
    await page.evaluate(()=>Promise.all(document.querySelector('.activity-streak-success').getAnimations().map(animation=>animation.finished)));
    const box=await page.locator('.activity-streak-success').boundingBox();
    assert.ok(box.height<=48 && box.width<350 && box.x>=0 && box.x+box.width<=390,'compact visible glass pill');
    if(index===1)assert.equal(await page.locator('.activity-streak-success').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.screenshot({path:`artifacts/streak-review/entry-success-${index===0?'dark':'light'}.png`});
  }
  for(const page of pages){
    await page.locator('.activity-streak-success').waitFor({state:'detached'});
    await page.evaluate(owner=>window.dispatchEvent(new CustomEvent('dayris:streak-entry-saved',{detail:{ownerId:owner}})),owner);
    await page.waitForTimeout(120);
    assert.equal(await page.locator('.activity-streak-success').count(),0,'a second same-day save does not celebrate again');
  }
  await pages[0].evaluate(other => window.setStreakOwner(other), other);
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '0 дн.');
  assert.equal(await pages[0].locator('#opened-count').textContent(), '');
  assert.ok(calls.filter(call => call.token === other).every(call => !call.parameters.p_legacy_count), 'new account never imports previous user days');
  await pages[0].evaluate(() => window.setStreakOwner(null));
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '0 дн.');
  await pages[0].evaluate(() => window.dispatchEvent(new CustomEvent('dayris:streak-entry-saved',{detail:{ownerId:'guest'}})));
  await pages[0].waitForFunction(() => document.querySelector('.activity-streak-value').textContent === '1 дн.');
  assert.equal(await pages[0].locator('.activity-streak-success').textContent(),'Вы зажгли огонёк');
  await pages[0].evaluate(() => {
    window.dispatchEvent(new CustomEvent('dayris:streak-entry-saved',{detail:{ownerId:'guest'}}));
    window.dispatchEvent(new CustomEvent('dayris:streak-entry-saved',{detail:{ownerId:'another-account'}}));
    window.dispatchEvent(new Event('focus'));
  });
  assert.equal(await pages[0].locator('.activity-streak-value').textContent(),'1 дн.','guest events count once and cannot cross accounts');
  console.log('PASS: two browsers preserve account streak, visits never count, saved entry syncs once, compact dark/light success, no duplicate notifications, offline and account isolation');
} finally { await browser.close(); }
