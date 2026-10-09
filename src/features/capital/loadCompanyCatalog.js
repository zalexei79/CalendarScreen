let catalogPromise;

// Bundled from the SEC's public company_tickers_exchange.json mapping. Load it
// only when the user opens stock/ETF selection so the main calendar stays small.
export function loadCompanyCatalog() {
  if (!catalogPromise) {
    catalogPromise = import('./usStockCatalog.json')
      .then(module => module.default)
      .catch(error => { catalogPromise = null; throw error; });
  }
  return catalogPromise;
}
