# DAYRIS — Денежный календарь

Step 12 — Paid DAYRIS PRO frontend

Replace only the project root `CalendarScreen.jsx` with the file in this package.

`Header.jsx` and `src/features/pro/useProAccess.js` do not need replacement for this step.

What changed:
- The $1.99 DAYRIS PRO button now calls the Supabase Edge Function `lemon-checkout`.
- The button shows loading and checkout errors.
- Checkout URLs are accepted only over HTTPS on `lemonsqueezy.com` / subdomains.
- The button does not start another checkout while DAYRIS PRO is already active.
- After `?payment=success`, DAYRIS PRO status is refreshed several times to cover webhook/redirect timing.
- RU / EN / RO payment copy is updated.
- No API key, Store ID, Variant ID, or webhook secret is added to the frontend.

Local checks performed here:
- JSX parse: 0 syntax diagnostics (TypeScript JSX parser)
- Uploaded Header.jsx parse: 0 syntax diagnostics
- Uploaded useProAccess.js parse: 0 syntax diagnostics
- Full Vite build was not run in this sandbox because the whole project/dependencies were not uploaded.

On your PC run:

    npm.cmd run build
    git diff --check

Then test the paid button with Lemon Squeezy Test Mode.
