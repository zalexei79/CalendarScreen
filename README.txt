Calendar V4 — onboarding + history share

Replace only:
- CalendarScreen.jsx

Keep your current:
- CalendarDayCell.jsx
- MonthlyGoal.jsx
- Header.jsx

Changes:
1. Removed the TEST effect that forced onboarding every login/reload.
2. Currency onboarding now says (RU/EN/RO) that currency can be changed later in Settings.
3. History icons/controls received a cleaner Lucide-style premium treatment.
4. Added a Share button in History.
5. Share creates a native 1080×1350 PNG result card (no dependency), shows preview, then uses Web Share API on iOS/Android where supported.
6. Also includes "Save PNG" fallback.
7. FREE share card: result, income, expenses, entry count.
8. PRO share card: result, profitable/losing trades, win rate.
9. If "All currencies" mixes several currencies, the share card avoids presenting the combined number as a precise money total.

Run:
npm.cmd run build
