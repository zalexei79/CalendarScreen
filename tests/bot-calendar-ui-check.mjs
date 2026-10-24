import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const { chromium, webkit } = require('playwright');
const bundle = await createRequire(path.resolve('package.json'))('esbuild').build({ entryPoints:['tests/bot-calendar-ui.jsx'], bundle:true,write:false,outfile:'bot.js',format:'iife',define:{'process.env.NODE_ENV':'"production"'} });
const js=bundle.outputFiles.find(x=>x.path.endsWith('.js')).text;
const css=bundle.outputFiles.find(x=>x.path.endsWith('.css')).text;
const projectRequire=createRequire(path.resolve('package.json'));
const utilities=(await projectRequire('postcss')([projectRequire('tailwindcss')({content:['CalendarDayCell.jsx'],corePlugins:{preflight:false}})]).process('@tailwind utilities;',{from:undefined})).css;
assert.doesNotMatch(js,/XAU_IMPULSE_SCALPER|RiskPercent|FastPeriod|StopAtrMultiplier|Параметры бота/,'strategy configuration must not ship in the browser bundle');
fs.mkdirSync('artifacts/bot-calendar',{recursive:true});
for (const [engine,options] of [[chromium,{channel:'msedge',headless:true}],[webkit,{headless:true}]]) {
  const browser=await engine.launch(options);
  try {
    const page=await browser.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install({time:new Date('2026-10-23T12:00:00Z')});
    await page.route('http://dayris.test/**',route=>{
      const file=path.join('public',new URL(route.request().url()).pathname);
      if(file.endsWith('.png')&&fs.existsSync(file))return route.fulfill({contentType:'image/png',body:fs.readFileSync(file)});
      return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0} ${utilities} ${css}</style><div id="root"></div><script>${js}</script></html>`});
    });
    const openMenu=()=>page.getByRole('button',{name:'Меню календаря',exact:true}).click();
    for(const width of [320,390,768,1440]) {
      await page.setViewportSize({width,height:950});
      await page.goto(`http://dayris.test/?calendar=bot&ref=private&width=${width}#private`);
      await page.waitForFunction(()=>!document.querySelector('section[aria-busy="true"]'));
      assert.ok(await page.getByText('457,85',{exact:false}).count()>0);
      assert.equal(await page.getByRole('button',{name:'Предыдущий месяц'}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:'Следующий месяц'}).isDisabled(),true);
      assert.equal(await page.getByRole('button',{name:/^4 октября 2026/}).isDisabled(),true);
      assert.ok(await page.getByRole('button',{name:/^5 октября 2026.*120,40/}).isEnabled());
      assert.ok(await page.getByRole('button',{name:/^24 октября 2026/}).isDisabled());
      assert.equal(await page.locator('.calendar-day-surface').count(),35,'reuse classic DAYRIS cells');
      const milestone=page.locator('[data-milestone=true]');
      assert.equal(await milestone.count(),1);
      assert.match(await milestone.getAttribute('aria-label'),/^5 октября 2026.*Начало учёта/);
      assert.equal(await milestone.locator('.calendar-day-milestone').textContent(),'Начало учёта');
      assert.ok(await page.getByRole('link',{name:'Создать свой календарь',exact:true}).isVisible(),'visible invitation without opening menu');
      assert.doesNotMatch(await page.locator('body').innerText(),/47484897|Spotware|Demo|DEMO|демосч[её]т/);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow at ${width}`);
      assert.ok(await page.locator('.bot-top-create').evaluate(el=>el.getBoundingClientRect().top<150),'create-calendar action belongs in the header');
      await page.screenshot({path:`artifacts/bot-calendar/classic-${engine.name()}-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Скопировать ссылку на календарь'}).click();
      await page.getByText('Ссылка на календарь скопирована',{exact:true}).waitFor();
      assert.deepEqual(await page.evaluate(()=>window.__copyLog),['http://dayris.test/?calendar=bot']);
      await openMenu();
      const cta=page.getByRole('navigation',{name:'Функции календаря'}).getByRole('link',{name:'Создать свой календарь'});
      assert.equal(await cta.getAttribute('href'),'/');assert.ok(await cta.isVisible());
      assert.equal(await page.getByRole('button',{name:'Параметры бота',exact:true}).count(),0);
      await page.keyboard.press('Escape');
      await page.getByRole('button',{name:'Открыть аналитику бота'}).click();
      const analytics=page.getByRole('dialog',{name:'Аналитика бота'});
      await analytics.waitFor();
      await analytics.getByText('Недостаточно данных для оценки',{exact:true}).waitFor();
      assert.equal(await analytics.getByRole('button',{name:'Вся история',exact:true}).getAttribute('aria-pressed'),'true');
      assert.equal(await analytics.locator('.bot-analytics-metrics article').count(),8);
      await analytics.getByRole('button',{name:'Просадка',exact:true}).click();
      await analytics.getByRole('img',{name:'Просадка по закрытым сделкам'}).waitFor();
      await analytics.getByRole('button',{name:'По дням',exact:true}).click();
      await analytics.getByRole('img',{name:'Результат по дням'}).waitFor();
      await analytics.getByRole('slider',{name:'День графика'}).press('Home');
      await analytics.getByText('Начало периода',{exact:true}).waitFor();
      await analytics.getByRole('button',{name:'Период',exact:true}).click();
      await analytics.getByLabel('Начало периода аналитики').fill('2026-10-06');
      await analytics.getByLabel('Конец периода аналитики').fill('2026-10-06');
      await analytics.getByRole('button',{name:'Применить',exact:true}).click();
      await analytics.locator('.bot-analytics-period').filter({hasText:/6 октября 2026 г.*1 сделка/}).waitFor();
      assert.ok((await analytics.locator('.bot-chart-title').innerText()).includes('24,35'));
      await page.screenshot({path:`artifacts/bot-calendar/analytics-${engine.name()}-${width}.png`,fullPage:true});
      await analytics.getByRole('button',{name:'Закрыть аналитику'}).click();
      await page.getByRole('button',{name:/^5 октября 2026.*120,40/}).click();
      await page.locator('.bot-trades article').first().waitFor();
      assert.equal(await page.locator('.bot-trades article').count(),2);
      assert.equal(await page.getByLabel('Начало периода').inputValue(),'2026-10-05');
      assert.equal(await page.getByLabel('Конец периода').inputValue(),'2026-10-05');
      assert.ok(await page.getByRole('button',{name:'Выбранный период',exact:true}).getAttribute('aria-pressed')==='true');
      await page.getByRole('button',{name:'Вся история',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.bot-trades article').length===100);
      assert.ok((await page.locator('.bot-history-caption').innerText()).includes('105 сделок'));
      assert.equal(await page.locator('.bot-history-totals strong').first().textContent(),'105');
      await page.getByRole('button',{name:'Следующие сделки'}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.bot-trades article').length===5);
      assert.equal(await page.getByRole('button',{name:'Следующие сделки'}).isDisabled(),true);
      assert.equal(await page.locator('.bot-history-totals strong').first().textContent(),'105','total independent of pagination');
      await page.getByRole('button',{name:'Выбранный период',exact:true}).click();
      await page.getByLabel('Начало периода').fill('2026-10-06');
      await page.getByLabel('Конец периода').fill('2026-10-06');
      await page.getByRole('button',{name:'Показать',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.bot-trades article').length===1);
      assert.equal(await page.locator('.bot-history-totals strong').first().textContent(),'1');
      assert.ok((await page.locator('.bot-history-totals').innerText()).includes('24,35'));
      await page.screenshot({path:`artifacts/bot-calendar/classic-${engine.name()}-${width}-history.png`,fullPage:true});
      await page.getByLabel('Начало периода').fill('2026-10-22');
      await page.getByLabel('Конец периода').fill('2026-10-05');
      await page.getByRole('button',{name:'Показать',exact:true}).click();
      await page.getByRole('alert').waitFor();
      await page.getByLabel('Начало периода').fill('2026-10-07');
      await page.getByLabel('Конец периода').fill('2026-10-07');
      await page.getByRole('button',{name:'Показать',exact:true}).click();
      await page.getByText('В выбранном периоде нет закрытых сделок.').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(),0);
      await openMenu();await page.getByRole('button',{name:'История',exact:true}).click();
      await page.waitForFunction(()=>document.querySelectorAll('.bot-trades article').length===100);
      assert.equal(await page.getByRole('button',{name:'Вся история',exact:true}).getAttribute('aria-pressed'),'true');
      await page.getByRole('button',{name:'Закрыть историю'}).click();
      await page.getByRole('button',{name:'История за месяц'}).click();
      await page.locator('.bot-trades article').first().waitFor();
      assert.equal(await page.getByLabel('Начало периода').inputValue(),'2026-10-05');
      assert.equal(await page.getByLabel('Конец периода').inputValue(),'2026-10-23');
      await page.getByRole('button',{name:'Закрыть историю'}).click();
      assert.equal(await page.getByRole('button',{name:/Удалить|Добавить|Редактировать|Настройки/}).count(),0);
      assert.ok((await page.evaluate(()=>window.__botRequests)).every(r=>['get_bot_calendar','get_bot_calendar_history','get_bot_calendar_analytics'].includes(r.name)));
    }
    for(const state of ['pending','delayed','error']) {
      await page.goto(`http://dayris.test/?state=${state}`);
      if(state==='pending') {
        await page.getByText('История появится после первой синхронизации.').waitFor();
        await openMenu();assert.equal(await page.getByRole('button',{name:'История',exact:true}).isDisabled(),true);
        assert.equal(await page.locator('.bot-metrics strong').first().textContent(),'—');
      } else if(state==='delayed') await page.getByText(/Обновление задерживается/).waitFor();
      else { await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'Повторить'}).click();await page.getByRole('button',{name:/^5 октября 2026.*120,40/}).waitFor(); }
    }
    for(const native of ['success','abort','fail']) {
      await page.goto(`http://dayris.test/?native=${native}`);
      await openMenu();await page.getByRole('button',{name:'Поделиться календарём',exact:true}).click();
      assert.deepEqual(await page.evaluate(()=>window.__shareLog),[{title:'Календарь бота · DAYRIS',url:'http://dayris.test/?calendar=bot'}]);
      assert.deepEqual(await page.evaluate(()=>window.__copyLog),[],'native cancel never copies or claims success');
      if(native==='fail') await page.getByRole('dialog',{name:'Ссылка на календарь'}).waitFor();
      else assert.equal(await page.getByRole('dialog').count(),0);
    }
    for(const [width,height] of [[320,568],[390,844],[1440,900]]) {
      await page.setViewportSize({width,height});
      await page.goto(`http://dayris.test/?milestone=${width}`);
      await page.waitForFunction(()=>!document.querySelector('section[aria-busy="true"]'));
      const geometry=await page.locator('[data-milestone=true]').evaluate(cell=>{
        const badge=cell.querySelector('.calendar-day-milestone').getBoundingClientRect();
        const amount=cell.querySelector('.day-amount').getBoundingClientRect();
        const count=cell.querySelector('.bot-cell-count').getBoundingClientRect();
        const box=cell.getBoundingClientRect();
        return {badgeFits:badge.left>=box.left&&badge.right<=box.right&&badge.bottom<=box.bottom,
          countFits:count.bottom<=box.bottom-2,badgeBeforeAmount:badge.bottom<=amount.top+1,
          badgeBottom:badge.bottom-box.top,amountTop:amount.top-box.top,cellHeight:box.height};
      });
      assert.ok(geometry.badgeFits&&geometry.countFits&&geometry.badgeBeforeAmount,`milestone must not overlap or crop real results at ${width}x${height}: ${JSON.stringify(geometry)}`);
      await page.screenshot({path:`artifacts/bot-calendar/milestone-${engine.name()}-${width}x${height}.png`,fullPage:true});
    }
    await page.goto('http://dayris.test/?qualified=1');
    await page.getByRole('button',{name:'Открыть аналитику бота'}).click();
    await page.getByRole('dialog',{name:'Аналитика бота'}).waitFor();
    assert.match(await page.locator('.bot-score-ring strong').textContent(),/^\d+$/);
    await page.getByText('Как считается скор',{exact:true}).click();
    assert.equal(await page.locator('.bot-score-explanation>div').count(),4);
    await page.keyboard.press('Escape');
    await page.goto('http://dayris.test/?analytics_error=1');
    await page.getByRole('button',{name:'Повторить аналитику'}).click();
    await page.getByRole('button',{name:'Открыть аналитику бота'}).waitFor();
    await page.goto('http://dayris.test/?analytics_empty=1');
    await page.getByRole('button',{name:'Открыть аналитику бота'}).click();
    await page.getByText('В выбранном периоде нет закрытых сделок.').waitFor();
    assert.equal(await page.locator('.bot-score-ring strong').textContent(),'—');
    await page.keyboard.press('Escape');
    await page.goto('http://dayris.test/?clipboard=denied');
    await page.getByRole('button',{name:'Скопировать ссылку на календарь'}).click();
    await page.getByRole('dialog',{name:'Ссылка на календарь'}).waitFor();
    assert.equal(await page.getByLabel('Прямая ссылка на календарь').inputValue(),'http://dayris.test/?calendar=bot');
    assert.equal(await page.getByText('Ссылка на календарь скопирована',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
    console.log(`${engine.name()}: classic calendar at 320/390/768/1440, private metadata absent, range/all totals and pagination, copy/native share success/cancel/failure passed`);
  } finally { await browser.close(); }
}
