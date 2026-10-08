import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const bundle=await require('esbuild').build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Pair from './src/shared/ui/AndroidWidgetPairing.jsx';function App(){const [ready,setReady]=React.useState(false);window.enable=()=>setReady(true);return <Pair ready={ready} userId="owner" language="ru" currency="MDL" categories={[]}/>;}createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);`},bundle:true,write:false,format:'iife',plugins:[{name:'fake-session',setup(build){build.onResolve({filter:/supabaseClient\.js$/},()=>({path:'client',namespace:'fake'}));build.onLoad({filter:/.*/,namespace:'fake'},()=>({contents:`export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'browser-google-token',user:{id:'owner'}}}})},functions:{invoke:async(_,args)=>{window.calls=(window.calls||0)+1;window.request=args;return {data:{id:'94786c07-d9ce-4a7b-ab91-5371c3e3f19a',secret:'a'.repeat(64),locale:'ru',endpoint:'https://project.supabase.co/functions/v1/widget-voice'}};}},from:()=>({update:()=>({eq:async()=>({})})})};`,loader:'js'}));}}]});
const playwright=createRequire(process.env.DAYRIS_PLAYWRIGHT_PACKAGE||path.resolve('package.json'))('playwright');
const browser=await playwright.chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('https://widget.example.test/**',route=>route.fulfill({contentType:'text/html',body:'<html lang="ru"><div id="root"></div><script>'+bundle.outputFiles[0].text+'</script></html>'}));
 await page.goto('https://widget.example.test/?widgetSetup=1');assert.equal(await page.locator('aside').count(),0);
 const handshake=async origin=>page.evaluate(origin=>{const channel=new MessageChannel();channel.port2.onmessage=event=>window.nativeReply=JSON.parse(event.data);window.dispatchEvent(new MessageEvent('message',{origin,ports:[channel.port1],data:JSON.stringify({type:'dayris.widget.hello',nonce:'08e0b5d0-f4d7-4679-9c8a-bb60e5f40e73'})}));},origin);
 await handshake('https://evil.test');await page.evaluate(()=>enable());const button=page.getByRole('button');await button.waitFor();assert.equal(await button.isDisabled(),true);
 // A new cold visit receives its transferred port before account/onboarding readiness.
 await page.goto('https://widget.example.test/?widgetSetup=1');await page.waitForFunction(()=>window.enable);
 await handshake('https://widget.example.test');assert.equal(await page.locator('aside').count(),0);
 await page.evaluate(()=>enable());await page.waitForFunction(()=>!document.querySelector('button').disabled);
 await button.click();await page.waitForFunction(()=>window.nativeReply);
 assert.equal(await page.evaluate(()=>calls),1,'StrictMode does not register a device twice');
 const reply=await page.evaluate(()=>nativeReply);assert.equal(reply.type,'dayris.widget.paired');assert.equal(reply.grant.secret,'a'.repeat(64));assert.ok(!JSON.stringify(reply).includes('browser-google-token'),'Google session never crosses the native bridge');
 assert.match(await button.innerText(),/Подключаю/,'wait for native encrypted storage confirmation');
 await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,data:JSON.stringify({type:'dayris.widget.confirmed',nonce:'08e0b5d0-f4d7-4679-9c8a-bb60e5f40e73'})})));
 await page.waitForFunction(()=>!location.search);
 assert.equal(await page.evaluate(()=>location.search),'');assert.equal(await page.evaluate(()=>sessionStorage.getItem('dayris_widget_setup')),null);
 await page.screenshot({path:'tests/voice-widget-pairing.png'});
 await page.goto('https://widget.example.test/');await page.evaluate(()=>enable());assert.equal(await page.locator('aside').count(),0,'ordinary calendar does not show widget setup');
 assert.deepEqual(errors,[]);console.log('PASS: native pairing waits for account, rejects foreign origin, registers once, sends only scoped grant and leaves normal visits unchanged.');
}finally{await browser.close();}
