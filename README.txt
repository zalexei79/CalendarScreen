STEP 9 — HISTORY SHARE BECOMES A REFERRAL CHANNEL

Replace ONLY:
D:\ai-trade-journal\CalendarScreen.jsx

No SQL.
Do not touch Header.jsx, src/, public/, Supabase.

WHAT CHANGED

1) History -> Share still sends the result image.
2) If the signed-in user has a referral code, the QR inside the result card
   already points to:
   /?install=1&ref=USER_CODE

3) Now the native share also sends a CLICKABLE personal referral URL.
   The URL is included:
   - in the Web Share `url` field
   - and inside the text itself, because social apps differ in what they keep
     when an image is attached.

4) Stronger share copy:
   "Посмотри мои результаты..."
   "Следи за деньгами красиво и просто."
   "По моей ссылке — 7 дней PRO после первой записи."
   + personal URL

5) The result PNG itself now has a much stronger viral install block:
   ПРИСОЕДИНЯЙСЯ
   Следи за деньгами красиво и просто
   Сканируй QR или открой ссылку
   7 ДНЕЙ PRO ПО МОЕЙ ССЫЛКЕ

6) If the user is not signed in / has no referral code:
   - QR and share URL remain generic install links
   - no false "+7 days PRO" promise is shown.

7) The preview explains that the clickable install link will be shared
   together with the image.

BUILD:
npm.cmd run build

TEST ON IPHONE:
- History -> Share
- Open the share sheet
- Send to Telegram or Messages
- Confirm the message contains BOTH:
  a) the PNG result card
  b) a clickable /?install=1&ref=... link
- Scan the QR too; it should lead to the same referral URL.
