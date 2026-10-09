const DECIMAL_PRICE = /^\d+(?:\.\d+)?$/;
const NON_US_ETFS = new Set(['CSPX', 'VWRA', 'EQQQ', 'VUAA']);

export const TIINGO_SESSION_TOKEN_PREFIX = 'dayris.capital.tiingo.token';
export const TIINGO_QUOTE_CACHE_PREFIX = 'dayris.capital.tiingo.eod';
export const TIINGO_EOD_REFRESH_MS = 6 * 60 * 60_000;

export function isTiingoEodAsset(asset) {
  const symbol = String(asset?.symbol || '').toUpperCase();
  return ['stock', 'etf'].includes(asset?.category)
    && asset?.currency === 'USD'
    && /^[A-Z0-9][A-Z0-9.-]{0,11}$/.test(symbol)
    && !(asset.category === 'etf' && NON_US_ETFS.has(symbol));
}

export function toTiingoSymbol(symbol) {
  return String(symbol || '').trim().toUpperCase().replaceAll('.', '-');
}

export function normalizeTiingoEodQuote(rows, expectedSymbol) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows
    .filter(item => typeof item?.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  const price = row?.close == null ? '' : String(row.close);
  const date = String(row?.date || '').slice(0, 10);
  const at = Date.parse(`${date}T23:59:59Z`);
  if (!expectedSymbol || !DECIMAL_PRICE.test(price) || Number(price) <= 0 || !Number.isFinite(at)) return null;
  return { symbol: String(expectedSymbol).toUpperCase(), price, date, at, transport: 'tiingo-eod' };
}

export function isTiingoEodQuoteFresh(quote, now = Date.now()) {
  if (quote?.transport !== 'tiingo-eod' || !Number.isFinite(Number(quote.at))) return false;
  const age = now - Number(quote.at);
  return age >= -5 * 60_000 && age < 7 * 24 * 60 * 60_000;
}

const safeStorageGet = (storage, key) => {
  try { return storage?.getItem(key) || ''; } catch { return ''; }
};

export function readTiingoToken(userId, storage = globalThis.sessionStorage) {
  if (!userId) return '';
  return safeStorageGet(storage, `${TIINGO_SESSION_TOKEN_PREFIX}:${userId}`);
}

export function writeTiingoToken(userId, token, storage = globalThis.sessionStorage) {
  if (!userId) return;
  try {
    if (token) storage?.setItem(`${TIINGO_SESSION_TOKEN_PREFIX}:${userId}`, token);
    else storage?.removeItem(`${TIINGO_SESSION_TOKEN_PREFIX}:${userId}`);
  } catch {}
}

export function readTiingoQuoteCache(userId, storage = globalThis.localStorage) {
  if (!userId) return { quotes: {}, attemptedAt: {}, requestTimes: [], symbolsByMonth: {} };
  try {
    const value = JSON.parse(safeStorageGet(storage, `${TIINGO_QUOTE_CACHE_PREFIX}:${userId}`) || '{}');
    return {
      quotes: value?.quotes && typeof value.quotes === 'object' ? value.quotes : {},
      attemptedAt: value?.attemptedAt && typeof value.attemptedAt === 'object' ? value.attemptedAt : {},
      requestTimes: Array.isArray(value?.requestTimes) ? value.requestTimes.filter(Number.isFinite) : [],
      symbolsByMonth: value?.symbolsByMonth && typeof value.symbolsByMonth === 'object' ? value.symbolsByMonth : {},
    };
  } catch { return { quotes: {}, attemptedAt: {}, requestTimes: [], symbolsByMonth: {} }; }
}

export function writeTiingoQuoteCache(userId, value, storage = globalThis.localStorage) {
  if (!userId) return;
  try { storage?.setItem(`${TIINGO_QUOTE_CACHE_PREFIX}:${userId}`, JSON.stringify(value)); } catch {}
}

export function clearTiingoQuoteCache(userId, storage = globalThis.localStorage) {
  if (!userId) return;
  try { storage?.removeItem(`${TIINGO_QUOTE_CACHE_PREFIX}:${userId}`); } catch {}
}
