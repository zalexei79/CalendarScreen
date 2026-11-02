# Friends workspace

The calendar Friends entry opens a responsive workspace: a conversation list beside the thread on desktop, and list/thread navigation on mobile. Settings and push/deep-link entry points retain the existing friend-only RPCs and authorization checks.

The list supports unread and favorite filters, name/number/latest-message search, timestamps and ordinary drafts. Threads add reply quotes, copy, local bookmarks, loaded-message search, day/streak filtering, emoji insertion, and private day/streak sharing. Search and bookmarks cover loaded history; older pages can be loaded from the thread. Favorites, bookmark IDs and ordinary drafts are scoped to the account on this device. Financial details remain private by default.

## Optional messages with a key

`DR1-` codes contain 32 cryptographically random bytes, generated with Web Crypto. Users exchange a key through a trusted channel outside DAYRIS and keep a separate copy. AES-256-GCM encrypts the entire message, including reply text and compact day/streak cards, before `friend_chat_send`. Every envelope has a fresh 96-bit IV and a 128-bit authentication tag. Authenticated additional data binds the version, both participants, sender and message UUID. The RPC retains its 2,000-character wire limit, with UTF-8/base64 overhead checked before sending. A retry reuses the UUID and the exact ciphertext.

Key material and decrypted text remain in the mounted thread's memory. They are cleared when locking or leaving the conversation, and when access is denied. They never enter local/session storage. Only a boolean marking this device's protected conversation preference persists, preventing accidental ordinary sending on reopen. Encrypted incoming messages are marked read only after successful decryption. Current clients hide encrypted/quote envelopes in push previews. Server-side full-detail day sharing is unavailable while the key is active; compact day and amount cards are encrypted locally instead.

Closing the conversation or using another device requires the key again. DAYRIS cannot recover a lost key. A new key can be deliberately created or accepted for future messages; earlier messages still need the earlier key. A supplied key is checked against loaded encrypted history; using a different new key requires explicit acknowledgement in the UI. The fingerprint is a short key identifier, not verified sender identity.

This is optional shared-key message encryption. It does not supply authenticated public-key exchange, device identity verification, forward secrecy, encrypted metadata, or protection against a compromised client. Earlier ordinary messages and financial records are unchanged. Participants, timing, counts and delivery metadata remain visible to the service. There is no new backend schema, key escrow, or recovery service.

References: [Web Crypto AES-GCM parameters](https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams), [Web Crypto key import](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey).

## Validation

- `node --test tests/friend-messenger.test.mjs tests/creator-messages-push.test.mjs`
- `node tests/friend-messenger-ui-check.mjs` (real components with synthetic RPCs; no user data or external messages)
- `npm run build`
- `git diff --check` for the scoped release

The UI check writes desktop/mobile/light screenshots and a standalone synthetic preview under `artifacts/friends-workspace-2026-11-02/`. Passing local checks or pushing a commit does not confirm a live deployment.
