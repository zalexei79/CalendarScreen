import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

test('admin shell never overwrites the main shell or caches user RPCs',async()=>{
  const handlers = new Map(), saved = new Map();
  let offline = false;
  const cache = { put:async(key,value)=>saved.set(typeof key==='string'?key:key.url,value),match:async key=>saved.get(key) };
  vm.runInNewContext(await fs.readFile('public/sw.js','utf8'),{
    self:{location:{origin:'https://dayris.test'},addEventListener:(type,fn)=>handlers.set(type,fn)},
    caches:{open:async()=>cache,match:async key=>saved.get(typeof key==='string'?key:key.url)},
    fetch:async()=>{if(offline)throw new Error('offline');return new Response('<html>admin only</html>',{status:200});},
    Response,URL,console,
  });
  let response;
  const event = request => ({request,respondWith:value=>{response=value;},waitUntil:()=>{}});
  handlers.get('fetch')(event({method:'GET',mode:'navigate',url:'https://dayris.test/admin.html'}));
  assert.equal(await (await response).text(),'<html>admin only</html>');
  assert.ok(saved.has('/admin.html')); assert.equal(saved.has('/'),false); assert.equal(saved.has('/index.html'),false);
  offline = true;
  handlers.get('fetch')(event({method:'GET',mode:'navigate',url:'https://dayris.test/admin.html'}));
  assert.equal(await (await response).clone().text(),'<html>admin only</html>');
  saved.set('/',new Response('cached calendar'));
  handlers.get('fetch')(event({method:'GET',mode:'navigate',url:'https://dayris.test/project-desk.html'}));
  const studio=await response;assert.equal(studio.status,503);assert.match(await studio.text(),/npm run project:desk/);
  for (const request of [
    {method:'POST',mode:'cors',url:'https://project.supabase.co/rest/v1/rpc/admin_user_data'},
    {method:'GET',mode:'cors',url:'https://project.supabase.co/rest/v1/site_admin_audit'},
    {method:'GET',mode:'cors',url:'https://custom.test/rest/v1/site_admin_audit'},
    {method:'GET',mode:'cors',url:'https://dayris.test/__dayris_desk/status'},
  ]) { response=null; handlers.get('fetch')(event(request)); assert.equal(response,null); }
});

test('admin and calendar have separate install identities and start documents',async()=>{
  const admin = JSON.parse(await fs.readFile('public/admin.webmanifest','utf8'));
  const main = JSON.parse(await fs.readFile('public/manifest.json','utf8'));
  assert.notEqual(admin.id,main.id); assert.equal(admin.start_url,'/admin.html');
  assert.equal(admin.scope,'/admin.html'); assert.equal(admin.display,'standalone');
  assert.ok((await fs.readFile('admin.html','utf8')).includes('href="/admin.webmanifest"'));
});
