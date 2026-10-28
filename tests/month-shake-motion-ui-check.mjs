import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const engine=process.env.DAYRIS_SHAKE_ENGINE==='webkit'?'webkit':'chromium';
const source=fs.readFileSync('tests/gold-theme-ui-check.mjs','utf8');
let setup=source.slice(0,source.indexOf(' for(const width of [320,390,1280])'))
 .replace("'./life-story-auth-fixture.mjs'",JSON.stringify(pathToFileURL(path.resolve('tests/life-story-auth-fixture.mjs')).href))
 .replace('page.setDefaultTimeout(10000)','page.setDefaultTimeout(30000)')
 .replace(' const page=await context.newPage()'," await context.route('**/rest/v1/reminders**',route=>route.fulfill({contentType:'application/json',body:'[]'})); const page=await context.newPage()");
if(engine==='webkit')setup=setup.replace('const {chromium}=','const {webkit}=').replace("chromium.launch({channel:'msedge',headless:true})",'webkit.launch({headless:true})');
const finish=`
 fs.mkdirSync('artifacts/month-motion',{recursive:true});
 const request=direction=>page.locator('.calendar-section').evaluate((el,direction)=>el.dispatchEvent(new CustomEvent('dayris-calendar-step',{cancelable:true,detail:{direction}})),direction);
 const pose=progress=>page.locator('.calendar-section').evaluate((el,progress)=>{
  for(const animation of el.getAnimations({subtree:true})) {
   if(animation.constructor.name==='CSSTransition') { animation.pause();animation.currentTime=animation.effect.getTiming().duration*progress; }
  }
 },progress);
 const rects=selector=>page.locator(selector).evaluateAll(cells=>cells.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
 const records=await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222'));
 for(const theme of ['gold','emerald']) {
  if(theme==='emerald') {
   await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.clock.runFor(400);
   await page.getByRole('button',{name:'Изумрудное',exact:true}).click();await page.clock.runFor(450);
   await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.clock.runFor(400);
  }
  for(const width of ${JSON.stringify(engine==='webkit'?[390]:[390,1280])}) {
   await page.setViewportSize({width,height:width<640?844:950});await page.clock.runFor(700);
   await page.screenshot({path:'artifacts/month-motion/'+theme+'-${engine}-'+width+'-before.png',animations:'disabled'});
   for(const direction of ['next','prev']) {
    assert.equal(await request(direction),false,'The calendar owns the transition request');
    await page.clock.runFor(64);
    const surface=page.locator('.calendar-section');
    assert.equal(await surface.getAttribute('data-calendar-step-motion'),direction);
    assert.equal(await page.locator('.calendar-month-preview').count(),1);
    assert.equal(await page.locator('.calendar-month-preview').getAttribute('aria-hidden'),'true');
    await pose(.4);await page.clock.runFor(16);
    const x=await surface.evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41);
    assert.ok(Math.abs(x)>5&&Math.abs(x)<width-1,'A real intermediate page position exists');
    assert.ok(direction==='next'?x<0:x>0,'Travel follows month direction');
    await request(direction==='next'?'prev':'next');
    assert.equal(await surface.getAttribute('data-calendar-step-motion'),direction,'A busy transition cannot reverse or skip a month');
    await page.screenshot({path:'artifacts/month-motion/'+theme+'-${engine}-'+width+'-'+direction+'-middle.png'});
    await pose(1);await page.clock.runFor(16);
    const landing=await rects('.calendar-month-preview .calendar-day-surface');
    await page.clock.runFor(650);
    assert.equal(await page.locator('.calendar-month-preview').count(),0);
    assert.equal(await page.locator('[data-calendar-step-motion]').count(),0);
    const resting=await rects('.calendar-section > .calendar-days-grid > .calendar-day-surface');
    assert.equal(landing.length,resting.length);
    const seam=Math.max(...resting.flatMap((r,i)=>['x','y','width','height'].map(key=>Math.abs(r[key]-landing[i][key]))));
    console.log(JSON.stringify({theme,engine:'${engine}',width,direction,seam,landing:landing[0],resting:resting[0]}));
    assert.ok(seam<=2,'Incoming preview and resting month must meet without a geometry jump');
    assert.equal(await page.locator('.calendar-section').evaluate(el=>getComputedStyle(el).animationName),'none','No second entrance after the page has landed');
    await page.screenshot({path:'artifacts/month-motion/'+theme+'-${engine}-'+width+'-'+direction+'-after.png',animations:'disabled'});
   }
  }
 }
 await request('next');await page.clock.runFor(64);
 await page.getByRole('button',{name:'Настройки',exact:true}).click();await page.clock.runFor(800);
 await page.getByRole('button',{name:'Октябрь',exact:true}).waitFor();
 await page.getByRole('button',{name:'Закрыть настройки',exact:true}).click();await page.clock.runFor(400);
 assert.equal(await page.locator('.calendar-month-preview').count(),0,'Opening a form cancels a pending transition');
 await request('next');await page.clock.runFor(64);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(800);await page.getByRole('button',{name:'Октябрь',exact:true}).waitFor();
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(32);
 await request('next');await page.clock.runFor(32);
 await page.getByRole('button',{name:'Ноябрь',exact:true}).waitFor();
 assert.equal(await page.locator('.calendar-month-preview').count(),0,'Reduced motion navigates immediately');
 assert.equal(await page.evaluate(()=>localStorage.getItem('money_calendar_trades_22222222-2222-4222-8222-222222222222')),records);
 assert.deepEqual(errors,[]);
 console.log('PASS ${engine}: two-page motion, both directions, five/six rows, no seam, no replay, cancellation, reduced motion and unchanged records.');
} finally {await browser.close();}
`;
await import('data:text/javascript;base64,'+Buffer.from(setup+finish).toString('base64')).catch(error=>{console.error(error.message);process.exitCode=1;});
