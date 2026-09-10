# Simple kalendar sync

This replaces the existing deployed `kalendar`, not `bright-api` or `super-service`.
Deploy `index.ts` AND `core.mjs`; do not deploy the test file. Keep JWT verification enabled.
Uses the existing SUPABASE_URL, SUPABASE_ANON_KEY, CTRADER_CLIENT_ID and
CTRADER_CLIENT_SECRET environment secrets. Never send cTrader tokens from React.

Prerequisite: migration 202609090001_simple_ctrader_sync.sql (already applied by owner).

Authenticated POST bodies:

- `{ "action": "accounts" }`: returns available persisted account rows (safe metadata only).
- `{ "action": "select-account", "accountId": "<ctrader_accounts.id UUID>" }`: remembers selection.
- `{ "action": "sync", "accountId": "<same UUID>", "timeZone": "Europe/Bucharest" }`:
  imports history, returns `inserted`, `dealsFound`, `skipped`, `accountId`, `currency`.
  Omitting accountId uses the saved active account; omitting timeZone uses UTC.

Use the same timezone for subsequent imports. ID here is the database UUID, not broker ID.
All errors return a safe `error` code and an `inserted` count (some batches may already have
committed). Retrying skips those rows using the database UNIQUE index and DO NOTHING.
`RECONNECT_REQUIRED` means show “Нужно переподключить cTrader”.
`SELECT_ACCOUNT` means open the account chooser. Network failures do not erase tokens.

Simple-version limits:

- No refresh locks, background jobs, cursor, tombstones or extra schema.
- Existing imported rows are not overwritten; deleted rows can be imported again.
- Legacy test trades without external IDs cannot be deduplicated automatically.
- Large history stops explicitly with HISTORY_TOO_LARGE/HISTORY_TRUNCATED rather than
  claiming success with incomplete data. No rows are inserted until history is collected.
- Existing database RLS/grants remain unchanged, including the existing own-token policy.
- Account IDs colliding across environments stop explicitly instead of mixing histories.

Local verification: `node --test supabase/functions/kalendar/core.test.mjs`.
Before calling the integration production-ready, verify deployment with an actual account:
list/select, first sync, repeat (inserted=0), compare PnL/currency with cTrader, then live/demo
isolation and an expired-token refresh. Never use the Dashboard Test button without a real
user JWT and explicit intent to import: sync writes to public.trades.
