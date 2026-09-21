import { createClient } from 'npm:@supabase/supabase-js@2.111.0';
import webpush from 'npm:web-push@3.6.7';
import { allowedEndpoint, resultForStatus } from './policy.mjs';

const reply = (status: number, body: unknown) => Response.json(body, { status });
async function equalSecret(a: string, b: string) {
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  return x.reduce((v, byte, i) => v | (byte ^ y[i]), 0) === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
  const secret = Deno.env.get('DAYRIS_CRON_SECRET') || '';
  if (secret.length < 32) return reply(503, { error: 'CONFIGURATION' });
  if (!await equalSecret(req.headers.get('x-dayris-cron-secret') || '', secret)) return reply(401, { error: 'UNAUTHORIZED' });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT');
  if (!url || !key || !publicKey || !privateKey || !subject) return reply(503, { error: 'CONFIGURATION' });
  try { webpush.setVapidDetails(subject, publicKey, privateKey); }
  catch { return reply(503, { error: 'INVALID_VAPID' }); }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: jobs, error } = await db.rpc('dayris_claim_reminders');
  if (error) return reply(500, { error: 'CLAIM_FAILED' });
  const outcomes = await Promise.all((jobs || []).map(async (job: any) => {
    let result = 'failed';
    let code = 'INVALID_ENDPOINT';
    if (allowedEndpoint(job.endpoint)) {
      const { data: reminder, error: lookupError } = await db.from('reminders').select('status,title,amount,currency,kind,remind_offset').eq('id', job.reminder_id).maybeSingle();
      if (lookupError) { result = 'uncertain'; code = 'DATABASE_UNAVAILABLE'; }
      else if (reminder?.status !== 'active') { code = 'CANCELLED'; }
      else {
        try {
          const amount = Number(reminder.amount);
          const money = Number.isFinite(amount) ? ` ${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${reminder.currency || ''}` : '';
          const lead = reminder.remind_offset === '1_day' ? 'Завтра' : reminder.remind_offset === '3_days' ? 'Через 3 дня' : reminder.remind_offset === '1_week' ? 'Через неделю' : 'Сегодня';
          const body = `${lead}: ${reminder.kind === 'income' ? 'ожидается' : 'к оплате'}${money}. ${reminder.title}`;
          const details = webpush.generateRequestDetails({ endpoint: job.endpoint, keys: { p256dh: job.p256dh, auth: job.auth } },
            JSON.stringify({ title: 'DAYRIS', body, reminderId: job.reminder_id, deliveryId: job.delivery_id }),
            { TTL: 3600, urgency: 'high', topic: job.delivery_id.replaceAll('-', ''), contentEncoding: 'aes128gcm' });
          const response = await fetch(details.endpoint, { method: details.method, headers: details.headers, body: details.body, redirect: 'error', signal: AbortSignal.timeout(10000) });
          result = resultForStatus(response.status);
          code = `HTTP_${response.status}`;
          await response.body?.cancel();
        } catch { result = 'uncertain'; code = 'NETWORK_OR_ENCODING_ERROR'; }
      }
    }
    const { error: finishError } = await db.rpc('dayris_finish_delivery', { p_id: job.delivery_id, p_token: job.token, p_result: result, p_code: code });
    return finishError ? 'record_failed' : result;
  }));
  const counts = outcomes.reduce((a: Record<string, number>, k: string) => ({ ...a, [k]: (a[k] || 0) + 1 }), {});
  console.info('[send-reminders]', JSON.stringify(counts));
  return reply(outcomes.includes('record_failed') ? 500 : 200, { processed: outcomes.length, counts });
});
