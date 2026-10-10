const stockRows = [
  ['AAPL','Apple'],['MSFT','Microsoft'],['NVDA','NVIDIA'],['AMZN','Amazon'],['GOOGL','Alphabet'],['GOOG','Alphabet Class C'],['META','Meta Platforms'],['TSLA','Tesla'],['BRK.B','Berkshire Hathaway'],['AVGO','Broadcom'],
  ['LLY','Eli Lilly'],['JPM','JPMorgan Chase'],['WMT','Walmart'],['V','Visa'],['XOM','Exxon Mobil'],['MA','Mastercard'],['ORCL','Oracle'],['COST','Costco'],['JNJ','Johnson & Johnson'],['NFLX','Netflix'],
  ['HD','Home Depot'],['ABBV','AbbVie'],['PG','Procter & Gamble'],['BAC','Bank of America'],['KO','Coca-Cola'],['CRM','Salesforce'],['CVX','Chevron'],['TMUS','T-Mobile US'],['CSCO','Cisco'],['IBM','IBM'],
  ['MCD','McDonald’s'],['ABT','Abbott Laboratories'],['ACN','Accenture'],['LIN','Linde'],['WFC','Wells Fargo'],['PM','Philip Morris'],['GE','GE Aerospace'],['DIS','Walt Disney'],['INTU','Intuit'],['TMO','Thermo Fisher'],
  ['QCOM','Qualcomm'],['CAT','Caterpillar'],['TXN','Texas Instruments'],['AMD','AMD'],['AMAT','Applied Materials'],['NOW','ServiceNow'],['UBER','Uber'],['ISRG','Intuitive Surgical'],['GS','Goldman Sachs'],['AXP','American Express'],
  ['MS','Morgan Stanley'],['RTX','RTX'],['PFE','Pfizer'],['LOW','Lowe’s'],['NEE','NextEra Energy'],['UNH','UnitedHealth Group'],['BKNG','Booking Holdings'],['SPGI','S&P Global'],['BLK','BlackRock'],['ADBE','Adobe'],
  ['INTC','Intel'],['T','AT&T'],['VZ','Verizon'],['C','Citigroup'],['DE','Deere & Company'],['LMT','Lockheed Martin'],['UPS','United Parcel Service'],['HON','Honeywell'],['SBUX','Starbucks'],['NKE','Nike'],
  ['PLTR','Palantir'],['PANW','Palo Alto Networks'],['SHOP','Shopify'],['COIN','Coinbase'],['SQ','Block'],['PYPL','PayPal'],['SNOW','Snowflake'],['CRWD','CrowdStrike'],['ARM','Arm Holdings'],['SMCI','Super Micro Computer'],
  ['BA','Boeing'],['F','Ford'],['GM','General Motors'],['RIVN','Rivian'],['BABA','Alibaba'],['TSM','Taiwan Semiconductor'],['NVO','Novo Nordisk'],['SONY','Sony'],['SAP','SAP'],['MELI','MercadoLibre'],
  ['BHP','BHP Group'],['RIO','Rio Tinto'],['UL','Unilever'],['SHEL','Shell'],['NVS','Novartis'],['TM','Toyota Motor'],['PDD','PDD Holdings'],['JD','JD.com'],['SE','Sea Limited'],['INFY','Infosys'],
  ['MRNA','Moderna'],['GILD','Gilead Sciences'],['CVS','CVS Health'],['MDT','Medtronic'],['DUK','Duke Energy'],['SO','Southern Company'],['O','Realty Income'],['PLD','Prologis'],['AMT','American Tower'],['TGT','Target'],
];

