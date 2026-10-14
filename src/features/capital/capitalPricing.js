import { isGoldApiAsset } from './metalQuotes.js';
import { parseScaled, MONEY_SCALE } from './decimal.js';
function validatedPrice(value, allowZero = false) {
  if (value == null) return null;
  const price = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(price)) return null;
  try { const amount = parseScaled(price, MONEY_SCALE); return amount > 0n || allowZero && amount === 0n ? price : null; } catch { return null; }
}
export function resolveCurrentPrice(asset, quote) {
  if (quote?.symbol && String(quote.symbol).toUpperCase() !== String(asset?.symbol || '').toUpperCase()) return null;
  if (asset?.quote_source === 'alphavantage') {
    return quote?.transport === 'alphavantage-daily' && quote.currency === asset.currency ? validatedPrice(quote.price) : null;
  }
  if (asset?.quote_source === 'binance') {
    if (asset.currency && asset.currency !== 'USDT') return null;
    if (quote?.transport && !['websocket', 'rest'].includes(quote.transport)) return null;
    if (quote?.currency && quote.currency !== 'USDT') return null;
    return validatedPrice(quote?.price);
  }
  if (asset?.quote_source === 'moex') {
    return quote?.transport === 'moex-delay' && quote.currency === asset.currency ? validatedPrice(quote.price) : null;
  }
  if (isGoldApiAsset(asset)) {
    if (quote?.currency && quote.currency !== 'USD') return null;
    return quote?.transport === 'gold-api' ? validatedPrice(quote.price) : null;
  }
  return validatedPrice(asset?.manual_price, true);
}
