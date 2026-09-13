// Optional balance snapshots: a failed account must never block account selection.
export function balanceSnapshot(trader, assets) {
  const digits = Number(trader?.moneyDigits ?? 2);
  const raw = trader?.balance;
  const currency = assets?.find(asset => String(asset.assetId) === String(trader?.depositAssetId))?.name;
  if (raw == null || !/^-?\d+$/.test(String(raw)) || !Number.isInteger(digits) || digits < 0 || digits > 18 || !currency) return null;
  // Format int64 as decimal text without losing precision through Number.
  const negative = String(raw).startsWith('-');
  const value = String(raw).replace(/^-/, '').padStart(digits + 1, '0');
  const balance = `${negative ? '-' : ''}${digits ? `${value.slice(0, -digits)}.${value.slice(-digits)}` : value}`;
  return { balance, currency, balance_updated_at: new Date().toISOString() };
}

export async function accountBalances(accounts, connectAccount, accessToken, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  const result = accounts.map(account => ({ ...account, balance: null, currency: null }));
  let next = 0;
  async function worker() {
    while (next < accounts.length && Date.now() < deadline) {
      const index = next++, account = accounts[index];
      let socket, expired = false, timer;
      const task = async () => {
        socket = await connectAccount(account.is_live);
        if (expired) { socket.close(); return; }
        const payload = { ctidTraderAccountId: account.account_id };
        await socket.request(2102, { ...payload, accessToken }, 2103);
        const response = await socket.request(2121, payload, 2122);
        const assets = await socket.request(2112, payload, 2113);
        const snapshot = balanceSnapshot(response.trader, assets.asset);
        if (!expired && snapshot) result[index] = { ...account, ...snapshot };
      };
      try {
        await Promise.race([task(), new Promise(resolve => { timer = setTimeout(resolve, Math.max(0, deadline - Date.now())); })]);
      } catch { /* Return unavailable, never expose upstream details or tokens. */ }
      finally { expired = true; clearTimeout(timer); socket?.close(); }
    }
  }
  await Promise.all([worker(), worker()]);
  return result;
}
