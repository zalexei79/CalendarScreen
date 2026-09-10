// @ts-nocheck
// Existing kalendar flow: authenticate -> account -> deals -> trades.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { id, mapDeal, parseMessage, readDeals } from './core.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
const fail = (code) => { throw new Error(code); };
const check = (result) => { if (result.error) fail('DATABASE_ERROR'); return result.data; };
const tokenErrors = new Set(['CH_ACCESS_TOKEN_INVALID', 'CH_ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_EXPIRED', 'OA_AUTH_TOKEN_EXPIRED', 'INVALID_ACCESS_TOKEN']);

function encodeRequest(clientMsgId, payloadType, payload) {
  // cTrader's JSON endpoint requires an integer token, not a quoted ID.
  // Serialize validated digits directly to avoid rounding int64 IDs via Number.
  const fields = Object.entries(payload).map(([key, value]) => {
    const encoded = key === 'ctidTraderAccountId' ? BigInt(id(value)).toString() : JSON.stringify(value);
    return `${JSON.stringify(key)}:${encoded}`;
  });
  return `{"clientMsgId":${JSON.stringify(clientMsgId)},"payloadType":${payloadType},"payload":{${fields.join(',')}}}`;
}

async function connect(isLive, clientId, clientSecret, trace) {
  const environment = isLive ? 'LIVE' : 'DEMO';
  trace(`CONNECT_${environment}`);
  const ws = new WebSocket(`wss://${isLive ? 'live' : 'demo'}.ctraderapi.com:5036`);
  let heartbeat;
  const close = () => { clearInterval(heartbeat); ws.close(); };
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CTRADER_TIMEOUT')), 10000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = () => { clearTimeout(timer); reject(new Error('CTRADER_UNAVAILABLE')); };
      ws.onclose = () => { clearTimeout(timer); reject(new Error('CTRADER_UNAVAILABLE')); };
    });
    heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ payloadType: 51, payload: {} }));
    }, 10000);
    let lastRequest = 0;
    async function request(payloadType, payload, expected) {
      // Sequential requests; remain below historical request rate limit.
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 220 - (Date.now() - lastRequest))));
      lastRequest = Date.now();
      return await new Promise((resolve, reject) => {
        const clientMsgId = crypto.randomUUID();
        const finish = (error, value) => {
          clearTimeout(timer);
          ws.removeEventListener('message', message);
          ws.removeEventListener('close', disconnected);
          ws.removeEventListener('error', disconnected);
          error ? reject(error) : resolve(value);
        };
        const disconnected = () => finish(new Error('CTRADER_UNAVAILABLE'));
        const timer = setTimeout(() => finish(new Error('CTRADER_TIMEOUT')), 12000);
        const message = event => {
          try {
            const msg = parseMessage(event.data);
            if (msg.clientMsgId !== clientMsgId) return;
            if ([50, 2142].includes(msg.payloadType)) {
              finish(new Error(tokenErrors.has(msg.payload?.errorCode) ? 'TOKEN_INVALID' : 'CTRADER_REQUEST_FAILED'));
            } else if (msg.payloadType === expected) finish(null, msg.payload);
          } catch { finish(new Error('CTRADER_INVALID_RESPONSE')); }
        };
        ws.addEventListener('message', message);
        ws.addEventListener('close', disconnected);
        ws.addEventListener('error', disconnected);
        try { ws.send(encodeRequest(clientMsgId, payloadType, payload)); }
        catch { disconnected(); }
      });
    }
    trace(`APP_AUTH_${environment}`);
    await request(2100, { clientId, clientSecret }, 2101);
    return { request, close };
  } catch (error) { close(); throw error; }
}

