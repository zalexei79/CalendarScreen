import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { installStoryAccount } from './life-story-auth-fixture.mjs';
import { selectBirthday } from './birthday-test-helper.mjs';
const require=createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const browser=await require('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  for(const [code,language,label,amethyst,january] of [
    ['ru','Русский','Дата рождения','Аметист','Январь (01)'],
    ['uk','Українська','Дата народження','Аметист','Січень (01)'],
    ['en','English','Date of birth','Amethyst','January (01)'],
    ['md','Română','Data nașterii','Ametist','Ianuarie (01)'],
    ['zh-CN','简体中文','出生日期','紫水晶','一月 (01)'],
  ]) {
    const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await context.addInitScript(()=>{localStorage.setItem('atj_language','ru');localStorage.setItem('atj_theme','dark');localStorage.setItem('calendar_guide_completed','1');});
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin!=='http://calendar.test')return route.abort();
      const file=path.resolve('dist',url.pathname==='/'?'index.html':'.'+url.pathname);
      if(!file.startsWith(path.resolve('dist')+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html',body:fs.readFileSync(file)});
    });
    await installStoryAccount(context);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-10-07T12:00:00')});
    await page.goto('http://calendar.test/');await page.clock.pauseAt(new Date('2026-10-07T13:00:00'));
    await page.getByRole('button',{name:new RegExp(language)}).click();
    await page.getByRole('button',{name:amethyst,exact:true}).click();await page.clock.runFor(700);
    assert.equal(await page.locator('html').getAttribute('data-dayris-theme'),'purple');
    await page.screenshot({path:`tests/amethyst-onboarding-${code}.png`,animations:'disabled'});
    await page.getByRole('button',{name:/MDL/}).click();await page.clock.runFor(300);
    assert.equal(await page.locator('#life-birthday legend').innerText(),label);
    assert.equal(await page.locator('.birthday-month select').locator('option[value="01"]').innerText(),january);
    if(!['ru','uk'].includes(code))assert.doesNotMatch(await page.getByRole('dialog').innerText(),/[А-Яа-яЁё]/,'No Russian copy remains after language selection');
    assert.equal(await page.locator('.birthday-year select option[value="2026"]').count(),0);await page.locator('.life-birthday-card').evaluate(form=>form.requestSubmit());
    assert.ok(await page.getByRole('alert').count()>0,'A birth year below the minimum age is rejected');
    await selectBirthday(page,'2000-02-29');
    await page.locator('.birthday-year select').selectOption('2001');
    assert.equal(await page.locator('.birthday-day select').inputValue(),'','A nonexistent leap day is cleared instead of changing the birthday');
    await selectBirthday(page,'2000-02-29');
    assert.equal(await page.getByRole('alert').count(),0);
    for(const width of [320,390]){
      await page.setViewportSize({width,height:844});await page.clock.runFor(300);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      const boxes=await page.locator('#life-birthday select').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().toJSON()));
      assert.ok(boxes.every(box=>box.x>=0 && box.x+box.width<=width && box.height>=44));
    }
    await page.screenshot({path:`tests/birthday-localized-${code}.png`,animations:'disabled'});
    assert.deepEqual(errors,[]);await context.close();
  }
  console.log('PASS: RU/EN/RO/ZH onboarding, localized birth fields/months, amethyst names, future/leap validation and narrow screens.');
} finally {await browser.close();}
