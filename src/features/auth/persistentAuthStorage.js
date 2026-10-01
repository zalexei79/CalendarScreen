// Keep the SDK's existing key: upgrades migrate current sessions without login.
// IndexedDB also persists when the SDK's localStorage availability probe fails.
export function createPersistentAuthStorage() {
  let database;
  const open = () => {
    if (!database) database = new Promise((resolve, reject) => {
      const request = indexedDB.open('dayris-auth', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('sessions');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Auth storage unavailable'));
    });
    return database;
  };
  const readLocal = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const writeLocal = (key, value) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
      return true;
    } catch { return false; }
  };
  const writeDatabase = async (key, value) => {
    const db = await open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      // A null tombstone prevents restoring an old token after explicit logout.
      tx.objectStore('sessions').put(value, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };
  return {
    async getItem(key) {
      try {
        const db = await open();
        const value = await new Promise((resolve, reject) => {
          const request = db.transaction('sessions').objectStore('sessions').get(key);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        if (value !== undefined) return value;
        const legacy = readLocal(key);
        if (legacy !== null) await writeDatabase(key, legacy);
        return legacy;
      } catch { return readLocal(key); }
    },
    async setItem(key, value) {
      // Commit the latest rotated token before the SDK announces success.
      try { await writeDatabase(key, value); }
      catch (error) { if (!writeLocal(key, value)) throw error; return; }
      writeLocal(key, value);
    },
    async removeItem(key) {
      const removed = writeLocal(key, null);
      try { await writeDatabase(key, null); }
      catch (error) { if (!removed) throw error; }
    },
  };
}
