import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const local=createRequire(path.resolve('package.json'));
const runtime=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE || 'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle=await local('esbuild').build({entryPoints:['tests/workspace-panel-ui.jsx'],bundle:true,write:false,outfile:'header.js',format:'iife',loader:{'.svg':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{"VITE_SUPABASE_URL":"https://local-test.supabase.co","VITE_SUPABASE_ANON_KEY":"test-anon-key"}'}});
const js=bundle.outputFiles.find(file=>file.path.endsWith('.js')).text;
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^main-.*\.css$/.test(file))),'utf8');
const browser=await runtime('playwright').chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage(),errors=[];
  await page.addInitScript(()=>{const ownerId='123e4567-e89b-42d3-a456-426614174000';localStorage.setItem('dayris_activity_streak:'+ownerId,JSON.stringify({ownerId,_accountSynced:true,currentStreak:18,lastActiveDate:'2026-11-01',paused:true}));});
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(8000);
  await page.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://navigation.test')return route.abort();
    const file=path.resolve('public','.'+url.pathname);
    if(file.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':'image/svg+xml'});
    return route.fulfill({contentType:'text/html',body:`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${js}</script>`});
  });
  const dimensions=()=>page.evaluate(()=>{
    const root=document.querySelector('.dayris-date-navigation'),box=document.querySelector('.dayris-header').getBoundingClientRect();
    const items=['[data-site-element="previous"]','.dayris-month-title','[data-site-element="next"]','.calendar-currency','.dayris-today-action'].map(selector=>{const r=root.querySelector(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,centerY:r.y+r.height/2};});
    const month=document.querySelector('.dayris-month-trigger'),year=document.querySelector('.dayris-year-trigger');
    const flame=document.querySelector('.activity-streak').getBoundingClientRect(),title=document.querySelector('.dayris-month-title').getBoundingClientRect();
    const actions=document.querySelector('.dayris-header-actions').getBoundingClientRect();
    return {height:box.height,top:box.top,bottom:box.bottom,items,headerHeight:box.height,flameY:flame.y+flame.height/2,titleY:title.y+title.height/2,flameLeft:flame.left,flameRight:flame.right,actionsLeft:actions.left,actionsY:actions.y+actions.height/2,
      overflow:document.documentElement.scrollWidth>innerWidth,
      clippedMonth:month.scrollWidth>month.clientWidth+1,
      monthRight:month.getBoundingClientRect().right,yearLeft:year.getBoundingClientRect().left,yearRight:year.getBoundingClientRect().right};
  });
  const cases=['dark','light','purple','gold','emerald'].flatMap(theme=>[320,390,1280].map(width=>[theme,width,'ru','pro']));
  cases.push(...['en','uk','md','zh-CN'].flatMap(language=>[320,390].map(width=>['gold',width,language,'pro'])));
  cases.push(['dark',320,'en','free'],['light',390,'uk','free']);
  cases.push(['gold',960,'md','pro'],['dark',1024,'en','pro'],['dark',360,'ru','pro']);
  const arrowsOnly=process.argv.includes('--arrows-only');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [theme,width,language,mode] of (arrowsOnly?cases.filter(([theme,width,language])=>['dark','gold','emerald'].includes(theme)&&(language==='ru'||width===320||width>=960)):cases)){
    await page.setViewportSize({width,height:844});
    await page.goto(`http://navigation.test/header?preview&current&user&theme=${theme}&language=${language}&mode=${mode}${theme==='light'?'&light':''}`);
    await page.locator('.dayris-month-trigger').waitFor();
    await page.locator('.activity-streak-pause').waitFor();
    await page.mouse.move(1,800);
    const originalMonth=await page.locator('.dayris-month-label > span:not(.dayris-month-outgoing)').textContent(),originalYear=await page.locator('.dayris-year-trigger').textContent();
    const original=await dimensions();
    assert.ok(original.height<=108,`compact header: ${theme}/${width}/${language}`);
    if(width>=960)assert.ok(Math.abs(original.titleY-original.flameY)<=5,'desktop keeps the full streak beside the brand');
    else{
      assert.ok(Math.abs(original.flameY-original.titleY)<3&&Math.abs(original.items[3].centerY-original.actionsY)<3,'date and streak lead above the utility toolbar');
      assert.ok(original.items[2].right+2<=original.flameLeft&&original.items[3].right<=original.items[4].left&&original.items[4].right+4<=original.actionsLeft,JSON.stringify({check:'date, Today and toolbar controls do not collide',theme,width,language,original}));
      assert.equal(await page.locator('.activity-streak-value').isVisible(),false);assert.equal(await page.locator('.activity-streak-pause-label').isVisible(),false);assert.equal(await page.locator('.activity-streak-count').textContent(),'18');
      assert.equal(await page.locator('.dayris-today-action > span').isVisible(),true,'Today always has a readable text label');
      for(const control of await page.locator('.home-friends-button,[data-site-element="settings"]').all()){const box=await control.boundingBox();assert.ok(box.width>=40&&box.height>=44,'quiet icons retain comfortable touch targets');}
      for(const control of await page.locator('.dayris-month-step').all())assert.equal(await control.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)','theme does not turn navigation into oversized pills');
    }
    await page.locator('.activity-streak').click();assert.equal(await page.evaluate(()=>handoffs.at(-1).kind),'streak','compact status still opens its details');
    for(let step=0;step<13;step++){
      if(step)await page.locator('[data-site-element="next"]').click();
      const layout=await dimensions(),context=`${theme}/${width}/${language}/${step}`;
      assert.equal(layout.overflow,false,`page fits: ${context}`);
      assert.equal(layout.clippedMonth,false,`full month name fits: ${context}`);
      assert.equal(layout.height,original.height,`row height stable: ${context}`);
      assert.equal(layout.headerHeight,original.headerHeight,`calendar stays in place: ${context}`);
      assert.ok(layout.yearLeft>=layout.monthRight-1,`month/year do not overlap: ${context}`);
      assert.ok(Math.abs(layout.items[0].centerY-layout.items[1].centerY)<4&&Math.abs(layout.items[2].centerY-layout.items[1].centerY)<4,`month arrows share the date line: ${context}`);
      assert.ok(layout.items[0].right<=layout.items[1].left+1&&layout.items[1].right<=layout.items[2].left+1,`arrows sit either side of date: ${context}`);
      assert.ok(layout.items[2].left-layout.yearRight<=8,`next arrow stays close to the year: ${context}`);
      layout.items.forEach((item,index)=>{
        assert.ok(item.top>=layout.top&&item.bottom<=layout.bottom,`one row: ${context}`);
        if(width<960&&index>=3)assert.equal(item.left,original.items[index].left,`currency and Today stay anchored: ${context}`);
      });
      if(step===1&&language==='ru'&&(width<=390||theme==='gold')){
        await page.locator('.dayris-header').screenshot({path:`artifacts/compact-month-${theme}-${width}.png`});
      }
    }
    await page.locator('[data-site-element="previous"]').click();
    await page.locator('[data-site-element="today"]').click();
    assert.equal(await page.locator('.dayris-today-action').getAttribute('data-current'),'true');
    assert.equal(await page.locator('.dayris-month-label > span:not(.dayris-month-outgoing)').textContent(),originalMonth);
    assert.equal(await page.locator('.dayris-year-trigger').textContent(),originalYear);
  }
  // Interactive menus and motion in the exact Gold phone layout from the report.
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://navigation.test/header?preview&current&user&mode=pro&theme=gold');
  await page.locator('.dayris-month-trigger').click();
  await page.locator('.calendar-picker-options [data-month="8"]').click();
  await page.locator('.dayris-year-trigger').click();
  await page.locator('.calendar-picker-options [data-year]').first().click();
  await page.locator('.calendar-currency-trigger').click();
  await page.locator('.calendar-currency-option').filter({hasText:'MDL'}).click();
  assert.equal(await page.locator('.calendar-currency-trigger > span').textContent(),'MDL');
  await page.locator('[data-site-element="today"]').click();
  await page.emulateMedia({reducedMotion:'no-preference'});
  const before=await dimensions();
  await page.locator('[data-site-element="next"]').click();
  const samples=await page.evaluate(()=>new Promise(resolve=>{
    const heights=[],start=performance.now();
    function sample(){heights.push(document.querySelector('.dayris-header').getBoundingClientRect().height);if(performance.now()-start<500)requestAnimationFrame(sample);else resolve(heights);}
    sample();
  }));
  assert.ok(samples.every(height=>height===before.headerHeight),'motion never pushes the calendar down');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const [theme,mode] of (arrowsOnly?[]:[['dark','free'],['dark','pro'],['light','free'],['purple','pro'],['gold','pro'],['emerald','pro']]))for(const width of [390,1280])for(const [year,month,weeks] of [[2027,1,4],[2026,11,5],[2026,2,6]]){
    const height=width===390?844:900;
    await page.setViewportSize({width,height});
    await page.goto(`http://navigation.test/header?preview&current&user&dock&mode=${mode}&theme=${theme}&year=${year}&month=${month}${theme==='light'?'&light':''}`);
    await page.waitForFunction(()=>Boolean(document.querySelector('.calendar-section')?.style.getPropertyValue('--calendar-row-height')));
    await page.waitForFunction(()=>{const grid=document.querySelector('.calendar-days-grid').getBoundingClientRect(),dock=document.querySelector('.history-fab').getBoundingClientRect();return grid.bottom<=dock.top;});
    const fit=await page.evaluate(()=>{const grid=document.querySelector('.calendar-days-grid'),box=grid.getBoundingClientRect(),dock=document.querySelector('.history-fab').getBoundingClientRect();return {gap:dock.top-box.bottom,count:grid.children.length,cellHeight:grid.children[0].getBoundingClientRect().height,width:box.width};});
    assert.equal(fit.count,weeks*7);
    assert.ok(fit.cellHeight>=56);
    assert.ok(fit.gap>=10&&fit.gap<=(['gold','emerald'].includes(theme)?46:14),JSON.stringify({check:'month fills available space above dock',theme,mode,width,weeks,fit}));
    assert.ok(fit.width>=width-(width===390?36:80),'calendar uses full content width');
    if(theme==='dark'&&mode==='free'&&weeks===5)await page.screenshot({path:`artifacts/calendar-full-height-dark-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: compact header with date beside flame, all months, year rollover, five themes/locales, phone/desktop, FREE/PRO, readable labels, date/currency menus, Today and reduced motion');
} finally {await browser.close();}
