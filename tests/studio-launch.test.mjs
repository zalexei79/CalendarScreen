import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedAdminOrigin,studioLaunchURL,validStudioReply,STUDIO_ORIGIN} from '../src/features/admin/studioLaunch.js';
test('studio launch is fixed loopback and only accepts known admin origins',()=>{
 const nonce='a'.repeat(32),url=new URL(studioLaunchURL('https://ai-trade-journal-ejm8.onrender.com',nonce));
 assert.equal(url.origin,STUDIO_ORIGIN);assert.equal(url.pathname,'/project-desk.html');assert.equal(url.searchParams.get('launch'),nonce);
 for(const origin of ['https://evil.example','null','http://localhost:666','https://ai-trade-journal-ejm8.onrender.com.evil.example','javascript:alert(1)'])assert.equal(allowedAdminOrigin(origin),false);
 assert.equal(allowedAdminOrigin('http://127.0.0.1:5173'),true);
 assert.equal(new URL(studioLaunchURL('https://evil.example',nonce)).search,'');
});
test('readiness requires the exact child, origin and per-click nonce; never accepts a token payload',()=>{
 const popup={},nonce='a'.repeat(32),event={source:popup,origin:STUDIO_ORIGIN,data:{type:'dayris:studio-ready',nonce}};
 assert.equal(validStudioReply(event,popup,nonce),true);
 for(const patch of [{source:{}},{origin:'https://evil.example'},{data:{type:'dayris:studio-ready',nonce:'wrong'}},{data:{type:'dayris:token',nonce}}])assert.equal(validStudioReply({...event,...patch},popup,nonce),false);
 assert.equal(validStudioReply(event,null,nonce),false);
});
