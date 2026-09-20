# DAYRIS icon

`dayris-source.png` is the unchanged, approved 1254 × 1254 source supplied on 2026-09-20.

Run `./scripts/build-icons.ps1` in PowerShell to reproduce the PNG exports. The crop removes excess black margins only; the artwork is not regenerated. UI and favicon exports use the full cropped square. Android maskable exports inset that square to 72% on opaque black so the polished tile survives circular masks. UI and share cards round only the image's outer black corners at 22%.

`dayris-play-store-512.png` is the 512 × 512 store-listing asset. Upload it when preparing the Google Play listing. This repository has no native Android launcher resources; any separately generated Android package must be rebuilt with the updated icons.

The manifest, HTML, UI and service-worker precache reference the same `20260920-polished` revision. Bump that revision and the service-worker cache when replacing the artwork again. Existing Home Screen installations may need OS refresh or reinstallation after deployment.
