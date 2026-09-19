Calendar V5 — Share Card + QR + PWA Install Screen

Replace/copy these files into the project root, preserving folders:
- CalendarScreen.jsx
- qrCode.js                 (NEW, project root)
- index.html
- src/main.jsx
- src/InstallPage.jsx       (NEW)
- public/manifest.json

Keep unchanged:
- CalendarDayCell.jsx
- CalendarGrid.jsx
- MonthlyGoal.jsx
- Header.jsx
- public/sw.js and all icons

What changed:
1. Share result card V5 is cleaner: one hero result, three compact metrics, no duplicated summary block.
2. Sentinel dates like 0000-01-01 — 9999-12-31 are no longer shown. They become a human label such as "За всё время". Normal selected ranges are formatted as readable dates/months.
3. The bottom of the shared PNG now says "Начни вести свой календарь" and includes a real scannable QR code.
4. QR URL is generated dynamically from the current deployed domain, so you do NOT need to hard-code your website address.
5. QR points to /?install=1. This renders a dedicated installation screen, not the normal calendar.
6. Android/Chromium: when the browser exposes beforeinstallprompt, the main button opens the native PWA install dialog.
7. iPhone/iPad: Apple does not expose a programmable install dialog, so the install screen shows native-style steps for Share -> Add to Home Screen -> Add.
8. No new npm dependency was added. qrCode.js is a local QR generator.
9. PWA meta tags and manifest id/scope were tightened for Home Screen installation.

Check after replacing:
  npm.cmd run build

Then deploy the new build before scanning a QR from another phone. A local localhost QR is only useful on the same development environment; after deployment the QR automatically contains the real production domain.
