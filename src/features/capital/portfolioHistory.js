import { calculateReturnPercent, MONEY_SCALE, multiplyScaled, parseScaled, QUANTITY_SCALE, scaledToString } from './decimal.js';
import { currencyRateOn } from './currencyRates.js';

const RANGE_DAYS = { week: 7, month: 30, quarter: 90, year: 365 };

export function calculatePortfolioPeriodResults(snapshots, operations, range = 'all', today = new Date(), fxSeries = {}, targetCurrency = 'USD') {
  const groups = new Map();
  for (const row of snapshots || []) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row?.sampled_on || ''))) continue;
    const rows = groups.get(row.currency) || [];
    rows.push(row);
    groups.set(row.currency, rows);
  }
  const days = RANGE_DAYS[range];
  const cutoff = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  if (days) cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const cutoffKey = days ? cutoff.toISOString().slice(0, 10) : null;

  const byCurrency = [...groups].map(([currency, rows]) => {
    const sorted = rows.slice().sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
    const candidates = cutoffKey ? sorted.filter(row => row.sampled_on <= cutoffKey) : [];
    const start = cutoffKey ? candidates.at(-1) || sorted.find(row => row.sampled_on >= cutoffKey) : sorted[0];
    const end = sorted.at(-1);
    if (!start || !end || start.sampled_on >= end.sampled_on) return { currency, start, end, result: null, percent: null, baseResult: null, basePercent: null, buys: 0n, sales: 0n, dividends: 0n, returnBasis: null, baseReturnBasis: null };

    let buys = 0n, sales = 0n, dividends = 0n, weightedFlows = 0n;
    let baseBuys = 0n, baseSales = 0n, baseDividends = 0n, baseWeightedFlows = 0n, fxComplete = true;
    const startTime = Date.parse(`${start.sampled_on}T00:00:00Z`);
    const endTime = Date.parse(`${end.sampled_on}T00:00:00Z`);
    const periodDays = Math.max(1, Math.round((endTime - startTime) / 86_400_000));
    for (const row of operations || []) {
      if (row.currency !== currency || row.occurred_on <= start.sampled_on || row.occurred_on > end.sampled_on) continue;
      if (row.operation === 'revalue') continue;
      const amount = multiplyScaled(parseScaled(row.quantity || '0', QUANTITY_SCALE), QUANTITY_SCALE, parseScaled(row.unit_price || '0', MONEY_SCALE), MONEY_SCALE);
      const fee = parseScaled(row.fee || '0', MONEY_SCALE);
      const flowDate = Date.parse(`${row.occurred_on}T00:00:00Z`);
      const weight = BigInt(Math.max(0, Math.min(periodDays, Math.round((endTime - flowDate) / 86_400_000))));
      const fx = currencyRateOn(fxSeries, currency, targetCurrency, row.occurred_on);
      const baseAmount = fx ? multiplyScaled(amount, MONEY_SCALE, fx, MONEY_SCALE) : 0n;
      const baseFee = fx ? multiplyScaled(fee, MONEY_SCALE, fx, MONEY_SCALE) : 0n;
      if (row.operation === 'buy') { const contribution=amount+fee;buys+=contribution;weightedFlows+=contribution*weight/BigInt(periodDays);if(fx){const baseContribution=baseAmount+baseFee;baseBuys+=baseContribution;baseWeightedFlows+=baseContribution*weight/BigInt(periodDays);}else fxComplete=false; }
      else if (row.operation === 'sell') { const proceeds = amount - fee; sales += proceeds; weightedFlows -= proceeds * weight / BigInt(periodDays); if(fx){const baseProceeds=baseAmount-baseFee;baseSales+=baseProceeds;baseWeightedFlows-=baseProceeds*weight/BigInt(periodDays);} else fxComplete=false; }
      else if (row.operation === 'dividend') { dividends += amount - fee; if(fx)baseDividends+=baseAmount-baseFee; else fxComplete=false; }
    }
    const startValue = parseScaled(start.portfolio_value, MONEY_SCALE);
    const endValue = parseScaled(end.portfolio_value, MONEY_SCALE);
    const result = endValue - startValue - buys + sales + dividends;
    const returnBasis = startValue + weightedFlows;
    const percent = calculateReturnPercent(result, returnBasis);
    const startFx=currencyRateOn(fxSeries,currency,targetCurrency,start.sampled_on), endFx=currencyRateOn(fxSeries,currency,targetCurrency,end.sampled_on);
    if(!startFx||!endFx)fxComplete=false;
    const baseStart=startFx?multiplyScaled(startValue,MONEY_SCALE,startFx,MONEY_SCALE):null;
    const baseEnd=endFx?multiplyScaled(endValue,MONEY_SCALE,endFx,MONEY_SCALE):null;
    const baseResult=fxComplete&&baseStart!==null&&baseEnd!==null?baseEnd-baseStart-baseBuys+baseSales+baseDividends:null;
    const baseReturnBasis=fxComplete&&baseStart!==null?baseStart+baseWeightedFlows:null;
    const basePercent=baseResult!==null&&baseReturnBasis!==null?calculateReturnPercent(baseResult,baseReturnBasis):null;
    return { currency, start, end, result, percent, baseResult, basePercent, baseReturnBasis, buys, sales, dividends, returnBasis };
  }).sort((a, b) => a.currency.localeCompare(b.currency));
  const unsupported = byCurrency.filter(row => row.currency === 'USDT').map(row => row.currency);
  const complete = byCurrency.length>0&&!unsupported.length&&byCurrency.every(row=>row.result!==null&&row.baseResult!==null&&row.baseReturnBasis!==null);
  const consolidated = complete
    ? byCurrency.reduce((all, row) => ({ result: all.result + row.baseResult, basis: all.basis + row.baseReturnBasis }), { result: 0n, basis: 0n })
    : null;
  return { byCurrency, consolidated: consolidated ? { currency: targetCurrency, result: consolidated.result, returnBasis: consolidated.basis, percent: calculateReturnPercent(consolidated.result, consolidated.basis) } : null, missingFx: byCurrency.filter(row => row.result !== null && row.baseResult === null && row.currency !== 'USDT').map(row => row.currency), unsupported };
}

