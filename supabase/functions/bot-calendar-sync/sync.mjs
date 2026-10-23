import { id, mapDeal, readDeals } from '../kalendar/core.mjs';

// Full broker snapshot since the fixed publication date. No personal journal
// reads or writes; collecting a truncated response can never publish a snapshot.
export async function collectSnapshot(source, token, { connect, refresh, now = Date.now }) {
  let socket;
  const opened = now();
  const open = () => connect(source.is_live);
  try {
    socket = await open();
    let available;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        available = await socket.request(2149, { accessToken: token.access_token }, 2150);
        break;
      } catch (error) {
        if (error.message !== 'TOKEN_INVALID' || attempt) throw error;
        socket.close();
        token = await refresh(token);
        socket = await open();
      }
    }
    if (!(available.ctidTraderAccount || []).some(a =>
      id(a.ctidTraderAccountId) === source.account_id && Boolean(a.isLive) === source.is_live)) {
      throw new Error('SOURCE_MISMATCH');
    }
    const account = { ctidTraderAccountId: source.account_id };
    await socket.request(2102, { ...account, accessToken: token.access_token }, 2103);
    const { trader } = await socket.request(2121, account, 2122);
    const assets = await socket.request(2112, account, 2113);
    const currency = (assets.asset || []).find(a => id(a.assetId) === id(trader.depositAssetId))?.name;
    if (!currency) throw new Error('CURRENCY_UNKNOWN');
    const symbolData = await socket.request(2114, { ...account, includeArchivedSymbols: true }, 2115);
    const symbols = new Map((symbolData.symbol || []).map(s => [id(s.symbolId), s.symbolName]));
    // Include the local midnight boundary across UTC offsets and DST, then filter
    // on the explicitly configured calendar timezone, never on the worker timezone.
    const from = Date.parse(`${source.start_date}T00:00:00Z`) - 86400000;
    const deals = await readDeals(async (fromTimestamp, toTimestamp) => {
      if (now() - opened > 75000) throw new Error('HISTORY_TOO_LARGE');
      return socket.request(2133, { ...account, fromTimestamp, toTimestamp, maxRows: 1000 }, 2134);
    }, from, opened);
    const rows = new Map();
    for (const deal of deals) {
      const row = mapDeal(deal, { userId: source.user_id, accountId: source.source_account_id,
        currency, symbols, timeZone: source.time_zone });
      if (!row || row.date_key < source.start_date) continue;
      rows.set(row.ctrader_deal_id, { deal_id: row.ctrader_deal_id, date_key: row.date_key,
        time: row.time, instrument: row.instrument, direction: row.direction, pnl: row.pnl, currency });
    }
    return { currency, deals: [...rows.values()] };
  } finally { socket?.close(); }
}

export const safeError = error => new Set(['SOURCE_MISMATCH','RECONNECT_REQUIRED',
  'TOKEN_INVALID','CURRENCY_UNKNOWN','HISTORY_TOO_LARGE','HISTORY_TRUNCATED',
  'CTRADER_UNAVAILABLE','CTRADER_TIMEOUT']).has(error?.message) ? error.message : 'SYNC_FAILED';
