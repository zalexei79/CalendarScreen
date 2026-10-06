export const TELEGRAM_PROVIDER = 'custom:telegram';

// Supabase handles state, provider PKCE, signature checks and session creation.
export async function startOAuthLogin({ auth, disablePush, provider, origin }) {
  await disablePush();
  const { error } = await auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: origin,
      ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
      ...(provider === TELEGRAM_PROVIDER ? { scopes: 'openid profile' } : {}),
    },
  });
  if (error) throw error;
}
