STEP 10 — PREMIUM LIGHT THEME + PRO HISTORY REDESIGN

ONE-PASS UPGRADE

Replace ONLY:
1) D:\ai-trade-journal\CalendarScreen.jsx
2) D:\ai-trade-journal\Header.jsx

No SQL.
Do NOT replace src/ or public/.
Referral logic, +26/+7 rewards, cTrader logic, calculations, auth and sync remain intact.

LIGHT THEME
- Stronger readable text hierarchy.
- Better contrast for secondary text.
- Cleaner border palette.
- Premium off-white app background.
- PRO history cards get cleaner white surfaces and subtle depth.

PRO HISTORY
- Desktop PRO history is wider (max-w-5xl), so it no longer looks like a long narrow receipt.
- Three clear tabs:
  1) Обзор
  2) Аналитика
  3) Сделки

OVERVIEW
- New premium command center.
- Result
- Winrate
- Number of trades
- Average trade
- Clear "What PRO unlocks" block:
  cTrader connection / PnL curve / discipline notes / period comparison
- Existing PnL curve and scorecard remain; calculations are unchanged.

ANALYTICS
- Deep analytics is separated from the overview.
- Trading notes/discipline, instrument breakdown, period dynamics and the existing analytics feed live here.
- No more endless everything-at-once feed on first open.

TRADES
- Trade journal gets its own section.
- Existing filters, rows, edit/delete/export behavior remain untouched.

MOBILE
- Still a bottom sheet.
- Tabs remain visible under the history header.
- No new dependencies.

BUILD
cd D:\ai-trade-journal
npm.cmd run build

TEST
1) Light theme -> open PRO history.
2) Switch Overview / Analytics / Trades.
3) Toggle dark/light while history is open.
4) Verify PnL/trade numbers are unchanged.
5) Verify cTrader sync, editing and export still work.

Validation performed while packaging:
- CalendarScreen.jsx passed a TypeScript JSX syntax parse.
- Full Vite build must still be run in your local project because your node_modules/project environment are on your PC.
