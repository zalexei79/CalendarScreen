// Keep large protocol integers lossless without changing quoted strings.
export function parseMessage(text) {
  return JSON.parse(text.replace(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g,
    token => /^-?\d{16,}$/.test(token) ? JSON.stringify(token) : token));
}

export function id(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('UNSAFE_ID');
  const result = String(value);
  if (!/^\d+$/.test(result)) throw new Error('INVALID_ID');
  return result;
}

export function mapDeal(deal, { userId, accountId, currency, symbols, timeZone = 'UTC' }) {
  if (!deal.closePositionDetail || ![2, 3].includes(Number(deal.dealStatus))) return null;
  if (![1, 2].includes(Number(deal.tradeSide))) throw new Error('INVALID_SIDE');
  const cp = deal.closePositionDetail;
  const digits = Number(cp.moneyDigits ?? 2);
  if (!Number.isInteger(digits) || digits < 0 || digits > 18) throw new Error('INVALID_PRECISION');
  const values = [cp.grossProfit, cp.swap ?? 0, cp.commission ?? 0, cp.pnlConversionFee ?? 0];
  if (values.some(v => !/^-?\d+$/.test(String(v)))) throw new Error('INVALID_MONEY');
  const total = BigInt(values[0]) + BigInt(values[1]) + BigInt(values[2]) - BigInt(values[3]);
  const abs = (total < 0n ? -total : total).toString().padStart(digits + 1, '0');
  const pnl = (total < 0n ? '-' : '') + (digits ? `${abs.slice(0, -digits)}.${abs.slice(-digits)}` : abs);
  const date = new Date(Number(deal.executionTimestamp));
  if (!Number.isFinite(date.getTime())) throw new Error('INVALID_DATE');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(p => [p.type, p.value]));
  if (!currency) throw new Error('CURRENCY_UNKNOWN');
  return {
    user_id: userId, ctrader_account_id: accountId, ctrader_deal_id: id(deal.dealId),
    date_key: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`,
    instrument: symbols.get(id(deal.symbolId)) || `SYMBOL_${id(deal.symbolId)}`,
    direction: Number(deal.tradeSide) === 2 ? 'LONG' : 'SHORT', pnl,
    currency, platform: 'cTrader', comment: deal.comment || '',
  };
}

// Split truncated time ranges; never silently mark a truncated response complete.
export async function readDeals(request, from, to, budget = { remaining: 150 }) {
  if (--budget.remaining < 0) throw new Error('HISTORY_TOO_LARGE');
  const result = await request(from, to);
  if (!result.hasMore) return result.deal || [];
  if (from >= to) throw new Error('HISTORY_TRUNCATED');
  const middle = Math.floor((from + to) / 2);
  return [...await readDeals(request, from, middle, budget),
    ...await readDeals(request, middle + 1, to, budget)];
}
