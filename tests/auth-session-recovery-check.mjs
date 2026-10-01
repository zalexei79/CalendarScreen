import assert from 'node:assert/strict';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['src/features/auth/sessionRecovery.js'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { restoreUser } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const user = { id: 'saved-account' };
let session = { user };
let refreshes = 0;
const auth = {
  getSession: async () => ({ data: { session } }),
  getUser: async () => ({ data: { user: null }, error: { status: 503 } }),
  refreshSession: async () => { refreshes++; return { data: { session } }; },
  signOut: () => { throw new Error('Startup must not sign out'); },
};
assert.equal(await restoreUser(auth), user, '503 retains login');
auth.getUser = async () => { throw new TypeError('Failed to fetch'); };
assert.equal(await restoreUser(auth), user, 'Offline retains login');
auth.getUser = async () => ({ data: {}, error: { status: 429 } });
assert.equal(await restoreUser(auth), user, 'Rate limit retains login');
assert.equal(refreshes, 0);
auth.getUser = async () => ({ data: {}, error: { status: 401 } });
assert.equal(await restoreUser(auth), user, 'Expired token refreshes');
assert.equal(refreshes, 1);
auth.refreshSession = async () => { session = null; return { data: {}, error: { code: 'refresh_token_not_found' } }; };
assert.equal(await restoreUser(auth), null, 'Revoked session stays signed out');
console.log('Auth session recovery checks passed');
