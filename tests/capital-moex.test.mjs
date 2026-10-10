import test from 'node:test';
import assert from 'node:assert/strict';
import { MOEX_POPULAR_BONDS, MOEX_POPULAR_STOCKS, normalizeMoexQuotes, searchMoexSecurities } from '../src/features/capital/moexMarket.js';
import { resolveCurrentPrice } from '../src/features/capital/capitalPricing.js';
import { isMoexQuoteFresh } from '../src/features/capital/quoteStatus.js';
import { MONEY_SCALE, parseScaled } from '../src/features/capital/decimal.js';

const NOW = Date.parse('2026-10-10T04:15:09Z');

test('MOEX share quote is normalized from the primary board in its exchange currency', () => {
  const payload={
    securities:{columns:['SECID','BOARDID','PREVPRICE','FACEVALUE','ACCRUEDINT','CURRENCYID','FACEUNIT'],data:[['SBER','TQBR','275.25',3,null,'SUR','SUR']]},
    marketdata:{columns:['SECID','BOARDID','LAST','MARKETPRICE','CLOSEPRICE','SYSTIME','UPDATETIME'],data:[['SBER','SPEQ',null,'281.82',null,'2026-10-10 07:15:09','07:15:09'],['SBER','TQBR',null,'281.82',null,'2026-10-10 07:15:09','07:15:09']]},
  };
  const quotes=normalizeMoexQuotes(payload,'shares',NOW);
  assert.equal(quotes.SBER.currency,'RUB');
  assert.equal(parseScaled(quotes.SBER.price,MONEY_SCALE),parseScaled('281.82',MONEY_SCALE));
  assert.equal(quotes.SBER.transport,'moex-delay');
});

test('MOEX bond quote converts percent of face value plus accrued coupon into cash per bond exactly', () => {
  const payload={
    securities:{columns:['SECID','BOARDID','PREVPRICE','FACEVALUE','ACCRUEDINT','CURRENCYID','FACEUNIT'],data:[['SU26238RMFS4','TQOB','50.3','1000','25.67','SUR','SUR']]},
    marketdata:{columns:['SECID','BOARDID','LAST','MARKETPRICE','CLOSEPRICE','SYSTIME','UPDATETIME'],data:[['SU26238RMFS4','TQOB',null,'50.252',null,'2026-10-10 07:15:09','07:15:09']]},
  };
  const quote=normalizeMoexQuotes(payload,'bonds',NOW).SU26238RMFS4;
  assert.equal(parseScaled(quote.price,MONEY_SCALE),parseScaled('528.19',MONEY_SCALE));
  assert.equal(quote.currency,'RUB');
});

test('MOEX catalog search uses active Russian securities and exposes stock and bond catalogs', async () => {
  assert.ok(MOEX_POPULAR_STOCKS.some(item=>item.symbol==='SBER'));
  assert.ok(MOEX_POPULAR_BONDS.some(item=>item.symbol==='SU26238RMFS4'));
  const oldFetch=globalThis.fetch;
  globalThis.fetch=async url=>({ok:true,json:async()=>({securities:{columns:['secid','shortname','name','isin','is_traded','type'],data:[['SBER','Сбербанк','Сбербанк России ПАО ао','RU0009029540',1,'common_share']]}})});
  try {
    const results=await searchMoexSecurities('сбер','stock');
    assert.equal(results[0].symbol,'SBER');
    assert.equal(results[0].currency,'RUB');
    assert.equal(results[0].quoteSource,'moex');
  } finally { globalThis.fetch=oldFetch; }
});

test('MOEX quote resolution requires matching currency and marks quotes stale after the exchange session ages out', () => {
  const quote={price:'281.82',currency:'RUB',at:NOW,transport:'moex-delay'};
  assert.equal(resolveCurrentPrice({quote_source:'moex',currency:'RUB'},quote),'281.82');
  assert.equal(resolveCurrentPrice({quote_source:'moex',currency:'USD'},quote),null);
  assert.equal(isMoexQuoteFresh(quote,NOW+60_000),true);
  assert.equal(isMoexQuoteFresh(quote,NOW+37*60*60_000),false);
});
