export const metaTraderAccountId = (platform, server, account) => `${platform}:${encodeURIComponent(server)}:${account}`;

export function parseMetaTraderExport(source) {
  const lines = source.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const header = 'platform;server;account;ticket;date;time;symbol;direction;profit;swap;commission;currency';
  if (lines[0] !== header || lines.at(-1) !== 'END') throw new Error('Incomplete or unsupported DAYRIS export');
  if (lines.length > 100002) throw new Error('Export is too large');
  const keys = new Set(), accounts = new Map();
  const body = lines.slice(1, -1);
  const hasMetadata = body[0]?.startsWith('ACCOUNT;');
  if (hasMetadata) {
    const [tag, platform, server, account, broker, mode, balance, currency, updated, ...extra] = body.shift().split(';');
    if (extra.length || platform !== 'MT5' || !server || !/^\d+$/.test(account) || !['Demo', 'Live', 'Contest'].includes(mode)
      || !balance?.trim() || !Number.isFinite(Number(balance)) || !/^[A-Z]{3}$/.test(currency)
      || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(updated)) throw new Error('Invalid account metadata');
    const id = metaTraderAccountId(platform, server, account);
    accounts.set(id, { id, platform, server, account, broker, mode, balance: Number(balance), currency, updated });
  }
  const rows = body.map(line => {
    const [platform, server, account, ticket, dateKey, time, instrument, direction, profit, swap, commission, currency, ...extra] = line.split(';');
    if (extra.length || !['MT4', 'MT5'].includes(platform) || !server || !/^\d+$/.test(account) || !/^\d+$/.test(ticket)
      || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || new Date(`${dateKey}T00:00:00Z`).toISOString().slice(0, 10) !== dateKey
      || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time) || !instrument || !['buy', 'sell'].includes(direction) || !/^[A-Z]{3}$/.test(currency)
      || [profit, swap, commission].some(value => !value?.trim() || !Number.isFinite(Number(value)))) throw new Error('Invalid DAYRIS export row');
    const marker = `[DAYRIS:${platform}:${encodeURIComponent(server)}:${account}:${ticket}]`;
    if (keys.has(marker)) throw new Error('Duplicate ticket in export');
    keys.add(marker);
    const id = metaTraderAccountId(platform, server, account);
    if (hasMetadata && !accounts.has(id)) throw new Error('Account metadata does not match trade');
    if (!accounts.has(id)) accounts.set(id, { id, platform, server, account, broker: server, mode: null, balance: null, currency, updated: null });
    return { dateKey, time: time.slice(0, 5), instrument, direction: direction === 'buy' ? 'LONG' : 'SHORT', signedPnl: Number(profit) + Number(swap) + Number(commission), platform, currency, traderMode: true, comment: marker };
  });
  return { rows, accounts: [...accounts.values()] };
}

export function parseMetaTrader(source) { return parseMetaTraderExport(source).rows; }

export function rowsForMetaTraderAccount(rows, id) {
  if (!id) return [];
  return rows.filter(row => typeof row.comment === 'string' && row.comment.startsWith(`[DAYRIS:${id}:`));
}

export function pendingMetaTrader(rows, existing) {
  const markers = new Set(Object.values(existing).flat().map(item => item.comment));
  return rows.filter(row => !markers.has(row.comment));
}
