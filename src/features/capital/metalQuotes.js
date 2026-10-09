const GOLD_API_SYMBOLS = new Set(['XAU', 'XAG', 'XPT', 'XPD']);
const DECIMAL_PRICE = /^\d+(?:\.\d+)?$/;

export function isGoldApiAsset(asset) {
  return asset?.category === 'metal'
    && asset?.currency === 'USD'
    && GOLD_API_SYMBOLS.has(String(asset?.symbol || '').toUpperCase());
}

export function normalizeGoldApiQuote(data, expectedSymbol) {
  const symbol = String(expectedSymbol || '').toUpperCase();
  const price = data?.price == null ? '' : String(data.price);
  const at = Date.parse(data?.updatedAt || '');
  if (!GOLD_API_SYMBOLS.has(symbol)
    || String(data?.symbol || '').toUpperCase() !== symbol
    || String(data?.currency || '').toUpperCase() !== 'USD'
    || !DECIMAL_PRICE.test(price)
    || Number(price) <= 0
    || !Number.isFinite(at)) return null;
  return { price, at, transport: 'gold-api' };
}

export async function fetchGoldApiQuote(symbol, signal) {
  const normalizedSymbol = String(symbol || '').toUpperCase();
  if (!GOLD_API_SYMBOLS.has(normalizedSymbol)) throw new Error('Unsupported metal spot symbol.');
  const requestController = new AbortController();
  const abortRequest = () => requestController.abort(signal?.reason);
  signal?.addEventListener('abort', abortRequest, { once: true });
  const timeout = setTimeout(() => requestController.abort(), 8_000);
  try {
    if (signal?.aborted) abortRequest();
    const response = await fetch(`https://api.gold-api.com/price/${normalizedSymbol}`, { signal: requestController.signal });
    if (!response.ok) throw new Error(`Gold API quote unavailable (${response.status}).`);
    const quote = normalizeGoldApiQuote(await response.json(), normalizedSymbol);
    if (!quote) throw new Error('Gold API returned an invalid quote.');
    return quote;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortRequest);
  }
}

export const GOLD_API_SYMBOLS_LIST = [...GOLD_API_SYMBOLS];
