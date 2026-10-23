import { id, parseMessage } from './core.mjs';
const fail = code => { throw new Error(code); };
const check = result => { if (result.error) fail('DATABASE_ERROR'); return result.data; };
const tokenErrors = new Set(['CH_ACCESS_TOKEN_INVALID','CH_ACCESS_TOKEN_EXPIRED','ACCESS_TOKEN_EXPIRED','OA_AUTH_TOKEN_EXPIRED','INVALID_ACCESS_TOKEN']);
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


export { encodeRequest, connect, refresh };

