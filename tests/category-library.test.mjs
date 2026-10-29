import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryLibrary,cleanCategoryProfile,rememberCategory,toggleFavorite,setCategoryIcon,forgetCategory} from '../src/shared/lib/categoryLibrary.js';
import {validCategoryEmoji,categoryEmoji,CATEGORY_EMOJIS} from '../src/shared/lib/categoryIconCatalog.js';
test('search uses localized labels, canonical names, word order and е/ё',()=>{
 const options=[{value:'Жильё',label:'Housing'},{value:'Сотовая связь',label:'Сотовая связь'},{value:'Сок',label:'Сок'}];
 const profile=cleanCategoryProfile(null);
 assert.equal(categoryLibrary(options,profile,'жилье','en').all[0].value,'Жильё');
 assert.equal(categoryLibrary(options,profile,'HOUS','en').all[0].value,'Жильё');
 assert.equal(categoryLibrary(options,profile,'связь сото').all[0].value,'Сотовая связь');
 assert.equal(categoryLibrary(options,profile,'со').all.length,2);
 assert.equal(categoryLibrary(options,profile,'unknown').all.length,0);
});
test('favorites keep user order while recent activity updates independently',()=>{
 let profile=cleanCategoryProfile(null);
 for(const name of ['Сок','Кафе','Такси','Кино','Продукты','Дом','Седьмой'])profile=toggleFavorite(profile,name);
 assert.equal(profile.favorites.length,6);
 profile=rememberCategory(rememberCategory(profile,'Монитор'),'СОК');
 assert.deepEqual(profile.favorites,['Сок','Кафе','Такси','Кино','Продукты','Дом']);
 const library=categoryLibrary(profile.favorites.concat('Монитор').map(value=>({value,label:value})),profile);
 assert.deepEqual(library.favorites.map(item=>item.value),profile.favorites);
 assert.deepEqual(library.recent.map(item=>item.value),['Монитор']);
 profile=toggleFavorite(profile,'сок');assert.ok(!profile.favorites.includes('Сок'));
 profile=toggleFavorite(profile,'Седьмой');assert.equal(profile.favorites.at(-1),'Седьмой');
});
test('stored preferences tolerate malformed data and unknown or filtered categories',()=>{
 const profile=cleanCategoryProfile({favorites:['Сок','сок',null,4,'Жильё'],recent:['A',null,'a','', 'x'.repeat(61)]});
 assert.deepEqual(profile.favorites,['сок','Жильё']);assert.deepEqual(profile.recent,['a']);
 assert.deepEqual(categoryLibrary([{value:'СОК',label:'Сок'}],profile).favorites.map(item=>item.value),['СОК']);
 assert.deepEqual(cleanCategoryProfile({favorites:'bad',recent:{}}),{favorites:[],recent:[],icons:{}});
});
test('icons survive activity and favorite updates, use canonical names, and disappear on category removal',()=>{
 let profile=setCategoryIcon(cleanCategoryProfile({favorites:['Жильё'],recent:['Сок']}),'Личный ПРОЕКТ','diamond');
 profile=rememberCategory(toggleFavorite(profile,'Сок'),'ЛИЧНЫЙ проект');
 assert.deepEqual(profile.icons,{'личный проект':'diamond'});
 assert.deepEqual(cleanCategoryProfile(JSON.parse(JSON.stringify(profile))),profile);
 assert.equal(setCategoryIcon(profile,'Другое','<svg>'),profile,'only registered icon IDs are accepted');
 assert.deepEqual(forgetCategory(profile,'личный проект').icons,{});
 assert.deepEqual(cleanCategoryProfile({icons:{' ЖИЛЬЁ ':'home','Unknown':'bad','""':'star'}}).icons,{'жилье':'home'});
 assert.deepEqual(cleanCategoryProfile({icons:['star']}).icons,{});
});
test('one emoji, including joined families, flags and modifiers, survives preference storage',()=>{
 for(const emoji of [...CATEGORY_EMOJIS,'👨‍👩‍👧‍👦','🇲🇩','👍🏽','1️⃣']){
  assert.ok(validCategoryEmoji(emoji),emoji);
  const profile=setCategoryIcon(cleanCategoryProfile(null),'Мой раздел','emoji:'+emoji);
  assert.equal(categoryEmoji(cleanCategoryProfile(JSON.parse(JSON.stringify(profile))).icons['мой раздел']),emoji);
  assert.deepEqual(forgetCategory(profile,'Мой раздел').icons,{});
 }
 for(const invalid of ['', 'text', '✨💎','🇲','👩‍','<svg>','✨\n','✨hello'])assert.equal(validCategoryEmoji(invalid),false,invalid);
 assert.deepEqual(cleanCategoryProfile({icons:{safe:'emoji:💎',bad:'emoji:<img>'}}).icons,{safe:'emoji:💎'});
});
