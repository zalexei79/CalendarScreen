import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';

const {PGlite}=createRequire(process.env.DAYRIS_PGLITE_PACKAGE||'D:/ai-trade-journal/android/app/build/widget-sql-test/package.json')('@electric-sql/pglite');
const owner='c22282af-a1e9-44ee-b0ab-e966ceefcba1',alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222',newUser='33333333-3333-4333-8333-333333333333';

test('number search defaults on for existing and new accounts, while owner opt-outs and blocks remain effective',async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(`
   create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create schema storage;
   create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),raw_user_meta_data jsonb default '{}');
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema public,auth to authenticated,anon,service_role;
   create table public.site_admins(user_id uuid,can_view_users boolean);
   create function public.site_admin_session_allowed() returns boolean language sql as $$select false$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(bucket_id text,name text);
   create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;
   create table public.friend_chat_messages(id uuid primary key,sender_id uuid,recipient_id uuid,body text);
  `);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'owner@example.test','{}'),($2,'alice@example.test','{\"nickname\":\"Алиса\"}'),($3,'bob@example.test','{\"full_name\":\"Борис\"}')",[owner,alice,bob]);
  const migrate=async file=>db.exec(await fs.readFile(`supabase/migrations/${file}`,'utf8'));
  await migrate('202610290005_profiles_and_friends.sql');
  await migrate('202610290006_social_block_visibility.sql');
  await db.query("insert into public.social_profiles(user_id,display_name,handle,avatar_path,discoverable) values($1,'Owner','dr_owner',null,true),($2,'Алиса','dr_alice','existing-avatar.jpg',false)",[owner,alice]);
  await migrate('202610290011_fixed_numbers_and_day_history.sql');
  await migrate('202610290013_positive_owner_first_numbers.sql');
  const oldNumbers=(await db.query('select user_id,number::text from public.social_account_numbers order by number')).rows;
  await migrate('202611050001_friend_discovery_default_on.sql');
  assert.deepEqual((await db.query('select user_id,number::text from public.social_account_numbers order by number')).rows,oldNumbers);
  const profiles=(await db.query('select * from public.social_profiles')).rows;
  assert.equal(profiles.length,3);assert.ok(profiles.every(p=>p.discoverable));
  assert.equal(profiles.find(p=>p.user_id===alice).avatar_path,'existing-avatar.jpg');
  assert.equal(profiles.find(p=>p.user_id===bob).display_name,'Борис');
  const aliceNumber=profiles.find(p=>p.user_id===alice).handle;
  const as=async(id,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec(`set role ${role}`);};
  const call=async(sql,args=[])=> (await db.query(sql,args)).rows[0].data;
  const find=number=>call('select public.social_find($1) as data',[number]);
  await as(bob);
  const found=await find(aliceNumber);assert.equal(found.user_id,alice);
  assert.equal((await find('#'+aliceNumber)).user_id,alice);
  assert.equal(await find(aliceNumber+'99'),null);assert.equal(await find(''),null);
  assert.deepEqual(Object.keys(found).sort(),['avatar_path','display_name','handle','relationship','requested_by','user_id','viewer_id'].sort());
  await assert.rejects(db.query('select * from public.social_profiles'),/permission denied/);
  await assert.rejects(call('select public.social_update_profile($1,$2,$3,$4) as data',['Wrong owner',aliceNumber,false,alice]),/owner changed/);

  await as(alice);
  assert.equal(await find(aliceNumber),null);
  const update=enabled=>call('select public.social_update_profile($1,$2,$3,$4) as data',['Алиса обновлена',aliceNumber,enabled,alice]);
  await update(false);
  assert.equal((await call('select public.social_own_profile() as data')).discoverable,false);
  await call('select public.social_set_avatar(null,$1) as data',[alice]);
  await as(bob);assert.equal(await find(aliceNumber),null);
  assert.equal(await call('select public.social_profile($1) as data',[alice]),null);

  // Existing friends retain their relationship and profile access after an opt-out.
  await db.exec('reset role');
  await db.query("insert into public.social_relationships(user_low,user_high,requested_by,state) values($1,$2,$1,'accepted')",[alice,bob]);
  await as(bob);assert.equal((await call('select public.social_profile($1) as data',[alice])).user_id,alice);assert.equal(await find(aliceNumber),null);
  await as(alice);assert.equal((await call('select public.social_own_profile() as data')).discoverable,false);
  await update(true);
  await as(bob);assert.equal((await find(aliceNumber)).user_id,alice);
  await call("select public.social_friend_action($1,'block',$2) as data",[alice,bob]);
  assert.equal(await find(aliceNumber),null);
  await as(alice);assert.equal(await find(profiles.find(p=>p.user_id===bob).handle),null);

  // Signup creates a searchable profile before social_own_profile is ever called.
  await as(null,'anon');await assert.rejects(find(aliceNumber),/permission denied/);
  await db.exec('reset role');
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'private@example.test','{\"name\":\"  \"}')",[newUser]);
  const created=(await db.query('select * from public.social_profiles where user_id=$1',[newUser])).rows[0];
  assert.equal(created.discoverable,true);assert.equal(created.display_name,'DAYRIS');
  await as(bob);assert.equal((await find(created.handle)).user_id,newUser);
  assert.ok(!JSON.stringify(await find(created.handle)).includes('private@example.test'));
  await as(newUser);await call('select public.social_update_profile($1,$2,false,$3) as data',['Новое имя',created.handle,newUser]);
  await as(bob);assert.equal(await find(created.handle),null);
  await as(newUser);assert.equal((await call('select public.social_own_profile() as data')).discoverable,false);
 }finally{await db.close();}
});
