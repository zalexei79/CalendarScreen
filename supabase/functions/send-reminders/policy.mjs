export function allowedEndpoint(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash &&
      ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com'].includes(u.hostname);
  } catch { return false; }
}

// Retry only explicit throttling. A timeout or 5xx might follow acceptance.
export function resultForStatus(status) {
  if (status >= 200 && status < 300) return 'accepted';
  if (status === 404 || status === 410) return 'gone';
  if (status === 429) return 'retry';
  if (status >= 500 || !status) return 'uncertain';
  return 'failed';
}
