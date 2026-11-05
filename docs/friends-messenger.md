# Friends messenger

The calendar Friends entry opens a responsive conversation workspace. Updated clients encrypt new friend messages, reply quotes and compact day/streak cards automatically. Creator/admin messages keep their existing behavior.

The list supports unread/favorite filters, search and local draft indicators. Threads support quotes, copy, bookmarks, loaded-history search and day/streak filters. Financial details stay private by default. Full server-generated day attachments remain readable in older history; new shares use encrypted client summaries.

## Finding friends

Exact user-number search is enabled by default. Migration `202611050001_friend_discovery_default_on.sql` enables it once for existing profiles and creates missing profiles from assigned account numbers. Signup creates a discoverable profile immediately, so a friend can find a new account before its first visit to Friends. Only profile names, numbers and avatars are returned; email, calendar and financial records remain private.

The profile checkbox lets the account owner turn number search off or back on. After this migration, an opt-out survives profile loading, sign-in and name/photo changes. Exact matching, authentication and blocks continue to apply to `social_find`; disabling discovery does not remove existing friendships.

## Automatic device keys

On sign-in, each browser creates an ECDH P-256 device identity and stores its non-extractable private CryptoKey in IndexedDB. The public key is registered through an authenticated owner-bound RPC. Both friends must open an updated DAYRIS client once; no code, password or out-of-app key transfer is needed.

Each sending device creates an AES-256-GCM conversation key. ECDH followed by HKDF-SHA-256 derives a separate AES-KW wrapping key for each device pair. The HKDF salt and context bind the epoch, both accounts and both device IDs. Only wrapped conversation keys and public device keys are sent to the key directory. Conversation keys remain locally wrap-capable so an already authorized device can automatically provide encrypted copies to a newly registered device.

Message envelopes use DAYRIS_AUTO_V1, an epoch UUID, a fresh 96-bit IV and a 128-bit GCM tag. Authenticated additional data binds the version, epoch, both participants, sender and message UUID. Sending retries reuse the exact UUID and ciphertext. The server preserves the ordinary 2,000-character limit and allows up to 12,000 wire characters for encrypted Unicode messages and bounded quotes. The UI retains a 2,000-character text limit.

Encrypted drafts use a separate non-extractable AES key stored with the device identity. Their contents remain in IndexedDB as ciphertext. LocalStorage holds only an account-scoped draft-present flag. Earlier ordinary drafts are migrated when their conversation is opened.

Opening or reopening a conversation loads its keys automatically. Incoming encrypted messages are marked read after successful decryption. Push previews hide protocol envelopes. If the friend has not registered a device yet, the UI waits for their first app opening; it does not downgrade new messages to plaintext.

## History and security boundaries

New devices can read future messages automatically. For older history, an existing device with the necessary keys must open the conversation so it can create encrypted packets for the new device. If all copies of the required keys are lost, the server cannot recover those messages.

Older DAYRIS_LOCK_V1 messages still require the manual code originally used. Their decoder remains available as a separate legacy history action; it does not control encryption of new messages. Earlier ordinary messages are not rewritten.

The authenticated directory binds public keys to accounts and immutable device IDs. It trusts the service's authentication and directory; there is no out-of-band identity verification, Double Ratchet, forward secrecy or claim of an audited messenger protocol. Participants, device/public-key metadata, timing and message counts remain visible to the service. A compromised client or malicious directory is outside this protection.

The key tables have RLS enabled and no direct anonymous/authenticated table access. The RPCs check the acting account, active device ownership and an accepted, unblocked friendship. Device key replacement and packets for outsiders are rejected. Key epochs and packets are separate from financial records.

## Deployment and validation

Migration: supabase/migrations/202611020001_automatic_friend_encryption.sql.

Deploy the database migration before the frontend. For this release, the remote migration history was fetched into an isolated directory and the CLI dry run showed only this migration. Use skip-vault and no seeds/roles when applying this scoped change.

Checks:

- node --test tests/automatic-friend-crypto.test.mjs tests/automatic-friend-db.test.mjs tests/friend-messenger.test.mjs tests/creator-messages-push.test.mjs
- node tests/friend-messenger-ui-check.mjs
- npm run build
- git diff --check

The browser fixture uses real Web Crypto and IndexedDB with synthetic accounts and RPCs. It covers automatic exchange, recipient decryption, encrypted quotes/cards/drafts, reload recovery, sending retries, access revocation, outside dismissal and responsive layouts. Production verification checks migration metadata/permissions and deployed assets without sending messages to real people.

References: [Web Crypto key agreement and derivation](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/deriveKey), [key wrapping](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/wrapKey), [CryptoKey storage](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto).