const etfRows = [
  ['SPY','SPDR S&P 500 ETF'],['VOO','Vanguard S&P 500 ETF'],['IVV','iShares Core S&P 500 ETF'],['VTI','Vanguard Total Stock Market ETF'],['QQQ','Invesco QQQ Trust'],['QQQM','Invesco Nasdaq 100 ETF'],['DIA','SPDR Dow Jones Industrial Average ETF'],['IWM','iShares Russell 2000 ETF'],['VUG','Vanguard Growth ETF'],['VTV','Vanguard Value ETF'],
  ['SCHD','Schwab US Dividend Equity ETF'],['VYM','Vanguard High Dividend Yield ETF'],['JEPI','JPMorgan Equity Premium Income ETF'],['JEPQ','JPMorgan Nasdaq Equity Premium Income ETF'],['ARKK','ARK Innovation ETF'],['XLF','Financial Select Sector SPDR Fund'],['XLK','Technology Select Sector SPDR Fund'],['XLE','Energy Select Sector SPDR Fund'],['XLV','Health Care Select Sector SPDR Fund'],['XLI','Industrial Select Sector SPDR Fund'],
  ['XLY','Consumer Discretionary Select Sector SPDR Fund'],['XLP','Consumer Staples Select Sector SPDR Fund'],['XLC','Communication Services Select Sector SPDR Fund'],['XLU','Utilities Select Sector SPDR Fund'],['XLB','Materials Select Sector SPDR Fund'],['VNQ','Vanguard Real Estate ETF'],['GLD','SPDR Gold Shares'],['IAU','iShares Gold Trust'],['SLV','iShares Silver Trust'],['BND','Vanguard Total Bond Market ETF'],
  ['AGG','iShares Core US Aggregate Bond ETF'],['TLT','iShares 20+ Year Treasury Bond ETF'],['SHY','iShares 1-3 Year Treasury Bond ETF'],['LQD','iShares iBoxx Investment Grade Corporate Bond ETF'],['HYG','iShares iBoxx High Yield Corporate Bond ETF'],['TIP','iShares TIPS Bond ETF'],['VWO','Vanguard FTSE Emerging Markets ETF'],['VEA','Vanguard FTSE Developed Markets ETF'],['EFA','iShares MSCI EAFE ETF'],['EEM','iShares MSCI Emerging Markets ETF'],
  ['ARKW','ARK Next Generation Internet ETF'],['SOXX','iShares Semiconductor ETF'],['SMH','VanEck Semiconductor ETF'],['IBIT','iShares Bitcoin Trust ETF'],['FBTC','Fidelity Wise Origin Bitcoin Fund'],['BITO','ProShares Bitcoin Strategy ETF'],['CSPX','iShares Core S&P 500 UCITS ETF'],['VWRA','Vanguard FTSE All-World UCITS ETF'],['EQQQ','Invesco EQQQ Nasdaq-100 UCITS ETF'],['VUAA','Vanguard S&P 500 UCITS ETF'],
  ['PDBC','Invesco Optimum Yield Diversified Commodity Strategy ETF'],['DBC','Invesco DB Commodity Index Tracking Fund'],['COMT','iShares GSCI Commodity Dynamic Roll Strategy ETF'],['GSG','iShares S&P GSCI Commodity-Indexed Trust'],['BCI','abrdn Bloomberg All Commodity Strategy K-1 Free ETF'],['USO','United States Oil Fund'],['BNO','United States Brent Oil Fund'],['UNG','United States Natural Gas Fund'],['DBA','Invesco DB Agriculture Fund'],['DBB','Invesco DB Base Metals Fund'],['CPER','United States Copper Index Fund'],['COPX','Global X Copper Miners ETF'],['WEAT','Teucrium Wheat Fund'],['CORN','Teucrium Corn Fund'],['SOYB','Teucrium Soybean Fund'],['CANE','Teucrium Sugar Fund'],['JO','iPath Series B Bloomberg Coffee Subindex ETN'],['NIB','iPath Series B Bloomberg Cocoa Subindex ETN'],['PPLT','abrdn Physical Platinum Shares ETF'],['PALL','abrdn Physical Palladium Shares ETF'],['SGOL','abrdn Physical Gold Shares ETF'],['GLDM','SPDR Gold MiniShares Trust'],['URA','Global X Uranium ETF'],
];

export const POPULAR_CRYPTO = [
  ['BTCUSDT','Bitcoin'],['ETHUSDT','Ethereum'],['SOLUSDT','Solana'],['PAXGUSDT','PAX Gold · tokenized gold'],['XAUTUSDT','Tether Gold · tokenized gold'],['BNBUSDT','BNB'],['XRPUSDT','XRP'],['ADAUSDT','Cardano'],['DOGEUSDT','Dogecoin'],['TRXUSDT','TRON'],['AVAXUSDT','Avalanche'],['LINKUSDT','Chainlink'],['DOTUSDT','Polkadot'],['LTCUSDT','Litecoin'],['BCHUSDT','Bitcoin Cash'],['SUIUSDT','Sui'],['TONUSDT','Toncoin'],['SHIBUSDT','Shiba Inu'],['NEARUSDT','NEAR Protocol'],['UNIUSDT','Uniswap'],['APTUSDT','Aptos'],['ATOMUSDT','Cosmos'],
].map(([symbol,name])=>({symbol,name,currency:'USDT',quoteSource:'binance'}));

