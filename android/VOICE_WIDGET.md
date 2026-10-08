# DAYRIS Android home-screen microphone

Android 1.0.4 (version code 6) replaces the home-screen launcher button with an autonomous 1×1 microphone. After initial configuration, daily taps start a native microphone foreground service and keep the launcher visible. No calendar, browser, recognition activity or full-screen voice panel is opened for recording.

Add it through Widgets → DAYRIS → Microphone. First configuration requests Android microphone permission, opens DAYRIS once in the browser for Google/account access, and asks to connect the microphone to that account. The browser waits for Android to confirm encrypted credential storage, then the configuration activity closes its temporary browser and returns to the launcher. This bridge requires Chrome 115+ (or a provider with the equivalent TWA postMessage implementation), an Android Keystore-capable device (Android 6+) and the published production signing certificate in the site's Digital Asset Links. A PWA installation alone cannot register this native widget.

## Daily interaction

- Tap: listen. The gold ring responds to actual microphone RMS level; processing uses a native indeterminate progress indicator.
- A complete unambiguous expense/income phrase saves without another confirmation. A green check and a brief spoken answer follow the committed database write.
- Missing fields: speak the clarification, stop microphone capture while TTS speaks, then listen again in the same conversation. A later tap also resumes a pending server draft for up to ten minutes.
- Corrections, conflicting recognition alternatives, low confidence and multiple purchases receive a short spoken review. Say save/done, a correction or cancel.
- Tap during listening: end this utterance. The notification also has a Stop microphone action. Screen lock, silence/error watchdogs and service destruction release recognition and TTS.
- Network failure after final recognition: keep the phrase and request ID encrypted on this phone. The next tap retries the same request. It never reports Saved before the database commit.
- Supported languages: Russian, English, Romanian and simplified Chinese, selected from DAYRIS during pairing. Voice replies reuse the web speech sanitizer, including currency names and slash removal.

The first version records income/expenses in the main calendar, including custom category labels, dates and batches. It does not expose wallet operations, financial history queries or editing/deleting previously saved records through the device credential. Its voice help describes that scope. Complete batches/corrections need spoken confirmation; clear single first utterances do not.

## Account and persistence

Google/Supabase access and refresh tokens stay in the browser. Pairing authenticates with the current Supabase JWT, then issues a random, scoped device credential with a 90-day lifetime. The Android app stores it and pending requests in an AtomicFile encrypted with an Android Keystore AES-GCM key, outside backup storage. The server stores only its SHA-256 hash.

The web/native handshake is restricted to the validated DAYRIS origin via the Chrome postMessage channel, transferred MessagePort and pairing nonce. No credential appears in a launch URL. Device IDs (not secrets) are remembered in this browser's persistent auth store. Normal logout or switching accounts revokes that browser's paired devices before changing the session. Removing the last widget erases its local credential and attempts server revocation; if offline, the server grant still expires normally. A new pairing revokes stale bindings from the same browser first.

Conversation state is server-owned. Clients send a phrase, timezone, confidence, alternatives and request ID; they cannot choose the owner or submit monetary rows. Database row locking serializes device turns. Financial rows, conversation and cached reply commit in one SQL transaction. Retrying the same ID returns its original response. Conflicting payloads are rejected; uncached requests older than 36 hours cannot execute after the 48-hour response cache is cleaned up. Quota is 120 new turns per device per hour.

## Release order

These local changes require publication; a website push alone is insufficient:

1. Apply only the new migration `supabase/migrations/202610080001_voice_widget.sql` using the project's existing database deployment procedure.
2. Run `npm run build:widget-core` and deploy the `widget-voice` Supabase Edge Function. Its configuration deliberately disables gateway JWT checking (`verify_jwt=false`); the function itself validates Supabase JWTs for pairing and hashed scoped credentials for turns/revocation. Equivalent CLI option: `supabase functions deploy widget-voice --no-verify-jwt`.
3. Publish the matching website, including `/.well-known/assetlinks.json` with the added `delegate_permission/common.use_as_origin` relation for the existing production certificate.
4. Build/sign/distribute Android 1.0.4. Keep custom Java/widget resources when regenerating Bubblewrap files.

Run `npm run build` for web/core and `android/gradlew.bat :app:assembleDebug` with JDK 17 and Android SDK 36 for compilation. The debug APK is an unsigned-for-production verification artifact: it cannot upgrade the production package or validate its production DAL certificate.

The icon long-press shortcut remains a separate quick entry to the full web voice screen at `/?voice=1&source=android-shortcut`; the widget itself does not use that launch route.

## Validation

Local checks on 2026-10-08 passed: production web build, Android debug assembly and lint (0 errors), 123 voice unit tests, both PostgreSQL/API integration tests, pairing UI (including a port received before account readiness), existing voice launch UI, OAuth/session recovery and persistent-auth browser checks. The compiled APK manifest was inspected for the microphone service type, permissions and widget configuration components. These checks do not replace physical-device validation.

- `node --test tests/widget-voice.test.mjs`: localized complete utterances, clarification continuity, correction/confirmation, batches, rejected/expired context, origin/intent checks and account revocation.
- `node --test tests/widget-voice-sql-check.mjs tests/widget-voice-api-check.mjs`: actual PostgreSQL via PGlite; atomic rollback, concurrent retries, account isolation, privilege restrictions, expiry/revocation, API credential checks, lost-response replay and forged input.
- SQL tests use a temporary ignored dependency: `npm install --prefix android/app/build/widget-sql-test --no-package-lock --no-save @electric-sql/pglite@0.3.14`. Alternatively set `DAYRIS_PGLITE_PACKAGE` to a package.json next to an installed PGlite dependency.
- `node tests/widget-voice-pairing-ui-check.mjs`: browser configuration/auth readiness, wrong-origin rejection, one registration under StrictMode and waiting for native acknowledgment. Set `DAYRIS_PLAYWRIGHT_PACKAGE` for the bundled runtime.
- Existing voice unit/UI checks continue to cover the web assistant.

Physical Android validation is still required before distributing: add/resize/remove widget; signed-certificate cold pairing; Google redirect and onboarding; permission denial/revocation; notification settings; native recognizer/TTS availability; complete and incomplete phrases; pause/second tap; multiple purchases/corrections; screen lock/phone interruption; server/recognition network failure and same-ID retry; foreground-service start on Android 14–16; account switch/logout. No physical device was connected during local validation.
