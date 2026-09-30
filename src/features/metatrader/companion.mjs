export const COMPANION_URL = 'http://127.0.0.1:17865';
export function companionToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(n => n.toString(16).padStart(2, '0')).join('');
}
export async function companionRequest(action, token) {
  let response;
  try {
    response = await fetch(`${COMPANION_URL}/${action}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}', signal: AbortSignal.timeout(120000),
    });
  } catch {
    throw new Error('Запустите помощник DAYRIS и разрешите браузеру доступ к устройствам в локальной сети. Затем нажмите «Подключить MT5» снова.');
  }
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'MT5 connection failed');
  return data;
}
export function companionFolder(token, initialCsv) {
  let first = initialCsv;
  return {
    companion: true, token,
    async *entries() {
      const csv = first ?? (await companionRequest('sync', token)).csv;
      first = null;
      yield ['dayris-mt5-companion.csv', { kind: 'file', async getFile() {
        return { size: new TextEncoder().encode(csv).length, text: async () => csv };
      } }];
    },
  };
}
