import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const allowedTicker = /^[A-Z0-9][A-Z0-9.-]{0,11}$/;
const allowedToken = /^[A-Za-z0-9._-]{8,200}$/;

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return reply({ error: 'UNAUTHORIZED' }, 401);
    const raw = await request.text();
    if (raw.length > 3000) return reply({ error: 'REQUEST_TOO_LARGE' }, 413);
    const body = JSON.parse(raw);
    const action = body?.action;
    const token = typeof body?.token === 'string' ? body.token : '';
    if (!['verify', 'quote'].includes(action) || !allowedToken.test(token)) return reply({ error: 'INVALID_REQUEST' }, 400);
    const url = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !serviceKey) return reply({ error: 'SERVICE_UNAVAILABLE' }, 503);
    const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await db.auth.getUser(authorization.slice(7));
    const user = authData?.user;
    if (authError || !user) return reply({ error: 'UNAUTHORIZED' }, 401);
    const now = new Date().toISOString();
    const { data: entitlement, error: entitlementError } = await db.from('pro_entitlements')
      .select('user_id')
      .eq('user_id', user.id)
      .lte('starts_at', now)
      .gt('ends_at', now)
      .limit(1)
      .maybeSingle();
    if (entitlementError) return reply({ error: 'ACCESS_CHECK_FAILED' }, 503);
    if (!entitlement) return reply({ error: 'PRO_REQUIRED' }, 403);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const headers = { Authorization: `Token ${token}`, Accept: 'application/json' };
      const rawSymbol = String(body?.symbol || '').toUpperCase();
      if (action === 'quote' && !allowedTicker.test(rawSymbol)) return reply({ error: 'INVALID_SYMBOL' }, 400);
      const endpoint = action === 'verify'
        ? 'https://api.tiingo.com/api/test/'
        : `https://api.tiingo.com/tiingo/daily/${encodeURIComponent(rawSymbol.replaceAll('.', '-'))}/prices`;
      const upstream = await fetch(endpoint, { headers, signal: controller.signal });
      if (upstream.status === 401 || upstream.status === 403) return reply({ error: 'INVALID_PROVIDER_TOKEN' }, 401);
      if (upstream.status === 429) return reply({ error: 'PROVIDER_RATE_LIMIT' }, 429);
      if (!upstream.ok) return reply({ error: 'PROVIDER_UNAVAILABLE' }, 502);
      const text = await upstream.text();
      if (text.length > 24_000) return reply({ error: 'PROVIDER_RESPONSE_TOO_LARGE' }, 502);
      const data = JSON.parse(text);
      if (action === 'verify') return reply({ ok: true });
      if (!Array.isArray(data)) return reply({ error: 'QUOTE_UNAVAILABLE' }, 404);
      const rows = data.filter((row: any) => typeof row?.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(row.date));
      rows.sort((a: any, b: any) => String(b.date).localeCompare(String(a.date)));
      const latest = rows[0];
      const price = latest?.close == null ? '' : String(latest.close);
      const date = String(latest?.date || '').slice(0, 10);
      if (!/^\d+(?:\.\d+)?$/.test(price) || Number(price) <= 0 || !Number.isFinite(Date.parse(`${date}T23:59:59Z`))) {
        return reply({ error: 'QUOTE_UNAVAILABLE' }, 404);
      }
      return reply({ quote: { symbol: String(body.symbol).toUpperCase(), price, date } });
    } finally { clearTimeout(timeout); }
  } catch { return reply({ error: 'SERVICE_UNAVAILABLE' }, 503); }
});
