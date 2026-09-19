V5.1 SAFE iPhone PWA patch

IMPORTANT:
Do NOT replace your whole src or public folders.

For the iPhone status-bar/layout fix:
1) Replace only project-root index.html with this index.html.

Keep your existing src/ and public/ folders intact.

Why:
- V5 used viewport-fit=cover + black-translucent, which lets a standalone iPhone PWA draw underneath the iOS status bar.
- This patch returns to normal safe viewport behavior and uses a non-translucent black status bar.

Your existing project should still contain at least:
src/Login.jsx
src/main.jsx
src/features/
src/shared/
src/supabaseClient.js

public/icon-32.png
public/icon-180.png
public/icon-192.png
public/icon-512.png
public/manifest.json
public/sw.js

InstallPage.jsx is included only as a recovery copy. Its correct project location is:
src/InstallPage.jsx

After the change:
npm.cmd run build
