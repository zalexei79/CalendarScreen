# DAYRIS icon

`dayris-source.png` is the unchanged, approved 1254 × 1254 source supplied on 2026-09-20.

`dayris-transparent.png` is the transparent cutout created with the built-in ImageGen tool. Edit prompt: remove only the background outside the rounded-square silhouette, preserve the polished artwork and interior dark surfaces, and output a genuinely transparent PNG with clean edges.

Run `./scripts/build-icons.ps1` in PowerShell to reproduce the PNG exports. Desktop/PWA `any` icons (192/512) and favicons (16/32/48) use 100% of the cropped square, preserving transparency and filling their display slot. Do not add adaptive-icon padding to desktop icons: the visible mark must occupy at least 94% of both dimensions. `brand-mark-192.png` uses the same tight framing for in-app logos. UI and share cards do not clip the actual contour.

Mobile exports are opaque square PNGs; the OS supplies the final mask:

- Apple touch: 152/167/180 pixels, 102% of the crop, placing the actual outer rim almost edge-to-edge. Keep the root `apple-touch-icon.png` fallback and legacy `icon-180.png` in sync.
- Android maskable: 192/512 pixels, 82% of the crop (formerly 72%). The four-button motif stays inside the guaranteed centered circle of radius 40%; decorative outer-rim pixels may be masked by aggressive launcher shapes. Check circle, rounded-square, teardrop and minimum-safe-zone previews.
- Store listing: independent opaque 512px export, unchanged by launcher sizing adjustments.

References: [Apple web clip icon sizes](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), [W3C maskable safe zone](https://www.w3.org/TR/appmanifest/#icon-masks).

Run `./scripts/test-icons.ps1` after generating icons to check desktop/favicons for excessive padding and opaque corners.

`dayris-play-store-512.png` is the 512 × 512 store-listing asset. Upload it when preparing the Google Play listing. This repository has no native Android launcher resources; any separately generated Android package must be rebuilt with the updated icons.

Favicons use revision `20260920-favicon-v3`; desktop `any` icons use `20260920-desktop-v4`; mobile filenames include `v5` to distinguish cached artwork. Bump the affected revision and the service-worker cache when replacing artwork again. Existing Home Screen installations may retain old icons; verify on a newly added shortcut before diagnosing a sizing regression. Do not remove an existing installation with unsynced local data just to refresh an icon.
