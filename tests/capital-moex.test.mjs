import test from 'node:test';
import assert from 'node:assert/strict';
import { MOEX_POPULAR_BONDS, MOEX_POPULAR_STOCKS, normalizeMoexCatalog, normalizeMoexQuotes, searchMoexSecurities } from '../src/features/capital/moexMarket.js';
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

test('full MOEX directory separates traded shares, ETFs and bonds and drops inactive securities', () => {
  const columns=['SECID','SHORTNAME','STATUS','MATDATE','ISIN','SECTYPE','CURRENCYID','FACEUNIT','BONDTYPE','BONDSUBTYPE','SECNAME'];
  const shares={securities:{columns,data:[
    ['SBER','Сбербанк','A',null,'RU0009029540','1','SUR','SUR',null,null,'Сбербанк ао'],
    ['SBER','Сбербанк','A',null,'RU0009029540','1','SUR','SUR',null,null,'Сбербанк ао'],
    ['SBMX','SBMX ETF','A',null,'RU000A0ZZH92','J','SUR','SUR',null,null,'БПИФ Первая'],
    ['OLD','Старая акция','D',null,'RU0000000000','1','SUR','SUR',null,null,'Архивная'],
  ]}};
  const bonds={securities:{columns,data:[
    ['SU26254RMFS1','ОФЗ 26254','A','2040-10-03','RU000A10D533','3','SUR','SUR','Облигация федерального займа','До погашения','ОФЗ-ПД'],
    ['RU000A10AAA1','Регион 1','A','2030-01-01','RU000A10AAA1','3','RUB','RUB','Облигация субъекта РФ','Региональная','Облигация региона'],
  ]}};
  const stocks=normalizeMoexCatalog(shares,'stock');
  const etfs=normalizeMoexCatalog(shares,'etf');
  const bondItems=normalizeMoexCatalog(bonds,'bond');
  assert.deepEqual(stocks.map(item=>item.symbol),['SBER']);
  assert.deepEqual(etfs.map(item=>item.symbol),['SBMX']);
  assert.equal(bondItems.length,2);
  assert.equal(bondItems.find(item=>item.symbol==='SU26254RMFS1').bondGroup,'ofz');
  assert.equal(bondItems.find(item=>item.symbol==='RU000A10AAA1').bondGroup,'municipal');
  assert.equal(bondItems.find(item=>item.symbol==='SU26254RMFS1').currency,'RUB');
});

test('MOEX prices use primary boards for Russian corporate bonds and ETFs as well as blue chips', () => {
  const securities={columns:['SECID','BOARDID','PREVPRICE','FACEVALUE','ACCRUEDINT','CURRENCYID','FACEUNIT'],data:[
    ['RU000A10AAA1','TQCB','98.5','1000','12.2','SUR','SUR'],
    ['SBMX','TQTF','120','1',null,'SUR','SUR'],
  ]};
  const marketdata={columns:['SECID','BOARDID','LAST','MARKETPRICE','CLOSEPRICE','SYSTIME','UPDATETIME'],data:[
    ['RU000A10AAA1','TQCB',null,'98.5',null,'2026-10-10 07:15:09','07:15:09'],
    ['SBMX','TQTF',null,'120',null,'2026-10-10 07:15:09','07:15:09'],
  ]};
  assert.equal(normalizeMoexQuotes({securities,marketdata},'bonds',NOW).RU000A10AAA1.price,'997.2');
  assert.equal(normalizeMoexQuotes({securities,marketdata},'shares',NOW).SBMX.price,'120');
});

test('MOEX quote resolution requires matching currency and marks quotes stale after the exchange session ages out', () => {
  const quote={price:'281.82',currency:'RUB',at:NOW,transport:'moex-delay'};
  assert.equal(resolveCurrentPrice({quote_source:'moex',currency:'RUB'},quote),'281.82');
  assert.equal(resolveCurrentPrice({quote_source:'moex',currency:'USD'},quote),null);
  assert.equal(isMoexQuoteFresh(quote,NOW+60_000),true);
  assert.equal(isMoexQuoteFresh(quote,NOW+37*60*60_000),false);
});
