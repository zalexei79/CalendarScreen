import { textValue } from '../../../shared/lib/formatters';

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
    currency: localTrade.currency || 'USD',
  };
}

export function toSupabaseTradeUpdates(localTrade, dateKey) {
  const { user_id, date_key, ...updates } = toSupabaseTradePayload(localTrade, dateKey, '__unused__');
  return updates;
}

export function fromSupabaseTradeRow(row) {
  return {
    id: row.id,
    time: textValue(row.time),
    instrument: textValue(row.instrument),
    direction: textValue(row.direction),
    pnl: Number(row.pnl),
    comment: row.comment || '',
    platform: textValue(row.platform) || 'Manual',
    currency: textValue(row.currency) || 'USD',
    // Optional fields are preserved locally when present in the database row.
    take_profit: row.take_profit ?? null,
    stop_loss: row.stop_loss ?? null,
  };
}
