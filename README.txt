REFERRAL STEP 2 — QR -> Google login -> automatic claim

IMPORTANT:
Do NOT replace your whole src/ folder.

Copy exactly these files into your existing project:

1) CalendarScreen.jsx
   -> D:\ai-trade-journal\CalendarScreen.jsx

2) src\main.jsx
   -> D:\ai-trade-journal\src\main.jsx

3) src\features\referrals\useReferral.js
   -> create the folders if needed and place the NEW file there.

Nothing in public/ is changed in this step.
Do not touch Login.jsx, shared/, trades-sync/, Supabase client, cTrader, or service worker.

What this step does:
- A signed-in user's share QR becomes:
  /?install=1&ref=THEIR_CODE
- The incoming ref code is stored immediately in localStorage.
- It survives the Google OAuth redirect.
- After Supabase restores the logged-in user, claim_referral(code) runs once.
- The pending code is removed after a successful/permanently rejected claim.
- Your existing database trigger still gives the inviter +26 days only after
  the referred user creates the first real entry.

Then run:
npm.cmd run build

Do NOT change the FREE/PRO entitlement UI yet. That is Step 3.
