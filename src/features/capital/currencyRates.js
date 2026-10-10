import { MONEY_SCALE, multiplyScaled, parseScaled, QUANTITY_SCALE } from './decimal.js';

export async function fetchDailyCurrencyRates(sourceCurrencies, targetCurrency, from, to, signal) {
  const unique = [...new Set(sourceCurrencies)].filter(code => /^[A-Z]{3}$/.test(code) && code !== targetCurrency);
  const entries = await Promise.all(unique.map(async base => {
    const params = new URLSearchParams({ base, quotes: targetCurrency, from, to });
    const response = await fetch(`https://api.frankfurter.dev/v2/rates?${params}`, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Exchange rates unavailable (${response.status}).`);
    const rows = await response.json();
    return [base, Array.isArray(rows) ? rows.filter(row => row.base === base && row.quote === targetCurrency && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(Number(row.rate))).map(row => ({ date: row.date, rate: String(row.rate) })).sort((a, b) => a.date.localeCompare(b.date)) : []];
  }));
  return Object.fromEntries(entries);
}

export function currencyRateOn(series, source, target, date) {
  if (source === target) return 10n ** BigInt(MONEY_SCALE);
  const rows = series?.[source];
  if (!rows?.length) return null;
  let selected = null;
  for (const row of rows) {
    if (row.date > date) break;
    selected = row;
  }
  if (!selected) return null;
  const age = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${selected.date}T00:00:00Z`);
  if (!Number.isFinite(age) || age > 7 * 86_400_000) return null;
  try { return parseScaled(selected.rate, MONEY_SCALE); } catch { return null; }
}

export function calculateBasePortfolioResult(assets, series, target, date, priceFor) {
  let realized=0n,unrealized=0n,value=0n,basis=0n,excludedUsdt=null;
  const incomplete=new Set();
  for(const asset of assets||[]){
    const currentPrice=priceFor(asset);
    if(asset.currency==='USDT'){
      if(currentPrice!==null){const currentNative=multiplyScaled(asset.quantity,QUANTITY_SCALE,currentPrice,MONEY_SCALE);excludedUsdt=(excludedUsdt||0n)+currentNative;}
      else incomplete.add('USDT');
      continue;
    }
    let quantity=0n,costBasis=0n,assetRealized=0n,complete=true;
    const rows=(asset.rows||[]).slice().sort((a,b)=>String(a.occurred_on).localeCompare(String(b.occurred_on))||String(a.created_at).localeCompare(String(b.created_at))||String(a.id).localeCompare(String(b.id)));
    for(const row of rows){
      if(row.operation==='revalue')continue;
      const rate=currencyRateOn(series,asset.currency,target,row.occurred_on);
      if(!rate){complete=false;continue;}
      const q=parseScaled(row.quantity||'0',QUANTITY_SCALE),price=parseScaled(row.unit_price||'0',MONEY_SCALE),fee=parseScaled(row.fee||'0',MONEY_SCALE);
      const native=multiplyScaled(q,QUANTITY_SCALE,price,MONEY_SCALE),baseAmount=multiplyScaled(native,MONEY_SCALE,rate,MONEY_SCALE),baseFee=multiplyScaled(fee,MONEY_SCALE,rate,MONEY_SCALE);
      if(row.operation==='buy'){quantity+=q;costBasis+=baseAmount+baseFee;basis+=baseAmount+baseFee;}
      else if(row.operation==='sell'){
        if(q>quantity){complete=false;continue;}
        const allocated=quantity?(costBasis*q+quantity/2n)/quantity:0n;
        costBasis-=allocated;quantity-=q;assetRealized+=baseAmount-baseFee-allocated;
      } else if(row.operation==='dividend')assetRealized+=baseAmount-baseFee;
    }
    if(currentPrice===null){complete=false;incomplete.add(asset.currency);continue;}
    const currentRate=currencyRateOn(series,asset.currency,target,date);
    if(!currentRate){complete=false;incomplete.add(asset.currency);continue;}
    const currentNative=multiplyScaled(asset.quantity,QUANTITY_SCALE,currentPrice,MONEY_SCALE);
    const currentBase=multiplyScaled(currentNative,MONEY_SCALE,currentRate,MONEY_SCALE);
    const unrealizedBase=currentBase-costBasis;
    value+=currentBase;realized+=assetRealized;unrealized+=unrealizedBase;
    if(!complete)incomplete.add(asset.currency);
  }
  return {value,pnl:realized+unrealized,realized,unrealized,basis,excludedUsdt,incomplete:[...incomplete],complete:incomplete.size===0};
}
