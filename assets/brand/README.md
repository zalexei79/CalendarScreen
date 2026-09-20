# DAYRIS icon

`dayris-source.png` is the unchanged, approved 1254 × 1254 source supplied on 2026-09-20.

`dayris-transparent.png` is the transparent cutout created with the built-in ImageGen tool. Edit prompt: remove only the background outside the rounded-square silhouette, preserve the polished artwork and interior dark surfaces, and output a genuinely transparent PNG with clean edges.

Run `./scripts/build-icons.ps1` in PowerShell to reproduce the PNG exports. Desktop/PWA `any` icons and favicons preserve alpha with balanced 84% artwork framing. `brand-mark-192.png` uses tighter framing for in-app logos. UI and share cards do not clip the actual contour. Apple touch, Android maskable, and store-listing assets are separate opaque exports; Android maskable exports inset the mark to 72% so it survives circular masks.

`dayris-play-store-512.png` is the 512 × 512 store-listing asset. Upload it when preparing the Google Play listing. This repository has no native Android launcher resources; any separately generated Android package must be rebuilt with the updated icons.

The manifest, HTML, UI and service-worker precache reference the same `20260920-transparent-v2` revision. Bump that revision and the service-worker cache when replacing the artwork again. Existing Home Screen installations may need OS refresh or reinstallation after deployment.
