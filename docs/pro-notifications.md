# PRO grant notifications

Any insert into `public.pro_entitlements`, including the admin SQL grant, records a welcome event. An extension via UPDATE also records an event. The migration uses only the four known entitlement columns: user_id, source, starts_at, ends_at. Existing unexpired grants are included.

The app shows a welcome card with the current total remaining days from `get_my_pro_status`, rounded up. Russian, English and Romanian are supported. “Thank you” acknowledges the displayed event IDs on the server for that account, across devices. Push acceptance does not acknowledge the card, so a user can still read it in the app. Offline acknowledgement is retried by the user; the card remains available until saved. Future grants are announced when their start date arrives; expired, deleted or superseded grants are filtered out.

The existing `send-reminders` Edge Function sends PRO pushes using the same VAPID configuration, cron secret, scheduler and endpoint allowlist as financial reminders. It enqueues each active device once for grants activated within the last day. A device registered within that day can also receive the push if the welcome card has not been acknowledged. After that day the card remains available in the app. Accepted pushes and uncertain outcomes are not retried; explicit throttling is retried at most four attempts. Push delivery still depends on OS permissions and the push provider. PRO notifications have no financial reminder actions.

## Deployment order

1. Run `supabase/migrations/202610010001_pro_notifications.sql` in the production Supabase SQL Editor (once), or apply it using the project's migration workflow. This requires the existing `pro_entitlements` and `push_subscriptions` tables. It creates events for existing active grants, so eligible devices will receive a welcome on the next worker invocation after step 2.
2. Deploy the updated existing worker: `supabase functions deploy send-reminders --no-verify-jwt --project-ref YOUR_PROJECT_REF`. Keep its existing `DAYRIS_CRON_SECRET` authentication and cron schedule. The CLI must be signed in to the appropriate project. No new secrets or schedule are required.
3. Deploy the frontend normally. The updated service worker retains the existing reminder payload format.

## Production verification

- Grant PRO to a test account using the existing SQL. Verify one row in `pro_notifications`; repeat the same exact tuple and verify no duplicate event.
- Open the account without push permission. Confirm the card shows the current remaining days; acknowledge it and reopen on another device. It must stay dismissed.
- Extend the entitlement and verify a new welcome. Check that other accounts cannot read or acknowledge it.
- With an active push subscription, run the scheduled worker. Verify one push per registered device and `accepted` deliveries. Run again and verify no duplicate push.
- Verify financial reminders still include their confirmation actions. Verify an expired/deleted grant is not announced.

Local checks: `node --test tests/pro-notifications.test.mjs tests/reminder-presentation.test.mjs` and `npm run build`. Production SQL and end-to-end push require access to the live Supabase project.
