export const QUOTE_STALE_AFTER_MS = 15_000;
export const GOLD_API_QUOTE_STALE_AFTER_MS = 5 * 60_000;
export const MOEX_QUOTE_STALE_AFTER_MS = 36 * 60 * 60_000;
const MAX_CLOCK_SKEW_MS = 5_000;

export function isQuoteFresh(quote, now = Date.now()) {
  if (!quote || !Number.isFinite(Number(quote.at))) return false;
  const age = now - Number(quote.at);
  return age >= -MAX_CLOCK_SKEW_MS && age < QUOTE_STALE_AFTER_MS;
}

export function isGoldApiQuoteFresh(quote, now = Date.now()) {
  if (!quote || quote.transport !== 'gold-api' || !Number.isFinite(Number(quote.at))) return false;
  const age = now - Number(quote.at);
  return age >= -MAX_CLOCK_SKEW_MS && age < GOLD_API_QUOTE_STALE_AFTER_MS;
}

export function isMoexQuoteFresh(quote, now = Date.now()) {
  if (!quote || quote.transport !== 'moex-delay' || !Number.isFinite(Number(quote.at))) return false;
  const age = now - Number(quote.at);
  return age >= -MAX_CLOCK_SKEW_MS && age < MOEX_QUOTE_STALE_AFTER_MS;
}
