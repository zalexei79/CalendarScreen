const BINANCE_HISTORY = 'https://data-api.binance.vision/api/v3/klines';
const MOEX_HISTORY = 'https://iss.moex.com/iss/engines/stock/markets';
const cache = new Map();
const CACHE_MS = 10 * 60_000;

function cached(key, load) {
  const saved = cache.get(key);
  if (saved && Date.now() - saved.at < CACHE_MS) return Promise.resolve(saved.rows);
  return load().then(rows => { cache.set(key, { at: Date.now(), rows }); return rows; });
}

function isoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

export function fetchAssetQuoteHistory(asset, { days = 180, signal } = {}) {
  if (!asset?.symbol) return Promise.resolve([]);
  const symbol = String(asset.symbol).toUpperCase();
  if (asset.quote_source === 'binance' && /^[A-Z0-9]{5,20}$/.test(symbol)) {
    const start = Date.now() - Math.max(1, Math.min(365, days)) * 86_400_000;
    const key = `binance:${symbol}:${days}`;
    return cached(key, async () => {
      const url = new URL(BINANCE_HISTORY);
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('interval', '1d');
      url.searchParams.set('startTime', String(start));
      url.searchParams.set('limit', String(Math.min(days, 365)));
      const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Binance history unavailable (${response.status})`);
      const rows = await response.json();
      return Array.isArray(rows) ? rows.flatMap(row => {
        const date = isoDate(Number(row?.[0]));
        const close = String(row?.[4] ?? '');
        return date && /^\d+(?:\.\d+)?$/.test(close) ? [{ date, price: close }] : [];
      }) : [];
    });
  }
  if (asset.quote_source === 'moex' && /^[A-Z0-9-]{1,24}$/.test(symbol)) {
    // ISS bond candle closes are quoted as a percent of face value, while
    // Capital positions store the cash price including accrued interest.
    // Don't chart incompatible units as if they were comparable.
    if (asset.category === 'bond') return Promise.resolve([]);
    const market = asset.category === 'bond' ? 'bonds' : 'shares';
    const start = new Date(Date.now() - Math.max(1, Math.min(365, days)) * 86_400_000).toISOString().slice(0, 10);
    const key = `moex:${market}:${symbol}:${start}`;
    return cached(key, async () => {
      const url = new URL(`${MOEX_HISTORY}/${market}/securities/${encodeURIComponent(symbol)}/candles.json`);
      url.searchParams.set('from', start);
      url.searchParams.set('interval', '24');
      url.searchParams.set('iss.meta', 'off');
      const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`MOEX history unavailable (${response.status})`);
      const payload = await response.json();
      const columns = Object.fromEntries((payload.candles?.columns || []).map((name, index) => [String(name).toLowerCase(), index]));
      return (payload.candles?.data || []).flatMap(row => {
        const date = isoDate(row[columns.begin]);
        const price = String(row[columns.close] ?? '');
        return date && /^\d+(?:\.\d+)?$/.test(price) ? [{ date, price }] : [];
      });
    });
  }
  return Promise.resolve([]);
}
