# Public bot calendar

Entry: `/?calendar=bot` (also `/bot` on SPA hosts). The PRO Trader panel links
to it without requiring PRO or sign-in. “Создать свой календарь” returns to `/`.
The calendar reuses DAYRIS day cells. The create-calendar action is in the header.
History and a cumulative result preview sit below the grid. The compact menu
holds analytics, history, sharing and the home link. The copy icon copies a canonical
`/?calendar=bot` URL, stripping any unrelated query/hash. Native sharing uses
the same URL; cancellation never claims success or copies unexpectedly.
Clipboard uses the synchronous Safari selection fallback and exposes a
selectable link if copying is denied.
Strategy parameters are private: their source module, import and dialog have been
removed. Current public assets contain no cbotset values. Neither public RPCs nor
analytics publish strategy settings, account identity, trade comments or tokens.
The first published date, 5 October 2026, is marked “Старт учёта” in the grid;
it is not presented as the bot's unverified original launch date. A visible
create-calendar link in the header opens the personal calendar homepage.
Owner-confirmed technical work on 13–15 October 2026 is shown as calendar
annotations. These labels do not create trades or change PnL, counts or analytics.

Stages are isolated by calendar slug. The original Spotware account `47484897`
is retained as `bot-stage-1`, **5–29 October 2026**, with its complete snapshot.
The current canonical `bot` stage pins PipFarm Live account `49362144`, starting
**30 October 2026 at 08:00 Europe/Bucharest**. Earlier deals on that account,
including the balance shown when connecting it, do not enter the new stage.

The owner confirmed **1,000 USD is the available trading risk budget**, not the
broker account balance or deposited capital. Public labels say “Стартовый торговый
лимит”, “Лимит с учётом результата”, and “Результат к лимиту”. Real broker PnL is
never rescaled: 10 USD of PnL is 10 USD and 1% of the initial 1,000 USD allowance.
Budget plus closed PnL is a journal calculation, not an official prop-firm limit
or broker equity. No deposit return or normalized balance is fabricated. A safe
“Реальный счёт · Live” badge is published only after the Live source was synced.

## Deployment

1. Apply `supabase/migrations/202610230001_bot_calendar.sql` as database owner.
   Then apply `202610230002_bot_calendar_history.sql` for range history and
   removal of broker account/environment metadata from the public response.
   Apply `202610240001_bot_calendar_analytics.sql` for complete-range statistics.
   Apply `202610240002_bot_deal_timestamps.sql`, deploy the updated sync worker
   and run a full sync to populate exact broker execution instants for existing
   rows. Analytics disclose minute precision until these timestamps are loaded.
2. Apply `supabase/bot-calendar-bind.sql` to pin the unique active administrator's
   connected account. An ambiguous or missing source fails closed. The worker
   independently checks the broker account ID and live/demo environment.
3. Deploy `bot-calendar-sync` with `verify_jwt=false`. It authenticates the
   existing private `DAYRIS_CRON_SECRET` in `x-dayris-cron-secret`, matching the
   current internal reminder scheduler. A browser key/JWT does not authorize it.
4. Apply `supabase/bot-calendar-schedule.sql`. Existing Vault secret
   `dayris_cron_secret` must match the Edge environment. Schedule: **hourly,
   08:00 through 20:00 inclusive, Europe/Bucharest**, every day. UTC candidates
   05:00–18:00 are filtered by local hour to handle daylight saving automatically.
   Applying the script replaces the former daily job without changing other jobs.
5. Trigger the same `net.http_post` once for the first snapshot. Check
   `net._http_response`, `bot_calendars.last_sync_at/last_error`, and the anonymous
   RPC response before reporting live data. Cron success alone only confirms
   the HTTP request was queued, not that the worker succeeded.
6. Apply `202610290020_bot_calendar_stages.sql` for safe period metadata, archive
   boundaries and exact opening-time enforcement. Deploy the updated worker,
   then apply `supabase/bot-calendar-pipfarm-stage.sql` for this owner-confirmed
   transition. It atomically copies the previous snapshot, rebinds only the unique
   active admin Live account, and clears the current snapshot. It is safe to rerun
   for this exact transition. Archived stages cannot be claimed or republished.

## Boundaries

Personal `trades`, balances, user IDs, comments and cTrader tokens are never
public. Broker account IDs and environment are private configuration and do not
appear in the public page or month/history API. New tables have RLS and no direct
client grants. The month RPC returns bounded summaries. `get_bot_calendar_history`
supports all history or inclusive dates, returning pages of 100 broker deals,
the complete filtered count/PnL and the overall publication count. Pagination
does not change the totals. The original day RPC remains available for compatibility.
The server loads a complete broker snapshot, filters out pre-cutoff rows, then
publishes it atomically under a five-minute lease. Failure preserves the last
complete snapshot; stale data is labelled after 30 hours. Retries do not duplicate
deals. Full-history imports retain existing explicit size/time limits rather
than silently publishing truncated history. Partial position closes appear as
separate closing deals, consistent with the personal cTrader importer.

## Verification

The public page links to the free-access Telegram bot using the supplied referral
URL. The analytics outcome panel switches between closed-deal counts (including
breakeven) and monetary shares: gross profit / (gross profit + absolute gross
loss), with the remaining share assigned to loss. Both follow the selected
inclusive date range. Empty data displays no percentages; neither view assumes
a starting deposit or represents a deposit return.

Analytics use every closing deal in the selected inclusive range. The curve
starts from zero and shows realized end-of-day PnL, not balance/equity or returns
on an invented deposit. Maximum drawdown uses each closed deal, including intraday
peaks. Daily drawdown is the worst closed-deal drawdown that day; inactive days
carry the last realized drawdown. Profit factor is undefined without losses.
All trading costs already included by the broker importer remain included.

The descriptive score requires 30 deals and five active days. Components:
`min(PF/2,1)*35 + positiveDays/activeDays*25 + clamp(recovery/3,0,1)*25 + winRate/100*15`.
Positive results with no losses or no drawdown receive the relevant maximum
component. The formula is disclosed in the panel and is not a forecast or rating
of strategy reliability. Empty and insufficient samples never get a fabricated score.

`node --test tests/bot-analytics.test.mjs tests/bot-calendar-db.test.mjs`

`node --test tests/bot-calendar-db.test.mjs supabase/functions/bot-calendar-sync/sync.test.mjs`

`node tests/bot-calendar-ui-check.mjs` checks Chromium and WebKit at phone,
tablet and desktop widths, read-only controls, cutoff, pending/error/delayed
states, all/range totals, history pagination, private parameter exclusion, analytics,
score sample thresholds, the header home link and
copy/native sharing success, cancellation and denial.

`npm run build`
