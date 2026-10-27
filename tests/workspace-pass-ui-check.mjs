import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const require=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||'C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json');
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({entryPoints:['tests/workspace-panel-ui.jsx'],bundle:true,write:false,outfile:'pass.js',format:'iife',loader:{'.svg':'dataurl'},define:{'process.env.NODE_ENV':'"production"','import.meta.env':'{"VITE_SUPABASE_URL":"https://local-test.supabase.co","VITE_SUPABASE_ANON_KEY":"test-anon-key"}'}});
const js=bundle.outputFiles.find(f=>f.path.endsWith('.js')).text;
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(f=>/^main-.*\.css$/.test(f))),'utf8');
const browser=await (process.env.DAYRIS_TEST_WEBKIT?require('playwright').webkit.launch({headless:true}):require('playwright').chromium.launch({channel:'msedge',headless:true}));
const rgb=value=>value.startsWith('#') ? (value.slice(1).length===8 ? value.slice(1).match(/../g).map((n,i)=>parseInt(n,16)/(i===3?255:1)) : value.slice(1).match(/../g).map(n=>parseInt(n,16))) : value.match(/[\d.]+/g).map(Number);
const luminance=color=>rgb(color).slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const values=[luminance(a),luminance(b)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);};
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://pass.test/**',route=>{
  const name=new URL(route.request().url()).pathname;
  if(name.startsWith('/brand-')&&fs.existsSync(path.resolve('public','.'+name)))return route.fulfill({contentType:'image/png',body:fs.readFileSync(path.resolve('public','.'+name))});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style><div id="root"></div><script>'+js+'</script>'});
 });
 const pass=page.locator('.workspace-pass'),toggle=pass.locator('.workspace-mode-toggle'),info=pass.locator('.workspace-pro-info');
 const settle=()=>pass.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
 for(const width of [320,390,1280])for(const language of ['ru','en','uk','md','zh-CN'])for(const light of [false,true]){
  await page.setViewportSize({width,height:844});await page.goto(`http://pass.test/header?preview&mode=free&language=${language}${light?'&light':''}`);await pass.waitFor();
  await page.locator('.activity-streak-value').evaluate(el=>el.textContent='10 дн.');
  assert.equal(await toggle.getAttribute('aria-checked'),'false');assert.equal(await info.isVisible(),true,'features can be opened without switching to PRO');
  const freeFace=await pass.locator('.workspace-pass-face').evaluate(el=>getComputedStyle(el).backgroundImage);
  const initial=await pass.boundingBox();await info.click();await page.waitForFunction(()=>document.querySelector('#state').textContent==='main/false/true');
  await toggle.click();await page.waitForFunction(()=>document.querySelector('.workspace-mode-toggle').getAttribute('aria-checked')==='true');await settle();
  assert.notEqual(await pass.locator('.workspace-pass-face').evaluate(el=>getComputedStyle(el).backgroundImage),freeFace,'the pass material changes, not only the icon');
  assert.equal(await pass.locator('.workspace-pass-label').evaluate(el=>getComputedStyle(el).color),await pass.evaluate(el=>getComputedStyle(el).color),'mode label retains the intended readable metallic color');
  const pro=await pass.boundingBox();assert.equal(pro.width,initial.width,'mode changes do not resize the header');assert.equal(pro.height,initial.height);
  for(const control of [toggle,info]){const b=await control.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=width,'both actions fit the viewport');}
  const settings=await page.locator('[data-site-element="settings"]').boundingBox(),satellite=await info.boundingBox();assert.ok(satellite.x+satellite.width<=settings.x,'satellite does not overlap Settings');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.ok(await page.locator('.dayris-brand-row h1').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'DAYRIS remains fully readable beside the pass');
  assert.equal((await pass.innerText()).match(/PRO/g)?.length,1,'no repeated PRO labels');
  if(width===390&&language==='ru'&&!light)await page.locator('.dayris-brand-row').screenshot({path:'artifacts/orbit-pass-pro-header.png'});
 }
 for(const reducedMotion of ['no-preference','reduce']){
  await page.emulateMedia({reducedMotion});await page.goto('http://pass.test/header?preview&mode=free&language=ru');await pass.waitFor();
  await toggle.focus();await page.keyboard.press('Space');await page.keyboard.press('Space');await page.keyboard.press('Space');
  await page.waitForFunction(()=>document.querySelector('.workspace-mode-toggle').getAttribute('aria-checked')==='true');await settle();
  const active=await info.locator('svg').boundingBox(),activeTarget=await info.boundingBox();await info.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#state').textContent==='main/true/true');
  await toggle.click();await page.waitForFunction(()=>document.querySelector('.workspace-mode-toggle').getAttribute('aria-checked')==='false');await settle();
  const inactive=await info.locator('svg').boundingBox(),inactiveTarget=await info.boundingBox();assert.ok(active.y<inactive.y-8,'satellite moves along its orbit between modes');
  assert.deepEqual(activeTarget,inactiveTarget,'the visible satellite moves inside a fixed touch target');
  if(reducedMotion==='reduce')assert.equal(await pass.evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running').length),0);
 }
 const materials=new Set();
 for(const width of [320,390,1280])for(const theme of ['dark','light','gold','emerald','purple']){
  await page.setViewportSize({width,height:844});await page.goto(`http://pass.test/header?preview&mode=free&language=ru${theme==='light'?'&light':''}`);await pass.waitFor();
  await page.evaluate(theme=>document.documentElement.dataset.dayrisTheme=theme,theme);
  await page.locator('.activity-streak-value').evaluate(el=>el.textContent='10 дн.');
  let freeMaterial;
  for(const active of [false,true]){
   if(active){await toggle.click();await settle();}
   const palette=await pass.evaluate(el=>{
    const face=getComputedStyle(el.querySelector('.workspace-pass-face'));
    return {fill:face.backgroundColor,image:face.backgroundImage,ink:getComputedStyle(el.querySelector('.workspace-pass-label')).color,highlight:getComputedStyle(el).getPropertyValue('--pass-highlight').trim()};
   });
   const key=`${theme}/${active?'PRO':'FREE'}/${width}`;
   assert.ok(contrast(palette.ink,palette.fill)>=4.5,`readable label on the plate: ${key}`);
   const [r,g,b,a=1]=rgb(palette.highlight),base=rgb(palette.fill);
   const highlight=`rgb(${[r,g,b].map((n,i)=>Math.round(n*a+base[i]*(1-a))).join(',')})`;
   assert.ok(contrast(palette.ink,highlight)>=4.5,`readable label under the brightest reflection: ${key}`);
   if(!active)freeMaterial=palette.fill;else assert.notEqual(palette.fill,freeMaterial,`material identifies mode: ${key}`);
   if(active&&width===390)materials.add(palette.fill);
   if(theme==='gold'){const [r,g,b]=rgb(palette.fill);assert.ok(r>g&&g>b,'gold uses a warm metal in both modes');}
   if(theme==='emerald'){const [r,g,b]=rgb(palette.fill);assert.ok(g>r&&g>b,'emerald uses green glass in both modes');}
   assert.equal(await pass.locator('.workspace-pass-label').evaluate(el=>getComputedStyle(el).color),await pass.evaluate(el=>getComputedStyle(el).color),'premium themes preserve readable FREE/PRO text');
   assert.equal(await toggle.evaluate(el=>getComputedStyle(el).backgroundImage),'none','premium theme does not add a second background behind the pass');
   const modeTarget=await toggle.boundingBox(),infoTarget=await info.boundingBox();
   assert.ok(modeTarget.width>=44&&modeTarget.height>=44&&infoTarget.width>=44&&infoTarget.height>=44,'independent touch targets are at least 44px');
   assert.ok(modeTarget.x+modeTarget.width<=infoTarget.x+.1,'mode and information targets do not overlap');
   const settings=await page.locator('[data-site-element="settings"]').boundingBox();
   assert.ok(infoTarget.x+infoTarget.width<=settings.x,'information target does not overlap Settings');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no overflow: ${key}`);
   if(width!==320)await page.locator('.dayris-header').screenshot({path:`artifacts/quiet-orbit-${theme}-${active?'pro':'free'}-${width}.png`});
  }
 }
 assert.equal(materials.size,5,'every theme has its own PRO material');
 // A live theme change updates the existing pass without resetting the selected mode.
 for(const theme of ['gold','emerald','purple','dark']){
  await page.evaluate(theme=>document.documentElement.dataset.dayrisTheme=theme,theme);await settle();
  assert.equal(await toggle.getAttribute('aria-checked'),'true');
  const palette=await pass.evaluate(el=>({actual:getComputedStyle(el.querySelector('.workspace-pass-face')).backgroundColor,expected:getComputedStyle(el).getPropertyValue('--pass-pro-fill').trim()}));
  assert.equal(luminance(palette.actual),luminance(palette.expected),'runtime theme changes repaint the pass');
 }
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.goto('http://pass.test/header?preview&mode=free&language=ru');await pass.waitFor();
 await pass.hover({position:{x:12,y:12}});const firstReflection=await pass.evaluate(el=>el.style.getPropertyValue('--pass-light-x'));
 assert.notEqual(firstReflection,'','mouse movement positions the metal reflection');
 await pass.hover({position:{x:90,y:12}});assert.notEqual(await pass.evaluate(el=>el.style.getPropertyValue('--pass-light-x')),firstReflection);
 await page.mouse.move(5,120);assert.equal(await pass.evaluate(el=>el.style.getPropertyValue('--pass-light-x')),'','reflection settles when the pointer leaves');
 await page.emulateMedia({reducedMotion:'reduce'});await pass.hover({position:{x:12,y:12}});
 assert.equal(await pass.evaluate(el=>el.style.getPropertyValue('--pass-light-x')),'','reduced motion disables pointer-following light');
 await page.setViewportSize({width:390,height:844});await page.goto('http://pass.test/header?preview&mode=free&language=ru');await pass.waitFor();
 await page.locator('.activity-streak-value').evaluate(el=>el.textContent='10 дн.');
 await page.locator('.dayris-brand-row').screenshot({path:'artifacts/orbit-pass-free-header.png'});
 assert.deepEqual(errors,[]);console.log('Quiet orbit: 30 localized header layouts and 30 theme/mode layouts, reflected-text contrast, fixed 44px targets, live theme changes, independent features, keyboard switching and reduced motion passed.');
} finally {await browser.close();}