async function refresh(db, userId, token, clientId, clientSecret) {
  const url = new URL('https://openapi.ctrader.com/apps/token');
  url.search = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: token.refresh_token,
    client_id: clientId, client_secret: clientSecret }).toString();
  let response;
  try { response = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(12000) }); }
  catch { fail('CTRADER_UNAVAILABLE'); }
  if (response.status === 429 || response.status >= 500) fail('CTRADER_UNAVAILABLE');
  const data = await response.json();
  const access = data.accessToken || data.access_token;
  const renewal = data.refreshToken || data.refresh_token;
  if (!response.ok || data.errorCode || data.error || !access || !renewal) fail('RECONNECT_REQUIRED');
  check(await db.from('ctrader_tokens').update({ access_token: access, refresh_token: renewal,
    updated_at: new Date().toISOString() }).eq('user_id', userId));
  return { ...token, access_token: access, refresh_token: renewal };
}

serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return reply({ error: 'METHOD_NOT_ALLOWED' }, 405);
  let socket;
  let inserted = 0;
  let stage = 'AUTH';
  const trace = value => { stage = value; };
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return reply({ error: 'UNAUTHORIZED' }, 401);
    const db = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data: { user }, error } = await db.auth.getUser();
    if (error || !user) return reply({ error: 'UNAUTHORIZED' }, 401);
    let body;
    try { body = await req.json(); } catch { return reply({ error: 'INVALID_REQUEST' }, 400); }
    const action = body.action || 'sync';
    if (!['accounts', 'select-account', 'sync'].includes(action)) fail('INVALID_ACTION');
    const timeZone = body.timeZone || 'UTC';
    try { new Intl.DateTimeFormat('en', { timeZone }); } catch { fail('INVALID_TIMEZONE'); }
    trace('LOAD_TOKEN');
    let token = check(await db.from('ctrader_tokens').select('access_token,refresh_token').eq('user_id', user.id).maybeSingle());
    if (!token) fail('RECONNECT_REQUIRED');
    const clientId = Deno.env.get('CTRADER_CLIENT_ID');
    const clientSecret = Deno.env.get('CTRADER_CLIENT_SECRET');
    if (!clientId || !clientSecret) fail('SERVER_CONFIGURATION');

    let available;
    let refreshed = false;
    // One refresh and one retry, only for a token-authentication failure.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        socket = await connect(false, clientId, clientSecret, trace);
        trace('LIST_ACCOUNTS');
        const result = await socket.request(2149, { accessToken: token.access_token }, 2150);
        available = result.ctidTraderAccount || [];
        break;
      } catch (err) {
        socket?.close(); socket = null;
        if (err.message !== 'TOKEN_INVALID') throw err;
        if (attempt) fail('RECONNECT_REQUIRED');
        trace('REFRESH_TOKEN');
        token = await refresh(db, user.id, token, clientId, clientSecret);
        refreshed = true;
      }
    }
    trace('SAVE_ACCOUNTS');
    const saved = check(await db.from('ctrader_accounts').select('id,account_id,is_live,is_active,broker_name').eq('user_id', user.id));
    const rows = available.map(a => {
      const account_id = id(a.ctidTraderAccountId);
      const old = saved.find(s => s.account_id === account_id);
      if (old && Boolean(old.is_live) !== Boolean(a.isLive)) fail('ACCOUNT_ENVIRONMENT_CONFLICT');
      return { user_id: user.id, account_id, is_live: Boolean(a.isLive),
        broker_name: a.brokerTitleShort || old?.broker_name || 'cTrader', is_active: old?.is_active ?? false };
    });
    // Refresh metadata without resetting the persisted selection on every sync.
    if (rows.length) check(await db.from('ctrader_accounts').upsert(rows, { onConflict: 'user_id,account_id' }));
    const accounts = check(await db.from('ctrader_accounts').select('id,account_id,is_live,is_active,broker_name').eq('user_id', user.id))
      .filter(a => rows.some(r => r.account_id === a.account_id));
    if (action === 'accounts') return reply({ success: true, accounts });
    const selected = body.accountId ? accounts.find(a => a.id === body.accountId) : accounts.find(a => a.is_active);
    if (!selected) fail('SELECT_ACCOUNT');
    if (action === 'select-account') {
      trace('SELECT_ACCOUNT');
      // One upsert statement; only the validated available account can be selected.
      check(await db.from('ctrader_accounts').upsert(accounts.map(a => ({ ...a, user_id: user.id,
        is_active: a.id === selected.id })), { onConflict: 'user_id,account_id' }));
      return reply({ success: true, account: { ...selected, is_active: true } });
    }
    socket.close();
    socket = await connect(selected.is_live, clientId, clientSecret, trace);
    const account = { ctidTraderAccountId: selected.account_id };
    try {
      trace('ACCOUNT_AUTH');
      await socket.request(2102, { ...account, accessToken: token.access_token }, 2103);
    } catch (err) {
      if (err.message !== 'TOKEN_INVALID' || refreshed) throw err;
      socket.close();
      trace('REFRESH_TOKEN');
      token = await refresh(db, user.id, token, clientId, clientSecret);
      socket = await connect(selected.is_live, clientId, clientSecret, trace);
      trace('ACCOUNT_AUTH');
      await socket.request(2102, { ...account, accessToken: token.access_token }, 2103);
    }
    trace('GET_TRADER');
    const trader = await socket.request(2121, account, 2122);
    trace('GET_ASSETS');
    const assets = await socket.request(2112, account, 2113);
    const currency = (assets.asset || []).find(a => id(a.assetId) === id(trader.trader.depositAssetId))?.name;
    if (!currency) fail('CURRENCY_UNKNOWN');
    trace('GET_SYMBOLS');
    const symbolsRes = await socket.request(2114, { ...account, includeArchivedSymbols: true }, 2115);
    const symbols = new Map((symbolsRes.symbol || []).map(s => [id(s.symbolId), s.symbolName]));
    const started = Date.now();
    trace('GET_DEALS');
    const deals = await readDeals(async (fromTimestamp, toTimestamp) => {
      if (Date.now() - started > 75000) fail('HISTORY_TOO_LARGE');
      return await socket.request(2133, { ...account, fromTimestamp, toTimestamp, maxRows: 1000 }, 2134);
    }, 0, started);
    trace('MAP_DEALS');
    const trades = new Map();
    for (const deal of deals) {
      const row = mapDeal(deal, { userId: user.id, accountId: selected.id, currency, symbols, timeZone });
      if (row) trades.set(row.ctrader_deal_id, row);
    }
    const all = [...trades.values()];
    trace('SAVE_TRADES');
    for (let i = 0; i < all.length; i += 200) {
      const added = check(await db.from('trades').upsert(all.slice(i, i + 200), {
        onConflict: 'user_id,ctrader_account_id,ctrader_deal_id', ignoreDuplicates: true,
      }).select('id'));
      inserted += added.length;
    }
    return reply({ success: true, inserted, dealsFound: all.length, skipped: all.length - inserted,
      accountId: selected.id, currency });
  } catch (error) {
    // Never return upstream responses, URLs or tokens to the browser.
    const safe = new Set(['RECONNECT_REQUIRED', 'SELECT_ACCOUNT', 'INVALID_ACTION', 'INVALID_TIMEZONE',
      'SERVER_CONFIGURATION', 'DATABASE_ERROR', 'CTRADER_TIMEOUT', 'CTRADER_UNAVAILABLE',
      'CTRADER_REQUEST_FAILED', 'CURRENCY_UNKNOWN', 'HISTORY_TOO_LARGE', 'HISTORY_TRUNCATED',
      'ACCOUNT_ENVIRONMENT_CONFLICT']);
    const code = error.message === 'TOKEN_INVALID' ? 'RECONNECT_REQUIRED' : error.message;
    const safeCode = safe.has(code) ? code : 'SYNC_FAILED';
    console.warn('[kalendar]', JSON.stringify({ error: safeCode, stage, inserted }));
    return reply({ error: safeCode, stage, inserted,
      message: code === 'RECONNECT_REQUIRED' ? 'Нужно переподключить cTrader' : 'Не удалось завершить синхронизацию' }, 400);
  } finally { socket?.close(); }
});
