# cTrader UX handoff

## Scope
- Restored `CalendarScreen.jsx` from `1049b2c` before applying the UX changes. The accidentally substituted CSV is preserved byte-for-byte as `recovered-calendar-export.csv` and ignored by Git.
- Calendar, History and Analysis continue to derive from `useTrades().manualTrades`. No separate cTrader trade store was added.
- Cache hydration is now separate from refresh triggers. The initial empty/previous owner's state cannot overwrite a newly loaded owner's cache. Out-of-order refresh responses and responses for a previous user are ignored.
- This fixes identified frontend races; it does **not** prove that the reported production disappearance had only this cause. Production row persistence and the current deployment still need checking.
- Import metadata survives cloud mapping/cache reload. The success notice can navigate to the imported account's latest available date and currency. Different dates/currencies remain intentional filters, not missing data.

## Actions
- Existing `accounts`, `select-account`, `sync` and `bright-api` OAuth remain in use, with Supabase session JWT authorization.
- New `disconnect` in the existing `kalendar`: authenticated user only; mark that user's accounts inactive, then delete that user's token. Never delete accounts or trades. Account identities remain valid for FK references and future deduplication.
- Disconnect confirmation is shown in the client. Database failure is reported instead of claiming disconnection. Repeating disconnect is safe when the token is absent.
- Selection persists through `select-account` immediately, without OAuth or deleting history.
- Reconnection is presented for expired authorization; additional OAuth account access is an explicitly labelled secondary action in account selection.
- Upsert still uses `(user_id, ctrader_account_id, ctrader_deal_id)` with `ignoreDuplicates: true`. Existing edited records are not overwritten. Deleted imported records can be reimported, as in the existing simple-sync design.
- No new migration, OAuth permission change, token storage change or `super-service` change.

## Publication
Deploy the existing `kalendar` with **index.ts, core.mjs and disconnect.mjs**. Tests/README are not function entry files. Publishing only the frontend does not add the new backend action.
Then publish the frontend normally. Do not stage `recovered-calendar-export.csv`.

## Checks
Run `node --test tests/trade-flow.test.mjs supabase/functions/kalendar/core.test.mjs supabase/functions/kalendar/disconnect.test.mjs` and `npm run build`.
The 12 tests cover money/date/timezone mapping, large IDs, history splitting, account-scoped identity, cache serialization/shared calendar-history totals, and disconnect target isolation/errors/repetition. They do not replace a real database/RLS test or a React lifecycle/browser test.

`tests/ctrader-ui.html` is a local-only interactive fixture: two 390px cards for light/dark, demo/live selection, simulated sync and disconnect. No Supabase/OAuth calls. It is not an application route and is not included in the production Vite entry bundle.

## Still requires production verification
A–K: new OAuth, accounts, demo/live selection, sync, History/Calendar values, repeated-import deduplication, account switch, disconnect with retained history, reconnect.
L–P: actual Header, 390px/desktop layouts and light/dark appearance. Browser automation timed out; do not mark these as visually passed.
Q: production build checked locally (existing bundle-size/lucide warnings only).

Do not use a real disconnect or repeated bulk import as an automatic test. First deploy, verify one existing account and its stored rows; get confirmation before tests that alter the user's real connection/history.