const stocks = stockRows.map(([symbol,name])=>({symbol,name,currency:'USD',quoteSource:'manual'}));
const etfs = etfRows.map(([symbol,name])=>({symbol,name,currency:'USD',quoteSource:'manual'}));
const metals = [
  {symbol:'XAU',name:'Gold · troy ounce',currency:'USD',quoteSource:'manual',marketSource:'gold-api'},
  {symbol:'XAG',name:'Silver · troy ounce',currency:'USD',quoteSource:'manual',marketSource:'gold-api'},
  {symbol:'XPT',name:'Platinum · troy ounce',currency:'USD',quoteSource:'manual',marketSource:'gold-api'},
  {symbol:'XPD',name:'Palladium · troy ounce',currency:'USD',quoteSource:'manual',marketSource:'gold-api'},
  {symbol:'HG',name:'Copper · pound',currency:'USD',quoteSource:'manual',marketSource:'gold-api'},
];

// Direct commodity ownership is tracked at the user's own transaction/valuation
// price. No fictitious spot quote is attached to these instruments.
const commodities = [
  ['WTI','Crude oil WTI · barrel','energy'],['BRENT','Crude oil Brent · barrel','energy'],['NATGAS','Natural gas · MMBtu','energy'],['HEATOIL','Heating oil · gallon','energy'],['RBOB','Gasoline RBOB · gallon','energy'],
  ['ALUMINUM','Aluminum · metric tonne','metals'],['NICKEL','Nickel · metric tonne','metals'],['ZINC','Zinc · metric tonne','metals'],['LEAD','Lead · metric tonne','metals'],['TIN','Tin · metric tonne','metals'],
  ['WHEAT','Wheat · bushel','agriculture'],['CORN','Corn · bushel','agriculture'],['SOYBEAN','Soybeans · bushel','agriculture'],['COFFEE','Coffee · pound','agriculture'],['COCOA','Cocoa · metric tonne','agriculture'],['SUGAR','Sugar · pound','agriculture'],['COTTON','Cotton · pound','agriculture'],['RICE','Rice · hundredweight','agriculture'],['LUMBER','Lumber · thousand board feet','agriculture'],
  ['LIVECATTLE','Live cattle · pound','livestock'],['LEANHOGS','Lean hogs · pound','livestock'],['FEEDERCATTLE','Feeder cattle · pound','livestock'],
].map(([symbol,name,group])=>({symbol,name,group,currency:'USD',quoteSource:'manual'}));

export function getCatalog(category) {
  if (category === 'stock') return stocks;
  if (category === 'etf') return etfs;
  if (category === 'crypto') return POPULAR_CRYPTO;
  if (category === 'metal') return metals;
  if (category === 'commodity') return commodities;
  return [];
}

export function normalizeBinanceSpotPairs(data) {
  return (data.symbols || [])
    .filter(item => item.status === 'TRADING' && item.quoteAsset === 'USDT' && item.isSpotTradingAllowed !== false && /^[A-Z0-9]{5,20}$/.test(item.symbol))
    .map(item => ({ symbol: item.symbol, name: item.baseAsset, currency: 'USDT', quoteSource: 'binance' }))
    .sort((a,b)=>a.symbol.localeCompare(b.symbol));
}

let binancePairsPromise;
export async function loadBinanceSpotPairs() {
  if (!binancePairsPromise) {
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(),12000);
    binancePairsPromise = fetch('https://data-api.binance.vision/api/v3/exchangeInfo?permissions=SPOT', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`Binance symbol list unavailable (${response.status}).`);
        return response.json();
      })
      .then(normalizeBinanceSpotPairs)
      .catch(error => { binancePairsPromise = null; throw error; })
      .finally(()=>clearTimeout(timeout));
  }
  return binancePairsPromise;
}
