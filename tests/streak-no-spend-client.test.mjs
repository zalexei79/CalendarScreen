import test from 'node:test';
import assert from 'node:assert/strict';
import { markAccountNoSpend } from '../src/shared/lib/accountActivityStreak.js';
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
function fixture(options={}){
  const cache=new Map(),calls=[];
  const client={auth:{getSession:async()=>({data:{session:{user:{id:options.authOwner||owner},access_token:'checked-session'}}})},
    rpc(name,params){const call={name,params};calls.push(call);const builder={setHeader(key,value){call[key]=value;return builder;},abortSignal(){return builder;},then(resolve,reject){
      return Promise.resolve().then(()=>{options.beforeResponse?.();return {error:options.error,data:{accountId:options.responseOwner||owner,currentStreak:9,lastActiveDate:'2026-10-28',entryDate:'2026-10-28',completedToday:true,noSpendToday:true,serverDate:'2026-10-28',timeZone:'Europe/Bucharest',paused:false,...options.data}};}).then(resolve,reject);
    }};return builder;}};
  return {client,calls,cache,storage:{setItem:(key,value)=>cache.set(key,value)}};
}
test('no-spend request pins the authenticated owner, sends no count or chosen day and caches confirmed marks',async()=>{
  const f=fixture();const result=await markAccountNoSpend({...f,ownerId:owner,timeZone:'Europe/Bucharest'});
  assert.equal(result.noSpendToday,true);assert.equal(result.currentStreak,9);
  assert.equal(f.calls[0].name,'mark_streak_no_spend');
  assert.deepEqual(f.calls[0].params,{p_time_zone:'Europe/Bucharest'});
  assert.equal(f.calls[0].Authorization,'Bearer checked-session');
  assert.equal(JSON.parse(f.cache.get('dayris_activity_streak:'+owner)).noSpendToday,true);
});
test('no-spend errors, account mismatches and cancelled requests never claim success or replace the cache',async()=>{
  for(const options of [{authOwner:other},{responseOwner:other},{error:{message:'STREAK_HAS_EXPENSES'}},{data:{noSpendToday:false}}]){
    const f=fixture(options);await assert.rejects(markAccountNoSpend({...f,ownerId:owner}));assert.equal(f.cache.size,0);
  }
  const abort=new AbortController();const f=fixture({beforeResponse:()=>abort.abort()});
  await assert.rejects(markAccountNoSpend({...f,ownerId:owner,signal:abort.signal}),/Aborted/);assert.equal(f.cache.size,0);
});
