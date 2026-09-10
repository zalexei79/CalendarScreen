import { textValue } from '../../../shared/lib/formatters';

function normalizeCurrency(value) {
  const code = textValue(value).trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'USD';
}

// Confirmed cloud contract for `trades`. Optional local fields stay out of
// writes until the actual Supabase schema is available for verification.
export function toSupabaseTradePayload(localTrade, dateKey, userId) {
  return {
    user_id: userId,
    date_key: dateKey,
    time: localTrade.time,
    instrument: localTrade.instrument,
    direction: localTrade.direction,
    pnl: localTrade.pnl,
    comment: localTrade.comment,
    platform: localTrade.platform,
    currency: normalizeCurrency(localTrade.currency),
  };
}

export function toSupabaseTradeUpdates(localTrade, dateKey) {
  const { user_id, date_key, ...updates } = toSupabaseTradePayload(localTrade, dateKey, '__unused__');
  return updates;
}

export function fromSupabaseTradeRow(row) {
  return {
    id: row.id,
    ctrader_account_id: row.ctrader_account_id ?? null,
    ctrader_deal_id: row.ctrader_deal_id ?? null,
    time: textValue(row.time),
    instrument: textValue(row.instrument),
    direction: textValue(row.direction),
    pnl: Number(row.pnl),
    comment: row.comment || '',
    platform: textValue(row.platform) || 'Manual',
    currency: normalizeCurrency(row.currency),
    // Optional fields are preserved locally when present in the database row.
    take_profit: row.take_profit ?? null,
    stop_loss: row.stop_loss ?? null,
  };
}
