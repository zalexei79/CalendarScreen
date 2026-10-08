import test from 'node:test';
import assert from 'node:assert/strict';
import {readVoiceLaunch,consumeVoiceLaunch,VOICE_LAUNCH_KEY} from '../src/shared/lib/voiceLaunch.js';
const store=()=>{const values=new Map();return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
test('home microphone launch survives OAuth return without financial data',()=>{
 const storage=store(),request=readVoiceLaunch({href:'https://dayris.test/?voice=1&source=android-widget'},storage,1000);
 assert.deepEqual(request,{id:'1000',createdAt:1000});
 assert.deepEqual(readVoiceLaunch({href:'https://dayris.test/?voice=1'},storage,1500),request,'mount replay preserves the same intent');
 assert.deepEqual(readVoiceLaunch({href:'https://dayris.test/'},storage,2000),request,'Google return can drop the launch URL');
 assert.equal(readVoiceLaunch({href:'https://dayris.test/'},storage,301001),null,'old launches never unexpectedly start the mic');
});
test('consuming a launch removes only voice parameters and preserves other app state',()=>{
 const storage=store();storage.setItem(VOICE_LAUNCH_KEY,'{}');let replaced;
 const state={calendar:3},history={state,replaceState:(...args)=>replaced=args};
 consumeVoiceLaunch({href:'https://dayris.test/?voice=1&source=android-shortcut&referral=alex#month'},history,storage);
 assert.deepEqual(replaced,[state,'','/?referral=alex#month']);assert.equal(storage.getItem(VOICE_LAUNCH_KEY),null);
 consumeVoiceLaunch({href:'https://dayris.test/?voice=1&source=share'},history,storage);assert.equal(replaced[2],'/?source=share');
});
test('ordinary visits, corrupted storage and denied storage do not create a launch',()=>{
 const location={href:'https://dayris.test/?voice=0'},storage=store();
 for(const value of ['oops','{}','{"id":"1","createdAt":-999999}','{"id":"1","createdAt":999999}']){storage.setItem(VOICE_LAUNCH_KEY,value);assert.equal(readVoiceLaunch(location,storage,1000),null);}
 const denied={getItem:()=>{throw Error('denied');},setItem:()=>{throw Error('denied');},removeItem:()=>{throw Error('denied');}};
 assert.equal(readVoiceLaunch(location,denied,1000),null);assert.ok(readVoiceLaunch({href:'https://dayris.test/?voice=1'},denied,1000));
});
