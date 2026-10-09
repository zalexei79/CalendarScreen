export const QUOTE_STALE_AFTER_MS = 15_000;
const MAX_CLOCK_SKEW_MS = 5_000;

export function isQuoteFresh(quote, now = Date.now()) {
  if (!quote || !Number.isFinite(Number(quote.at))) return false;
  const age = now - Number(quote.at);
  return age >= -MAX_CLOCK_SKEW_MS && age < QUOTE_STALE_AFTER_MS;
}
