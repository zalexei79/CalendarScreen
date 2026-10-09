import test from 'node:test';
import assert from 'node:assert/strict';
import { getCatalog, normalizeBinanceSpotPairs, POPULAR_CRYPTO } from '../src/features/capital/assetCatalog.js';
import { readFile } from 'node:fs/promises';

test('searchable stock and ETF catalogues include broad popular coverage and allow custom fallback', () => {
  const stocks = getCatalog('stock');
  const etfs = getCatalog('etf');
  const metals = getCatalog('metal');
  assert.ok(stocks.length >= 100);
  assert.ok(etfs.length >= 40);
  assert.ok(stocks.some(asset => asset.symbol === 'NVDA'));
  assert.ok(etfs.some(asset => asset.symbol === 'CSPX'));
  assert.deepEqual(metals.map(asset => asset.symbol), ['XAU','XAG','XPT','XPD']);
  assert.ok(metals.every(asset => asset.marketSource === 'gold-api' && asset.currency === 'USD'));
  assert.ok(stocks.every(asset => asset.quoteSource === 'manual' && asset.currency === 'USD'));
});

test('bundled SEC issuer directory adds thousands of searchable listed issuers without a client API call', async () => {
  const directory = JSON.parse(await readFile(new URL('../src/features/capital/usStockCatalog.json', import.meta.url), 'utf8'));
  const stocks = directory.records.filter(item => item.category === 'stock');
  const etfs = directory.records.filter(item => item.category === 'etf');
  assert.ok(stocks.length >= 7000);
  assert.ok(etfs.length >= 40);
  assert.ok(stocks.some(item => item.symbol === 'AAPL'));
  assert.ok(etfs.some(item => item.symbol === 'SPY'));
  assert.match(directory.source, /^SEC /);
});

test('Binance symbol metadata admits only active USDT spot pairs for live quote selection', () => {
  const assets = normalizeBinanceSpotPairs({ symbols: [
    { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: true },
    { symbol: 'ETHBTC', baseAsset: 'ETH', quoteAsset: 'BTC', status: 'TRADING', isSpotTradingAllowed: true },
    { symbol: 'OLDUSDT', baseAsset: 'OLD', quoteAsset: 'USDT', status: 'BREAK', isSpotTradingAllowed: true },
    { symbol: 'NOUSDT', baseAsset: 'NO', quoteAsset: 'USDT', status: 'TRADING', isSpotTradingAllowed: false },
  ] });
  assert.deepEqual(assets, [{ symbol: 'BTCUSDT', name: 'BTC', currency: 'USDT', quoteSource: 'binance' }]);
  assert.equal(POPULAR_CRYPTO.length >= 20, true);
  assert.ok(POPULAR_CRYPTO.some(asset => asset.symbol === 'PAXGUSDT' && /tokenized gold/i.test(asset.name)));
  assert.ok(POPULAR_CRYPTO.some(asset => asset.symbol === 'XAUTUSDT' && /tokenized gold/i.test(asset.name)));
});
