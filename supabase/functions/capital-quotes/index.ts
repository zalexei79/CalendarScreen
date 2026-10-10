import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const validSymbol = /^[A-Z][A-Z0-9.-]{0,9}$/;
const todayUtc = () => new Date().toISOString().slice(0, 10);
const eodTimestamp = (date: string) => new Date(`${date}T23:59:59.000Z`).getTime();

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'UNAUTHORIZED' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: 'SERVER_NOT_CONFIGURED' }, 503);

    const userDb = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authError } = await userDb.auth.getUser();
    if (authError || !userData.user) return json({ error: 'UNAUTHORIZED' }, 401);
    const { data: hasPro, error: proError } = await userDb.rpc('dayris_capital_has_pro');
    if (proError) return json({ error: 'ACCESS_CHECK_FAILED' }, 503);
    if (!hasPro) return json({ error: 'PRO_REQUIRED' }, 403);

    let body: { symbols?: unknown };
    try { body = await request.json(); } catch { return json({ error: 'INVALID_JSON' }, 400); }
    const symbols = Array.isArray(body.symbols)
      ? [...new Set(body.symbols.map(value => String(value).trim().toUpperCase()).filter(value => validSymbol.test(value)))].slice(0, 10)
      : [];
    if (!symbols.length) return json({ error: 'SYMBOLS_REQUIRED' }, 400);

    const providerKey = Deno.env.get('ALPHAVANTAGE_API_KEY');
    if (!providerKey) return json({ error: 'PROVIDER_NOT_CONFIGURED' }, 503);
    const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const today = todayUtc();
    const current = new Date();
    const weekday = current.getUTCDay() > 0 && current.getUTCDay() < 6;
    // Daily quotes settle after the US close; 22:00 UTC is safely after both
    // DST and standard-time closes. This permits one same-day refresh if an
    // early request cached yesterday's close.
    const afterUsClose = weekday && current.getUTCHours() >= 22;
    const { data: cachedRows, error: cacheError } = await db.from('capital_market_quote_cache')
      .select('symbol,currency,quote_as_of,last_checked_on,last_after_close_check_on,price,history')
      .eq('provider', 'alphavantage').in('symbol', symbols);
    if (cacheError) return json({ error: 'CACHE_UNAVAILABLE' }, 503);
    const cacheBySymbol = new Map((cachedRows || []).map(row => [row.symbol, row]));
    const quotes: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    for (const symbol of symbols) {
      let row = cacheBySymbol.get(symbol);
      const refreshAfterClose = Boolean(row && afterUsClose && row.quote_as_of < today && row.last_after_close_check_on !== today);
      const needsDailyRefresh = !row || weekday && row.last_checked_on !== today;
      if (needsDailyRefresh || refreshAfterClose) {
        const url = new URL('https://www.alphavantage.co/query');
        url.searchParams.set('function', 'TIME_SERIES_DAILY');
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('outputsize', 'compact');
        url.searchParams.set('apikey', providerKey);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        let payload: Record<string, unknown>;
        try {
          const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
          if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
          payload = await response.json();
        } finally { clearTimeout(timeout); }

        const series = payload['Time Series (Daily)'];
        if (series && typeof series === 'object') {
          const history = Object.entries(series as Record<string, Record<string, unknown>>)
            .flatMap(([date, values]) => {
              const close = String(values['4. close'] ?? '');
              if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+(?:\.\d+)?$/.test(close)) return [];
              return [{ date, price: close }];
            }).sort((a, b) => a.date.localeCompare(b.date));
          const latest = history.at(-1);
          if (!latest) { errors[symbol] = 'NO_DAILY_PRICE'; continue; }
          const updated = await db.from('capital_market_quote_cache').upsert({
            provider: 'alphavantage', symbol, currency: 'USD', quote_as_of: latest.date,
            last_checked_on: today, last_after_close_check_on: afterUsClose ? today : row?.last_after_close_check_on || null,
            price: latest.price, history, updated_at: new Date().toISOString(),
          }, { onConflict: 'provider,symbol' }).select('symbol,currency,quote_as_of,last_checked_on,last_after_close_check_on,price,history').single();
          if (updated.error) { errors[symbol] = 'CACHE_WRITE_FAILED'; continue; }
          row = updated.data;
        } else {
          const providerMessage = String(payload['Note'] || payload['Information'] || payload['Error Message'] || 'QUOTE_UNAVAILABLE');
          errors[symbol] = /api call frequency|rate limit|25 requests/i.test(providerMessage) ? 'DAILY_FREE_LIMIT_REACHED' : 'QUOTE_UNAVAILABLE';
          continue;
        }
      }

      quotes[symbol] = {
        symbol, price: String(row.price), currency: row.currency,
        at: eodTimestamp(row.quote_as_of), asOf: row.quote_as_of,
        transport: 'alphavantage-daily', history: row.history,
      };
    }
    return json({ quotes, errors, asOf: today });
  } catch (error) {
    console.error('[capital-quotes] request failed:', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof DOMException && error.name === 'AbortError' ? 'PROVIDER_TIMEOUT' : 'INTERNAL_ERROR' }, 500);
  }
});
