import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
import { EMPTY_CONFIG } from '../src/features/admin/siteConfig.js';

const require = createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser = await require('playwright').chromium.launch({ channel: 'msedge', headless: true });
let checkPage;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', hasTouch:true });
  await context.addInitScript(() => {
    localStorage.setItem('atj_language', 'ru');
    localStorage.setItem('dayris_onboarding_v2_completed', '1');
    localStorage.setItem('calendar_guide_completed', '1');
  });
  let draft = structuredClone(EMPTY_CONFIG), version = 0, live = structuredClone(EMPTY_CONFIG), isAdmin = true;
  const releases = [{ id: 1, config: live, published_at: new Date().toISOString() }];
  const dist = path.resolve('dist');
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const json = value => route.fulfill({ contentType: 'application/json', body: JSON.stringify(value) });
    if (url.pathname.endsWith('/rpc/is_site_admin')) return json(isAdmin);
    if (url.pathname.endsWith('/rpc/admin_capabilities')) return json({design:isAdmin,viewUsers:isAdmin,editUsers:isAdmin});
    if (url.pathname.endsWith('/site_config_draft')) return json({ config: draft, version });
    if (url.pathname.endsWith('/site_config_releases')) return json(releases);
    if (url.pathname.endsWith('/site_live_config')) return json({ config: live });
    if (url.pathname.endsWith('/rpc/save_site_config')) {
      const body = route.request().postDataJSON();
      assert.equal(body.p_version, version); draft = body.p_config; return json(++version);
    }
    if (url.pathname.endsWith('/rpc/publish_site_config')) {
      assert.equal(route.request().postDataJSON().p_version, version);
      live = structuredClone(draft); releases.unshift({ id: releases.length + 1, config: live, published_at: new Date().toISOString() });
      return json(++version);
    }
    if (url.origin !== 'http://calendar.test') return route.abort();
    const target = path.resolve(dist, url.pathname === '/' ? 'index.html' : '.' + url.pathname);
    if (!target.startsWith(dist + path.sep) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) return route.fulfill({ status: 404, body: '' });
    const type = target.endsWith('.js') ? 'text/javascript' : target.endsWith('.css') ? 'text/css' : target.endsWith('.png') ? 'image/png' : 'text/html';
    return route.fulfill({ contentType: type, body: fs.readFileSync(target) });
  });
  await installStoryAccount(context);
  const page = await context.newPage(), errors = [];
  checkPage = page;
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://calendar.test/?admin=1');
  await page.getByText('Администратор · версия черновика 0', { exact: true }).waitFor();
  const preview = page.frameLocator('iframe');
  await preview.locator('[data-site-element="settings"]').waitFor();
  // Inspection intercepts calendar days, pointer handlers and keyboard activation.
  const day = preview.locator('.calendar-section:not(.calendar-month-preview) > .calendar-days-grid > button').first();
  await day.click();
  assert.equal(await page.getByLabel('Элемент', {exact:true}).inputValue(), 'day');
  assert.equal(await day.getAttribute('data-design-selected'), '');
  await day.press('Enter');
  assert.equal(await preview.getByRole('dialog').count(), 0);
  await preview.locator('[data-site-element="settings"]').click();
  assert.equal(await preview.getByRole('dialog').count(), 0);
  await page.getByLabel('Ширина', { exact: true }).fill('60');
  await preview.locator('[data-site-element="settings"]').evaluate(element => new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (Math.round(element.getBoundingClientRect().width) === 60) { clearInterval(timer); resolve(); }
      else if (Date.now() - start > 5000) { clearInterval(timer); reject(new Error('Preview width did not update')); }
    }, 50);
  }));
  await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).click();
  await page.getByText('Черновик сохранён в облаке.', { exact: true }).waitFor();
  assert.equal(draft.mobile.elements.settings.width, 60);
  assert.equal(live.mobile.elements.settings, undefined);
  await page.getByRole('button', {name:'+ Добавить кнопку',exact:true}).click();
  await page.getByLabel('Название кнопки',{exact:true}).fill('Помощь');
  await page.getByLabel('Переход по кнопке',{exact:true}).fill('/privacy.html');
  await preview.locator('[data-site-buttons="header"]').getByRole('link',{name:'Помощь',exact:true}).waitFor();
  await page.getByLabel('Расположение кнопки',{exact:true}).selectOption('bottom');
  const customLink = preview.getByRole('link',{name:'Помощь',exact:true});
  await customLink.waitFor();
  assert.equal(await customLink.getAttribute('href'),'/privacy.html');
  await customLink.click();
  assert.equal(new URL(page.frames()[1].url()).pathname,'/','inspection must not follow custom links');
  assert.equal(live.buttons,undefined,'new button stays unpublished in draft');
  await page.getByLabel('Цвет элемента',{exact:true}).fill('#123456');
  await page.getByRole('button',{name:'ПК',exact:true}).click();
  assert.equal(await page.getByLabel('Ширина',{exact:true}).inputValue(),'');
  assert.equal(await page.evaluate(()=>document.querySelector('iframe').getBoundingClientRect().right<=innerWidth),true,'desktop preview scales to fit');
  await page.getByRole('button',{name:'Телефон',exact:true}).click();
  await page.getByRole('button', { name: 'Опубликовать', exact: true }).click();
  await page.getByText(/^Опубликовано\./).waitFor();
  assert.equal(live.mobile.elements.settings.width, 60);
  assert.equal(live.buttons[0].label,'Помощь');
  const publicPage = await context.newPage();
  await publicPage.setViewportSize({ width: 390, height: 844 });
  await publicPage.goto('http://calendar.test/');
  await publicPage.waitForFunction(() => {
    const button = document.querySelector('[data-site-element="settings"]');
    return button && Math.round(button.getBoundingClientRect().width) === 60;
  });
  const publishedLink = publicPage.getByRole('link',{name:'Помощь',exact:true});
  await publishedLink.waitFor();
  assert.equal(await publishedLink.getAttribute('href'),'/privacy.html');
  assert.equal(await publishedLink.evaluate(node=>getComputedStyle(node).backgroundColor),'rgb(18, 52, 86)');
  await publishedLink.click();
  assert.equal(new URL(publicPage.url()).pathname,'/privacy.html');
  await publicPage.goto('http://calendar.test/');
  const adminLink = publicPage.getByRole('link',{name:'Админ-панель',exact:true});
  await adminLink.waitFor();
  assert.equal(await adminLink.getAttribute('href'),'/admin.html');
  assert.equal(await adminLink.getAttribute('target'),null,'calendar entry must reuse the current session in the same tab');
  for (const width of [320,390,1440]) {
    await publicPage.setViewportSize({width,height:844});
    assert.equal(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`owner header fits at ${width}px`);
  }
  await publicPage.screenshot({path:'tests/admin-calendar-entry.png'});
  await adminLink.click();
  await publicPage.getByRole('heading',{name:'Пользователи',exact:true}).waitFor();
  assert.equal(new URL(publicPage.url()).pathname,'/admin.html');
  await publicPage.close();
  await page.getByRole('button',{name:'Проверить приложение',exact:true}).click();
  await customLink.click();
  await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.location.pathname==='/privacy.html');
  await page.getByRole('button',{name:'Редактирование',exact:true}).click();
  // Returning from a navigated preview must restore the editable app.
  await preview.locator('[data-site-element="settings"]').waitFor();
  await page.getByLabel('Элемент',{exact:true}).selectOption('settings');
  await page.getByRole('button', { name: 'ПК', exact: true }).click();
  assert.equal(await page.getByLabel('Ширина', { exact: true }).inputValue(), '');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Телефон', exact: true }).click();
  await preview.locator('[data-site-element="settings"]').tap({timeout:5000});
  assert.equal(await preview.getByRole('dialog').count(),0,'touch inspection does not open settings');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(await page.evaluate(()=>document.querySelector('iframe').getBoundingClientRect().right<=innerWidth),true,'phone preview fits without scrolling sideways');
  await page.screenshot({ path: 'tests/site-admin-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'tests/site-admin-desktop.png', fullPage: true });
  await page.getByLabel('Элемент',{exact:true}).selectOption(live.buttons[0].id);
  await page.getByRole('button',{name:'Удалить кнопку из черновика',exact:true}).click();
  await customLink.waitFor({state:'detached'});
  await page.getByRole('button',{name:'Отменить',exact:true}).click();
  await customLink.waitFor();
  await page.getByRole('button',{name:'Вернуть',exact:true}).click();
  await customLink.waitFor({state:'detached'});
  assert.equal(live.buttons.length,1,'removing a draft button must not affect the published design');
  await page.getByRole('button',{name:'Отменить',exact:true}).click();
  await customLink.waitFor();
  isAdmin = false;
  await page.reload();
  await page.getByRole('heading',{name:'Нужен доступ к данным пользователей',exact:true}).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Опубликовать', exact: true }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Сохранить черновик', exact: true }).count(), 0);
  await page.goto('http://calendar.test/');
  await page.locator('.dayris-header').waitFor();
  await page.waitForFunction(()=>document.querySelector('style[data-dayris-site-config]'));
  assert.equal(await page.getByRole('link',{name:'Админ-панель',exact:true}).count(),0,'ordinary users do not see the admin entry');
  assert.deepEqual(errors, []);
  console.log('PASS: real iframe preview, independent device configuration, cloud draft/publish protocol and public runtime (mock backend), non-admin controls, mobile layout; no page errors.');
} catch(error) {
  if(checkPage) {
    await checkPage.screenshot({path:'tests/site-admin-failure.png',fullPage:true});
    console.error(await checkPage.evaluate(()=>({scrollY,frame:document.querySelector('iframe')?.getBoundingClientRect().toJSON(),stage:document.querySelector('.admin-stage')?.getBoundingClientRect().toJSON()})));
  }
  throw error;
} finally { await browser.close(); }
