import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {createRequire} from 'node:module';
const {PGlite}=createRequire('D:/ai-trade-journal/android/app/build/widget-sql-test/package.json')('@electric-sql/pglite');
const alice='11111111-1111-4111-8111-111111111111',bob='22222222-2222-4222-8222-222222222222';
test('notification feed unifies real sources, synchronizes reading, hides only notifications, isolates owners and records verification/subscription events',async()=>{
 const db=new PGlite();await db.waitReady;try{
 await db.exec(`create role authenticated;create role anon;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;
 create table public.creator_campaigns(id uuid primary key default gen_random_uuid(),status text,kind text,title text,body text,sent_at timestamptz default now());
 create table public.creator_messages(id uuid primary key default gen_random_uuid(),campaign_id uuid,user_id uuid,pro_until timestamptz,read_at timestamptz);
 create table public.pro_notifications(id uuid primary key default gen_random_uuid(),user_id uuid,creator_message_id uuid,starts_at timestamptz default now(),ends_at timestamptz,created_at timestamptz default now(),seen_at timestamptz);
 create table public.social_verifications(user_id uuid primary key references auth.users(id) on delete cascade,verified_at timestamptz not null default now());
 create table public.pro_subscriptions(id uuid primary key,user_id uuid,status text,ends_at timestamptz,provider text);
 `);await db.query('insert into auth.users values($1),($2)',[alice,bob]);await db.query('insert into public.social_verifications(user_id) values($1)',[alice]);
 await db.exec(await fs.readFile('supabase/migrations/202611050003_notification_center.sql','utf8'));
 const as=async id=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id||'']);await db.exec('set role authenticated');};
 const feed=async(owner=alice,unread=false,offset=0)=>(await db.query('select public.dayris_notification_feed($1,$2,20,$3) as data',[owner,unread,offset])).rows[0].data;
 const act=(key,action,owner=alice)=>db.query('select public.dayris_notification_action($1,$2,$3)',[owner,key,action]);
 await as(alice);let page=await feed();assert.equal(page.rows.length,1);const verified=page.rows[0];assert.equal(page.celebration.entry_key,verified.entry_key);await act(verified.entry_key,'presented');page=await feed();assert.equal(page.celebration,null);assert.equal(page.unread_count,1);await act(verified.entry_key,'read');assert.equal((await feed()).unread_count,0);
 await as(bob);assert.equal((await feed(bob)).rows.length,0);await assert.rejects(feed(alice),/Account changed/);await act(verified.entry_key,'delete',bob);await assert.rejects(db.query('select * from public.dayris_notification_entries'),/permission denied/);await assert.rejects(db.query('insert into public.dayris_account_events(user_id,kind,source_key) values($1,$2,$3)',[bob,'verified','fake']),/permission denied/);
 await db.exec('reset role');const campaign=(await db.query("insert into public.creator_campaigns(status,kind,title,body) values('sent','notice','Подарок','Только для Алисы') returning id")).rows[0].id;
 const message=(await db.query("insert into public.creator_messages(campaign_id,user_id,pro_until) values($1,$2,now()+interval '1 year') returning id",[campaign,alice])).rows[0].id;
 await db.query("insert into public.pro_notifications(user_id,creator_message_id,ends_at) values($1,$2,now()+interval '1 year')",[alice,message]);
 const pro=(await db.query("insert into public.pro_notifications(user_id,ends_at) values($1,now()+interval '1 month') returning id",[alice])).rows[0].id;
 const draft=(await db.query("insert into public.creator_campaigns(status,kind,title,body) values('draft','notice','Draft','Secret') returning id")).rows[0].id;await db.query('insert into public.creator_messages(campaign_id,user_id) values($1,$2)',[draft,alice]);
 await as(alice);page=await feed();assert.equal(page.rows.length,3);assert.equal(page.unread_count,2);assert.ok(!JSON.stringify(page).includes('Secret'));assert.equal(page.rows.filter(r=>r.kind==='gift').length,1);
 await act('creator:'+message,'read');await db.exec('reset role');assert.ok((await db.query('select seen_at from public.pro_notifications where creator_message_id=$1',[message])).rows[0].seen_at);await as(alice);await act('creator:'+message,'delete');await act('creator:'+message,'delete');assert.equal((await feed()).rows.length,2);
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from public.creator_messages where id=$1',[message])).rows[0].n,1);assert.equal((await db.query('select count(*)::int n from public.pro_notifications where creator_message_id=$1',[message])).rows[0].n,1);
 // Reading through an existing PRO notice is reflected without copying read state.
 await db.query('update public.pro_notifications set seen_at=now() where id=$1',[pro]);await as(alice);assert.equal((await feed()).unread_count,0);
 await db.exec('reset role');await db.query('delete from public.social_verifications where user_id=$1',[alice]);await as(alice);assert.equal((await feed()).celebration,null);assert.equal((await feed(alice,true)).rows[0].kind,'verification_removed');
 await db.exec('reset role');await db.query('insert into public.social_verifications(user_id) values($1)',[alice]);const subscription=crypto.randomUUID();await db.query("insert into public.pro_subscriptions values($1,$2,'active',now()+interval '1 month','lemon_squeezy')",[subscription,alice]);await db.query('update public.pro_subscriptions set status=status where id=$1',[subscription]);assert.equal((await db.query("select count(*)::int n from public.dayris_account_events where kind='pro'")).rows[0].n,1);
 await as(alice);assert.ok((await feed()).celebration);await act(null,'read_all');assert.equal((await feed()).unread_count,0);assert.equal((await feed()).celebration,null);
 await as(bob);assert.equal((await feed(bob)).total,0);await db.exec('reset role;set role anon');await assert.rejects(feed(),/permission denied/);
 }finally{await db.close();}
});
