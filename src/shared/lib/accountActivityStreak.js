const PREFIX = 'dayris_activity_streak:';

function read(storage, key) {
  try { return JSON.parse(storage.getItem(key) || 'null'); } catch { return null; }
}

export function isDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validStreak(value) {
  return Number.isInteger(value?.currentStreak) && value.currentStreak >= 0 && value.currentStreak <= 36500
    && isDateKey(value.lastActiveDate);
}

export function readAccountStreakCache(storage, ownerId) {
  const value = read(storage, PREFIX + ownerId);
  return value?._accountSynced === true && value.ownerId === ownerId && validStreak(value) ? value : null;
}

export async function syncAccountActivityStreak({ client, storage, ownerId, signal, timeZone,
  createDeviceId = () => crypto.randomUUID() }) {
  const { data: auth, error: authError } = await client.auth.getSession();
  if (authError || auth?.session?.user?.id !== ownerId || !auth.session.access_token) throw new Error('STREAK_AUTH_CHANGED');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const previous = read(storage, PREFIX + ownerId);
  const parameters = { p_time_zone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' };
  if (previous?._accountSynced !== true && validStreak(previous)) {
    const deviceKey = `dayris_activity_streak_device:${ownerId}`;
    let deviceId;
    try { deviceId = storage.getItem(deviceKey); } catch { /* storage may be unavailable */ }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deviceId || '')) {
      deviceId = createDeviceId();
      try { storage.setItem(deviceKey, deviceId); } catch { /* server deduplicates imports too */ }
    }
    Object.assign(parameters, { p_legacy_device: deviceId, p_legacy_count: previous.currentStreak,
      p_legacy_date: previous.lastActiveDate, p_legacy_paused: Boolean(previous.paused) });
  }
  // Pin the checked session so switching accounts while a request starts can
  // never import one account's local streak into another account.
  let request = client.rpc('sync_activity_streak', parameters)
    .setHeader('Authorization', `Bearer ${auth.session.access_token}`);
  if (signal) request = request.abortSignal(signal);
  const { data, error } = await request;
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (error) throw error;
  if (data?.accountId !== ownerId || !validStreak(data)) throw new Error('INVALID_ACCOUNT_STREAK');
  const next = { currentStreak: data.currentStreak, lastActiveDate: data.lastActiveDate,
    paused: Boolean(data.paused), timeZone: data.timeZone, ownerId, _accountSynced: true,
    entryDate: data.entryDate || null, completedToday: Boolean(data.completedToday), rule: data.rule };
  try { storage.setItem(PREFIX + ownerId, JSON.stringify(next)); } catch { /* online state remains usable */ }
  return next;
}
