# Public bot calendar

Entry: `/?calendar=bot` (also `/bot` on SPA hosts). The PRO Trader panel links
to it without requiring PRO or sign-in. “Создать свой календарь” returns to `/`.
“Параметры бота” displays the explicit whitelist from the owner-provided
`work, XAUUSD m1.cbotset`, received 23 October 2026. No arbitrary file is served.
Settings are a supplied snapshot, not telemetry or a claim about historical settings.

Source: Spotware Demo account `47484897`, closed deals dated **5 October 2026
onward**, using `Europe/Bucharest`. This cutoff is fixed and history accumulates.
The displayed current balance is not used as starting capital or fabricated PnL.

## Deployment

1. Apply `supabase/migrations/202610230001_bot_calendar.sql` as database owner.
2. Apply `supabase/bot-calendar-bind.sql` to pin the unique active administrator's
   connected account. An ambiguous or missing source fails closed. The worker
   independently checks the broker account ID and live/demo environment.
3. Deploy `bot-calendar-sync` with `verify_jwt=false`. It authenticates the
   existing private `DAYRIS_CRON_SECRET` in `x-dayris-cron-secret`, matching the
   current internal reminder scheduler. A browser key/JWT does not authorize it.
4. Apply `supabase/bot-calendar-schedule.sql`. Existing Vault secret
   `dayris_cron_secret` must match the Edge environment. Schedule: **00:15 UTC
   daily**, i.e. 02:15 winter / 03:15 summer in Bucharest.
5. Trigger the same `net.http_post` once for the first snapshot. Check
   `net._http_response`, `bot_calendars.last_sync_at/last_error`, and the anonymous
   RPC response before reporting live data. Cron success alone only confirms
   the HTTP request was queued, not that the worker succeeded.

## Boundaries

Personal `trades`, balances, user IDs, comments and cTrader tokens are never
public. New tables have RLS and no direct client grants. The two anonymous RPCs
return only bounded month summaries and pages of 100 deals for one day.
The server loads a complete broker snapshot, filters out pre-cutoff rows, then
publishes it atomically under a five-minute lease. Failure preserves the last
complete snapshot; stale data is labelled after 30 hours. Retries do not duplicate
deals. Full-history imports retain existing explicit size/time limits rather
than silently publishing truncated history. Partial position closes appear as
separate closing deals, consistent with the personal cTrader importer.

## Verification

`node --test tests/bot-calendar-db.test.mjs supabase/functions/bot-calendar-sync/sync.test.mjs`

`node tests/bot-calendar-ui-check.mjs` checks Chromium and WebKit at phone,
tablet and desktop widths, read-only controls, cutoff, pending/error/delayed
states, history pagination, settings and the home CTA.

`npm run build`
