import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(process.env.DAYRIS_PGLITE_PACKAGE||path.resolve('android/app/build/widget-sql-test/package.json'));
const {PGlite}=require('@electric-sql/pglite');
test('PostgreSQL migration: account isolation, atomic batches, deduplication, conflicts, expiry and revocation',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,service_role;grant execute on function auth.uid() to authenticated;create type public.direction as enum('SHORT','LONG');create table public.trades(id bigint generated always as identity primary key,user_id uuid not null references auth.users(id),date_key date not null,time time not null,instrument text not null,direction public.direction not null,pnl numeric not null,comment text,platform text,currency text);`);
  await db.exec(await fs.readFile('supabase/migrations/202610080001_voice_widget.sql','utf8'));
  const owner='d37192c2-87bf-424f-b389-dd99f0f683a3',other='a0ff526d-0442-4fe5-a849-dfc2f034be07',device='94786c07-d9ce-4a7b-ab91-5371c3e3f19a',foreign='cc0e2a9f-2a94-40a5-9812-c9c31e7626dc',request='83a88054-46e0-4930-bf4a-28a2030ad301';
  await db.query('insert into auth.users values($1),($2)',[owner,other]);
  await db.query('insert into public.voice_widget_devices(id,user_id,secret_hash) values($1,$2,$3),($4,$5,$6)',[device,owner,'a'.repeat(64),foreign,other,'b'.repeat(64)]);
  const today=(await db.query("select current_date::text as day")).rows[0].day;
  const entry={amount:'50',sign:'minus',currency:'MDL',category:'сок',dateKey:today,destination:'main'};
  const commit=async({id=request,revision=0,entries=[entry],fingerprint='fingerprint',context=null}={})=>(await db.query('select public.commit_voice_widget_turn($1,$2,$3,$4,$5,$6,$7,$8,$9) as reply',[device,id,fingerprint,revision,context,JSON.stringify({status:'saved'}),JSON.stringify(entries),today,'13:45'])).rows[0].reply;
  assert.deepEqual(await commit(),{status:'saved'});assert.deepEqual(await commit(),{status:'saved'});
  let rows=(await db.query('select user_id,pnl::text,currency,time::text from trades')).rows;assert.equal(rows.length,1);assert.equal(rows[0].user_id,owner);assert.equal(rows[0].pnl,'-50');assert.equal(rows[0].time,'13:45:00');
  await assert.rejects(commit({fingerprint:'different'}),/REQUEST_CONFLICT/);
  await assert.rejects(commit({id:'675812d9-b342-4ba4-9d39-0c0f0eaf522e'}),/TURN_CONFLICT/);
  await assert.rejects(commit({id:'675812d9-b342-4ba4-9d39-0c0f0eaf522e',revision:1,entries:[entry,{...entry,amount:'0'}]}),/INVALID_ENTRY/);
  assert.equal((await db.query('select count(*)::int as count from trades')).rows[0].count,1,'invalid second purchase rolls back the first purchase');
  await commit({id:'d62ce9a1-cd02-4fa7-bf37-19fe918f303e',revision:1,entries:[entry,{...entry,sign:'plus',amount:'100'}]});
  assert.equal((await db.query('select count(*)::int as count from trades')).rows[0].count,3);
  const concurrent=await Promise.allSettled([commit({id:'eb0f59e7-92b1-4a11-b209-af073ac4bff4',revision:2}),commit({id:'eb0f59e7-92b1-4a11-b209-af073ac4bff4',revision:2})]);assert.ok(concurrent.every(result=>result.status==='fulfilled'));
  assert.equal((await db.query('select count(*)::int as count from trades')).rows[0].count,4,'concurrent retries commit one row');
  await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`);
  assert.deepEqual((await db.query('select id from voice_widget_devices')).rows,[{id:device}]);
  await assert.rejects(db.query('select secret_hash from voice_widget_devices'),/permission denied/);
  await assert.rejects(commit(),/permission denied/);
  assert.equal((await db.query('update voice_widget_devices set revoked_at=now() where id=$1 returning id',[foreign])).rows.length,0);
  await db.query('update voice_widget_devices set revoked_at=now() where id=$1',[device]);await db.exec('reset role');
  await assert.rejects(commit(),/DEVICE_EXPIRED/);
  await db.query("update voice_widget_devices set revoked_at=null,expires_at=now()-interval '1 day' where id=$1",[device]);
  await assert.rejects(commit(),/DEVICE_EXPIRED/);
 }finally{await db.close();}
});
