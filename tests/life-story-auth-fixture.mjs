// Local production-browser fixture; no login requests or real credentials.
export const storyUserId = '22222222-2222-4222-8222-222222222222';
export async function installStoryAccount(context) {
  await context.addInitScript(id => {
    const user = { id, email: 'story@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: { nickname: 'Story' } };
    const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
    const expires = Math.floor(Date.now() / 1000) + 86400 * 365;
    const session = JSON.stringify({ user, expires_at: expires, expires_in: 86400 * 365, token_type: 'bearer', refresh_token: 'local-fixture', access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, exp: expires, role: 'authenticated' })}.local-fixture` });
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key) {
      if (this === localStorage && /^sb-.*-auth-token$/.test(key)) return session;
      return original.call(this, key);
    };
  }, storyUserId);
  await context.route('**/auth/v1/user', async route => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: storyUserId, email: 'story@example.test', role: 'authenticated', aud: 'authenticated', user_metadata: { nickname: 'Story' } }) });
  });
}
