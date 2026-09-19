REFERRAL STEP 4 — PERSONAL QR CARD + BOTH GET PRO

What changes:
- Inviter gets +26 days PRO after the referred user creates the first real entry.
- New referred user gets +7 days PRO at the same moment.
- The locked-PRO screen now says that both users receive PRO.
- "Create invitation" opens a real share preview instead of immediately sharing a plain link.
- The invitation is a unique 1080x1350 PNG with the user's own referral QR.
- Main copy:
  "Присоединяйся — будем считать дни вместе"
  "Следи за деньгами красиво и просто"
- The card clearly says 7 days PRO for the new user.
- It honestly says that the inviter also receives a PRO bonus.
- Native iPhone/Android Share Sheet sends the PNG + referral install link.
- Save PNG fallback remains available.
- No new npm dependencies.

ORDER:

1) Supabase -> SQL Editor -> New query
   Open STEP4_BOTH_SIDES_REWARD.sql, paste it, Run.
   Expected: Success. No rows returned.

2) Replace ONLY:
   D:\ai-trade-journal\CalendarScreen.jsx

Do NOT replace src/ or public/.
No Header change in this step.

3) Build:
   npm.cmd run build

4) Deploy.

Test:
- Use a signed-in account that does NOT already have PRO, tap locked PRO.
- Tap "Создать приглашение".
- Preview should contain a unique QR and "7 ДНЕЙ PRO".
- Share to Telegram/Messages.
- On a genuinely new account, open from that referral, sign in, make the first real entry.
- Supabase should create TWO pro_entitlements rows tied to the same referral:
  inviter +26 days, referred user +7 days.

Important:
Existing already-rewarded referrals are not retroactively given the new +7-day welcome reward by this migration.
The new two-sided reward applies when future pending referrals qualify.
