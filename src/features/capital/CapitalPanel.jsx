import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Bitcoin, BriefcaseBusiness, Building2, ChartNoAxesCombined, CircleDollarSign, Coins, Landmark, Plus, RefreshCw, Search, Wallet, X } from 'lucide-react';
import { useCapitalPortfolio } from './useCapitalPortfolio';
import { calculateDailyChange, calculateReturnPercent, formatMoney, MONEY_SCALE, multiplyScaled, parseScaled, QUANTITY_SCALE, scaledToString } from './decimal';
import { useWalletExitGesture } from '../wallet/hooks/useWalletExitGesture';
import SwipeDismissSheet from '../../shared/ui/SwipeDismissSheet.jsx';
import { isQuoteFresh } from './quoteStatus.js';
import { getCatalog, loadBinanceSpotPairs, POPULAR_CRYPTO } from './assetCatalog.js';
import { loadCompanyCatalog } from './loadCompanyCatalog.js';
import { friendlyCapitalError } from './capitalErrors.js';
import './capital.css';

const copy = {
  ru: { title:'DAYRIS Capital', subtitle:'Ваши инвестиции в одном месте', value:'Стоимость портфеля', invested:'Вложено', pnl:'Прибыль / убыток', today:'Котировки', assets:'Активы', add:'Добавить актив', empty:'Здесь появятся ваши инвестиции', emptyHint:'Добавьте актив и сохраните первую операцию покупки.', back:'К календарю', wallet:'Кошелёк', signIn:'Войдите, чтобы сохранить портфель на всех устройствах.', category:'Категория', name:'Название', symbol:'Тикер / пара Binance', currency:'Валюта', quoteSource:'Источник цены', quantity:'Количество', purchase:'Цена покупки', price:'Текущая оценка за единицу', date:'Дата', fee:'Комиссия', save:'Сохранить покупку', cancel:'Отмена', search:'Название или тикер', manual:'Ручная оценка', live:'LIVE · Binance', offline:'OFFLINE', updated:'Обновлено', history:'История операций', buy:'Покупка', sell:'Продажа', sellAction:'Продать', dividend:'Дивиденд', revalue:'Обновить оценку', operation:'Операция', lastUpdated:'Последняя цена', distribution:'Распределение активов', chart:'История оценки', chartEmpty:'История появится после первой дневной фиксации стоимости.', cancelOperation:'Отменить последнюю операцию', categories:['Акции','ETF','Криптовалюта','Металл','Недвижимость','Облигации','Вклад','Другое'], cats:['stock','etf','crypto','metal','real_estate','bond','deposit','other'], error:'Не удалось загрузить портфель.' },
  en: { title:'DAYRIS Capital', subtitle:'Your investments in one place', value:'Portfolio value', invested:'Invested', pnl:'Profit / loss', today:'Quotes', assets:'Assets', add:'Add asset', empty:'Your investments will appear here', emptyHint:'Add an asset and record your first purchase.', back:'Calendar', wallet:'Wallet', signIn:'Sign in to sync your portfolio across devices.', category:'Category', name:'Name', symbol:'Ticker / Binance pair', currency:'Currency', quoteSource:'Price source', quantity:'Quantity', purchase:'Purchase price', price:'Current estimate per unit', date:'Date', fee:'Fee', save:'Save purchase', cancel:'Cancel', search:'Name or ticker', manual:'Manual estimate', live:'LIVE · Binance', offline:'OFFLINE', updated:'Updated', history:'Activity', buy:'Purchase', sell:'Sale', sellAction:'Sell', dividend:'Dividend', revalue:'Update valuation', operation:'Operation', lastUpdated:'Last price', distribution:'Asset allocation', chart:'Valuation history', chartEmpty:'History starts after the first daily valuation snapshot.', cancelOperation:'Cancel latest operation', categories:['Stocks','ETF','Crypto','Metal','Real estate','Bonds','Deposit','Other'], cats:['stock','etf','crypto','metal','real_estate','bond','deposit','other'], error:'Could not load portfolio.' },
  ro: { title:'DAYRIS Capital', subtitle:'Investițiile tale într-un singur loc', value:'Valoarea portofoliului', invested:'Investit', pnl:'Profit / pierdere', today:'Cotații', assets:'Active', add:'Adaugă activ', empty:'Investițiile tale vor apărea aici', emptyHint:'Adaugă un activ și înregistrează prima cumpărare.', back:'Calendar', wallet:'Portofel', signIn:'Autentifică-te pentru sincronizarea portofoliului.', category:'Categorie', name:'Nume', symbol:'Simbol / pereche Binance', currency:'Monedă', quoteSource:'Sursa prețului', quantity:'Cantitate', purchase:'Preț de cumpărare', price:'Estimare curentă pe unitate', date:'Data', fee:'Comision', save:'Salvează cumpărarea', cancel:'Anulează', search:'Nume sau simbol', manual:'Evaluare manuală', live:'LIVE · Binance', offline:'OFFLINE', updated:'Actualizat', history:'Activitate', buy:'Cumpărare', sell:'Vânzare', sellAction:'Vinde', dividend:'Dividend', revalue:'Actualizează evaluarea', operation:'Operațiune', lastUpdated:'Ultimul preț', distribution:'Alocarea activelor', chart:'Istoricul evaluării', chartEmpty:'Istoricul începe după prima evaluare zilnică salvată.', cancelOperation:'Anulează ultima operațiune', categories:['Acțiuni','ETF','Cripto','Metal','Imobiliare','Obligațiuni','Depozit','Altele'], cats:['stock','etf','crypto','metal','real_estate','bond','deposit','other'], error:'Portofoliul nu a putut fi încărcat.' },
  zh: { title:'DAYRIS Capital', subtitle:'在一处管理您的投资', value:'投资组合价值', invested:'已投入', pnl:'盈亏', today:'行情', assets:'资产', add:'添加资产', empty:'您的投资将显示在这里', emptyHint:'添加资产并记录首次购买。', back:'返回日历', wallet:'钱包', signIn:'登录以在设备间同步投资组合。', category:'类别', name:'名称', symbol:'代码 / Binance交易对', currency:'货币', quoteSource:'价格来源', quantity:'数量', purchase:'买入价格', price:'当前估值/单位', date:'日期', fee:'手续费', save:'保存买入', cancel:'取消', search:'名称或代码', manual:'手动估值', live:'实时 · Binance', offline:'离线', updated:'更新于', history:'交易记录', buy:'买入', sell:'卖出', sellAction:'卖出', dividend:'股息', revalue:'更新估值', operation:'操作', lastUpdated:'最近报价', distribution:'资产分布', chart:'估值历史', chartEmpty:'首次每日估值记录后将显示历史。', cancelOperation:'取消最近操作', categories:['股票','ETF','加密货币','贵金属','房地产','债券','存款','其他'], cats:['stock','etf','crypto','metal','real_estate','bond','deposit','other'], error:'无法加载投资组合。' },
};
Object.assign(copy.ru,{binanceSource:'Binance Spot · USDT',manualSource:'Ручная оценка',usdtNote:'Котировки Binance указаны в USDT. Суммы остаются в USDT; валюты не конвертируются.',stale:'УСТАРЕЛО',pending:'Ожидание котировки'});
Object.assign(copy.en,{binanceSource:'Binance Spot · USDT',manualSource:'Manual estimate',usdtNote:'Binance quotes are in USDT. Values stay in USDT; currencies are not converted.',stale:'STALE',pending:'Waiting for quote'});
Object.assign(copy.ro,{binanceSource:'Binance Spot · USDT',manualSource:'Evaluare manuală',usdtNote:'Cotațiile Binance sunt în USDT. Valorile rămân în USDT; monedele nu sunt convertite.',stale:'ÎNVECHIT',pending:'Se așteaptă cotația'});
Object.assign(copy.zh,{binanceSource:'Binance 现货 · USDT',manualSource:'手动估值',usdtNote:'Binance 报价以 USDT 计价。金额保持为 USDT，不进行货币换算。',stale:'报价已过期',pending:'正在等待报价'});
Object.assign(copy.ru,{return:'Доходность'});
Object.assign(copy.en,{return:'Return'});
Object.assign(copy.ro,{return:'Randament'});
Object.assign(copy.zh,{return:'回报率'});
Object.assign(copy.ru,{chooseCategory:'Выберите категорию',findAsset:'Найдите актив по названию или тикеру',popular:'Популярные',customAsset:'Добавить свой актив',changeAsset:'Выбрать другой',noAssetsFound:'Ничего не найдено — добавьте актив вручную.',catalogLoading:'Загружаем список Binance…',catalogUnavailable:'Список Binance недоступен. Популярные пары и ручное добавление доступны.',purchaseDetails:'Детали покупки',optional:'необязательно',manualName:'Например: квартира, облигация, фонд',accountSetup:'Функции Capital в базе ещё не обновлены. Попробуйте позже; если ошибка повторится, обратитесь в поддержку.',proRequired:'Для доступа к Capital требуется активный DAYRIS PRO.',custom:'Свой актив',currentEstimate:'Текущая оценка за единицу'});
Object.assign(copy.en,{chooseCategory:'Choose a category',findAsset:'Search by asset name or ticker',popular:'Popular',customAsset:'Add a custom asset',changeAsset:'Choose another',noAssetsFound:'No matches. Add this asset manually.',catalogLoading:'Loading Binance symbols…',catalogUnavailable:'Binance list is unavailable. Popular pairs and manual entry still work.',purchaseDetails:'Purchase details',optional:'optional',manualName:'For example: apartment, bond, fund',accountSetup:'Capital database functions are not up to date. Try again later; if this continues, contact support.',proRequired:'An active DAYRIS PRO plan is required to use Capital.',custom:'Custom asset',currentEstimate:'Current estimate per unit'});
Object.assign(copy.ro,{chooseCategory:'Alege o categorie',findAsset:'Caută după nume sau simbol',popular:'Populare',customAsset:'Adaugă un activ propriu',changeAsset:'Alege altul',noAssetsFound:'Nu s-au găsit rezultate. Adaugă activul manual.',catalogLoading:'Se încarcă simbolurile Binance…',catalogUnavailable:'Lista Binance nu este disponibilă. Poți folosi perechile populare sau adăugarea manuală.',purchaseDetails:'Detaliile cumpărării',optional:'opțional',manualName:'De exemplu: apartament, obligațiune, fond',accountSetup:'Funcțiile bazei Capital nu sunt actualizate. Încearcă din nou mai târziu; dacă persistă, contactează asistența.',proRequired:'Este necesar un abonament DAYRIS PRO activ pentru Capital.',custom:'Activ propriu',currentEstimate:'Estimare curentă pe unitate'});
Object.assign(copy.zh,{chooseCategory:'选择类别',findAsset:'按名称或代码搜索',popular:'热门',customAsset:'添加自定义资产',changeAsset:'重新选择',noAssetsFound:'没有匹配项。请手动添加资产。',catalogLoading:'正在加载 Binance 代码…',catalogUnavailable:'Binance 列表暂不可用，仍可选择热门交易对或手动添加。',purchaseDetails:'买入详情',optional:'可选',manualName:'例如：公寓、债券、基金',accountSetup:'Capital 数据库功能尚未更新。请稍后重试；如问题持续，请联系支持。',proRequired:'使用 Capital 需要有效的 DAYRIS PRO。',custom:'自定义资产',currentEstimate:'当前单价估值'});
Object.assign(copy.ru,{stockCatalogLoading:'Загружаем справочник тикеров…',stockCatalogUnavailable:'Справочник временно недоступен. Популярные акции и ручной ввод работают.'});
Object.assign(copy.en,{stockCatalogLoading:'Loading the ticker directory…',stockCatalogUnavailable:'Ticker directory is unavailable. Popular assets and manual entry still work.'});
Object.assign(copy.ro,{stockCatalogLoading:'Se încarcă lista de simboluri…',stockCatalogUnavailable:'Lista simbolurilor nu este disponibilă. Activele populare și adăugarea manuală funcționează.'});
Object.assign(copy.zh,{stockCatalogLoading:'正在加载代码目录…',stockCatalogUnavailable:'代码目录暂不可用，热门资产和手动添加仍可使用。'});
Object.assign(copy.ru,{today:'К оценке вчера',todayMethod:'Изменение общей стоимости, включая сделки.'});
Object.assign(copy.en,{today:'vs. yesterday',todayMethod:'Total value change; recorded trades are included.'});
Object.assign(copy.ro,{today:'față de ieri',todayMethod:'Schimbarea valorii totale, inclusiv tranzacțiile.'});
Object.assign(copy.zh,{today:'较昨日',todayMethod:'总价值变化，包含已记录交易。'});
const icons = [ChartNoAxesCombined, ChartNoAxesCombined, Bitcoin, Coins, Building2, Landmark, CircleDollarSign, BriefcaseBusiness];
const statCopy={ru:{average:'Средняя цена покупки',basis:'Осталось вложено',realized:'Реализовано',unrealized:'Нереализовано'},en:{average:'Average purchase price',basis:'Cost basis remaining',realized:'Realized',unrealized:'Unrealized'},ro:{average:'Preț mediu de cumpărare',basis:'Cost rămas',realized:'Realizat',unrealized:'Nerealizat'},zh:{average:'平均买入价',basis:'剩余成本',realized:'已实现',unrealized:'未实现'}};
const todayKey = () => new Date().toISOString().slice(0,10);
const formatQuantity = (value, locale) => {
  const [whole, fraction = ''] = scaledToString(value, QUANTITY_SCALE).split('.');
  const grouped = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(BigInt(whole));
  if (!fraction) return grouped;
  const separator = new Intl.NumberFormat(locale).formatToParts(1.1).find(part => part.type === 'decimal')?.value || '.';
  return `${grouped}${separator}${fraction}`;
};
const formatPercent = (pnl, basis, locale) => {
  const hundredths = calculateReturnPercent(pnl,basis);
  if (hundredths === null) return '—';
  const negative = hundredths < 0n, digits = (negative ? -hundredths : hundredths).toString().padStart(3,'0');
  const whole = digits.slice(0,-2), fraction = digits.slice(-2);
  const grouped = new Intl.NumberFormat(locale,{useGrouping:true,maximumFractionDigits:0}).format(BigInt(whole));
  const parts = new Intl.NumberFormat(locale,{style:'percent',minimumFractionDigits:2,maximumFractionDigits:2}).formatToParts(negative?-1:1);
  return parts.map(part=>part.type==='integer'?grouped:part.type==='fraction'?fraction:part.value).join('');
};
function valuationPath(rows) {
  const sorted = rows.slice().sort((a,b)=>a.sampled_on.localeCompare(b.sampled_on));
  if (sorted.length < 2) return '';
  const values = sorted.map(row=>parseScaled(row.portfolio_value,MONEY_SCALE));
  const min = values.reduce((a,b)=>a<b?a:b), max = values.reduce((a,b)=>a>b?a:b), span = max-min || 1n;
  return values.map((value,index)=>{
    const x = 12 + index * (296 / (values.length-1));
    const y = 104 - Number((value-min)*8000n/span)/100;
    return `${index?'L':'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}
async function verifyBinanceSpotPair(symbol) {
  if (!/^[A-Z0-9]{5,20}$/.test(symbol)) throw new Error('Enter a Binance USDT spot pair such as BTCUSDT, or choose manual valuation.');
  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(),8000);
  try {
    const response = await fetch(`https://data-api.binance.vision/api/v3/exchangeInfo?symbol=${encodeURIComponent(symbol)}`,{signal:controller.signal});
    if (!response.ok) throw new Error('Binance could not verify this symbol.');
    const data = await response.json();
    if (!data.symbols?.some(pair=>pair.symbol===symbol&&pair.status==='TRADING'&&pair.quoteAsset==='USDT')) throw new Error('Choose a supported Binance spot pair quoted in USDT, or use manual valuation.');
  } catch(error) {
    if(error.name==='AbortError') throw new Error('Binance symbol check timed out. Choose manual valuation or try again.');
    throw error;
  } finally { clearTimeout(timeout); }
}
export default function CapitalPanel({ language='ru', isLight=false, currency='USD', user, onBack, onWallet }) {
  const locale = String(language).toLowerCase().startsWith('zh') ? 'zh' : String(language).toLowerCase().startsWith('en') ? 'en' : String(language).toLowerCase().startsWith('ro') || language === 'md' ? 'ro' : 'ru';
  const t = copy[locale], stats = statCopy[locale];
  const [composer,setComposer] = useState(false), [selected,setSelected] = useState(null), [quotes,setQuotes] = useState({}), [lastQuote,setLastQuote] = useState(null), [online,setOnline] = useState(navigator.onLine), [filter,setFilter] = useState(''), [form,setForm] = useState({category:'stock',name:'',symbol:'',currency,quoteSource:'manual',quantity:'',purchasePrice:'',price:'',fee:'0',date:todayKey()});
  const [assetSelection,setAssetSelection]=useState(null), [assetSearch,setAssetSearch]=useState(''), [binanceCatalog,setBinanceCatalog]=useState([]), [binanceCatalogLoading,setBinanceCatalogLoading]=useState(false), [binanceCatalogError,setBinanceCatalogError]=useState(false), [companyCatalog,setCompanyCatalog]=useState(null), [companyCatalogLoading,setCompanyCatalogLoading]=useState(false), [companyCatalogError,setCompanyCatalogError]=useState(false), [showPurchaseDetails,setShowPurchaseDetails]=useState(false), [saving,setSaving]=useState(false);
  const [now,setNow] = useState(Date.now());
  const [opForm,setOpForm]=useState({operation:'sell',quantity:'',price:'',fee:'0',date:todayKey()});
  const [saveError,setSaveError]=useState('');
  const snapshotAttempts=useRef(new Set());
  const quoteBuffer=useRef({});
  const portfolio = useCapitalPortfolio({ user });
  const { surfaceRef } = useWalletExitGesture({ onExit: onBack, disabled: Boolean(composer || selected), navigation: 'wallet' });
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(id);},[]);

  useEffect(()=>{
    if(!composer||form.category!=='crypto'||binanceCatalog.length) return;
    let active=true; setBinanceCatalogLoading(true); setBinanceCatalogError(false);
    loadBinanceSpotPairs().then(items=>{if(active)setBinanceCatalog(items);}).catch(()=>{if(active)setBinanceCatalogError(true);}).finally(()=>{if(active)setBinanceCatalogLoading(false);});
    return()=>{active=false;};
  },[composer,form.category,binanceCatalog.length]);

  useEffect(()=>{
    if(!composer||!['stock','etf'].includes(form.category)||companyCatalog) return;
    let active=true; setCompanyCatalogLoading(true); setCompanyCatalogError(false);
    loadCompanyCatalog().then(items=>{if(active)setCompanyCatalog(items);}).catch(()=>{if(active)setCompanyCatalogError(true);}).finally(()=>{if(active)setCompanyCatalogLoading(false);});
    return()=>{active=false;};
  },[composer,form.category,companyCatalog]);

  useEffect(() => { const on=()=>setOnline(true), off=()=>setOnline(false); window.addEventListener('online',on); window.addEventListener('offline',off); return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);}; },[]);
  const pairs = useMemo(() => [...new Set(portfolio.assets.filter(a=>a.category==='crypto' && a.quote_source==='binance' && /^[A-Z0-9]{5,20}$/.test(a.symbol)).map(a=>a.symbol.toLowerCase()))], [portfolio.assets]);
  useEffect(() => {
    if (!online || !pairs.length) return;
    let socket, timer, stableTimer, healthTimer, frame, closed=false, attempt=0, lastMessageAt=0;
    const connect=()=>{
      if (closed) return;
      socket=new WebSocket(`wss://stream.binance.com:9443/stream?streams=${pairs.map(p=>`${p}@miniTicker`).join('/')}`);
      socket.onopen=()=>{lastMessageAt=Date.now();healthTimer=setInterval(()=>{if(socket?.readyState===WebSocket.OPEN&&Date.now()-lastMessageAt>20000)socket.close();},5000);stableTimer=setTimeout(()=>{attempt=0;},30000);};
      socket.onmessage=(event)=>{lastMessageAt=Date.now();try{const payload=JSON.parse(event.data)?.data; const symbol=String(payload?.s||'').toUpperCase(); const price=String(payload?.c||''); if(symbol && /^\d+(?:\.\d+)?$/.test(price)){const at=Number(payload?.E)||Date.now();quoteBuffer.current[symbol]={price,at};if(!frame)frame=requestAnimationFrame(()=>{frame=null;const batch=quoteBuffer.current;quoteBuffer.current={};setQuotes(previous=>({...previous,...batch}));setLastQuote(Math.max(...Object.values(batch).map(item=>item.at)));});}}catch{}}
      socket.onclose=()=>{clearTimeout(stableTimer);clearInterval(healthTimer);if(!closed)timer=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));};
      socket.onerror=()=>socket.close();
    };
    connect(); return()=>{closed=true;clearTimeout(timer);clearTimeout(stableTimer);clearInterval(healthTimer);cancelAnimationFrame(frame);quoteBuffer.current={};socket?.close();};
  },[online,pairs.join('|')]);

  const priceFor = asset => parseScaled(quotes[asset.symbol]?.price ?? asset.manual_price ?? scaledToString(asset.averageCost,MONEY_SCALE), MONEY_SCALE);
  const metrics = useMemo(() => portfolio.assets.reduce((all,asset)=>{const code=asset.currency;const value=multiplyScaled(asset.quantity,QUANTITY_SCALE,priceFor(asset),MONEY_SCALE);if(!all[code])all[code]={value:0n,invested:0n,pnl:0n};all[code].value+=value;all[code].invested+=asset.invested;all[code].pnl+=value+asset.realized-asset.invested;return all;},{}),[portfolio.assets,quotes]);
  const todayChanges = useMemo(()=>calculateDailyChange(metrics,portfolio.snapshots,todayKey()),[metrics,portfolio.snapshots]);
  const visible = portfolio.assets.filter(a=>`${a.name} ${a.symbol} ${a.category}`.toLowerCase().includes(filter.toLowerCase()));
  const hasBinanceAssets = pairs.length > 0;
  const allPairsFresh = hasBinanceAssets && pairs.every(pair=>isQuoteFresh(quotes[pair.toUpperCase()],now));
  const latestManualUpdate = portfolio.assets.reduce((latest,asset)=>asset.quote_source==='manual'&&asset.updated_at&&(!latest||asset.updated_at>latest)?asset.updated_at:latest,null);
  const displayTime = value => value ? new Date(value).toLocaleString(locale==='zh'?'zh-CN':locale) : '';
  const quoteLabel = (asset, quote) => {
    if (asset.quote_source === 'binance') {
      if (!online) return `${t.offline} · ${displayTime(quote?.at||asset.updated_at)}`;
      if (!quote) return t.pending;
      return `${isQuoteFresh(quote,now)?t.live:t.stale} · ${displayTime(quote.at)}`;
    }
    return `${t.manual}${asset.updated_at?` · ${t.updated} ${displayTime(asset.updated_at)}`:''}`;
  };
  const allocations = useMemo(()=>portfolio.assets.reduce((all,asset)=>{const key=`${asset.currency}:${asset.category}`;const value=multiplyScaled(asset.quantity,QUANTITY_SCALE,priceFor(asset),MONEY_SCALE);all[key]=(all[key]||0n)+value;return all;},{}),[portfolio.assets,quotes]);
  const allocationTotals = useMemo(()=>Object.entries(allocations).reduce((all,[key,value])=>{const code=key.split(':')[0];all[code]=(all[code]||0n)+value;return all;},{}),[allocations]);
  useEffect(()=>{
    if(portfolio.loading||!user?.id||!portfolio.assets.length) return;
    const snapshotDate=todayKey();
    for(const [code,value] of Object.entries(metrics)){
      const key=`${code}:${snapshotDate}`;
      if(snapshotAttempts.current.has(key)||portfolio.snapshots.some(item=>item.currency===code&&item.sampled_on===snapshotDate)) continue;
      if(portfolio.assets.some(asset=>asset.currency===code&&asset.quote_source==='binance')&&!portfolio.assets.filter(asset=>asset.currency===code&&asset.quote_source==='binance').every(asset=>isQuoteFresh(quotes[asset.symbol],now))) continue;
      snapshotAttempts.current.add(key);
      portfolio.recordSnapshot(code,value,snapshotDate).catch(error=>console.warn('[capital] daily snapshot failed:',error.message));
    }
  },[portfolio.loading,portfolio.assets,portfolio.snapshots,portfolio.recordSnapshot,user?.id,metrics,online,quotes,now]);
  const matchedCatalog = useMemo(()=>{
    const query=assetSearch.trim().toLowerCase();
    const curated=getCatalog(form.category);
    const exchangeDirectory=companyCatalog&&['stock','etf'].includes(form.category)
      ? companyCatalog.records.filter(item=>item.category===form.category).map(item=>({...item,currency:'USD',quoteSource:'manual'}))
      : [];
    const curatedSymbols=new Set(curated.map(item=>item.symbol));
    const catalog=form.category==='crypto'&&binanceCatalog.length
      ? [...POPULAR_CRYPTO,...binanceCatalog.filter(item=>!POPULAR_CRYPTO.some(popular=>popular.symbol===item.symbol))]
      : [...curated,...exchangeDirectory.filter(item=>!curatedSymbols.has(item.symbol))];
    const matches=query?catalog.filter(item=>`${item.symbol} ${item.name}`.toLowerCase().includes(query)):catalog;
    return matches.slice(0, query?80:12);
  },[assetSearch,form.category,binanceCatalog]);
  const chooseCatalogAsset=item=>{setAssetSelection(item);setForm(current=>({...current,name:item.name,symbol:item.symbol,currency:item.currency,quoteSource:item.quoteSource,quantity:'',purchasePrice:'',price:'',fee:'0'}));};
  const chooseCustomAsset=()=>{
    const query=assetSearch.trim();
    setAssetSelection({custom:true});
    setForm(current=>({...current,name:query,symbol:/^[A-Za-z0-9.:-]{1,24}$/.test(query)?query.toUpperCase():'',currency:current.category==='crypto'&&current.quoteSource==='binance'?'USDT':current.category==='stock'||current.category==='etf'?'USD':current.currency,quoteSource:'manual',quantity:'',purchasePrice:'',price:'',fee:'0'}));
  };
  const changeCategory=category=>{setAssetSelection(null);setAssetSearch('');setForm(current=>({...current,category,name:'',symbol:'',currency:category==='crypto'?'USDT':category==='stock'||category==='etf'?'USD':current.currency,quoteSource:category==='crypto'?'binance':'manual',quantity:'',purchasePrice:'',price:'',fee:'0'}));};
  const submit=async(event)=>{event.preventDefault();if(saving)return;setSaving(true);setSaveError('');try{if(!assetSelection)throw new Error(t.noAssetsFound);if(assetSelection.custom&&form.category==='crypto'&&form.quoteSource==='binance')await verifyBinanceSpotPair(form.symbol);await portfolio.addAsset({...form,price:form.price||form.purchasePrice,quoteSource:form.category==='crypto'?form.quoteSource:'manual'});setComposer(false);setAssetSelection(null);setAssetSearch('');setForm({...form,name:'',symbol:'',quantity:'',purchasePrice:'',price:'',fee:'0',date:todayKey()});}catch(error){setSaveError(friendlyCapitalError(error,locale,t));}finally{setSaving(false);}};
  const saveOperation=async(event)=>{event.preventDefault();if(saving)return;setSaving(true);setSaveError('');try{await portfolio.addOperation(selected,opForm);setSelected(null);setOpForm({operation:'sell',quantity:'',price:'',fee:'0',date:todayKey()});}catch(error){setSaveError(friendlyCapitalError(error,locale,t));}finally{setSaving(false);}};
  const closeSheet=()=>{setComposer(false);setSelected(null);setAssetSelection(null);setAssetSearch('');setSaveError('');setShowPurchaseDetails(false);};
  const base=isLight?'capital-panel capital-light':'capital-panel';
  return <main ref={surfaceRef} className={base}>
    <header className="capital-top"><button className="capital-back" onClick={onBack}><ArrowLeft size={17}/><span>{t.back}</span></button><div className="capital-brand"><span>DAYRIS</span><b>CAPITAL</b><i>PRO</i></div><button className="capital-wallet" onClick={onWallet}><Wallet size={16}/><span>{t.wallet}</span></button></header>
    <div className="capital-content"><div className="capital-heading"><div><p className="capital-kicker">PERSONAL PORTFOLIO</p><h1>{t.title}</h1><p>{t.subtitle}</p></div><button className="capital-add" onClick={()=>setComposer(true)}><Plus size={17}/>{t.add}</button></div>
      <section className="capital-overview">
        <div className="capital-total"><span>{t.value}</span><strong className="capital-multi-value">{Object.entries(metrics).length?Object.entries(metrics).map(([code,totals])=><span key={code}>{formatMoney(totals.value,code,locale)}</span>):formatMoney(0,currency,locale)}</strong><small>{!online?t.offline:hasBinanceAssets?allPairsFresh?t.live:lastQuote?`${t.stale} · ${displayTime(lastQuote)}`:t.pending:`${t.manual}${latestManualUpdate?` · ${t.updated} ${displayTime(latestManualUpdate)}`:''}`}</small><div className="capital-today-change">{Object.entries(metrics).length?Object.entries(metrics).map(([code])=>{const change=todayChanges[code];return <small key={code} className={change?(change.value>=0n?'positive':'negative'):''}>{code} · {t.today}: {change?`${formatMoney(change.value,code,locale)} (${formatPercent(change.value,change.baseline,locale)})`:'—'}</small>}):<small>{t.today}: —</small>}{Object.keys(todayChanges).length>0&&<small className="capital-change-caption">{t.todayMethod}</small>}</div></div>
        <div className="capital-metric"><span>{t.invested}</span><strong className="capital-multi-value">{Object.entries(metrics).length?Object.entries(metrics).map(([code,totals])=><span key={code}>{formatMoney(totals.invested,code,locale)}</span>):formatMoney(0,currency,locale)}</strong></div>
        <div className="capital-metric"><span>{t.pnl}</span><strong className="capital-multi-value">{Object.entries(metrics).length?Object.entries(metrics).map(([code,totals])=><span key={code} className={totals.pnl>=0?'positive':'negative'}>{formatMoney(totals.pnl,code,locale)}</span>):formatMoney(0,currency,locale)}</strong><div className="capital-multi-return">{Object.entries(metrics).map(([code,totals])=><small key={code}>{code} · {t.return} {formatPercent(totals.pnl,totals.invested,locale)}</small>)}</div></div>
      </section>
      <section className="capital-analytics"><article className="capital-insight"><h2>{t.chart}</h2>{Object.entries(metrics).map(([code])=>{const rows=portfolio.snapshots.filter(row=>row.currency===code),path=valuationPath(rows);return <div className="capital-chart" key={code}><span>{code}</span>{path?<svg viewBox="0 0 320 120" role="img" aria-label={`${t.chart} ${code}`}><path d={path}/></svg>:<p>{t.chartEmpty}</p>}<small>{rows.length?`${rows[0].sampled_on} — ${rows.at(-1).sampled_on}`:t.manual}</small></div>})}{!Object.keys(metrics).length&&<p>{t.chartEmpty}</p>}</article><article className="capital-insight"><h2>{t.distribution}</h2>{Object.entries(allocations).length?Object.entries(allocations).map(([key,value])=>{const [code,category]=key.split(':');const percent=allocationTotals[code]?Number(value*10000n/allocationTotals[code])/100:0;return <div className="capital-allocation" key={key}><div><span>{t.categories[t.cats.indexOf(category)]} · {code}</span><b>{formatMoney(value,code,locale)}</b></div><i><span style={{width:`${percent}%`}}/></i></div>}):<p>{t.emptyHint}</p>}</article></section>
      {!user && <div className="capital-notice"><LockIcon/> {t.signIn}</div>}
      {portfolio.error&&<div role="alert" className="capital-notice">{friendlyCapitalError(portfolio.error,locale,t)}</div>}
      <div className="capital-section-title"><h2>{t.assets} <span>{visible.length}</span></h2><label className="capital-search"><Search size={15}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder={t.search}/></label></div>
      {portfolio.loading?<div className="capital-empty"><RefreshCw className="capital-spin"/>{t.updated}…</div>:!visible.length?<div className="capital-empty"><div className="capital-empty-icon"><ChartNoAxesCombined/></div><strong>{t.empty}</strong><span>{t.emptyHint}</span><button className="capital-add" onClick={()=>setComposer(true)}><Plus size={16}/>{t.add}</button></div>:<div className="capital-assets">{visible.map(asset=>{const Icon=icons[t.cats.indexOf(asset.category)]||BriefcaseBusiness, quote=quotes[asset.symbol], fresh=isQuoteFresh(quote,now), price=priceFor(asset), total=multiplyScaled(asset.quantity,QUANTITY_SCALE,price,MONEY_SCALE), pnl=total+asset.realized-asset.invested;return <button className="capital-asset" key={asset.id} onClick={()=>setSelected(asset)}><span className="capital-asset-icon"><Icon/></span><span className="capital-asset-main"><strong>{asset.name}</strong><small>{asset.symbol||t.manual} · {t.categories[t.cats.indexOf(asset.category)]}</small><em className="capital-quote-mobile">{quoteLabel(asset,quote)}</em></span><span className="capital-asset-value"><strong>{formatMoney(total,asset.currency,locale)}</strong><small className={pnl>=0?'positive':'negative'}>{pnl>=0?'+':''}{formatMoney(pnl,asset.currency,locale)}</small></span><span className="capital-asset-qty">{formatQuantity(asset.quantity,locale)} {asset.symbol}</span><span className="capital-quote-state" data-live={fresh}>{quoteLabel(asset,quote)}</span></button>})}</div>}
      <p className="capital-disclaimer">{t.manual} · {t.live} · {t.updated}: {lastQuote?displayTime(lastQuote):'—'} · Binance crypto stream; other assets are valued manually.</p>
    </div>
    {(composer||selected)&&<div className="capital-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeSheet();}}><SwipeDismissSheet as="form" onDismiss={closeSheet} handleClassName="-mt-3 mb-2" className="capital-sheet" onSubmit={composer?submit:saveOperation}>
      <div className="capital-sheet-head"><div><span className="capital-kicker">DAYRIS CAPITAL</span><h2>{composer?t.add:selected?.name}</h2></div><button type="button" onClick={closeSheet}><X/></button></div>
      {composer?<>
        <p className="capital-step-label">{t.chooseCategory}</p>
        <div className="capital-category-grid">{t.cats.map((category,index)=>{const Icon=icons[index]||BriefcaseBusiness;return <button type="button" key={category} className={form.category===category?'is-selected':''} onClick={()=>changeCategory(category)}><Icon/><span>{t.categories[index]}</span></button>;})}</div>
        {!assetSelection?<>
          <p className="capital-step-label">{assetSearch?t.findAsset:t.popular}</p>
          <label className="capital-picker-search"><Search size={16}/><input autoComplete="off" value={assetSearch} onChange={event=>setAssetSearch(event.target.value)} placeholder={t.findAsset}/></label>
          {['stock','etf'].includes(form.category)&&companyCatalogLoading&&<p className="capital-form-hint">{t.stockCatalogLoading}</p>}
          {['stock','etf'].includes(form.category)&&companyCatalogError&&<p className="capital-form-hint">{t.stockCatalogUnavailable}</p>}
          {form.category==='crypto'&&binanceCatalogLoading&&<p className="capital-form-hint">{t.catalogLoading}</p>}
          {form.category==='crypto'&&binanceCatalogError&&<p className="capital-form-hint">{t.catalogUnavailable}</p>}
          <div className="capital-picker-results">{matchedCatalog.map(item=><button type="button" key={item.symbol} onClick={()=>chooseCatalogAsset(item)}><span className="capital-picker-symbol">{item.symbol}</span><span>{item.name}</span>{item.quoteSource==='binance'&&<i>LIVE</i>}</button>)}
            {!matchedCatalog.length&&<p>{t.noAssetsFound}</p>}</div>
          <button type="button" className="capital-custom-link" onClick={chooseCustomAsset}><Plus size={15}/>{t.customAsset}</button>
        </>:<>
          <div className="capital-selected-asset"><span className="capital-picker-symbol">{assetSelection.custom?t.custom:(form.symbol||form.category.toUpperCase())}</span><span><strong>{assetSelection.custom?t.customAsset:form.name}</strong><small>{form.symbol||t.manualSource}</small></span><button type="button" onClick={()=>{setAssetSelection(null);setAssetSearch('');}}>{t.changeAsset}</button></div>
          {assetSelection.custom&&<><label>{t.name}<input required maxLength="120" value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder={t.manualName}/></label><label>{t.symbol}<input maxLength="24" value={form.symbol} onChange={event=>setForm({...form,symbol:event.target.value.toUpperCase()})} placeholder={t.optional}/></label></>}
          <div className="capital-form-grid"><label>{t.quantity}<input required min="0.000000000001" step="any" type="number" value={form.quantity} onChange={event=>setForm({...form,quantity:event.target.value})}/></label><label>{t.purchase}<input required min="0" step="any" type="number" value={form.purchasePrice} onChange={event=>setForm({...form,purchasePrice:event.target.value})} placeholder="0.00"/></label></div>
          <details className="capital-purchase-details" open={showPurchaseDetails} onToggle={event=>setShowPurchaseDetails(event.currentTarget.open)}><summary>{t.purchaseDetails} <span>{t.optional}</span></summary>
            <div className="capital-form-grid"><label>{t.currency}<select disabled={form.category==='crypto'&&form.quoteSource==='binance'} value={form.currency} onChange={event=>setForm({...form,currency:event.target.value})}>{['USD','EUR','RON','RUB','CNY','GBP','USDT'].map(code=><option key={code}>{code}</option>)}</select></label><label>{t.fee}<input min="0" step="any" type="number" value={form.fee} onChange={event=>setForm({...form,fee:event.target.value})}/></label><label>{t.date}<input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></label>{form.quoteSource==='manual'&&<label>{t.currentEstimate}<input min="0" step="any" type="number" value={form.price} onChange={event=>setForm({...form,price:event.target.value})} placeholder={form.purchasePrice||'0.00'}/></label>}</div>
          </details>
          {form.category==='crypto'&&<><label>{t.quoteSource}<select value={form.quoteSource} onChange={event=>setForm(current=>({...current,quoteSource:event.target.value,currency:event.target.value==='binance'?'USDT':current.currency==='USDT'?currency:current.currency}))}><option value="binance">{t.binanceSource}</option><option value="manual">{t.manualSource}</option></select></label><p className="capital-form-hint">{form.quoteSource==='binance'?t.usdtNote:t.manualSource}</p></>}
          <button className="capital-add capital-submit" type="submit" disabled={saving}>{t.save}</button>
        </>}
      </>:<><div className="capital-detail-value"><span>{t.value}</span><strong>{formatMoney(multiplyScaled(selected.quantity,QUANTITY_SCALE,priceFor(selected),MONEY_SCALE),selected.currency,locale)}</strong><small>{formatQuantity(selected.quantity,locale)} × {formatMoney(priceFor(selected),selected.currency,locale)} · {quoteLabel(selected,quotes[selected.symbol])}</small></div><div className="capital-detail-stats"><div><span>{stats.average}</span><b>{formatMoney(selected.averageCost,selected.currency,locale)}</b></div><div><span>{stats.basis}</span><b>{formatMoney(selected.invested,selected.currency,locale)}</b></div><div><span>{stats.realized}</span><b>{formatMoney(selected.realized,selected.currency,locale)}</b></div><div><span>{stats.unrealized}</span><b>{formatMoney(multiplyScaled(selected.quantity,QUANTITY_SCALE,priceFor(selected),MONEY_SCALE)-selected.invested,selected.currency,locale)}</b></div></div><label>{t.operation}<select value={opForm.operation} onChange={e=>setOpForm({...opForm,operation:e.target.value})}><option value="buy">{t.buy}</option><option value="sell">{t.sell}</option><option value="dividend">{t.dividend||t.sell}</option>{selected.quote_source==='manual'&&<option value="revalue">{t.revalue}</option>}</select></label><div className="capital-form-grid"><label>{t.quantity}<input required={opForm.operation!=='revalue'} min="0.000000000001" max={opForm.operation==='sell'?scaledToString(selected.quantity,QUANTITY_SCALE):undefined} step="any" type="number" value={opForm.quantity} onChange={e=>setOpForm({...opForm,quantity:e.target.value})}/></label><label>{t.purchase}<input required min="0" step="any" type="number" value={opForm.price} onChange={e=>setOpForm({...opForm,price:e.target.value})}/></label><label>{t.fee}<input min="0" step="any" type="number" value={opForm.fee} onChange={e=>setOpForm({...opForm,fee:e.target.value})}/></label><label>{t.date}<input required type="date" value={opForm.date} onChange={e=>setOpForm({...opForm,date:e.target.value})}/></label></div><div className="capital-operations">{selected.rows.map(row=><div key={row.id}><span>{row.operation==='sell'?<ArrowUpRight/>:<ArrowDownLeft/>}{row.operation==='sell'?t.sell:row.operation==='revalue'?t.revalue:row.operation==='dividend'?(t.dividend||t.buy):t.buy}</span><b>{formatQuantity(row.quantity?parseScaled(row.quantity,QUANTITY_SCALE):0n,locale)} × {formatMoney(row.unit_price,row.currency,locale)}</b><time>{row.occurred_on}</time></div>)}</div>{selected.rows[0]&&<button type="button" className="capital-cancel" onClick={async()=>{if(!window.confirm(`${t.cancelOperation}?`))return;setSaveError('');try{await portfolio.deleteLatestOperation(selected.rows[0].id);setSelected(null);}catch(error){setSaveError(friendlyCapitalError(error,locale,t));}}}>{t.cancelOperation}</button>}<button className="capital-add capital-submit" type="submit" disabled={saving}>{opForm.operation==='buy'?t.save:opForm.operation==='revalue'?t.revalue:opForm.operation==='dividend'?(t.dividend||t.buy):t.sellAction}</button></>}
          {saveError&&<p role="alert" className="capital-form-hint">{saveError}</p>}{portfolio.error&&composer&&<p role="alert" className="capital-form-hint">{friendlyCapitalError(portfolio.error,locale,t)}</p>}<button type="button" className="capital-cancel" onClick={closeSheet}>{t.cancel}</button>
    </SwipeDismissSheet></div>}
  </main>;
}
function LockIcon(){return <Wallet size={16}/>}
