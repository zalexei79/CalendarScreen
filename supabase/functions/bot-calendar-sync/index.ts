// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { connect, refresh } from '../kalendar/transport.mjs';
import { collectSnapshot, safeError } from './sync.mjs';

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

Deno.serve(async req => {
  if (req.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const secret = Deno.env.get('DAYRIS_CRON_SECRET') || '';
  if (!key || secret.length < 32) return response({ error: 'SERVER_CONFIGURATION' }, 503);
  const hash = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const [expected, provided] = await Promise.all([hash(secret), hash(req.headers.get('x-dayris-cron-secret') || '')]);
  if (expected.reduce((diff, byte, i) => diff | (byte ^ provided[i]), 0) !== 0) {
    return response({ error: 'UNAUTHORIZED' }, 401);
  }
  const db = createClient(Deno.env.get('SUPABASE_URL') || '', key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let source;
  const check = result => { if (result.error) throw new Error('DATABASE_ERROR'); return result.data; };
  try {
    const clientId = Deno.env.get('CTRADER_CLIENT_ID');
    const clientSecret = Deno.env.get('CTRADER_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new Error('SERVER_CONFIGURATION');
    // The public client cannot supply a user, account, date or timezone.
    source = check(await db.rpc('claim_bot_calendar', { p_slug: 'bot' }));
    if (!source) return response({ status: 'pending_or_running' });
    const token = check(await db.from('ctrader_tokens').select('access_token,refresh_token')
      .eq('user_id', source.user_id).maybeSingle());
    if (!token) throw new Error('RECONNECT_REQUIRED');
    const snapshot = await collectSnapshot(source, token, {
      connect: isLive => connect(isLive, clientId, clientSecret, () => {}),
      refresh: old => refresh(db, source.user_id, old, clientId, clientSecret),
    });
    const published = check(await db.rpc('publish_bot_calendar', { p_slug: source.slug,
      p_lease: source.lease_token, p_currency: snapshot.currency, p_deals: snapshot.deals }));
    return response({ status: 'ready', published });
  } catch (error) {
    const code = safeError(error);
    if (source) await db.rpc('fail_bot_calendar', {
      p_slug: source.slug, p_lease: source.lease_token, p_code: code,
    });
    // Never expose upstream errors, credentials or private broker metadata.
    return response({ error: code }, 500);
  }
});
