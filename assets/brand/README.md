# DAYRIS icon

`dayris-source.png` is the unchanged, approved 1254 × 1254 source supplied on 2026-09-20.

`dayris-transparent.png` is the transparent cutout created with the built-in ImageGen tool. Edit prompt: remove only the background outside the rounded-square silhouette, preserve the polished artwork and interior dark surfaces, and output a genuinely transparent PNG with clean edges.

Run `./scripts/build-icons.ps1` in PowerShell to reproduce the PNG exports. Desktop/PWA `any` icons preserve alpha with balanced 84% artwork framing. Favicons (16/32/48) use 100% of the cropped square so their visible mark fills the browser tab's 16px slot at 1×/2×/3× density. `brand-mark-192.png` uses the same tight framing for in-app logos. UI and share cards do not clip the actual contour. Apple touch, Android maskable, and store-listing assets are separate opaque exports; Android maskable exports inset the mark to 72% so it survives circular masks.

`dayris-play-store-512.png` is the 512 × 512 store-listing asset. Upload it when preparing the Google Play listing. This repository has no native Android launcher resources; any separately generated Android package must be rebuilt with the updated icons.

Favicons use revision `20260920-favicon-v3`; app icons retain `20260920-transparent-v2`. Bump the affected revision and the service-worker cache when replacing artwork again. Existing Home Screen installations may need OS refresh or reinstallation after deployment.