export function filterPortfolioSnapshots(rows, range = 'all', today = new Date()) {
  const valid = (rows || []).filter(row => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.sampled_on || '')));
  const days = RANGE_DAYS[range];
  if (!days) return valid.slice().sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
  const cutoff = new Date(`${today.toISOString().slice(0, 10)}T00:00:00.000Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days + 1);
  const dateKey = cutoff.toISOString().slice(0, 10);
  return valid.filter(row => row.sampled_on >= dateKey).sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
}

// Build one honest portfolio series in the app's base currency. Each point is
// derived only from saved valuations; missing or stale currency snapshots are
// left out instead of being filled with invented prices.
export function buildConsolidatedPortfolioSnapshots(snapshots, currencies, fxSeries = {}, targetCurrency = 'USD') {
  const included = [...new Set(currencies)].filter(code => code !== 'USDT');
  if (!included.length) return [];
  const byCurrency = new Map();
  for (const row of snapshots || []) {
    if (!included.includes(row.currency) || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.sampled_on || ''))) continue;
    const rows = byCurrency.get(row.currency) || [];
    rows.push(row);
    byCurrency.set(row.currency, rows);
  }
  if (included.some(code => !byCurrency.has(code))) return [];
  for (const rows of byCurrency.values()) rows.sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
  const dates = [...new Set([...byCurrency.values()].flatMap(rows => rows.map(row => row.sampled_on)))].sort();
  return dates.flatMap(date => {
    let total = 0n;
    for (const code of included) {
      const row = byCurrency.get(code).filter(item => item.sampled_on <= date).at(-1);
      if (!row) return [];
      const age = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${row.sampled_on}T00:00:00Z`);
      if (age < 0 || age > 7 * 86_400_000) return [];
      const rate = currencyRateOn(fxSeries, code, targetCurrency, date);
      if (!rate) return [];
      total += multiplyScaled(parseScaled(row.portfolio_value, MONEY_SCALE), MONEY_SCALE, rate, MONEY_SCALE);
    }
    return [{ sampled_on: date, currency: targetCurrency, portfolio_value: scaledToString(total, MONEY_SCALE) }];
  });
}

