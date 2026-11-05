import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const {PGlite}=createRequire('D:/ai-trade-journal/android/app/build/widget-sql-test/package.json')('@electric-sql/pglite');
const admin='11111111-1111-4111-8111-111111111111',reader='22222222-2222-4222-8222-222222222222',user='33333333-3333-4333-8333-333333333333';
test('only authorized administrators grant/revoke verification; changes are audited and users cannot self-verify',async()=>{
 const db=new PGlite();await db.waitReady;try{
  await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to anon,authenticated;
  create table public.site_admins(user_id uuid,can_view_users boolean,can_edit_users boolean);
  create function public.site_admin_session_allowed() returns boolean language sql as $$select coalesce(current_setting('test.admin_session',true),'yes')='yes'$$;
  create table public.site_admin_audit(actor_id uuid,subject_id uuid,action text,dataset text,before_data jsonb,after_data jsonb);
  create function public.social_can_view(uuid) returns boolean language sql as $$select $1=auth.uid() or coalesce(current_setting('test.visible',true),'yes')='yes'$$;`);
  const previous=await fs.readFile('supabase/migrations/202610150003_admin_google_access.sql','utf8');await db.exec(previous.match(/create or replace function public\.site_admin_require\(p_write[\s\S]*?\$\$;/i)[0]);
  await db.query('insert into auth.users values($1),($2),($3)',[admin,reader,user]);await db.query('insert into public.site_admins values($1,true,true),($2,true,false)',[admin,reader]);await db.exec(await fs.readFile('supabase/migrations/202611050002_profile_verification.sql','utf8'));
  const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');};
  const set=enabled=>db.query('select public.admin_set_user_verification($1,$2) as data',[user,enabled]);
  await as(user);await assert.rejects(set(true),/permission/i);await assert.rejects(db.query('insert into public.social_verifications(user_id) values($1)',[user]),/permission denied/);
  await as(reader);await assert.rejects(set(true),/permission/i);
  await as(admin);await db.exec("select set_config('test.admin_session','no',false)");await assert.rejects(set(true),/permission/i);await db.exec("select set_config('test.admin_session','yes',false)");await set(true);await set(true);
  await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.site_admin_audit')).rows[0].n,1);
  await as(user);const state=await db.query('select public.social_verified_profiles($1,$2) as data',[[user],user]);assert.deepEqual(state.rows[0].data.users,[user]);await assert.rejects(db.query('select public.social_verified_profiles($1,$2)',[[user],admin]),/Account changed/);
  await as(reader);await db.exec("select set_config('test.visible','no',false)");assert.deepEqual((await db.query('select public.social_verified_profiles($1,$2) as data',[[user],reader])).rows[0].data.users,[]);
  await as(admin);await set(false);await as(user);assert.deepEqual((await db.query('select public.social_verified_profiles($1,$2) as data',[[user],user])).rows[0].data.users,[]);
  await db.exec('reset role');const audit=(await db.query('select * from public.site_admin_audit')).rows;assert.equal(audit.length,2);assert.equal(audit[1].before_data.verified,true);assert.equal(audit[1].after_data.verified,false);await db.exec('set role anon');await assert.rejects(db.query('select public.admin_set_user_verification($1,true)',[user]),/permission denied/);
 }finally{await db.close();}
});
