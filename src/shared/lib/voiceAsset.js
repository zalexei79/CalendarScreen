const assets=[
 {id:'gold',label:'Золото',aliases:/^(?:золото|золоте|золоту|gold|xau|xauusd|xau usd)$/,symbols:/^(?:XAU(?:USD|EUR)?|GOLD)(?:[._-].*|m|c)?$/i},
 {id:'bitcoin',label:'Биткоин',aliases:/^(?:биток|биткоин|биткоине|биткойн|биткойне|bitcoin|btc|btc usd|btcusd|btcusdt)$/,symbols:/^BTC(?:USD|USDT|EUR)?(?:[._-].*|m|c)?$/i},
 {id:'ethereum',label:'Эфириум',aliases:/^(?:эфир|эфире|эфириум|эфириуме|ethereum|eth|ethusd|ethusdt)$/,symbols:/^ETH(?:USD|USDT|EUR)?(?:[._-].*|m|c)?$/i},
 {id:'silver',label:'Серебро',aliases:/^(?:серебро|серебре|silver|xag|xagusd)$/,symbols:/^(?:XAG(?:USD|EUR)?|SILVER)(?:[._-].*|m|c)?$/i},
 {id:'solana',label:'Солана',aliases:/^(?:солана|солану|солане|solana|sol|solusd|solusdt)$/,symbols:/^SOL(?:USD|USDT|EUR)?(?:[._-].*|m|c)?$/i},
];
export function resolveVoiceAsset(value){const name=String(value||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();return assets.find(asset=>asset.aliases.test(name)||assetMatchesInstrument(asset,name))||null;}
export function assetMatchesInstrument(asset,value){return Boolean(asset?.symbols.test(String(value||'').replace(/[\s/]/g,'')));}