export function buildPortfolioReturnSeries(snapshots, operations, fxSeries = {}, targetCurrency = 'USD') {
  const sorted = (snapshots || []).slice().sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
  if (!sorted.length) return [];
  const indexBase = 100n * 10n ** BigInt(MONEY_SCALE);
  let index = indexBase;
  const output = [{ ...sorted[0], portfolio_value: scaledToString(index, MONEY_SCALE) }];
  for (let i = 1; i < sorted.length; i++) {
    const start = sorted[i - 1], end = sorted[i];
    const startValue = parseScaled(start.portfolio_value, MONEY_SCALE);
    const endValue = parseScaled(end.portfolio_value, MONEY_SCALE);
    const startTime = Date.parse(`${start.sampled_on}T00:00:00Z`);
    const endTime = Date.parse(`${end.sampled_on}T00:00:00Z`);
    const span = Math.max(1, Math.round((endTime - startTime) / 86_400_000));
    let buys = 0n, sales = 0n, dividends = 0n, weightedFlows = 0n;
    for (const row of operations || []) {
      if (row.occurred_on <= start.sampled_on || row.occurred_on > end.sampled_on) continue;
      if (row.operation === 'revalue') continue;
      const rate = currencyRateOn(fxSeries, row.currency, targetCurrency, row.occurred_on);
      if (!rate) continue;
      const amount = multiplyScaled(multiplyScaled(parseScaled(row.quantity || '0', QUANTITY_SCALE), QUANTITY_SCALE, parseScaled(row.unit_price || '0', MONEY_SCALE)), MONEY_SCALE, rate);
      const fee = multiplyScaled(parseScaled(row.fee || '0', MONEY_SCALE), MONEY_SCALE, rate);
      const flowDate = Date.parse(`${row.occurred_on}T00:00:00Z`);
      const weight = BigInt(Math.max(0, Math.min(span, Math.round((endTime - flowDate) / 86_400_000))));
      if (row.operation === 'buy') { const flow = amount + fee; buys += flow; weightedFlows += flow * weight / BigInt(span); }
      else if (row.operation === 'sell') { const flow = amount - fee; sales += flow; weightedFlows -= flow * weight / BigInt(span); }
      else if (row.operation === 'dividend') dividends += amount - fee;
    }
    const basis = startValue + weightedFlows;
    const periodReturn = calculateReturnPercent(endValue - startValue - buys + sales + dividends, basis);
    if (periodReturn !== null) index = multiplyScaled(index, MONEY_SCALE, 10_000n + periodReturn, 4);
    output.push({ ...end, portfolio_value: scaledToString(index, MONEY_SCALE) });
  }
  return output;
}

export function buildPortfolioChart(rows) {
  const sorted = (rows || []).slice().sort((a, b) => a.sampled_on.localeCompare(b.sampled_on));
  if (sorted.length < 2) return { linePath: '', areaPath: '', rows: sorted, points: [] };
  const values = sorted.map(row => parseScaled(row.portfolio_value, MONEY_SCALE));
  const min = values.reduce((a, b) => a < b ? a : b);
  const max = values.reduce((a, b) => a > b ? a : b);
  const span = max - min || 1n;
  const points = values.map((value, index) => ({
    x: 12 + index * (296 / (values.length - 1)),
    y: 100 - Number((value - min) * 7600n / span) / 100,
    value,
    date: sorted[index].sampled_on,
  }));
  const linePath = points.map(({ x, y }, index) => `${index ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const last = points.at(-1);
  const areaPath = `${linePath} L${last.x.toFixed(1)} 112 L${points[0].x.toFixed(1)} 112 Z`;
  return { linePath, areaPath, rows: sorted, points, min, max };
}
