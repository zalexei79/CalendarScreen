import { isGoldApiAsset } from './metalQuotes.js';
import { isTiingoEodAsset } from './tiingoQuotes.js';
const DECIMAL_PRICE = /^\d+(?:\.\d+)?$/;

export function resolveCurrentPrice(asset, quote) {
  if (asset?.quote_source === 'binance') {
    const price = quote?.price == null ? '' : String(quote.price);
    return DECIMAL_PRICE.test(price) ? price : null;
  }
  if (isGoldApiAsset(asset)) {
    const price = quote?.transport === 'gold-api' && quote?.price != null ? String(quote.price) : '';
    return DECIMAL_PRICE.test(price) ? price : null;
  }
  if (isTiingoEodAsset(asset) && quote?.transport === 'tiingo-eod') {
    const price = quote?.price == null ? '' : String(quote.price);
    return DECIMAL_PRICE.test(price) ? price : null;
  }
  return asset?.manual_price ?? null;
}
