import { MONEY_SCALE, parseScaled, scaledToString } from './decimal.js';

const API = 'https://iss.moex.com/iss';
const REQUEST_TIMEOUT_MS = 10_000;
const CURRENCY_MAP = { SUR: 'RUB', RUR: 'RUB', RUB: 'RUB', USD: 'USD', CNY: 'CNY', EUR: 'EUR' };

export const MOEX_POPULAR_STOCKS = [
  ['SBER','Сбербанк'],['GAZP','Газпром'],['LKOH','ЛУКОЙЛ'],['YDEX','Яндекс'],['NVTK','НОВАТЭК'],
  ['T','Т-Технологии'],['ROSN','Роснефть'],['GMKN','Норникель'],['VTBR','ВТБ'],['CHMF','Северсталь'],
  ['PLZL','Полюс'],['OZON','Ozon'],['AFLT','Аэрофлот'],['ALRS','АЛРОСА'],['MGNT','Магнит'],
  ['SBERP','Сбербанк, привилегированные'],['MOEX','Московская биржа'],['SNGS','Сургутнефтегаз'],['SNGSP','Сургутнефтегаз, привилегированные'],['TATN','Татнефть'],
  ['TATNP','Татнефть, привилегированные'],['RUAL','РУСАЛ'],['POLY','Полюс'],['PIKK','ПИК'],['MTSS','МТС'],
].map(([symbol,name])=>({symbol,name,currency:'RUB',quoteSource:'moex',marketSource:'moex',category:'stock'}));

export const MOEX_POPULAR_ETFS = [
  ['SBMX','Первая · Топ российских акций'],['TMOS','Т-Капитал · индекс Мосбиржи'],['AKME','Альфа · Управляемые акции'],
  ['SBGB','Первая · государственные облигации'],['SBMM','Первая · денежный рынок'],['TGLD','Т-Капитал · золото'],
  ['EQMX','Индекс Мосбиржи'],['DIVD','Дивидендные акции'],['AMNY','Альфа · денежный рынок'],['CNYM','Китайский юань'],
].map(([symbol,name])=>({symbol,name,currency:'RUB',quoteSource:'moex',marketSource:'moex',category:'etf'}));

export const MOEX_POPULAR_BONDS = [
  ['SU26238RMFS4','ОФЗ 26238 · 2041'],['SU26240RMFS0','ОФЗ 26240 · 2036'],['SU26241RMFS8','ОФЗ 26241 · 2032'],
  ['SU26243RMFS4','ОФЗ 26243 · 2038'],['SU26244RMFS2','ОФЗ 26244 · 2034'],['SU26245RMFS9','ОФЗ 26245 · 2035'],
  ['SU26246RMFS7','ОФЗ 26246 · 2036'],['SU26247RMFS5','ОФЗ 26247 · 2039'],['SU26248RMFS3','ОФЗ 26248 · 2040'],
  ['SU26250RMFS8','ОФЗ 26250 · 2037'],['SU26251RMFS6','ОФЗ 26251 · 2041'],
].map(([symbol,name])=>({symbol,name,currency:'RUB',quoteSource:'moex',marketSource:'moex',category:'bond'}));

function makeRequest(url, signal) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS);
  const abort = () => controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  return fetch(url,{signal:controller.signal,cache:'no-store'}).then(response=>{
    if(!response.ok) throw new Error(`MOEX ISS request failed (${response.status})`);
    return response.json();
  }).finally(()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);});
}

export async function searchMoexSecurities(query, category, signal) {
  const text=String(query||'').trim();
  if(text.length<2) return [];
  const market=category==='bond'?'bonds':'shares';
  const url=new URL(`${API}/securities.json`);
  url.searchParams.set('q',text);
  url.searchParams.set('engine','stock');
  url.searchParams.set('market',market);
  url.searchParams.set('is_trading','1');
  url.searchParams.set('limit','40');
  url.searchParams.set('lang','ru');
  const response=await makeRequest(url,signal);
  const columns=response.securities?.columns||[];
  const index=Object.fromEntries(columns.map((name,i)=>[name.toLowerCase(),i]));
  return (response.securities?.data||[]).flatMap(row=>{
    const symbol=String(row[index.secid]||'').toUpperCase();
    const type=String(row[index.type]||'');
    if(!/^[A-Z0-9-]{1,24}$/.test(symbol)||Number(row[index.is_traded])!==1) return [];
    const group=String(row[index.group]||'');
    const isEtf=type.includes('ppif')||group.includes('ppif')||/\betf\b/i.test(String(row[index.shortname]||''));
    if(category==='stock' && (!['common_share','preferred_share'].includes(type)||isEtf)) return [];
    if(category==='etf' && !isEtf) return [];
    return [{symbol,name:String(row[index.shortname]||row[index.name]||symbol),currency:'RUB',quoteSource:'moex',marketSource:'moex',category,isin:String(row[index.isin]||'')}];
  });
}

