const DECIMAL_PRICE = /^\d+(?:\.\d+)?$/;

export function resolveCurrentPrice(asset, quote) {
  if (asset?.quote_source === 'binance') {
    const price = quote?.price == null ? '' : String(quote.price);
    return DECIMAL_PRICE.test(price) ? price : null;
  }
  return asset?.manual_price ?? null;
}
