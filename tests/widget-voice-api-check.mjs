import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),temporary=createRequire(process.env.DAYRIS_PGLITE_PACKAGE||path.resolve('android/app/build/widget-sql-test/package.json'));
const {PGlite}=temporary('@electric-sql/pglite');
const owner='d37192c2-87bf-424f-b389-dd99f0f683a3',other='a0ff526d-0442-4fe5-a849-dfc2f034be07';
function client(db){
 class Query{
  constructor(table){assert.ok(['voice_widget_devices','voice_widget_turns'].includes(table));this.table=table;this.filters=[];this.columns='*';}
  select(columns,options={}){this.columns=columns;this.options=options;return this;}
  eq(column,value){this.filters.push([column,'=',value]);return this;}
  is(column,value){assert.equal(value,null);this.filters.push([column,'is null']);return this;}
  gt(column,value){this.filters.push([column,'>',value]);return this;}
  insert(value){this.inserted=value;return this;}
  update(value){this.updated=value;return this;}
  maybeSingle(){this.single=true;return this.run();}
  async run(){
   try{
    const parameters=[],quoted=name=>{assert.match(name,/^[a-z_]+$/);return '"'+name+'"';};
    if(this.inserted){const fields=Object.keys(this.inserted);parameters.push(...fields.map(field=>typeof this.inserted[field]==='object'?JSON.stringify(this.inserted[field]):this.inserted[field]));await db.query('insert into '+this.table+'('+fields.map(quoted).join(',')+') values('+fields.map((_,i)=>'$'+(i+1)).join(',')+')',parameters);return {data:null,error:null};}
    const conditions=this.filters.map(([name,operator,value])=>{if(operator==='is null')return quoted(name)+' is null';parameters.push(value);return quoted(name)+operator+'$'+parameters.length;});
    if(this.updated){const setters=Object.entries(this.updated).map(([name,value])=>{parameters.push(value);return quoted(name)+'=$'+parameters.length;});await db.query('update '+this.table+' set '+setters.join(',')+' where '+conditions.join(' and '),parameters);return {data:null,error:null};}
    const columns=this.options?.count?'count(*)::int as count':this.columns==='*'?'*':this.columns.split(',').map(quoted).join(',');
    const result=await db.query('select '+columns+' from '+this.table+(conditions.length?' where '+conditions.join(' and '):''),parameters);
    return {data:this.options?.head?null:this.single?result.rows[0]||null:result.rows,error:null,count:this.options?.count?result.rows[0].count:undefined};
   }catch(error){return {data:null,error:{message:error.message}};}
  }
  then(resolve,reject){return this.run().then(resolve,reject);}
 }
 return {auth:{getUser:async token=>token==='valid-owner'?{data:{user:{id:owner}},error:null}:{data:{user:null},error:new Error('invalid token')}},from:table=>new Query(table),rpc:async(name,values)=>{
  assert.equal(name,'commit_voice_widget_turn');
  const args=['p_device','p_request','p_fingerprint','p_revision','p_context','p_response','p_entries','p_today','p_time'].map(key=>typeof values[key]==='object'&&values[key]!==null?JSON.stringify(values[key]):values[key]);
  try{return {data:(await db.query('select commit_voice_widget_turn($1,$2,$3,$4,$5,$6,$7,$8,$9) as reply',args)).rows[0].reply,error:null};}
  catch(error){return {data:null,error:{message:error.message}};}
 }};
}
test('edge endpoint + PostgreSQL: scoped pairing, voice writes, lost-response retries, timestamps and forged credentials',async()=>{
 const db=new PGlite();await db.waitReady;let handler;
 try{
  await db.exec("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table trades(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),date_key text not null,time text not null,instrument text,direction text,pnl numeric,comment text,platform text,currency text);");
  await db.exec(await fs.readFile('supabase/migrations/202610080001_voice_widget.sql','utf8'));
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  globalThis.__widgetDb=client(db);globalThis.Deno={env:{get:key=>key==='SUPABASE_URL'?'https://project.supabase.co':'test-server-key'},serve:fn=>handler=fn};
  const bundled=await require('esbuild').build({entryPoints:['supabase/functions/widget-voice/index.ts'],write:false,bundle:true,platform:'node',format:'esm',plugins:[{name:'fixture-auth',setup(build){build.onResolve({filter:/^https:\/\/esm.sh\/@supabase/},()=>({path:'auth',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>globalThis.__widgetDb;',loader:'js'}));}}]});
  await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  const call=async(body,authorization='')=>{const result=await handler(new Request('https://project.supabase.co/functions/v1/widget-voice',{method:'POST',headers:{authorization,'Content-Type':'application/json'},body:JSON.stringify(body)}));return {status:result.status,body:await result.json()};};
  assert.equal((await call({action:'pair'},'Bearer invalid')).status,401);
  const paired=await call({action:'pair',user_id:other,settings:{locale:'ru',currency:'MDL'}},'Bearer valid-owner');assert.equal(paired.status,200);
  const grant=paired.body;assert.equal((await db.query('select user_id from voice_widget_devices where id=$1',[grant.id])).rows[0].user_id,owner);
  assert.equal((await db.query('select secret_hash from voice_widget_devices where id=$1',[grant.id])).rows[0].secret_hash.length,64);assert.notEqual((await db.query('select secret_hash from voice_widget_devices where id=$1',[grant.id])).rows[0].secret_hash,grant.secret);
  const body={action:'turn',deviceId:grant.id,requestId:crypto.randomUUID(),phrase:'потратил 50 лей на сок',timezone:'Europe/Bucharest',createdAt:Date.now(),user_id:other,entries:[{amount:99999}]};
  assert.equal((await call(body,'Widget '+'f'.repeat(64))).status,401);
  const saved=await call(body,'Widget '+grant.secret);assert.equal(saved.status,200);assert.equal(saved.body.status,'saved');
  assert.match(saved.body.speech,/леев/);
  const retry=await call(body,'Widget '+grant.secret);assert.deepEqual(retry,saved);
  const rows=(await db.query('select user_id,pnl::text from trades')).rows;assert.deepEqual(rows,[{user_id:owner,pnl:'-50'}]);
  assert.equal((await call({...body,phrase:'потратил 90 лей на сок'},'Widget '+grant.secret)).status,409);
  assert.equal((await call({...body,requestId:crypto.randomUUID(),createdAt:Date.now()-37*60*60*1000},'Widget '+grant.secret)).body.error,'INVALID_REQUEST_TIMESTAMP');
  assert.equal((await call({...body,requestId:crypto.randomUUID(),timezone:'invalid-zone'},'Widget '+grant.secret)).status,400);
  const first=await call({...body,requestId:crypto.randomUUID(),phrase:'потратил 70 лей'},'Widget '+grant.secret);assert.equal(first.body.status,'clarify');
  const next=await call({...body,requestId:crypto.randomUUID(),phrase:'на кофе'},'Widget '+grant.secret);assert.equal(next.body.status,'saved');
  assert.equal((await db.query('select count(*)::int as count from trades')).rows[0].count,2);
  assert.equal((await call({action:'revoke',deviceId:grant.id},'Widget '+'f'.repeat(64))).status,401);
  assert.equal((await call({action:'revoke',deviceId:grant.id},'Widget '+grant.secret)).body.status,'revoked');
  assert.equal((await call({...body,requestId:crypto.randomUUID()},'Widget '+grant.secret)).status,401);
 }finally{delete globalThis.Deno;delete globalThis.__widgetDb;await db.close();}
});