export async function fetchMoexCurrency(category, symbol, signal) {
  const url=new URL(`${API}/securities/${encodeURIComponent(String(symbol).toUpperCase())}.json`);
  url.searchParams.set('iss.meta','off');
  url.searchParams.set('iss.only','boards');
  const response=await makeRequest(url,signal);
  const table=response.boards||{}, columns=table.columns||[];
  const index=Object.fromEntries(columns.map((name,i)=>[name.toLowerCase(),i]));
  const primaryBoard=category==='bond'?'TQOB':'TQBR';
  const board=(table.data||[]).find(row=>row[index.boardid]===primaryBoard&&Number(row[index.is_primary])===1)
    ||(table.data||[]).find(row=>row[index.boardid]===primaryBoard);
  const raw=String(board?.[index.currencyid]||'RUB').toUpperCase();
  return CURRENCY_MAP[raw]||null;
}

function dateFromMoex(value) {
  const text=String(value||'');
  if(!text) return 0;
  const normalized=/^\d{2}:\d{2}:\d{2}$/.test(text)?`${new Date().toISOString().slice(0,10)} ${text}`:text;
  const timestamp=Date.parse(`${normalized.replace(' ','T')}+03:00`);
  return Number.isFinite(timestamp)?timestamp:0;
}

function decimalToScaled(value) {
  if(value===null||value===undefined||value==='') return null;
  try { return parseScaled(String(value),MONEY_SCALE); } catch { return null; }
}

function bondCashPrice(marketPrice, faceValue, accruedInterest) {
  const percent=decimalToScaled(marketPrice), face=decimalToScaled(faceValue), accrued=decimalToScaled(accruedInterest)||0n;
  if(percent===null||face===null||face<=0n) return null;
  const product=percent*face, divisor=100n*(10n**BigInt(MONEY_SCALE));
  const cleanPrice=(product+divisor/2n)/divisor;
  return cleanPrice+accrued;
}

export function normalizeMoexQuotes(payload, market, now=Date.now()) {
  const securities=payload.securities||{}, marketdata=payload.marketdata||{};
  const secIndex=Object.fromEntries((securities.columns||[]).map((key,i)=>[key.toUpperCase(),i]));
  const mdIndex=Object.fromEntries((marketdata.columns||[]).map((key,i)=>[key.toUpperCase(),i]));
  const terms=new Map((securities.data||[]).map(row=>[String(row[secIndex.SECID]||'').toUpperCase(),row]));
  const quotes={};
  for(const row of marketdata.data||[]) {
    const symbol=String(row[mdIndex.SECID]||'').toUpperCase();
    const board=String(row[mdIndex.BOARDID]||'');
    if(!symbol||board!==(market==='bonds'?'TQOB':'TQBR')) continue;
    const details=terms.get(symbol)||[];
    const rawPrice=row[mdIndex.MARKETPRICE]??row[mdIndex.LAST]??row[mdIndex.CLOSEPRICE]??details[secIndex.PREVPRICE];
    const currencyId=String(details[secIndex.CURRENCYID]||details[secIndex.FACEUNIT]||'RUB').toUpperCase();
    const currency=CURRENCY_MAP[currencyId]||currencyId;
    let price=decimalToScaled(rawPrice);
    if(market==='bonds') price=bondCashPrice(rawPrice,details[secIndex.FACEVALUE],details[secIndex.ACCRUEDINT]);
    const at=dateFromMoex(row[mdIndex.SYSTIME]||row[mdIndex.UPDATETIME]);
    if(price===null||price<=0n||!at||at>now+5*60_000) continue;
    quotes[symbol]={price:scaledToString(price,MONEY_SCALE),currency,at,transport:'moex-delay',market};
  }
  return quotes;
}

export async function fetchMoexQuotes(category, symbols, signal) {
  const market=category==='bond'?'bonds':'shares';
  const requested=[...new Set(symbols.map(symbol=>String(symbol).toUpperCase()).filter(symbol=>/^[A-Z0-9-]{1,24}$/.test(symbol)))];
  if(!requested.length) return {};
  const output={};
  for(let offset=0;offset<requested.length;offset+=40) {
    const chunk=requested.slice(offset,offset+40), url=new URL(`${API}/engines/stock/markets/${market}/securities.json`);
    url.searchParams.set('iss.meta','off');
    url.searchParams.set('iss.only','securities,marketdata');
    url.searchParams.set('securities',chunk.join(','));
    url.searchParams.set('securities.columns','SECID,BOARDID,PREVPRICE,FACEVALUE,ACCRUEDINT,CURRENCYID,FACEUNIT');
    url.searchParams.set('marketdata.columns','SECID,BOARDID,LAST,MARKETPRICE,CLOSEPRICE,SYSTIME,UPDATETIME');
    Object.assign(output,normalizeMoexQuotes(await makeRequest(url,signal),market));
  }
  return output;
}
