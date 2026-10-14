export function isUsEquityQuoteFresh(quote, now = Date.now()) {
  if (quote?.transport !== 'alphavantage-daily' || !quote.asOf) return false;
  const age = now - Date.parse(`${quote.asOf}T23:59:59.000Z`);
  return Number.isFinite(age) && age >= -86_400_000 && age < 5 * 86_400_000;
}
