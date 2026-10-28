import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const { PGlite } = createRequire(path.resolve('android/app/build/widget-sql-test/package.json'))('@electric-sql/pglite');

test('hourly publication is 08–20 Bucharest across DST, replaces daily job, and preserves other jobs', async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec(`create schema cron; create schema net; create schema vault;
      create table cron.job(jobid serial primary key, jobname text unique, schedule text, command text);
      create function cron.schedule(text,text,text) returns integer language sql as $$
        insert into cron.job(jobname,schedule,command) values($1,$2,$3)
        on conflict(jobname) do update set schedule=$2,command=$3 returning jobid $$;
      create function cron.unschedule(integer) returns boolean language sql as $$
        delete from cron.job where jobid=$1 returning true $$;
      create table vault.decrypted_secrets(name text, decrypted_secret text);
      insert into vault.decrypted_secrets values('dayris_cron_secret','test-only');
      create table net.requests(url text);
      create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds integer)
      returns bigint language sql as $$ insert into net.requests values($1) returning 1::bigint $$;
      insert into cron.job(jobname,schedule) values('dayris-bot-calendar-daily','15 0 * * *'),('other-reminders','* * * * *');`);
    // PGlite has no pg_cron/pg_net extensions; execute the actual schedule SQL
    // against signature-compatible stubs, including its local-time WHERE guard.
    const sql=(await readFile('supabase/bot-calendar-schedule.sql','utf8')).replace(/^create extension.*;\r?\n/gm,'');
    await db.exec(sql); await db.exec(sql);
    const jobs=(await db.query('select * from cron.job order by jobname')).rows;
    assert.deepEqual(jobs.map(x=>x.jobname),['dayris-bot-calendar-hourly','other-reminders']);
    assert.equal(jobs[1].schedule,'* * * * *');
    const hourly=jobs[0]; assert.equal(hourly.schedule,'0 5-18 * * *');
    for(const date of ['2026-01-15','2026-07-15','2026-03-29','2026-10-25']) {
      const fired=[];
      for(let hour=5;hour<=18;hour++) {
        const timestamp=`${date}T${String(hour).padStart(2,'0')}:00:00Z`;
        const result=await db.query(hourly.command.replace('now()',`timestamptz '${timestamp}'`));
        if(result.rows.length) fired.push((await db.query(`select extract(hour from timestamptz '${timestamp}' at time zone 'Europe/Bucharest')::int as hour`)).rows[0].hour);
      }
      assert.deepEqual(fired,Array.from({length:13},(_,i)=>i+8),date);
    }
  } finally {await db.close();}
});
