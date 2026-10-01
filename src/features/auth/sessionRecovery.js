// Cached identity is for local UI only. Supabase still authorizes every request.
export async function restoreUser(auth) {
  const { data } = await auth.getSession();
  const cachedUser = data?.session?.user ?? null;
  if (!cachedUser) return null;

  try {
    const { data: verified, error } = await auth.getUser();
    if (verified?.user) return verified.user;
    // A rejected token can be renewed without making the user log in again.
    if (error?.status === 401 || error?.status === 403 || error?.name === 'AuthSessionMissingError') {
      const refreshed = await auth.refreshSession();
      // The SDK removes revoked sessions itself, but retains retryable ones.
      if (refreshed.data?.session?.user) return refreshed.data.session.user;
      const latest = await auth.getSession();
      return latest.data?.session?.user ?? null;
    }
    // Network failures, rate limits and server errors must not erase login.
    return cachedUser;
  } catch {
    return cachedUser;
  }
}
