import {createRequire} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const bundle=await createRequire(path.resolve('package.json'))('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
import CategoryPicker from './src/shared/ui/CategoryPicker.jsx';import useVoiceCategories from './src/shared/ui/useVoiceCategories.js';
import {MONEY_CATEGORIES,getMoneyCategoryLabel} from './src/shared/config/constants.js';
function App(){const[owner,setOwner]=useState('a'),[light,setLight]=useState(false),[language,setLanguage]=useState('ru'),[value,setValue]=useState('Продукты'),[management,setManagement]=useState(false);const categories=useVoiceCategories(owner);
 window.switchOwner=setOwner;window.setLight=setLight;window.setLanguage=setLanguage;window.addCategory=categories.add;window.setManagement=setManagement;
 const options=[...MONEY_CATEGORIES,...categories.categories.map(key=>({key}))].filter(item=>!categories.hidden.some(name=>name.toLowerCase()===item.key.toLowerCase())).map(item=>({value:item.key,label:getMoneyCategoryLabel(item.key,language),icon:item.icon}));
 const actions=management?{onCreate:categories.add,onDelete:async name=>{if(window.failRemoval)throw new Error('retry');categories.remove(name);}}:{};
 return <main style={{maxWidth:500,margin:'60px auto',padding:16}}><h1 style={{color:light?'#222':'#eee',fontSize:24,marginBottom:24}}>DAYRIS</h1><CategoryPicker {...actions} options={options} value={value} onChange={setValue} userId={owner} language={language} isLight={light} allowCreate/><div style={{marginTop:20}}><CategoryPicker options={options} value={value} onChange={setValue} userId={owner} language={language} isLight={light} allOption="Все"/></div><output>{value}</output></main>;
}createRoot(document.getElementById('root')).render(<App/>);
`},bundle:true,write:false,outfile:'categories.js',format:'iife'});
const utility=fs.readFileSync(path.join('dist/assets',fs.readdirSync('dist/assets').find(file=>file.endsWith('.css'))),'utf8');
const browser=await createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright').chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  localStorage.setItem('dayris_money_categories:a',JSON.stringify(['Сок','Такси','Монитор','Сотовая связь','Очень длинное название пользовательского раздела',...Array.from({length:90},(_,i)=>'Раздел '+i)]));
  if(!localStorage.getItem('dayris_category_library:a'))localStorage.setItem('dayris_category_library:a',JSON.stringify({favorites:['Продукты','Такси'],recent:['Монитор','Сок','Такси']}));
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('http://categories.test/**',route=>route.fulfill({contentType:'text/html',body:`<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${utility}${bundle.outputFiles.find(file=>file.path.endsWith('.css')).text}body{margin:0;background:#101114}</style><div id="root"></div><script>${bundle.outputFiles.find(file=>file.path.endsWith('.js')).text}</script>`}));
 await page.goto('http://categories.test');
 const open=async(index=0)=>{await page.locator('.category-picker-trigger').nth(index).click();await page.getByRole('dialog').waitFor();await page.waitForFunction(()=>document.querySelector('.category-picker-sheet').getAnimations().every(animation=>animation.playState==='finished'));};
 const close=async()=>{await page.getByRole('button',{name:'Закрыть разделы'}).click();await page.getByRole('dialog').waitFor({state:'detached'});};
 const search=()=>page.getByRole('textbox',{name:'Найти раздел'});
 await open();assert.equal(await page.locator('.category-picker-expand').getAttribute('aria-expanded'),'false');
 assert.deepEqual(await page.locator('.category-picker-quick .category-picker-choice').allTextContents(),['Продукты','Такси']);
 assert.deepEqual(await page.locator('.category-picker-list .category-picker-choice').allTextContents(),['Монитор','Сок']);
 assert.equal(await page.locator('#root').evaluate(element=>element.inert),true);
 await page.screenshot({path:'tests/category-picker-dark.png',animations:'disabled'});
 await page.locator('.category-picker-expand').click();assert.ok(await page.locator('.category-picker-expanded .category-picker-choice').count()>100);
 await page.locator('.category-picker-expanded .category-picker-choice').last().scrollIntoViewIfNeeded();assert.equal(await page.locator('.category-picker-expanded .category-picker-choice').last().isVisible(),true);
 await page.locator('.category-picker-expand').click();assert.equal(await page.locator('.category-picker-expanded').count(),0);
 await search().fill('со');assert.equal(await page.locator('.category-picker-choice').count(),2);
 await page.getByRole('button',{name:'Закрепить Сок',exact:true}).click();
 await page.getByRole('button',{name:'Сок',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.locator('output').textContent(),'Сок');assert.equal(await page.locator('#root').evaluate(element=>element.inert),false);
 assert.equal(await page.locator('.category-picker-trigger').first().evaluate(element=>document.activeElement===element),true);
 await open(1);assert.deepEqual(await page.locator('.category-picker-quick .category-picker-choice').allTextContents(),['Продукты','Такси','Сок']);await close();
 // Successful voice-created sections are available immediately, without reopening the app.
 await page.evaluate(()=>addCategory('Аквариум'));await open();assert.ok((await page.locator('.category-picker-list .category-picker-choice').allTextContents()).includes('Аквариум'));
 for(const name of ['Кафе','Покупки','Жильё']){await search().fill(name);await page.getByRole('button',{name:'Закрепить '+name,exact:true}).click();}
 await search().fill('Монитор');await page.getByRole('button',{name:'Закрепить Монитор',exact:true}).click();assert.match(await page.locator('footer').textContent(),/до 6/);
 await search().fill('ЖИЛЬЕ');assert.equal(await page.locator('.category-picker-choice').textContent(),'Жильё');
 await search().fill('Личный проект');await page.getByRole('button',{name:'Создать «Личный проект»'}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.locator('output').textContent(),'Личный проект');
 assert.ok(!(await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_money_categories:a')))).includes('Личный проект'),'draft choice does not create a stored category');
 await page.evaluate(()=>switchOwner('b'));await open();assert.equal(await page.locator('.category-picker-quick').count(),0);assert.equal(await page.locator('.category-picker-expand').getAttribute('aria-expanded'),'true');await close();
 await page.evaluate(()=>switchOwner('a'));await open();assert.equal(await page.locator('.category-picker-quick .category-picker-choice').count(),6);await close();
 for(const width of [320,390,1280])for(const light of [false,true]){
  await page.setViewportSize({width,height:844});await page.evaluate(light=>{setLight(light);document.body.style.background=light?'#f4f4f6':'#101114';},light);await open();
  const box=await page.locator('.category-picker-sheet').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=844);
  await search().fill('Очень');assert.equal(await page.locator('.category-picker-choice').count(),1);
  assert.ok(await page.locator('.category-picker-sheet').evaluate(element=>element.scrollWidth<=element.clientWidth));
  for(const button of await page.locator('.category-picker-sheet button').all()){const rect=await button.boundingBox();if(rect)assert.ok(rect.height>=44&&rect.width>=44,'touch target');}
  if(width===390&&light)await page.screenshot({path:'tests/category-picker-light.png',animations:'disabled'});
  await close();
 }
 await page.emulateMedia({reducedMotion:'reduce'});await open();assert.equal(await page.locator('.category-picker-sheet').evaluate(element=>getComputedStyle(element).animationName),'none');
 await page.setViewportSize({width:390,height:390});await search().fill('Сок');
 await page.waitForFunction(()=>document.querySelector('.category-picker-sheet').getBoundingClientRect().bottom<=390);
 assert.equal(await page.getByRole('button',{name:'Сок',exact:true}).isVisible(),true);await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'Закрыть разделы'}).focus();await page.keyboard.press('Shift+Tab');assert.ok(await page.getByRole('dialog').evaluate(element=>element.contains(document.activeElement)));
 await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.locator('#root').evaluate(element=>element.inert),false);
 const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_category_library:a')));assert.equal(stored.favorites.length,6);
 await page.reload();await open();assert.equal(await page.locator('.category-picker-quick .category-picker-choice').count(),6);await close();
 await page.evaluate(()=>setManagement(true));
 for(const width of [320,390,1280])for(const light of [false,true]){
  await page.setViewportSize({width,height:844});await page.evaluate(light=>setLight(light),light);await open();
  await page.getByRole('button',{name:'Добавить раздел',exact:true}).click();await page.getByRole('textbox',{name:'Название раздела'}).fill('Ручной раздел');
  if(width===390&&light)await page.screenshot({path:'tests/category-create-light.png',animations:'disabled'});
  await page.getByRole('button',{name:'Создать',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.locator('output').textContent(),'Ручной раздел');
  await open();await page.getByRole('button',{name:'Управлять разделами'}).click();await search().fill('Ручной раздел');await page.getByRole('button',{name:'Удалить раздел Ручной раздел',exact:true}).click();
  const rect=await page.locator('.category-picker-sheet').boundingBox();assert.ok(rect.x>=0&&rect.x+rect.width<=width&&rect.y>=0&&rect.y+rect.height<=844);
  if(width===320&&!light){await page.evaluate(()=>window.failRemoval=true);await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.getByRole('alert').waitFor();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('dayris_money_categories:a')).includes('Ручной раздел')));await page.evaluate(()=>window.failRemoval=false);}
  await page.getByRole('button',{name:'Удалить',exact:true}).click();await page.locator('.category-picker-confirm').waitFor({state:'detached'});assert.equal(await page.locator('output').textContent(),'Другое');await close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: manual create/delete/retry, 100 categories, favorites/recents, owner isolation, keyboard/focus, light/dark 320–1280px, reduced motion');
}finally{await browser.close();}
