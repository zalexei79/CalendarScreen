REFERRAL STEP 5 — PRO VALUE SCREEN

Replace ONLY:
D:\ai-trade-journal\CalendarScreen.jsx

No SQL in this step.
Do not replace src/ or public/.
Header stays unchanged.

What changed:
- Locked PRO screen now sells the VALUE before asking for an invite.
- Four visible PRO benefits:
  1) cTrader platform connection / sync
  2) Advanced analytics: PnL curve, period dynamics, statistics
  3) Trading journal: instrument, direction, TP/SL, notes
  4) Results review through history and notes
- Two clear paths:
  A) Get PRO free -> existing referral flow
     inviter +26 days, friend +7 days after the friend's first real entry
  B) PRO without invitation -> $1.99/month
- The $1.99 checkout button is intentionally visual-only and disabled.
  No fake payment flow has been added. Payment provider comes next.
- RU / EN / RO copy included.
- Mobile bottom-sheet is scrollable and desktop remains centered.

Run:
npm.cmd run build
