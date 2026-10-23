import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium, webkit } = require('playwright');
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({ entryPoints:['tests/bot-calendar-ui.jsx'], bundle:true,write:false,outfile:'bot.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'} });
const js=bundle.outputFiles.find(x=>x.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(x=>x.path.endsWith('.css')).text;
fs.mkdirSync('artifacts/bot-calendar',{recursive:true});
for (const [engine,options] of [[chromium,{channel:'msedge',headless:true}],[webkit,{headless:true}]]) {
  const browser=await engine.launch(options);
  try {
    const page=await browser.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-10-23T12:00:00Z')});
    await page.route('http://dayris.test/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0} ${css}</style><div id="root"></div><script>${js}</script></html>`}));
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:950});
      await page.goto('http://dayris.test/?calendar=bot');
      await page.getByRole('button',{name:'История',exact:true}).waitFor();
      await page.waitForFunction(()=>!document.querySelector('section[aria-busy="true"]'));
      const cta=page.getByRole('link',{name:'Создать свой календарь'});
      assert.equal(await cta.getAttribute('href'),'/');
      assert.ok(await cta.isVisible());
      assert.ok(await page.getByText('457,85',{exact:false}).count()>0);
      assert.equal(await page.getByRole('button',{name:'Предыдущий месяц'}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Следующий месяц'}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:/^4 октября 2026/}).isDisabled(),true);
      assert.ok(await page.getByRole('button',{name:/5 октября 2026.*120,40/}).isEnabled());
      assert.ok(await page.getByRole('button',{name:/24 октября 2026/}).isDisabled());
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
      const pnl=page.locator('.bot-day-pnl').first();
      assert.ok(await pnl.evaluate(el=>el.scrollWidth<=el.clientWidth+1),`pnl clipped at ${width}`);
      await page.screenshot({path:`artifacts/bot-calendar/${engine.name()}-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Параметры бота',exact:true}).click();
      await page.getByRole('dialog',{name:'Параметры бота'}).waitFor();
      await page.getByText('XAU_IMPULSE_SCALPER',{exact:true}).waitFor();
      assert.equal(await page.locator('.bot-settings-group dt').count(),14);
      assert.equal(await page.getByText('0.25',{exact:true}).count(),1);
      assert.equal(await page.getByText('07:00 UTC',{exact:true}).count(),1);
      assert.equal(await page.getByText('20:00 UTC',{exact:true}).count(),1);
      await page.screenshot({path:`artifacts/bot-calendar/${engine.name()}-${width}-parameters.png`,fullPage:true});
      await page.getByRole('button',{name:'Закрыть параметры'}).click();
      await page.getByRole('button',{name:/5 октября 2026.*120,40/}).click();
      await page.getByRole('dialog').waitFor();
      await page.getByText('XAUUSD').first().waitFor();
      assert.equal(await page.locator('.bot-trades article').count(),2);
      assert.equal(await page.getByRole('dialog').getByText('Buy',{exact:false}).count(),1);
      assert.equal(await page.getByRole('dialog').getByText('Sell',{exact:false}).count(),1);
      assert.equal(await page.getByRole('button',{name:/Удалить|Добавить|Редактировать|Синхронизация/}).count(),0);
      await page.screenshot({path:`artifacts/bot-calendar/${engine.name()}-${width}-history.png`,fullPage:true});
      await page.getByRole('button',{name:'Все дни месяца'}).click();
      await page.getByRole('dialog').getByRole('button',{name:/22 октября/}).click();
      await page.locator('.bot-trades article').first().waitFor();
      assert.equal(await page.locator('.bot-trades article').count(),100);
      await page.getByRole('button',{name:'Далее',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.bot-trades article').length===2);
      assert.equal(await page.getByRole('button',{name:'Далее',exact:true}).isDisabled(),true);
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(),0);
      await page.getByRole('button',{name:'История',exact:true}).click();
      assert.equal(await page.getByRole('heading',{name:/октябрь 2026/}).count(),2);
      await page.getByRole('button',{name:'Закрыть историю'}).click();
      assert.ok((await page.evaluate(()=>window.__botRequests)).every(r=>['get_bot_calendar','get_bot_calendar_day'].includes(r.name)));
    }
    for(const state of ['pending','delayed','error']) {
      await page.goto(`http://dayris.test/?state=${state}`);
      if(state==='pending') {
        await page.getByText('История появится после первой синхронизации счёта.').waitFor();
        assert.equal(await page.getByRole('button',{name:'История',exact:true}).isDisabled(),true);
        assert.equal(await page.locator('.bot-metrics strong').first().textContent(),'—');
      } else if(state==='delayed') await page.getByText('Обновление задерживается').waitFor();
      else { await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Повторить'}).click();await page.getByRole('button',{name:/5 октября 2026.*120,40/}).waitFor(); }
    }
    assert.deepEqual(errors,[]);
    console.log(`${engine.name()}: 320/390/768/1440, CTA, daily history, pagination, cutoff, read-only and pending/error/delayed states passed`);
  } finally { await browser.close(); }
}
