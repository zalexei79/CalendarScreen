REFERRAL / PRO STEP 8 — STATIC TOGGLE + INVITATIONS IN PRO

Replace ONLY:
1) D:\ai-trade-journal\CalendarScreen.jsx
2) D:\ai-trade-journal\Header.jsx

No SQL.
Do not touch src/ or public/.

WHAT CHANGED

1. FREE / PRO switch is now STATIC.
   - The light theme no longer adds extra padding/border around the whole row.
   - The subtitle line under the app title always reserves the same height.
   - The monthly PRO summary was moved out of the static row.
   Result: the switch should stop jumping when:
   - FREE -> PRO
   - PRO -> FREE
   - dark -> light
   - light -> dark

2. PRO content now SLIDES OUT underneath the switch.
   - Monthly trading summary
   - Platforms/filter bar
   - Existing expanded PRO control center
   The switch itself stays in place.

3. When PRO mode is ON, a compact invitation button appears NEXT TO the switch:
   Gift icon + invitation count.
   On desktop it also shows "Мои приглашения" / localized label.

4. That button opens the existing "Мои приглашения" tab directly.
   The modal title changes to:
   "Мои приглашения"
   instead of "Открой PRO".

5. Existing Step 6/7 referral logic is untouched.

BUILD:
npm.cmd run build

Expected:
✓ built in ...

Then test on iPhone:
- switch FREE/PRO several times;
- switch dark/light several times;
- make sure the FREE/PRO pill stays anchored;
- PRO controls should smoothly slide down/up;
- in PRO mode tap the Gift / invitation-count button.
