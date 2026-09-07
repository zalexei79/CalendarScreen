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
    // These fields were already read by the app. They remain local-only on
    // writes until their database columns are explicitly confirmed.
    take_profit: row.take_profit ?? null,
    stop_loss: row.stop_loss ?? null,
  };
}
