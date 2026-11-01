import {createRequire} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import Setup from './src/features/onboarding/FirstRunSetup.jsx';import {installDisplayPreferences,setDisplayPreferences} from './src/shared/lib/displayPreferences.js';
installDisplayPreferences();window.setScale=setDisplayPreferences;
const params=new URLSearchParams(location.search);function App(){const[step,setStep]=useState(params.get('step')||'language'),[theme,setTheme]=useState('dark'),[currency,setCurrency]=useState('MDL'),[language,setLanguage]=useState(params.get('language')||'ru');return <Setup step={step} language={language} currency={currency} theme={theme} proAccessActive={params.has('pro')} onLanguage={item=>setLanguage(item.code)} onCurrency={setCurrency} onTheme={setTheme} onStep={setStep} onSkip={()=>{}} onStart={()=>{}} onArrive={()=>{}}/>;}createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'onboarding-footer.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.svg':'dataurl','.png':'dataurl','.webp':'dataurl'},plugins:[{name:'video-urls-only',setup(build){build.onLoad({filter:/\.mp4$/},args=>({loader:'js',contents:'export default '+JSON.stringify('/onboarding/'+path.basename(args.path))}));}}]});
const css=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>/^main-.*\.css$/.test(file))),'utf8');
const browser=await createRequire('C:/Users/aveel/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({hasTouch:true,reducedMotion:'reduce'}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install({time:new Date(2026,10,1,12)});
 await page.route('http://setup-footer.test/**',route=>{const file=path.resolve('public','.'+new URL(route.request().url()).pathname);if(file.startsWith(path.resolve('public')+path.sep)&&fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.png')?'image/png':'image/svg+xml'});return route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`});});
 for(const [width,height]of[[320,568],[360,640],[390,844],[740,360],[1280,900]])for(const large of [false,true]){
  await page.setViewportSize({width,height});await page.goto('http://setup-footer.test');await page.getByRole('dialog').waitFor();
  await page.evaluate(large=>setScale({interfaceScale:large?115:100,textScale:large?130:100}),large);
  for(const stage of ['language','appearance','currency','birthday']){
   if(stage!=='birthday')assert.equal(await page.locator('.first-run-actions').getByRole('button',{name:'Продолжить',exact:true}).count(),0,'no redundant confirmation');
   if(stage==='language'){
    assert.equal(await page.locator('.first-run-language-choice').count(),5);
    for(const choice of await page.locator('.first-run-language-choice').all()){const box=await choice.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height,JSON.stringify({check:'all languages fit',width,height,large,box}));assert.equal(await choice.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'all languages are visible without scrolling');}
    if(width===360&&!large)await page.screenshot({path:'artifacts/onboarding-one-tap-language.png'});
    await page.getByRole('button',{name:/Русский/}).click();continue;
   }
   if(stage==='appearance'){assert.equal(await page.locator('.theme-onboarding-option').count(),4,'paid themes are not unlocked for a free account');if(width===360&&!large)await page.screenshot({path:'artifacts/onboarding-one-tap-appearance.png'});await page.getByRole('button',{name:'Тёмное',exact:true}).click();continue;}
   if(stage==='currency'){assert.equal(await page.locator('.first-run-actions').getByRole('button',{name:'Продолжить',exact:true}).count(),0,'currency selection already advances');await page.getByRole('button',{name:/MDL/}).click();continue;}
   const action=page.locator('.first-run-actions button').filter({hasText:stage==='birthday'?'Увидеть мою историю':'Продолжить'});
   await action.waitFor();const box=await action.boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height+1,JSON.stringify({stage,width,height,large,box}));
   assert.equal(await action.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'the primary action is reachable without scrolling');
   assert.ok(await page.locator('.first-run-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),'no horizontal overflow');
   if(width===360&&stage==='birthday'&&!large)await page.screenshot({path:'artifacts/onboarding-visible-continue.png'});
   if(stage!=='birthday')await action.click();
  }
 }
 for(const [language,title,noDate]of[['ru','Ваш день рождения','Продолжить без даты'],['uk','Ваш день народження','Продовжити без дати'],['en','Your birthday','Continue without a date'],['md','Data nașterii','Continuă fără dată'],['zh-CN','你的生日','不填写日期，继续']]){
  await page.setViewportSize({width:390,height:740});await page.goto('http://setup-footer.test?step=birthday&language='+language);assert.equal(await page.locator('#first-run-heading').textContent(),title);
  const skip=page.locator('.first-run-actions').getByRole('button',{name:noDate,exact:true});await skip.waitFor();const box=await skip.boundingBox();assert.ok(box.y+box.height<=740);await skip.click();await page.locator('.first-run-dialog[data-story="true"]').waitFor();
 }
 await page.goto('http://setup-footer.test?step=birthday');const year=page.locator('.birthday-year input'),month=page.locator('.birthday-month select'),day=page.locator('.birthday-day select');
 assert.notEqual(await year.evaluate(el=>document.activeElement===el),true,'year entry does not open the keyboard on arrival');await year.fill('2023');assert.equal(await year.getAttribute('aria-invalid'),'true');assert.equal(await month.isDisabled(),true);
 await year.fill('1998');assert.equal(await month.locator('option[value="11"]').textContent(),'Ноябрь (11)');await month.selectOption('11');await day.selectOption('14');
 await year.fill('2013');assert.equal(await month.locator('option[value="12"]').count(),0);assert.equal(await day.locator('option[value="02"]').count(),0);await day.selectOption('01');
 await page.getByRole('button',{name:'Увидеть мою историю',exact:true}).click();await page.locator('.first-run-dialog[data-story="true"]').waitFor();
 await page.goto('http://setup-footer.test?step=appearance&pro');assert.equal(await page.locator('.theme-onboarding-option').count(),6,'active subscribers can choose premium themes immediately');await page.getByRole('button',{name:'Изумрудное',exact:true}).click();await page.locator('.first-run-dialog[data-setup-step="currency"]').waitFor();
 await page.goto('http://setup-footer.test?step=birthday');await year.fill('2000');await month.selectOption('02');await day.selectOption('29');await year.fill('');await year.pressSequentially('2000');assert.equal(await day.inputValue(),'29','partial year editing retains a valid leap birthday');
 assert.deepEqual(errors,[]);console.log('PASS: one-tap language/theme/currency, all languages visible, optional localized birthday, numbered months, 13-year cutoff, PRO theme gating, small/landscape viewports and enlarged text');
}finally{await browser.close();}
