import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSnapshot, safeError } from './sync.mjs';
const source = { account_id:'47484897',is_live:false,start_date:'2026-10-05',time_zone:'Europe/Bucharest',user_id:'owner',source_account_id:'private' };
const deal = { dealId:'9223372036854775807',symbolId:12,tradeSide:2,dealStatus:2,executionTimestamp:Date.parse('2026-10-05T10:00:00Z'),closePositionDetail:{grossProfit:12345,swap:-100,commission:-200,pnlConversionFee:5,moneyDigits:2},comment:'private comment' };
function fixture({ deals=[deal], accountId='47484897', live=false, fail=null, truncated=false, expired=false }={}) {
  let closes=0,refreshed=0;
  const requests=[];
  return {
    deps:{ now:()=>Date.parse('2026-10-23T10:00:00Z'),
      refresh:async()=>{refreshed++; return {access_token:'new'};},
      connect:async isLive=>{assert.equal(isLive,false);return {
        close:()=>{closes++;},
        request:async(type,payload)=>{
          requests.push({type,payload});
          if(fail)throw new Error(fail);
          if(type===2149){ if(expired && refreshed===0)throw new Error('TOKEN_INVALID');return {ctidTraderAccount:[{ctidTraderAccountId:accountId,isLive:live}]}; }
          if(type===2102)return {};
          if(type===2121)return {trader:{depositAssetId:1}};
          if(type===2112)return {asset:[{assetId:1,name:'USD'}]};
          if(type===2114)return {symbol:[{symbolId:12,symbolName:'XAUUSD'}]};
          if(type===2133)return {deal:deals,hasMore:truncated};
          throw new Error('UNEXPECTED_REQUEST');
        },
      };},
    }, get closes(){return closes;},get refreshed(){return refreshed;},requests,
  };
}
test('only closed broker deals from local 5 October are published; private data never copied',async()=>{
  const f=fixture({deals:[deal,{...deal},
    {...deal,dealId:'2',executionTimestamp:Date.parse('2026-10-04T20:59:59Z')},
    {...deal,dealId:'3',executionTimestamp:Date.parse('2026-10-04T21:00:00Z')},
    {...deal,dealId:'4',closePositionDetail:undefined},
    {...deal,dealId:'5',dealStatus:4},
  ]});
  const result=await collectSnapshot(source,{access_token:'secret'},f.deps);
  assert.equal(result.currency,'USD');assert.equal(result.deals.length,2);
  assert.deepEqual(result.deals[0],{deal_id:deal.dealId,date_key:'2026-10-05',time:'13:00',instrument:'XAUUSD',direction:'LONG',pnl:'120.40',currency:'USD'});
  assert.equal(result.deals[1].time,'00:00');assert.equal(f.closes,1);
  assert.equal(f.requests.some(r=>![2149,2102,2121,2112,2114,2133].includes(r.type)),false,'no trading commands');
});
test('wrong account, wrong environment, incomplete history and connection errors fail closed',async()=>{
  for(const options of [{accountId:'999'},{live:true},{fail:'CTRADER_TIMEOUT'},{truncated:true}]) {
    const f=fixture(options);await assert.rejects(collectSnapshot(source,{access_token:'secret'},f.deps));assert.equal(f.closes,1);
  }
});
test('expired credentials refresh once without returning tokens',async()=>{
  const f=fixture({expired:true});const result=await collectSnapshot(source,{access_token:'expired'},f.deps);
  assert.equal(f.refreshed,1);assert.equal(f.closes,2);assert.equal(JSON.stringify(result).includes('access_token'),false);
  assert.equal(safeError(new Error('secret https://upstream/?token=private')),'SYNC_FAILED');
});
