import assert from 'node:assert/strict';
import { startOAuthLogin, TELEGRAM_PROVIDER } from '../src/features/auth/oauthLogin.js';

const calls = [];
const auth = { async signInWithOAuth(input) { calls.push(input); return { error: null }; } };
const origin = 'https://dayris.example';
await startOAuthLogin({ auth, origin, provider: TELEGRAM_PROVIDER, disablePush: async () => calls.push('push-disabled') });
assert.equal(calls[0], 'push-disabled');
assert.deepEqual(calls[1], { provider: 'custom:telegram', options: { redirectTo: origin, scopes: 'openid profile' } });

calls.length = 0;
await startOAuthLogin({ auth, origin, provider: 'google', disablePush: async () => {} });
assert.deepEqual(calls[0], { provider: 'google', options: { redirectTo: origin, queryParams: { prompt: 'select_account' } } });

calls.length = 0;
await assert.rejects(startOAuthLogin({ auth, origin, provider: TELEGRAM_PROVIDER, disablePush: async () => { throw new Error('offline'); } }), /offline/);
assert.equal(calls.length, 0, 'Failed subscription cleanup must prevent account switching');
await assert.rejects(startOAuthLogin({ origin, provider: TELEGRAM_PROVIDER, disablePush: async () => {}, auth: { signInWithOAuth: async () => ({ error: new Error('provider disabled') }) } }), /provider disabled/);
console.log('OAuth checks passed: Telegram, Google, cleanup ordering and provider errors.');
