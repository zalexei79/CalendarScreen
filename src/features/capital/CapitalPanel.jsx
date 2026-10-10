import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, Bitcoin, BriefcaseBusiness, Building2, ChartNoAxesCombined, CircleDollarSign, Coins, Fuel, Landmark, Plus, RefreshCw, Search, Wallet, X } from 'lucide-react';
import { useCapitalPortfolio } from './useCapitalPortfolio';
import { calculateDailyChange, calculateReturnPercent, formatMoney, MONEY_SCALE, multiplyScaled, parseScaled, QUANTITY_SCALE, scaledToString } from './decimal';
import { useWalletExitGesture } from '../wallet/hooks/useWalletExitGesture';
import SwipeDismissSheet from '../../shared/ui/SwipeDismissSheet.jsx';
import { isGoldApiQuoteFresh, isMoexQuoteFresh, isQuoteFresh } from './quoteStatus.js';
import { resolveCurrentPrice } from './capitalPricing.js';
import { getCatalog, loadBinanceSpotPairs, POPULAR_CRYPTO } from './assetCatalog.js';
import { fetchGoldApiQuote, isGoldApiAsset } from './metalQuotes.js';
import { loadCompanyCatalog } from './loadCompanyCatalog.js';
import { fetchMoexCurrency, fetchMoexQuotes, loadMoexCatalog, MOEX_POPULAR_BONDS, MOEX_POPULAR_ETFS, MOEX_POPULAR_STOCKS, searchMoexSecurities } from './moexMarket.js';
import { friendlyCapitalError } from './capitalErrors.js';
import CapitalPerformanceChart from './CapitalPerformanceChart.jsx';
import CapitalAssetHistoryChart from './CapitalAssetHistoryChart.jsx';
import { buildConsolidatedPortfolioSnapshots, calculatePortfolioPeriodResults } from './portfolioHistory.js';
import { calculateBasePortfolioResult, currencyRateOn, fetchDailyCurrencyRates } from './currencyRates.js';
import './capital.css';

const copy = {
  ru: { title:'DAYRIS Capital', subtitle:'Ваши инвестиции в одном месте', value:'Стоимость портфеля', invested:'Вложено', pnl:'Прибыль / убыток', today:'Котировки', assets:'Активы', add:'Добавить актив', empty:'Здесь появятся ваши инвестиции', emptyHint:'Добавьте актив и сохраните первую операцию покупки.', back:'К календарю', wallet:'Кошелёк', signIn:'Войдите, чтобы сохранить портфель на всех устройствах.', category:'Категория', name:'Название', symbol:'Тикер / пара Binance', currency:'Валюта', quoteSource:'Источник цены', quantity:'Количество', purchase:'Цена покупки', price:'Текущая оценка за единицу', date:'Дата', fee:'Комиссия', save:'Сохранить покупку', cancel:'Отмена', search:'Название или тикер', manual:'Ручная оценка', live:'LIVE · Binance', offline:'OFFLINE', updated:'Обновлено', history:'История операций', buy:'Покупка', sell:'Продажа', sellAction:'Продать', dividend:'Дивиденд', revalue:'Обновить оценку', operation:'Операция', lastUpdated:'Последняя цена', distribution:'Распределение активов', chart:'История оценки', chartEmpty:'История появится после первой дневной фиксации стоимости.', cancelOperation:'Отменить последнюю операцию', categories:['Акции','ETF','Криптовалюта','Металл','Сырьё','Недвижимость','Облигации','Вклад','Другое'], cats:['stock','etf','crypto','metal','commodity','real_estate','bond','deposit','other'], error:'Не удалось загрузить портфель.' },
  en: { title:'DAYRIS Capital', subtitle:'Your investments in one place', value:'Portfolio value', invested:'Invested', pnl:'Profit / loss', today:'Quotes', assets:'Assets', add:'Add asset', empty:'Your investments will appear here', emptyHint:'Add an asset and record your first purchase.', back:'Calendar', wallet:'Wallet', signIn:'Sign in to sync your portfolio across devices.', category:'Category', name:'Name', symbol:'Ticker / Binance pair', currency:'Currency', quoteSource:'Price source', quantity:'Quantity', purchase:'Purchase price', price:'Current estimate per unit', date:'Date', fee:'Fee', save:'Save purchase', cancel:'Cancel', search:'Name or ticker', manual:'Manual estimate', live:'LIVE · Binance', offline:'OFFLINE', updated:'Updated', history:'Activity', buy:'Purchase', sell:'Sale', sellAction:'Sell', dividend:'Dividend', revalue:'Update valuation', operation:'Operation', lastUpdated:'Last price', distribution:'Asset allocation', chart:'Valuation history', chartEmpty:'History starts after the first daily valuation snapshot.', cancelOperation:'Cancel latest operation', categories:['Stocks','ETF','Crypto','Metal','Commodities','Real estate','Bonds','Deposit','Other'], cats:['stock','etf','crypto','metal','commodity','real_estate','bond','deposit','other'], error:'Could not load portfolio.' },
  ro: { title:'DAYRIS Capital', subtitle:'Investițiile tale într-un singur loc', value:'Valoarea portofoliului', invested:'Investit', pnl:'Profit / pierdere', today:'Cotații', assets:'Active', add:'Adaugă activ', empty:'Investițiile tale vor apărea aici', emptyHint:'Adaugă un activ și înregistrează prima cumpărare.', back:'Calendar', wallet:'Portofel', signIn:'Autentifică-te pentru sincronizarea portofoliului.', category:'Categorie', name:'Nume', symbol:'Simbol / pereche Binance', currency:'Monedă', quoteSource:'Sursa prețului', quantity:'Cantitate', purchase:'Preț de cumpărare', price:'Estimare curentă pe unitate', date:'Data', fee:'Comision', save:'Salvează cumpărarea', cancel:'Anulează', search:'Nume sau simbol', manual:'Evaluare manuală', live:'LIVE · Binance', offline:'OFFLINE', updated:'Actualizat', history:'Activitate', buy:'Cumpărare', sell:'Vânzare', sellAction:'Vinde', dividend:'Dividend', revalue:'Actualizează evaluarea', operation:'Operațiune', lastUpdated:'Ultimul preț', distribution:'Alocarea activelor', chart:'Istoricul evaluării', chartEmpty:'Istoricul începe după prima evaluare zilnică salvată.', cancelOperation:'Anulează ultima operațiune', categories:['Acțiuni','ETF','Cripto','Metal','Mărfuri','Imobiliare','Obligațiuni','Depozit','Altele'], cats:['stock','etf','crypto','metal','commodity','real_estate','bond','deposit','other'], error:'Portofoliul nu a putut fi încărcat.' },
  zh: { title:'DAYRIS Capital', subtitle:'在一处管理您的投资', value:'投资组合价值', invested:'已投入', pnl:'盈亏', today:'行情', assets:'资产', add:'添加资产', empty:'您的投资将显示在这里', emptyHint:'添加资产并记录首次购买。', back:'返回日历', wallet:'钱包', signIn:'登录以在设备间同步投资组合。', category:'类别', name:'名称', symbol:'代码 / Binance交易对', currency:'货币', quoteSource:'价格来源', quantity:'数量', purchase:'买入价格', price:'当前估值/单位', date:'日期', fee:'手续费', save:'保存买入', cancel:'取消', search:'名称或代码', manual:'手动估值', live:'实时 · Binance', offline:'离线', updated:'更新于', history:'交易记录', buy:'买入', sell:'卖出', sellAction:'卖出', dividend:'股息', revalue:'更新估值', operation:'操作', lastUpdated:'最近报价', distribution:'资产分布', chart:'估值历史', chartEmpty:'首次每日估值记录后将显示历史。', cancelOperation:'取消最近操作', categories:['股票','ETF','加密货币','贵金属','大宗商品','房地产','债券','存款','其他'], cats:['stock','etf','crypto','metal','commodity','real_estate','bond','deposit','other'], error:'无法加载投资组合。' },
};
Object.assign(copy.ru,{binanceSource:'Binance Spot · USDT',manualSource:'Ручная оценка',usdtNote:'Котировки Binance указаны в USDT. Суммы остаются в USDT; валюты не конвертируются.',stale:'УСТАРЕЛО',pending:'Ожидание котировки'});
Object.assign(copy.en,{binanceSource:'Binance Spot · USDT',manualSource:'Manual estimate',usdtNote:'Binance quotes are in USDT. Values stay in USDT; currencies are not converted.',stale:'STALE',pending:'Waiting for quote'});
Object.assign(copy.ro,{binanceSource:'Binance Spot · USDT',manualSource:'Evaluare manuală',usdtNote:'Cotațiile Binance sunt în USDT. Valorile rămân în USDT; monedele nu sunt convertite.',stale:'ÎNVECHIT',pending:'Se așteaptă cotația'});
Object.assign(copy.zh,{binanceSource:'Binance 现货 · USDT',manualSource:'手动估值',usdtNote:'Binance 报价以 USDT 计价。金额保持为 USDT，不进行货币换算。',stale:'报价已过期',pending:'正在等待报价'});
Object.assign(copy.ru,{return:'Доходность'});
Object.assign(copy.en,{return:'Return'});
Object.assign(copy.ro,{return:'Randament'});
Object.assign(copy.zh,{return:'回报率'});
Object.assign(copy.ru,{portfolioEyebrow:'ИНВЕСТИЦИОННЫЙ ПОРТФЕЛЬ',assets:'Мои вложения',investments:'Инвестиции',myAssets:'Мои активы',allTime:'за всё время',rangeWeek:'1Н',rangeMonth:'1М',rangeQuarter:'3М',rangeYear:'1Г',rangeAll:'ВСЁ',allAssets:'Все активы',showLess:'Свернуть',addOperation:'Добавить операцию',chartEmpty:'График появится после второй сохранённой дневной оценки. Исторические данные не подменяются примерами.'});
Object.assign(copy.en,{portfolioEyebrow:'INVESTMENT PORTFOLIO',assets:'My holdings',investments:'Investments',myAssets:'My assets',allTime:'all time',rangeWeek:'1W',rangeMonth:'1M',rangeQuarter:'3M',rangeYear:'1Y',rangeAll:'ALL',allAssets:'All assets',showLess:'Show less',addOperation:'Add transaction',chartEmpty:'The chart starts after a second saved daily valuation. No sample history is shown.'});
Object.assign(copy.ro,{portfolioEyebrow:'PORTOFOLIU DE INVESTIȚII',assets:'Investițiile mele',investments:'Investiții',myAssets:'Activele mele',allTime:'în total',rangeWeek:'1S',rangeMonth:'1L',rangeQuarter:'3L',rangeYear:'1A',rangeAll:'TOT',allAssets:'Toate activele',showLess:'Restrânge',addOperation:'Adaugă operațiune',chartEmpty:'Graficul începe după a doua evaluare zilnică salvată. Nu sunt afișate date demonstrative.'});
Object.assign(copy.zh,{portfolioEyebrow:'投资组合',assets:'我的持仓',investments:'投资',myAssets:'我的资产',allTime:'累计',rangeWeek:'1周',rangeMonth:'1月',rangeQuarter:'3月',rangeYear:'1年',rangeAll:'全部',allAssets:'全部资产',showLess:'收起',addOperation:'添加交易',chartEmpty:'保存第二次每日估值后将显示图表，不会填入示例历史数据。'});
Object.assign(copy.ru,{chooseCategory:'Выберите категорию',findAsset:'Найдите актив по названию или тикеру',popular:'Популярные',customAsset:'Добавить свой актив',changeAsset:'Выбрать другой',noAssetsFound:'Ничего не найдено — добавьте актив вручную.',catalogLoading:'Загружаем список Binance…',catalogUnavailable:'Список Binance недоступен. Популярные пары и ручное добавление доступны.',purchaseDetails:'Детали покупки',optional:'необязательно',manualName:'Например: квартира, облигация, фонд',accountSetup:'Функции Capital в базе ещё не обновлены. Попробуйте позже; если ошибка повторится, обратитесь в поддержку.',proRequired:'Для доступа к Capital требуется активный DAYRIS PRO.',custom:'Свой актив',currentEstimate:'Текущая оценка за единицу'});
Object.assign(copy.en,{chooseCategory:'Choose a category',findAsset:'Search by asset name or ticker',popular:'Popular',customAsset:'Add a custom asset',changeAsset:'Choose another',noAssetsFound:'No matches. Add this asset manually.',catalogLoading:'Loading Binance symbols…',catalogUnavailable:'Binance list is unavailable. Popular pairs and manual entry still work.',purchaseDetails:'Purchase details',optional:'optional',manualName:'For example: apartment, bond, fund',accountSetup:'Capital database functions are not up to date. Try again later; if this continues, contact support.',proRequired:'An active DAYRIS PRO plan is required to use Capital.',custom:'Custom asset',currentEstimate:'Current estimate per unit'});
Object.assign(copy.ro,{chooseCategory:'Alege o categorie',findAsset:'Caută după nume sau simbol',popular:'Populare',customAsset:'Adaugă un activ propriu',changeAsset:'Alege altul',noAssetsFound:'Nu s-au găsit rezultate. Adaugă activul manual.',catalogLoading:'Se încarcă simbolurile Binance…',catalogUnavailable:'Lista Binance nu este disponibilă. Poți folosi perechile populare sau adăugarea manuală.',purchaseDetails:'Detaliile cumpărării',optional:'opțional',manualName:'De exemplu: apartament, obligațiune, fond',accountSetup:'Funcțiile bazei Capital nu sunt actualizate. Încearcă din nou mai târziu; dacă persistă, contactează asistența.',proRequired:'Este necesar un abonament DAYRIS PRO activ pentru Capital.',custom:'Activ propriu',currentEstimate:'Estimare curentă pe unitate'});
Object.assign(copy.zh,{chooseCategory:'选择类别',findAsset:'按名称或代码搜索',popular:'热门',customAsset:'添加自定义资产',changeAsset:'重新选择',noAssetsFound:'没有匹配项。请手动添加资产。',catalogLoading:'正在加载 Binance 代码…',catalogUnavailable:'Binance 列表暂不可用，仍可选择热门交易对或手动添加。',purchaseDetails:'买入详情',optional:'可选',manualName:'例如：公寓、债券、基金',accountSetup:'Capital 数据库功能尚未更新。请稍后重试；如问题持续，请联系支持。',proRequired:'使用 Capital 需要有效的 DAYRIS PRO。',custom:'自定义资产',currentEstimate:'当前单价估值'});
Object.assign(copy.ru,{accountSetup:'Серверная функция Capital не найдена в Supabase. Портфель не сохранён; требуется применить миграцию Capital.'});
Object.assign(copy.en,{accountSetup:'The Capital server function was not found in Supabase. This portfolio change was not saved; the Capital database migration must be applied.'});
Object.assign(copy.ro,{accountSetup:'Funcția Capital nu a fost găsită în Supabase. Modificarea nu a fost salvată; trebuie aplicată migrarea bazei de date Capital.'});
Object.assign(copy.zh,{accountSetup:'在 Supabase 中找不到 Capital 服务函数。更改未保存；需要应用 Capital 数据库迁移。'});
Object.assign(copy.ru,{perUnit:'за единицу',perTroyOunce:'за тройскую унцию',quoteSnapshot:'Снимок',spot:'СПОТ · Gold API',goldApiSource:'Спот · Gold API',quoteDisclaimer:'Binance передаёт котировки криптоактивов и токенизированного золота PAXG/XAUT. Gold API обновляет ориентировочные спотовые цены XAU/XAG/XPT/XPD в USD примерно раз в минуту; поставщик не гарантирует точность котировок. Акции и ETF остаются без бесплатного разрешённого потока и используют ручную оценку.'});
Object.assign(copy.en,{perUnit:'per unit',perTroyOunce:'per troy ounce',quoteSnapshot:'Snapshot',spot:'SPOT · Gold API',goldApiSource:'Spot · Gold API',quoteDisclaimer:'Binance streams crypto and tokenized gold PAXG/XAUT. Gold API refreshes indicative XAU/XAG/XPT/XPD spot prices in USD about once a minute; the provider does not warrant quote accuracy. Stocks and ETFs remain manually valued because no free permitted feed is available.',waitingQuote:'Waiting for a market price',analytics:'Portfolio analytics'});
Object.assign(copy.ru,{waitingQuote:'Ожидаем рыночную цену',analytics:'Аналитика портфеля'});
Object.assign(copy.ro,{perUnit:'per unitate',perTroyOunce:'pe uncie troy',quoteSnapshot:'Instantaneu',spot:'SPOT · Gold API',goldApiSource:'Spot · Gold API',quoteDisclaimer:'Binance transmite cotații crypto și aurului tokenizat PAXG/XAUT. Gold API actualizează aproximativ o dată pe minut prețurile spot orientative XAU/XAG/XPT/XPD în USD; furnizorul nu garantează exactitatea. Acțiunile și ETF-urile rămân evaluate manual deoarece nu este disponibil un flux gratuit permis.',waitingQuote:'Se așteaptă prețul pieței',analytics:'Analiza portofoliului'});
Object.assign(copy.zh,{perUnit:'每单位',perTroyOunce:'每金衡盎司',quoteSnapshot:'行情快照',spot:'现货 · Gold API',goldApiSource:'现货 · Gold API',quoteDisclaimer:'Binance 提供加密资产和代币化黄金 PAXG/XAUT 行情。Gold API 每分钟左右更新 USD 计价的 XAU/XAG/XPT/XPD 参考现货价格；该服务不保证行情准确性。股票和 ETF 因没有可免费合规使用的行情源，仍采用手动估值。',waitingQuote:'等待市场价格',analytics:'投资组合分析'});
Object.assign(copy.ru,{stockCatalogLoading:'Загружаем справочник тикеров…',stockCatalogUnavailable:'Справочник временно недоступен. Популярные акции и ручной ввод работают.'});
Object.assign(copy.en,{stockCatalogLoading:'Loading the ticker directory…',stockCatalogUnavailable:'Ticker directory is unavailable. Popular assets and manual entry still work.'});
Object.assign(copy.ro,{stockCatalogLoading:'Se încarcă lista de simboluri…',stockCatalogUnavailable:'Lista simbolurilor nu este disponibilă. Activele populare și adăugarea manuală funcționează.'});
Object.assign(copy.zh,{stockCatalogLoading:'正在加载代码目录…',stockCatalogUnavailable:'代码目录暂不可用，热门资产和手动添加仍可使用。'});
Object.assign(copy.ru,{today:'К оценке вчера',todayMethod:'Изменение общей стоимости, включая сделки.'});
Object.assign(copy.en,{today:'vs. yesterday',todayMethod:'Total value change; recorded trades are included.'});
Object.assign(copy.ro,{today:'față de ieri',todayMethod:'Schimbarea valorii totale, inclusiv tranzacțiile.'});
Object.assign(copy.zh,{today:'较昨日',todayMethod:'总价值变化，包含已记录交易。'});
Object.assign(copy.ru,{quoteDisclaimer:'Binance передаёт криптокотировки в реальном времени; Gold API обновляет ориентировочные цены металлов в USD. Акции, ETF, недвижимость, облигации, вклады и другие активы оцениваются вручную.'});
Object.assign(copy.en,{quoteDisclaimer:'Binance streams crypto quotes in real time; Gold API refreshes indicative metal prices in USD. Stocks, ETFs, real estate, bonds, deposits, and other assets use manual valuations.'});
Object.assign(copy.ro,{quoteDisclaimer:'Binance transmite cotații crypto în timp real; Gold API actualizează prețuri orientative pentru metale în USD. Acțiunile, ETF-urile, imobiliarele, obligațiunile, depozitele și alte active folosesc evaluări manuale.'});
Object.assign(copy.zh,{quoteDisclaimer:'Binance 提供实时加密货币行情；Gold API 更新美元计价的参考金属价格。股票、ETF、房地产、债券、存款和其他资产使用手动估值。'});
const icons = [ChartNoAxesCombined, ChartNoAxesCombined, Bitcoin, Coins, Fuel, Building2, Landmark, CircleDollarSign, BriefcaseBusiness];
const statCopy={ru:{average:'Средняя себестоимость',basis:'Себестоимость остатка',realized:'Реализовано',unrealized:'Нереализовано',total:'Общий результат',fees:'Комиссии'},en:{average:'Average cost',basis:'Remaining cost basis',realized:'Realized',unrealized:'Unrealized',total:'Total result',fees:'Fees'},ro:{average:'Cost mediu',basis:'Costul rămas',realized:'Realizat',unrealized:'Nerealizat',total:'Rezultat total',fees:'Comisioane'},zh:{average:'平均成本',basis:'剩余成本',realized:'已实现',unrealized:'未实现',total:'总收益',fees:'手续费'}};
Object.assign(copy.ru,{unrealizedLead:'Нереализованная прибыль / убыток',relativeCost:'Относительно себестоимости остатка',currentValue:'Текущая стоимость',currentUnitPrice:'Цена за единицу',quantityUnit:'ед.',buyAction:'Купить',sellAction:'Продать',assetHistory:'История позиции',assetHistoryNote:'По сохранённым операциям · без подмены исторических котировок',assetHistoryEmpty:'График появится после первой операции.',costMode:'Себестоимость',quantityMode:'Количество',resultFormula:'Общий результат = реализованный + нереализованный. Комиссии уже учтены.'});
Object.assign(copy.en,{unrealizedLead:'Unrealized profit / loss',relativeCost:'Against the remaining cost basis',currentValue:'Current value',currentUnitPrice:'Price per unit',quantityUnit:'units',buyAction:'Buy',sellAction:'Sell',assetHistory:'Position history',assetHistoryNote:'From recorded transactions · no synthetic market prices',assetHistoryEmpty:'History appears after the first transaction.',costMode:'Cost basis',quantityMode:'Quantity',resultFormula:'Total = realized + unrealized. Fees are already included.'});
Object.assign(copy.ro,{unrealizedLead:'Profit / pierdere nerealizată',relativeCost:'Față de costul rămas',currentValue:'Valoare curentă',currentUnitPrice:'Preț pe unitate',quantityUnit:'unități',buyAction:'Cumpără',sellAction:'Vinde',assetHistory:'Istoricul poziției',assetHistoryNote:'Din operațiunile salvate · fără cotații istorice inventate',assetHistoryEmpty:'Graficul apare după prima operațiune.',costMode:'Cost',quantityMode:'Cantitate',resultFormula:'Total = realizat + nerealizat. Comisioanele sunt deja incluse.'});
Object.assign(copy.zh,{unrealizedLead:'未实现盈亏',relativeCost:'相对于剩余成本',currentValue:'当前价值',currentUnitPrice:'单价',quantityUnit:'单位',buyAction:'买入',sellAction:'卖出',assetHistory:'持仓历史',assetHistoryNote:'基于已保存交易 · 不伪造历史行情',assetHistoryEmpty:'首次交易后显示图表。',costMode:'成本',quantityMode:'数量',resultFormula:'总收益 = 已实现 + 未实现。手续费已计入。'});
Object.assign(copy.ru,{market:'Рынок',worldMarket:'США',russiaMarket:'Россия · MOEX',moexSource:'MOEX · задержка до 15 мин',moexDelayed:'DELAYED · MOEX',moexCurrencyLoading:'Проверяем валюту инструмента…',moexCatalogUnavailable:'Не удалось загрузить справочник MOEX. Попробуйте ещё раз или добавьте актив вручную.',quoteDisclaimer:'Справочник акций и ETF США; котировки MOEX для российских акций и облигаций задерживаются. Binance передаёт криптокотировки в реальном времени, Gold API обновляет ориентировочные цены металлов. Недвижимость, вклады и другие активы оцениваются вручную.'});
Object.assign(copy.en,{market:'Market',worldMarket:'US',russiaMarket:'Russia · MOEX',moexSource:'MOEX · up to 15 min delay',moexDelayed:'DELAYED · MOEX',moexCurrencyLoading:'Checking instrument currency…',moexCatalogUnavailable:'Could not load the MOEX directory. Try again or add the asset manually.',quoteDisclaimer:'The stock and ETF directory covers US listings; MOEX quotes for Russian shares and bonds are delayed. Binance streams crypto quotes, and Gold API refreshes indicative metal prices. Real estate, deposits, and other assets use manual valuations.'});
Object.assign(copy.ro,{market:'Piață',worldMarket:'SUA',russiaMarket:'Rusia · MOEX',moexSource:'MOEX · întârziere de până la 15 min',moexDelayed:'ÎNTÂRZIAT · MOEX',moexCurrencyLoading:'Se verifică moneda instrumentului…',moexCatalogUnavailable:'Lista MOEX nu s-a încărcat. Încearcă din nou sau adaugă manual activul.',quoteDisclaimer:'Catalogul de acțiuni și ETF-uri include listări din SUA; cotațiile MOEX pentru acțiunile și obligațiunile rusești sunt întârziate. Binance transmite cotații crypto, iar Gold API actualizează prețuri orientative pentru metale. Imobiliarele, depozitele și alte active folosesc evaluări manuale.'});
Object.assign(copy.zh,{market:'市场',worldMarket:'美国',russiaMarket:'俄罗斯 · MOEX',moexSource:'MOEX · 延迟最多 15 分钟',moexDelayed:'延迟 · MOEX',moexCurrencyLoading:'正在检查资产货币…',moexCatalogUnavailable:'无法加载 MOEX 目录。请重试或手动添加资产。',quoteDisclaimer:'股票和 ETF 目录涵盖美国上市证券；MOEX 的俄罗斯股票和债券报价存在延迟。Binance 提供加密货币行情，Gold API 更新金属参考价格。房地产、存款和其他资产采用手动估值。'});
Object.assign(copy.ru,{assetScore:'Скор позиции',assetScoreNote:'100 баллов: доходность — до 50, доля в портфеле той же валюты — до 25, свежесть цены — до 25. Валюты не конвертируются. Это оценка позиции, не прогноз.',assetScoreChip:score=>`Скор ${score}/100`,scoreReturn:'Доходность · до 50',scoreShare:'Доля портфеля · до 25',scorePrice:'Свежесть цены · до 25',scoreFreshLive:'LIVE',scoreFreshDelayed:'Задержанная котировка',scoreFreshStale:'Устарела',scoreFreshManual:'Ручная оценка',scoreUnavailable:'Недостаточно данных: нужна текущая оценка актива и сумма портфеля в той же валюте.'});
Object.assign(copy.en,{assetScore:'Position score',assetScoreNote:'100 points: return up to 50, same-currency portfolio share up to 25, and price freshness up to 25. Currencies are not converted. This scores the position; it is not a forecast.',assetScoreChip:score=>`Score ${score}/100`,scoreReturn:'Return · up to 50',scoreShare:'Portfolio share · up to 25',scorePrice:'Price freshness · up to 25',scoreFreshLive:'LIVE',scoreFreshDelayed:'Delayed quote',scoreFreshStale:'Stale',scoreFreshManual:'Manual valuation',scoreUnavailable:'Not enough data: a current asset valuation and same-currency portfolio total are required.'});
Object.assign(copy.ro,{assetScore:'Scorul poziției',assetScoreNote:'100 de puncte: randament până la 50, ponderea în portofoliul aceleiași monede până la 25 și actualitatea prețului până la 25. Monedele nu se convertesc. Evaluează poziția, nu este o prognoză.',assetScoreChip:score=>`Scor ${score}/100`,scoreReturn:'Randament · până la 50',scoreShare:'Pondere · până la 25',scorePrice:'Actualitatea prețului · până la 25',scoreFreshLive:'LIVE',scoreFreshDelayed:'Cotație întârziată',scoreFreshStale:'Învechită',scoreFreshManual:'Evaluare manuală',scoreUnavailable:'Date insuficiente: este necesară evaluarea curentă și valoarea portofoliului în aceeași monedă.'});
Object.assign(copy.zh,{assetScore:'持仓评分',assetScoreNote:'共100分：收益最高50分，同币种组合占比最高25分，价格时效最高25分。不同币种不换算。此评分描述持仓，不是预测。',assetScoreChip:score=>`评分 ${score}/100`,scoreReturn:'收益 · 最高50',scoreShare:'组合占比 · 最高25',scorePrice:'价格时效 · 最高25',scoreFreshLive:'实时',scoreFreshDelayed:'延迟行情',scoreFreshStale:'已过期',scoreFreshManual:'手动估值',scoreUnavailable:'数据不足：需要当前资产估值和同币种组合总额。'});
Object.assign(copy.ru,{chartLatest:'Стоимость на последнюю дату',chartPeriodChange:'Изменение стоимости',chartScale:'Шкала графика',chartSavedPoints:count=>`${count} ${count===1?'снимок':count<5?'снимка':'снимков'}`,chartOnePoint:'одна оценка'});
Object.assign(copy.en,{chartLatest:'Value at latest date',chartPeriodChange:'Change in value',chartScale:'Chart scale',chartSavedPoints:count=>`${count} saved ${count===1?'snapshot':'snapshots'}`,chartOnePoint:'one valuation'});
Object.assign(copy.ro,{chartLatest:'Valoare la ultima dată',chartPeriodChange:'Modificarea valorii',chartScale:'Scara graficului',chartSavedPoints:count=>`${count} ${count===1?'instantaneu':'instantanee'}`,chartOnePoint:'o evaluare'});
Object.assign(copy.zh,{chartLatest:'最新日期的价值',chartPeriodChange:'价值变化',chartScale:'图表刻度',chartSavedPoints:count=>`${count} 个已保存快照`,chartOnePoint:'一次估值'});
Object.assign(copy.ru,{chartValueMode:'Стоимость',chartReturnMode:'Доходность',chartReturnLatest:'Доходность за период',chartReturnChange:'Изменение доходности'});
Object.assign(copy.en,{chartValueMode:'Value',chartReturnMode:'Return',chartReturnLatest:'Period return',chartReturnChange:'Return change'});
Object.assign(copy.ro,{chartValueMode:'Valoare',chartReturnMode:'Randament',chartReturnLatest:'Randamentul perioadei',chartReturnChange:'Modificarea randamentului'});
Object.assign(copy.zh,{chartValueMode:'价值',chartReturnMode:'收益率',chartReturnLatest:'期间收益率',chartReturnChange:'收益率变化'});
Object.assign(copy.ru,{usdtSeparate:'USDT отдельно'});
Object.assign(copy.en,{usdtSeparate:'USDT separately'});
Object.assign(copy.ro,{usdtSeparate:'USDT separat'});
Object.assign(copy.zh,{usdtSeparate:'USDT单独显示'});
Object.assign(copy.ru,{periodResult:'Результат за период',periodResultNote:'Покупки и продажи учтены по датам. Процент показывает результат относительно капитала под риском.',periodNoHistory:'Для выбранного периода пока недостаточно сохранённых оценок.',periodOf:'из',periodBase:'капитал под риском',periodFxNote:'Итог нельзя корректно объединить: часть валют не конвертируется. Результаты показаны отдельно.'});
Object.assign(copy.en,{periodResult:'Result for the period',periodResultNote:'Purchases and sales use their transaction dates. Return is measured against capital at risk.',periodNoHistory:'There are not enough saved valuations for this period yet.',periodOf:'of',periodBase:'capital at risk',periodFxNote:'Currencies cannot be safely combined. Results are shown separately.'});
Object.assign(copy.ro,{periodResult:'Rezultatul perioadei',periodResultNote:'Cumpărările și vânzările folosesc datele operațiunilor. Randamentul este raportat la capitalul expus.',periodNoHistory:'Nu există încă suficiente evaluări salvate pentru această perioadă.',periodOf:'din',periodBase:'capital expus',periodFxNote:'Monedele nu pot fi combinate corect. Rezultatele sunt afișate separat.'});
Object.assign(copy.zh,{periodResult:'所选期间结果',periodResultNote:'按交易日期计算买入和卖出。收益率以风险资本为基准。',periodNoHistory:'所选期间的已保存估值还不够。',periodOf:'/',periodBase:'风险资本',periodFxNote:'货币无法可靠合并，结果将分开显示。'});
Object.assign(copy.ru,{globalValue:'Стоимость в базовой валюте',baseCurrency:'Базовая валюта',globalPnl:'Общий результат',fxDaily:'Курс Frankfurter · обновление раз в день',fxLoading:'Загружаем курсы валют…',fxUnavailable:'Курс недоступен — суммы показаны раздельно',fxExcluded:'USDT не конвертируется и остаётся отдельно',globalCoverage:'Учтены валюты с доступными оценками и курсами',globalIncomplete:'Нет текущей оценки для валют: '});
Object.assign(copy.en,{globalValue:'Value in base currency',baseCurrency:'Base currency',globalPnl:'Total return',fxDaily:'Frankfurter reference rate · daily',fxLoading:'Loading currency rates…',fxUnavailable:'Rate unavailable — currencies remain separate',fxExcluded:'USDT is not converted and remains separate',globalCoverage:'Includes currencies with available valuations and rates',globalIncomplete:'Current valuations missing for: '});
Object.assign(copy.ro,{globalValue:'Valoare în moneda de bază',baseCurrency:'Monedă de bază',globalPnl:'Rezultatul total',fxDaily:'Curs de referință Frankfurter · zilnic',fxLoading:'Se încarcă cursurile…',fxUnavailable:'Curs indisponibil — monedele rămân separate',fxExcluded:'USDT nu se convertește și rămâne separat',globalCoverage:'Include monede cu evaluări și cursuri disponibile',globalIncomplete:'Lipsesc evaluări curente pentru: '});
Object.assign(copy.zh,{globalValue:'基准货币估值',baseCurrency:'基准货币',globalPnl:'总收益',fxDaily:'Frankfurter参考汇率 · 每日更新',fxLoading:'正在加载汇率…',fxUnavailable:'汇率不可用，货币分开展示',fxExcluded:'USDT不换算，单独显示',globalCoverage:'包含有可用估值和汇率的货币',globalIncomplete:'以下货币缺少当前估值：'});
Object.assign(copy.ru,{currencyBreakdown:'Разбивка по валютам',chartCoverage:'График включает только валюты с сохранёнными оценками и доступным дневным курсом. USDT остаётся отдельно.',periodBreakdown:'Детали результата по валютам',historyValue:'Стоимость по сохранённым оценкам',historyNote:'Изменение стоимости показывает портфель на даты снимков. Результат периода дополнительно учитывает покупки, продажи и закрытые позиции.'});
Object.assign(copy.en,{currencyBreakdown:'Currency breakdown',chartCoverage:'The chart includes currencies with saved valuations and an available daily rate. USDT is shown separately.',periodBreakdown:'Result by currency',historyValue:'Value from saved valuations',historyNote:'Value change shows the portfolio on snapshot dates. Period result also accounts for purchases, sales, and closed positions.'});
Object.assign(copy.ro,{currencyBreakdown:'Defalcare pe monede',chartCoverage:'Graficul include monede cu evaluări salvate și curs zilnic disponibil. USDT rămâne separat.',periodBreakdown:'Rezultatul pe monede',historyValue:'Valoare din evaluările salvate',historyNote:'Modificarea valorii arată portofoliul la datele evaluărilor. Rezultatul perioadei include și cumpărări, vânzări și poziții închise.'});
Object.assign(copy.zh,{currencyBreakdown:'按货币拆分',chartCoverage:'图表仅包含有已保存估值和可用每日汇率的货币。USDT单独显示。',periodBreakdown:'按货币查看结果',historyValue:'基于已保存估值的价值',historyNote:'价值变化显示估值日的投资组合。期间结果还包括买入、卖出和已平仓头寸。'});
Object.assign(copy.ru,{quoteCoverage:(fresh,total,manual)=>`Актуальные котировки: ${fresh}/${total} · ручная оценка: ${manual}`,quoteNone:'Нет рыночных котировок'});
Object.assign(copy.en,{quoteCoverage:(fresh,total,manual)=>`Fresh quotes: ${fresh}/${total} · manual valuations: ${manual}`,quoteNone:'No market quotes'});
Object.assign(copy.ro,{quoteCoverage:(fresh,total,manual)=>`Cotații actuale: ${fresh}/${total} · evaluări manuale: ${manual}`,quoteNone:'Fără cotații de piață'});
Object.assign(copy.zh,{quoteCoverage:(fresh,total,manual)=>`实时行情：${fresh}/${total} · 手动估值：${manual}`,quoteNone:'无市场行情'});
Object.assign(copy.ru,{commodityGroups:[['all','Всё сырьё'],['energy','Энергоресурсы'],['metals','Промышленные металлы'],['agriculture','Сельхозтовары'],['livestock','Животноводство']],commodityManual:'Для сырья нет общего бесплатного потока котировок внутри приложения. Указывайте цену покупки и обновляйте текущую оценку вручную.',goldApiCopper:'Спот · Gold API (медь)',quoteDisclaimer:copy.ru.quoteDisclaimer.replace('Gold API обновляет ориентировочные цены металлов в USD.','Gold API обновляет ориентировочные цены XAU/XAG/XPT/XPD/HG в USD.')});
Object.assign(copy.en,{commodityGroups:[['all','All commodities'],['energy','Energy'],['metals','Industrial metals'],['agriculture','Agriculture'],['livestock','Livestock']],commodityManual:'There is no broadly available free in-app quote feed for these commodities. Enter the purchase price and update the current valuation manually.',goldApiCopper:'Spot · Gold API (copper)',quoteDisclaimer:copy.en.quoteDisclaimer.replace('Gold API refreshes indicative metal prices in USD.','Gold API refreshes indicative XAU/XAG/XPT/XPD/HG prices in USD.')});
Object.assign(copy.ro,{commodityGroups:[['all','Toate mărfurile'],['energy','Energie'],['metals','Metale industriale'],['agriculture','Agricultură'],['livestock','Zootehnie']],commodityManual:'Nu există un flux gratuit general de cotații în aplicație pentru aceste mărfuri. Introdu prețul de cumpărare și actualizează manual evaluarea.',goldApiCopper:'Spot · Gold API (cupru)',quoteDisclaimer:copy.ro.quoteDisclaimer.replace('Gold API actualizează prețuri orientative pentru metale în USD.','Gold API actualizează prețuri orientative XAU/XAG/XPT/XPD/HG în USD.')});
Object.assign(copy.zh,{commodityGroups:[['all','全部商品'],['energy','能源'],['metals','工业金属'],['agriculture','农产品'],['livestock','畜牧业']],commodityManual:'这些商品目前没有可在应用内使用的通用免费行情源。请录入买入价并手动更新当前估值。',goldApiCopper:'现货 · Gold API（铜）',quoteDisclaimer:copy.zh.quoteDisclaimer.replace('Gold API 更新金属参考价格。','Gold API 更新 XAU/XAG/XPT/XPD/HG 金属参考价格。')});
Object.assign(copy.ru,{exchangeAll:'Все биржи',bondAll:'Все облигации',bondOfz:'ОФЗ',bondCorporate:'Корпоративные',bondMunicipal:'Муниципальные',showUsCatalog:'Открыть полный каталог США',catalogCount:'инструментов в каталоге',catalogSearchCount:'найдено по запросу',catalogLoadingAll:'Загружаем полный каталог MOEX…',showMoreCatalog:'Показать ещё'});
Object.assign(copy.en,{exchangeAll:'All exchanges',bondAll:'All bonds',bondOfz:'OFZ',bondCorporate:'Corporate',bondMunicipal:'Municipal',showUsCatalog:'Open full US directory',catalogCount:'in directory',catalogSearchCount:'matches',catalogLoadingAll:'Loading the full MOEX directory…',showMoreCatalog:'Show more'});
Object.assign(copy.ro,{exchangeAll:'Toate bursele',bondAll:'Toate obligațiunile',bondOfz:'OFZ',bondCorporate:'Corporative',bondMunicipal:'Municipale',showUsCatalog:'Deschide catalogul complet SUA',catalogCount:'instrumente în catalog',catalogSearchCount:'rezultate',catalogLoadingAll:'Se încarcă catalogul MOEX…',showMoreCatalog:'Arată mai multe'});
Object.assign(copy.zh,{exchangeAll:'所有交易所',bondAll:'所有债券',bondOfz:'OFZ',bondCorporate:'企业债',bondMunicipal:'市政债',showUsCatalog:'打开美国完整目录',catalogCount:'个目录工具',catalogSearchCount:'个匹配项',catalogLoadingAll:'正在加载完整 MOEX 目录…',showMoreCatalog:'显示更多'});
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
const scorePosition = (asset, currentPrice, quote, portfolioValue, now, t) => {
  if (!asset||currentPrice===null||portfolioValue===null||portfolioValue<=0n) return null;
  const grossInvested=asset.rows.reduce((total,row)=>row.operation==='buy'?total+multiplyScaled(parseScaled(row.quantity,QUANTITY_SCALE),QUANTITY_SCALE,parseScaled(row.unit_price,MONEY_SCALE),MONEY_SCALE)+parseScaled(row.fee||'0',MONEY_SCALE):total,0n);
  const value=multiplyScaled(asset.quantity,QUANTITY_SCALE,currentPrice,MONEY_SCALE);
  const percent=calculateReturnPercent(value-asset.invested+asset.realized,grossInvested);
  if(percent===null)return null;
  const performanceRaw=25n+percent/200n;
  const performance=performanceRaw<0n?0n:performanceRaw>50n?50n:performanceRaw;
  const shareBasisPoints=value*10000n/portfolioValue;
  const diversification=shareBasisPoints>=10000n?0n:25n-shareBasisPoints*25n/10000n;
  let freshness=0n,freshnessLabel=t.scoreFreshStale;
  if(asset.quote_source==='binance'){
    const fresh=quote?.transport==='websocket'&&isQuoteFresh(quote,now);
    freshness=fresh?25n:quote&&isQuoteFresh(quote,now)?16n:5n;
    freshnessLabel=fresh?t.scoreFreshLive:t.scoreFreshStale;
  } else if(isGoldApiAsset(asset)) {
    const fresh=isGoldApiQuoteFresh(quote,now);
    freshness=fresh?20n:8n;
    freshnessLabel=fresh?t.scoreFreshDelayed:t.scoreFreshStale;
  } else if(asset.quote_source==='moex') {
    const fresh=isMoexQuoteFresh(quote,now);
    freshness=fresh?20n:8n;
    freshnessLabel=fresh?t.scoreFreshDelayed:t.scoreFreshStale;
  } else {
    const updated=Date.parse(asset.updated_at||'');
    const age=Number.isFinite(updated)?Math.max(0,now-updated):Infinity;
    freshness=age<=86_400_000?15n:age<=604_800_000?10n:age!==Infinity?5n:0n;
    freshnessLabel=t.scoreFreshManual;
  }
  return {value:performance+diversification+freshness,performance,diversification,shareBasisPoints,freshness,freshnessLabel};
};
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
  const [composer,setComposer] = useState(false), [selected,setSelected] = useState(null), [quotes,setQuotes] = useState({}), [lastQuote,setLastQuote] = useState(null), [online,setOnline] = useState(navigator.onLine), [filter,setFilter] = useState(''), [categoryFilter,setCategoryFilter] = useState('all'), [assetsExpanded,setAssetsExpanded] = useState(false), [searchVisible,setSearchVisible] = useState(false), [historyRange,setHistoryRange] = useState('all'), [form,setForm] = useState({category:'stock',name:'',symbol:'',currency,quoteSource:'manual',quantity:'',purchasePrice:'',price:'',fee:'0',date:todayKey()});
  const [assetSelection,setAssetSelection]=useState(null), [assetSearch,setAssetSearch]=useState(''), [marketScope,setMarketScope]=useState('world'), [moexCatalog,setMoexCatalog]=useState([]), [moexCatalogCategory,setMoexCatalogCategory]=useState(''), [moexCatalogIsFull,setMoexCatalogIsFull]=useState(false), [moexCatalogLoading,setMoexCatalogLoading]=useState(false), [moexCatalogError,setMoexCatalogError]=useState(false), [moexCurrencyLoading,setMoexCurrencyLoading]=useState(false), [binanceCatalog,setBinanceCatalog]=useState([]), [binanceCatalogLoading,setBinanceCatalogLoading]=useState(false), [binanceCatalogError,setBinanceCatalogError]=useState(false), [companyCatalog,setCompanyCatalog]=useState(null), [companyCatalogLoading,setCompanyCatalogLoading]=useState(false), [companyCatalogError,setCompanyCatalogError]=useState(false), [showFullUsCatalog,setShowFullUsCatalog]=useState(false), [exchangeFilter,setExchangeFilter]=useState('all'), [bondFilter,setBondFilter]=useState('all'), [commodityGroup,setCommodityGroup]=useState('all'), [catalogVisibleLimit,setCatalogVisibleLimit]=useState(40), [showPurchaseDetails,setShowPurchaseDetails]=useState(false), [saving,setSaving]=useState(false);
  const [now,setNow] = useState(Date.now());
  const [fxSeries,setFxSeries]=useState({}),[fxTarget,setFxTarget]=useState(currency),[fxLoading,setFxLoading]=useState(false),[fxError,setFxError]=useState(false);
  const [opForm,setOpForm]=useState({operation:'sell',quantity:'',price:'',fee:'0',date:todayKey()});
  const [saveError,setSaveError]=useState('');
  const snapshotAttempts=useRef(new Set());
  const quoteBuffer=useRef({});
  const moexLookupSequence=useRef(0);
  const portfolio = useCapitalPortfolio({ user });
  const { surfaceRef } = useWalletExitGesture({ onExit: onBack, disabled: Boolean(composer || selected), navigation: 'wallet' });
  const fxSources=useMemo(()=>[...new Set([...portfolio.assets.map(asset=>asset.currency),...portfolio.snapshots.map(row=>row.currency),...portfolio.operations.map(row=>row.currency)])].filter(code=>code!=='USDT'&&code!==currency&&/^[A-Z]{3}$/.test(code)),[portfolio.assets,portfolio.snapshots,portfolio.operations,currency]);
  const fxStart=useMemo(()=>{
    const allDates=[...portfolio.snapshots.map(row=>row.sampled_on),...portfolio.operations.map(row=>row.occurred_on)].filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
    const days={week:7,month:30,quarter:90,year:365}[historyRange];
    if(!days)return allDates[0]||new Date(now-7*86_400_000).toISOString().slice(0,10);
    const date=new Date(`${new Date(now).toISOString().slice(0,10)}T00:00:00Z`);date.setUTCDate(date.getUTCDate()-days+1-7);return date.toISOString().slice(0,10);
  },[portfolio.snapshots,portfolio.operations,historyRange,now]);
  useEffect(()=>{
    if(!online||!fxSources.length){setFxLoading(false);return undefined;}
    const controller=new AbortController();setFxLoading(true);setFxError(false);
    fetchDailyCurrencyRates(fxSources,currency,fxStart,new Date(now).toISOString().slice(0,10),controller.signal)
      .then(series=>{if(!controller.signal.aborted){setFxSeries(series);setFxTarget(currency);}})
      .catch(error=>{if(!controller.signal.aborted){setFxError(true);console.warn('[capital] FX rates unavailable:',error.message);}})
      .finally(()=>{if(!controller.signal.aborted)setFxLoading(false);});
    return()=>controller.abort();
  },[online,fxSources.join('|'),currency,fxStart]);
  useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),5000);return()=>clearInterval(id);},[]);

  useEffect(()=>{
    if(!composer||form.category!=='crypto'||binanceCatalog.length) return;
    let active=true; setBinanceCatalogLoading(true); setBinanceCatalogError(false);
    loadBinanceSpotPairs().then(items=>{if(active)setBinanceCatalog(items);}).catch(()=>{if(active)setBinanceCatalogError(true);}).finally(()=>{if(active)setBinanceCatalogLoading(false);});
    return()=>{active=false;};
  },[composer,form.category,binanceCatalog.length]);

  useEffect(()=>{
    if(!composer||marketScope!=='world'||!['stock','etf'].includes(form.category)||(assetSearch.trim().length<2&&!showFullUsCatalog)||companyCatalog) {setCompanyCatalogLoading(false);setCompanyCatalogError(false);return;}
    let active=true; setCompanyCatalogLoading(true); setCompanyCatalogError(false);
    loadCompanyCatalog().then(items=>{if(active)setCompanyCatalog(items);}).catch(()=>{if(active)setCompanyCatalogError(true);}).finally(()=>{if(active)setCompanyCatalogLoading(false);});
    return()=>{active=false;};
  },[composer,marketScope,form.category,assetSearch,showFullUsCatalog,companyCatalog]);

  useEffect(()=>{
    if(!composer||marketScope!=='russia'||!['stock','etf','bond'].includes(form.category)) {setMoexCatalogLoading(false);setMoexCatalogError(false);return;}
    let active=true;setMoexCatalogLoading(true);setMoexCatalogError(false);
    loadMoexCatalog(form.category).then(items=>{if(active){setMoexCatalog(items);setMoexCatalogCategory(form.category);setMoexCatalogIsFull(true);}}).catch(error=>{if(active){setMoexCatalogError(true);console.warn('[capital] MOEX catalogue failed:',error.message);}}).finally(()=>{if(active)setMoexCatalogLoading(false);});
    return()=>{active=false;};
  },[composer,marketScope,form.category]);

  useEffect(()=>{
    if(!composer||marketScope!=='russia'||!moexCatalogError||assetSearch.trim().length<2)return;
    let active=true;const controller=new AbortController();setMoexCatalogLoading(true);
    const timer=window.setTimeout(()=>searchMoexSecurities(assetSearch,form.category,controller.signal).then(items=>{if(active){setMoexCatalog(items);setMoexCatalogCategory(form.category);setMoexCatalogIsFull(false);setMoexCatalogError(false);}}).catch(error=>{if(active&&error.name!=='AbortError')console.warn('[capital] MOEX search failed:',error.message);}).finally(()=>{if(active)setMoexCatalogLoading(false);}),250);
    return()=>{active=false;clearTimeout(timer);controller.abort();};
  },[composer,marketScope,moexCatalogError,assetSearch,form.category]);

  useEffect(()=>{setCatalogVisibleLimit(40);},[assetSearch,form.category,marketScope,exchangeFilter,bondFilter]);

  useEffect(() => { const on=()=>setOnline(true), off=()=>setOnline(false); window.addEventListener('online',on); window.addEventListener('offline',off); return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off);}; },[]);
  const pairs = useMemo(() => [...new Set([
    ...portfolio.assets.filter(a=>a.category==='crypto' && a.quote_source==='binance' && /^[A-Z0-9]{5,20}$/.test(a.symbol)).map(a=>a.symbol.toLowerCase()),
    ...(composer && form.category==='crypto' && form.quoteSource==='binance' && /^[A-Z0-9]{5,20}$/.test(form.symbol) ? [form.symbol.toLowerCase()] : []),
  ])], [portfolio.assets, composer, form.category, form.quoteSource, form.symbol]);
  const moexListings = useMemo(()=>[
    ...portfolio.assets.filter(asset=>asset.quote_source==='moex').map(asset=>({category:asset.category,symbol:asset.symbol})),
    ...(composer&&form.quoteSource==='moex'&&form.symbol?[{category:form.category,symbol:form.symbol}]:[]),
  ],[portfolio.assets,composer,form.quoteSource,form.category,form.symbol]);
  useEffect(()=>{
    if(!online||!moexListings.length)return;
    let active=true,inFlight=false;const controller=new AbortController();
    const refresh=async()=>{
      if(inFlight||controller.signal.aborted)return;inFlight=true;
      try {
        const groups=['bond','stock'].map(category=>({category,symbols:moexListings.filter(item=>category==='bond'?item.category==='bond':item.category!=='bond').map(item=>item.symbol)})).filter(group=>group.symbols.length);
        const snapshots=await Promise.all(groups.map(group=>fetchMoexQuotes(group.category,group.symbols,controller.signal)));
        if(!active||controller.signal.aborted)return;
        const next=Object.assign({},...snapshots);
        setQuotes(previous=>{const merged={...previous};for(const [symbol,quote] of Object.entries(next))if(!merged[symbol]||Number(merged[symbol].at)<=quote.at)merged[symbol]=quote;return merged;});
        const newest=Math.max(0,...Object.values(next).map(quote=>quote.at));if(newest)setLastQuote(previous=>Math.max(Number(previous)||0,newest));
      }catch(error){if(active&&error.name!=='AbortError')console.warn('[capital] MOEX quote refresh failed:',error.message);}
      finally{inFlight=false;}
    };
    void refresh();const timer=window.setInterval(()=>void refresh(),60_000);
    return()=>{active=false;controller.abort();window.clearInterval(timer);};
  },[online,moexListings.map(item=>`${item.category}:${item.symbol}`).join('|')]);
  const metalSymbols = useMemo(() => [...new Set(portfolio.assets.filter(isGoldApiAsset).map(asset=>asset.symbol.toUpperCase()))].sort(), [portfolio.assets]);
  useEffect(()=>{
    if(!online||!metalSymbols.length) return;
    const controller=new AbortController(); let active=true, inFlight=false;
    const refresh=async()=>{
      if(inFlight||controller.signal.aborted) return;
      inFlight=true;
      try {
        for(let index=0;index<metalSymbols.length;index++) {
          if(!active||controller.signal.aborted) break;
          const symbol=metalSymbols[index];
          try {
            const quote=await fetchGoldApiQuote(symbol,controller.signal);
            if(active&&!controller.signal.aborted) {
              setQuotes(previous=>!previous[symbol]||Number(previous[symbol].at)<=quote.at?{...previous,[symbol]:quote}:previous);
              setLastQuote(previous=>Math.max(Number(previous)||0,quote.at));
            }
          } catch {}
          if(index<metalSymbols.length-1&&!controller.signal.aborted) await new Promise(resolve=>window.setTimeout(resolve,1100));
        }
      } finally { inFlight=false; }
    };
    void refresh();
    const timer=window.setInterval(()=>void refresh(),60_000);
    return()=>{active=false;controller.abort();window.clearInterval(timer);};
  },[online,metalSymbols.join('|')]);
  useEffect(()=>{
    if(!online||!pairs.length) return;
    const controller=new AbortController();
    const requestedAt=Date.now();
    const timeout=window.setTimeout(()=>controller.abort(),8000);
    const symbols=pairs.slice(0,20).map(pair=>pair.toUpperCase());
    const query=encodeURIComponent(JSON.stringify(symbols));
    fetch(`https://data-api.binance.vision/api/v3/ticker/price?symbols=${query}`,{signal:controller.signal})
      .then(response=>{if(!response.ok)throw new Error('Binance price snapshot unavailable');return response.json();})
      .then(rows=>{
        if(controller.signal.aborted||!Array.isArray(rows))return;
        const snapshot=Object.fromEntries(rows.filter(row=>symbols.includes(row.symbol)&&/^\d+(?:\.\d+)?$/.test(String(row.price))).map(row=>[row.symbol,{price:String(row.price),at:requestedAt,transport:'rest'}]));
        setQuotes(previous=>{
          const next={...previous};
          for(const [symbol,quote] of Object.entries(snapshot)) if(!next[symbol]||Number(next[symbol].at)<=quote.at) next[symbol]=quote;
          return next;
        });
        if(Object.keys(snapshot).length)setLastQuote(requestedAt);
      }).catch(()=>{});
    return()=>{window.clearTimeout(timeout);controller.abort();};
  },[online,pairs.join('|')]);
  useEffect(() => {
    if (!online || !pairs.length) return;
    let socket, timer, stableTimer, healthTimer, frame, closed=false, attempt=0, endpointIndex=0, lastMessageAt=0;
    const endpoints=['wss://stream.binance.com:443','wss://stream.binance.com:9443','wss://data-stream.binance.vision:443'];
    const connect=()=>{
      if (closed) return;
      socket=new WebSocket(`${endpoints[endpointIndex]}/stream?streams=${pairs.map(p=>`${p}@miniTicker`).join('/')}`);
      socket.onopen=()=>{lastMessageAt=Date.now();healthTimer=setInterval(()=>{if(socket?.readyState===WebSocket.OPEN&&Date.now()-lastMessageAt>20000)socket.close();},5000);stableTimer=setTimeout(()=>{attempt=0;},30000);};
      socket.onmessage=(event)=>{lastMessageAt=Date.now();try{const payload=JSON.parse(event.data)?.data; const symbol=String(payload?.s||'').toUpperCase(); const price=String(payload?.c||''); if(symbol && /^\d+(?:\.\d+)?$/.test(price)){const at=Number(payload?.E)||Date.now();quoteBuffer.current[symbol]={price,at,transport:'websocket'};if(!frame)frame=requestAnimationFrame(()=>{frame=null;const batch=quoteBuffer.current;quoteBuffer.current={};setQuotes(previous=>({...previous,...batch}));setLastQuote(Math.max(...Object.values(batch).map(item=>item.at)));});}}catch{}}
      socket.onclose=()=>{clearTimeout(stableTimer);clearInterval(healthTimer);endpointIndex=(endpointIndex+1)%endpoints.length;if(!closed)timer=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));};
      socket.onerror=()=>socket.close();
    };
    connect(); return()=>{closed=true;clearTimeout(timer);clearTimeout(stableTimer);clearInterval(healthTimer);cancelAnimationFrame(frame);quoteBuffer.current={};socket?.close();};
  },[online,pairs.join('|')]);

  const priceFor = asset => {
    const price=resolveCurrentPrice(asset,quotes[asset.symbol]);
    return price===null?null:parseScaled(price,MONEY_SCALE);
  };
  const selectedPrice=selected?priceFor(selected):null;
  const openOperation = operation => {
    const quote = selected && quotes[selected.symbol];
    const quoteIsUsable = selected?.quote_source === 'binance'
      ? quote && isQuoteFresh(quote, now)
      : selected?.quote_source === 'moex' ? quote && isMoexQuoteFresh(quote, now) && quote.currency===selected.currency
      : isGoldApiAsset(selected) ? quote && isGoldApiQuoteFresh(quote, now)
      : selected?.quote_source === 'manual' && selectedPrice !== null;
    const price = quoteIsUsable && selectedPrice !== null ? scaledToString(selectedPrice, MONEY_SCALE) : '';
    setOpForm({ operation, quantity:'', price, fee:'0', date:todayKey() });
  };
  useEffect(()=>{
    if(!composer || !assetSelection || !['binance','moex'].includes(form.quoteSource) || !form.symbol || form.purchasePrice) return;
    const quote=quotes[form.symbol];
    const fresh=form.quoteSource==='binance'?quote&&isQuoteFresh(quote,now):quote&&isMoexQuoteFresh(quote,now)&&quote.currency===form.currency;
    if(fresh) setForm(current=>current.purchasePrice?current:{...current,purchasePrice:quote.price,price:current.price||quote.price});
  },[composer,assetSelection,form.quoteSource,form.symbol,form.purchasePrice,form.currency,quotes,now]);
  const selectedValue=selectedPrice===null?null:multiplyScaled(selected.quantity,QUANTITY_SCALE,selectedPrice,MONEY_SCALE);
  const selectedUnrealized=selectedValue===null?null:selectedValue-selected.invested;
  const selectedTotalResult=selectedUnrealized===null?null:selectedUnrealized+selected.realized;
  const selectedFees=selected?.rows.reduce((total,row)=>total+parseScaled(row.fee||'0',MONEY_SCALE),0n)??0n;
  const metrics = useMemo(() => {
    const totals=portfolio.assets.reduce((all,asset)=>{
      const code=asset.currency,price=priceFor(asset);
      if(!all[code])all[code]={value:0n,invested:0n,realized:0n,unrealized:0n,pnl:0n,hasUnpriced:false};
      all[code].invested+=asset.invested;
      all[code].realized+=asset.realized;
      if(price===null){all[code].hasUnpriced=true;return all;}
      const value=multiplyScaled(asset.quantity,QUANTITY_SCALE,price,MONEY_SCALE);
      all[code].value+=value;
      all[code].unrealized+=value-asset.invested;
      all[code].pnl+=value+asset.realized-asset.invested;
      return all;
    },{});
    return Object.fromEntries(Object.entries(totals).map(([code,row])=>[code,{...row,value:row.hasUnpriced?null:row.value,unrealized:row.hasUnpriced?null:row.unrealized,pnl:row.hasUnpriced?null:row.pnl}]));
  },[portfolio.assets,quotes]);
  const activeFxSeries=fxTarget===currency?fxSeries:{};
  const periodResults=useMemo(()=>calculatePortfolioPeriodResults(portfolio.snapshots,portfolio.operations,historyRange,new Date(now),activeFxSeries,currency),[portfolio.snapshots,portfolio.operations,historyRange,now,activeFxSeries,currency]);
  const chartCurrencies=useMemo(()=>Object.entries(metrics).filter(([code,row])=>code!=='USDT'&&row.value!==null).map(([code])=>code),[metrics]);
  const consolidatedSnapshots=useMemo(()=>buildConsolidatedPortfolioSnapshots(portfolio.snapshots,chartCurrencies,activeFxSeries,currency),[portfolio.snapshots,chartCurrencies,activeFxSeries,currency]);
  const chartOperations=useMemo(()=>portfolio.operations.filter(row=>chartCurrencies.includes(row.currency)),[portfolio.operations,chartCurrencies]);
  const globalValue=useMemo(()=>{
    let value=0n,excludedUsdt=null;const missing=[],unpriced=[];let latestFxDate=null,converted=0;
    for(const [code,totals] of Object.entries(metrics)){
      if(code==='USDT'){excludedUsdt=totals.value;continue;}
      if(totals.value===null){unpriced.push(code);continue;}
      const rate=currencyRateOn(activeFxSeries,code,currency,new Date(now).toISOString().slice(0,10));
      if(rate===null){missing.push(code);continue;}
      value+=multiplyScaled(totals.value,MONEY_SCALE,rate,MONEY_SCALE);converted++;
      const date=code===currency?null:activeFxSeries[code]?.at(-1)?.date;
      if(date&&(!latestFxDate||date<latestFxDate))latestFxDate=date;
    }
    const performance=calculateBasePortfolioResult(portfolio.assets,activeFxSeries,currency,new Date(now).toISOString().slice(0,10),priceFor);
    return {value:converted&&!missing.length&&!unpriced.length?value:null,missing,unpriced,excludedUsdt,latestFxDate,pnl:performance.complete&&performance.excludedUsdt===null?performance.pnl:null,realized:performance.realized,unrealized:performance.unrealized,incomplete:performance.incomplete};
  },[metrics,activeFxSeries,currency,now,portfolio.assets,quotes]);
  const selectedScore=scorePosition(selected,selectedPrice,selected?quotes[selected.symbol]:null,selected?metrics[selected.currency]?.value??null:null,now,t);
  const todayChanges = useMemo(()=>calculateDailyChange(Object.fromEntries(Object.entries(metrics).filter(([,totals])=>totals.value!==null)),portfolio.snapshots,todayKey()),[metrics,portfolio.snapshots]);
  const filteredAssets = portfolio.assets.filter(a=>(categoryFilter==='all'||a.category===categoryFilter)&&`${a.name} ${a.symbol} ${a.category}`.toLowerCase().includes(filter.toLowerCase()));
  const visible = filter||assetsExpanded||categoryFilter!=='all'?filteredAssets:filteredAssets.slice(0,4);
  const categoryOptions = ['all',...new Set(portfolio.assets.map(asset=>asset.category))];
  const hasBinanceAssets = pairs.length > 0;
  const hasGoldApiAssets = metalSymbols.length > 0;
  const hasMoexAssets = moexListings.length > 0;
  const allMoexFresh = hasMoexAssets&&moexListings.every(item=>isMoexQuoteFresh(quotes[item.symbol],now));
  const allPairsFresh = hasBinanceAssets && pairs.every(pair=>quotes[pair.toUpperCase()]?.transport==='websocket'&&isQuoteFresh(quotes[pair.toUpperCase()],now));
  const allPairsRecent = hasBinanceAssets && pairs.every(pair=>isQuoteFresh(quotes[pair.toUpperCase()],now));
  const allMetalsFresh = hasGoldApiAssets && metalSymbols.every(symbol=>isGoldApiQuoteFresh(quotes[symbol],now));
  const latestManualUpdate = portfolio.assets.reduce((latest,asset)=>asset.quote_source==='manual'&&asset.updated_at&&(!latest||asset.updated_at>latest)?asset.updated_at:latest,null);
  const displayTime = value => value ? new Date(value).toLocaleString(locale==='zh'?'zh-CN':locale) : '';
  const displayQuoteTime = value => value ? new Date(value).toLocaleTimeString(locale==='zh'?'zh-CN':locale,{hour:'2-digit',minute:'2-digit'}) : '';
  const quoteSummary = !online ? t.offline : [
    hasBinanceAssets ? allPairsFresh ? t.live : allPairsRecent ? t.quoteSnapshot : lastQuote ? `${t.stale} · ${displayQuoteTime(lastQuote)}` : t.pending : null,
    hasGoldApiAssets ? allMetalsFresh ? t.spot : metalSymbols.some(symbol=>quotes[symbol]) ? `${t.stale} · ${displayQuoteTime(Math.min(...metalSymbols.map(symbol=>Number(quotes[symbol]?.at)||Infinity)))}` : t.pending : null,
    hasMoexAssets ? allMoexFresh ? t.moexDelayed : moexListings.some(item=>quotes[item.symbol]) ? `${t.stale} · ${displayQuoteTime(Math.min(...moexListings.map(item=>Number(quotes[item.symbol]?.at)||Infinity)))}` : t.pending : null,
  ].filter(Boolean).join(' · ') || `${t.manual}${latestManualUpdate?` · ${t.updated} ${displayTime(latestManualUpdate)}`:''}`;
  const quoteLabel = (asset, quote) => {
    if (isGoldApiAsset(asset)) {
      if (!online) return `${t.offline}${quote?.at?` · ${displayQuoteTime(quote.at)}`:''}`;
      if (!quote) return t.pending;
      return `${isGoldApiQuoteFresh(quote,now)?t.spot:t.stale} · ${displayQuoteTime(quote.at)}`;
    }
    if (asset.quote_source === 'binance') {
      if (!online) return `${t.offline}${quote?.at?` · ${displayQuoteTime(quote.at)}`:''}`;
      if (!quote) return t.pending;
      if (quote.transport==='rest') return `${t.quoteSnapshot} · ${displayQuoteTime(quote.at)}`;
      return `${isQuoteFresh(quote,now)?t.live:t.stale} · ${displayQuoteTime(quote.at)}`;
    }
    if (asset.quote_source === 'moex') {
      if(!online)return `${t.offline}${quote?.at?` · ${displayQuoteTime(quote.at)}`:''}`;
      if(!quote||quote.currency!==asset.currency)return t.pending;
      return `${isMoexQuoteFresh(quote,now)?t.moexDelayed:t.stale} · ${displayQuoteTime(quote.at)}`;
    }
    return `${t.manual}${asset.updated_at?` · ${displayQuoteTime(asset.updated_at)}`:''}`;
  };
  const marketQuotedAssets=portfolio.assets.filter(asset=>asset.quote_source==='binance'||asset.quote_source==='moex'||isGoldApiAsset(asset));
  const freshQuoteCount=marketQuotedAssets.filter(asset=>asset.quote_source==='binance'?isQuoteFresh(quotes[asset.symbol],now):asset.quote_source==='moex'?isMoexQuoteFresh(quotes[asset.symbol],now):isGoldApiQuoteFresh(quotes[asset.symbol],now)).length;
  const manualAssetCount=portfolio.assets.length-marketQuotedAssets.length;
  const allocations = useMemo(()=>portfolio.assets.reduce((all,asset)=>{const price=priceFor(asset);if(price===null)return all;const key=`${asset.currency}:${asset.category}`;const value=multiplyScaled(asset.quantity,QUANTITY_SCALE,price,MONEY_SCALE);all[key]=(all[key]||0n)+value;return all;},{}),[portfolio.assets,quotes]);
  const allocationTotals = useMemo(()=>Object.entries(allocations).reduce((all,[key,value])=>{const code=key.split(':')[0];all[code]=(all[code]||0n)+value;return all;},{}),[allocations]);
  useEffect(()=>{
    if(portfolio.loading||!user?.id||!portfolio.assets.length) return;
    const snapshotDate=todayKey();
    for(const [code,{value}] of Object.entries(metrics)){
      if(value===null) continue;
      const key=`${code}:${snapshotDate}`;
      if(snapshotAttempts.current.has(key)||portfolio.snapshots.some(item=>item.currency===code&&item.sampled_on===snapshotDate)) continue;
      if(portfolio.assets.some(asset=>asset.currency===code&&asset.quote_source==='binance')&&!portfolio.assets.filter(asset=>asset.currency===code&&asset.quote_source==='binance').every(asset=>isQuoteFresh(quotes[asset.symbol],now))) continue;
      if(portfolio.assets.some(asset=>asset.currency===code&&isGoldApiAsset(asset))&&!portfolio.assets.filter(asset=>asset.currency===code&&isGoldApiAsset(asset)).every(asset=>isGoldApiQuoteFresh(quotes[asset.symbol],now))) continue;
      if(portfolio.assets.some(asset=>asset.currency===code&&asset.quote_source==='moex')&&!portfolio.assets.filter(asset=>asset.currency===code&&asset.quote_source==='moex').every(asset=>isMoexQuoteFresh(quotes[asset.symbol],now))) continue;
      snapshotAttempts.current.add(key);
      portfolio.recordSnapshot(code,value,snapshotDate).catch(error=>console.warn('[capital] daily snapshot failed:',error.message));
    }
  },[portfolio.loading,portfolio.assets,portfolio.snapshots,portfolio.recordSnapshot,user?.id,metrics,online,quotes,now]);
  const catalogMatches = useMemo(()=>{
    const query=assetSearch.trim().toLowerCase();
    if(marketScope==='russia'&&['stock','etf','bond'].includes(form.category)) {
      const fallback=form.category==='bond'?MOEX_POPULAR_BONDS:form.category==='etf'?MOEX_POPULAR_ETFS:MOEX_POPULAR_STOCKS;
      const catalogue=moexCatalogCategory===form.category&&moexCatalog.length&&(moexCatalogIsFull||assetSearch.trim().length>=2)?moexCatalog:fallback;
      const popularSymbols=new Set(fallback.map(item=>item.symbol));
      const sorted=[...catalogue].sort((a,b)=>Number(popularSymbols.has(b.symbol))-Number(popularSymbols.has(a.symbol))||a.symbol.localeCompare(b.symbol,'ru'));
      return sorted.filter(item=>{
        if(form.category==='bond'&&bondFilter!=='all'&&item.bondGroup!==bondFilter)return false;
        return !query||`${item.symbol} ${item.name} ${item.isin||''}`.toLowerCase().includes(query);
      });
    }
    const curated=getCatalog(form.category);
    const exchangeDirectory=companyCatalog&&['stock','etf'].includes(form.category)
      ? companyCatalog.records.filter(item=>item.category===form.category).map(item=>({...item,currency:'USD',quoteSource:'manual'}))
      : [];
    const inExchange=items=>exchangeFilter==='all'?items:exchangeFilter==='other'?items.filter(item=>item.exchange&&!['Nasdaq','NYSE','TXSE'].includes(item.exchange)):items.filter(item=>item.exchange===exchangeFilter);
    const curatedSymbols=new Set(curated.map(item=>item.symbol));
    const catalog=form.category==='crypto'&&binanceCatalog.length
      ? [...POPULAR_CRYPTO,...binanceCatalog.filter(item=>!POPULAR_CRYPTO.some(popular=>popular.symbol===item.symbol))]
      : [...inExchange(curated),...exchangeDirectory.filter(item=>!curatedSymbols.has(item.symbol))];
    return (query?catalog.filter(item=>`${item.symbol} ${item.name} ${item.exchange||''}`.toLowerCase().includes(query)):catalog)
      .filter(item=>form.category!=='commodity'||commodityGroup==='all'||item.group===commodityGroup)
      .filter((item,index,items)=>items.findIndex(candidate=>candidate.symbol===item.symbol)===index);
  },[assetSearch,form.category,marketScope,moexCatalog,binanceCatalog,companyCatalog,exchangeFilter,bondFilter,commodityGroup]);
  const matchedCatalog=catalogMatches.slice(0,catalogVisibleLimit);
  const chooseCatalogAsset=async item=>{
    const lookup=++moexLookupSequence.current;
    setAssetSelection(item);
    setMoexCurrencyLoading(item.quoteSource==='moex'&&['bond','etf','stock'].includes(item.category));
    setForm(current=>({...current,name:item.name,symbol:item.symbol,currency:item.currency,quoteSource:item.quoteSource,quantity:'',purchasePrice:'',price:'',fee:'0'}));
    if(item.quoteSource==='moex'&&['bond','etf','stock'].includes(item.category)) {
      try {const resolvedCurrency=await fetchMoexCurrency(item.category,item.symbol);if(moexLookupSequence.current===lookup&&resolvedCurrency)setForm(current=>current.symbol===item.symbol?{...current,currency:resolvedCurrency}:current);} catch {}
      finally {if(moexLookupSequence.current===lookup)setMoexCurrencyLoading(false);}
    }
  };
  const chooseCustomAsset=()=>{
    const query=assetSearch.trim();
    setAssetSelection({custom:true});
    setForm(current=>({...current,name:query,symbol:/^[A-Za-z0-9.:-]{1,24}$/.test(query)?query.toUpperCase():'',currency:current.category==='crypto'&&current.quoteSource==='binance'?'USDT':current.category==='stock'&&marketScope==='russia'||current.category==='bond'?'RUB':current.category==='stock'||current.category==='etf'?'USD':current.currency,quoteSource:'manual',quantity:'',purchasePrice:'',price:'',fee:'0'}));
  };
  const changeCategory=category=>{moexLookupSequence.current++;setMoexCurrencyLoading(false);setAssetSelection(null);setAssetSearch('');setCommodityGroup('all');setMarketScope(category==='bond'?'russia':'world');setMoexCatalog([]);setForm(current=>({...current,category,name:'',symbol:'',currency:['crypto'].includes(category)?'USDT':['stock','etf','metal','commodity'].includes(category)?'USD':category==='bond'?'RUB':current.currency,quoteSource:category==='crypto'?'binance':'manual',quantity:'',purchasePrice:'',price:'',fee:'0'}));};
  const submit=async(event)=>{event.preventDefault();if(saving)return;setSaving(true);setSaveError('');try{if(!assetSelection)throw new Error(t.noAssetsFound);if(assetSelection.custom&&form.category==='crypto'&&form.quoteSource==='binance')await verifyBinanceSpotPair(form.symbol);await portfolio.addAsset({...form,price:form.price||form.purchasePrice,quoteSource:form.quoteSource});setComposer(false);setAssetSelection(null);setAssetSearch('');setForm({...form,name:'',symbol:'',quantity:'',purchasePrice:'',price:'',fee:'0',date:todayKey()});}catch(error){setSaveError(friendlyCapitalError(error,locale,t));}finally{setSaving(false);}};
  const saveOperation=async(event)=>{event.preventDefault();if(saving)return;setSaving(true);setSaveError('');try{await portfolio.addOperation(selected,opForm);setSelected(null);setOpForm({operation:'sell',quantity:'',price:'',fee:'0',date:todayKey()});}catch(error){setSaveError(friendlyCapitalError(error,locale,t));}finally{setSaving(false);}};
  const closeSheet=()=>{moexLookupSequence.current++;setMoexCurrencyLoading(false);setComposer(false);setSelected(null);setAssetSelection(null);setAssetSearch('');setSaveError('');setShowPurchaseDetails(false);};
  const base=isLight?'capital-panel capital-light':'capital-panel';
  return <main ref={surfaceRef} className={base}>
    <header className="capital-top"><button className="capital-back" onClick={onBack}><ArrowLeft size={17}/><span>{t.back}</span></button><div className="capital-brand"><span>DAYRIS</span><b>CAPITAL</b><i>PRO</i></div><button className="capital-wallet" onClick={onWallet}><Wallet size={16}/><span>{t.wallet}</span></button></header>
    <div className="capital-content"><div className="capital-heading"><div><p className="capital-kicker">{t.portfolioEyebrow}</p><h1>{t.title}</h1><p>{t.subtitle}</p></div></div>
      <section className="capital-overview capital-portfolio-card">
        <div className="capital-overview-head"><div className="capital-overview-brand"><span>DAYRIS PRO</span><i>/</i><b>{t.investments}</b></div><ChartNoAxesCombined className="capital-overview-mark"/></div>
        <p className="capital-total-title">{t.value}</p>
        <section className="capital-global-total" aria-label={t.globalValue}>
          <div><small>{t.globalValue} · {t.baseCurrency}: {currency}</small><strong>{globalValue.value===null?'—':formatMoney(globalValue.value,currency,locale)}</strong><span className={`capital-global-pnl ${globalValue.pnl===null?'':globalValue.pnl>=0n?'positive':'negative'}`}>{t.globalPnl}: {globalValue.pnl===null?'—':`${globalValue.pnl>0n?'+':''}${formatMoney(globalValue.pnl,currency,locale)}`} · {stats.realized}: {globalValue.pnl===null?'—':formatMoney(globalValue.realized,currency,locale)} · {stats.unrealized}: {globalValue.pnl===null?'—':formatMoney(globalValue.unrealized,currency,locale)}</span><span>{fxLoading?t.fxLoading:globalValue.latestFxDate?`${t.fxDaily} · ${t.fxAsOf} ${globalValue.latestFxDate}`:fxError?t.fxUnavailable:t.globalCoverage}</span>{globalValue.excludedUsdt!==null&&<span className="capital-global-extra">{t.usdtSeparate}: {formatMoney(globalValue.excludedUsdt,'USDT',locale)}</span>}</div>
          {(globalValue.excludedUsdt!==null||globalValue.missing.length>0||globalValue.unpriced.length>0)&&<small className="capital-global-warning">{globalValue.excludedUsdt!==null?t.fxExcluded:globalValue.missing.length?`${t.fxUnavailable}: ${globalValue.missing.join(', ')}`:`${t.globalIncomplete}${globalValue.unpriced.join(', ')}`}</small>}
        </section>
        <details className="capital-currency-disclosure"><summary>{t.currencyBreakdown}<span>{Object.keys(metrics).join(' · ')||currency}</span></summary><div className="capital-portfolio-totals">{Object.entries(metrics).length?Object.entries(metrics).map(([code,totals])=><div className="capital-currency-total" key={code}>
          <div className="capital-total-number"><strong>{totals.value===null?'—':formatMoney(totals.value,code,locale)}</strong>{Object.entries(metrics).length>1&&<span>{code}</span>}</div>
          <div className="capital-total-return"><span className="capital-result-title">{stats.total}</span><span className={`capital-return-chip ${totals.pnl===null?'':totals.pnl>=0?'positive':'negative'}`}>{totals.pnl===null?'—':`${totals.pnl>=0?'+':''}${formatMoney(totals.pnl,code,locale)}`}</span><small>{totals.pnl===null?'—':`${formatPercent(totals.pnl,totals.invested,locale)} ${t.allTime}`}</small></div>
          <small className="capital-invested-line">{t.invested}: {formatMoney(totals.invested,code,locale)}</small>
          <div className="capital-result-breakdown"><small><span>{stats.realized}</span><b className={totals.realized>0n?'positive':totals.realized<0n?'negative':''}>{totals.realized>0n?'+':''}{formatMoney(totals.realized,code,locale)}</b></small><small><span>{stats.unrealized}</span><b className={totals.unrealized===null?'':totals.unrealized>0n?'positive':totals.unrealized<0n?'negative':''}>{totals.unrealized===null?'—':`${totals.unrealized>0n?'+':''}${formatMoney(totals.unrealized,code,locale)}`}</b></small></div>
        </div>):<div className="capital-currency-total"><div className="capital-total-number"><strong>{formatMoney(0,currency,locale)}</strong></div><div className="capital-total-return"><span className="capital-return-chip">—</span><small>{t.allTime}</small></div><small className="capital-invested-line">{t.emptyHint}</small></div>}</div></details>
        <section className="capital-period-overview" aria-label={t.periodResult}>
          <div className="capital-period-heading"><div><h2>{t.periodResult}</h2><p>{t.periodResultNote}</p></div><div className="capital-range-selector" role="group" aria-label={t.chart}>{[['week','rangeWeek'],['month','rangeMonth'],['quarter','rangeQuarter'],['year','rangeYear'],['all','rangeAll']].map(([value,label])=><button type="button" key={value} className={historyRange===value?'is-active':''} aria-pressed={historyRange===value} onClick={()=>setHistoryRange(value)}>{t[label]}</button>)}</div></div>
          {periodResults.byCurrency.some(item=>item.result!==null)?<>{!periodResults.consolidated&&(periodResults.unsupported.length||periodResults.missingFx.length>0)&&<div className="capital-period-fx-note">{t.periodFxNote}</div>}<div className="capital-period-results">
            {periodResults.consolidated&&(()=>{const item=periodResults.consolidated,magnitude=item.percent===null?0:Number(item.percent<0n?-item.percent:item.percent)/100,dash=Math.min(100,magnitude)/100*169.65,trend=item.result>0n?'up':item.result<0n?'down':'flat';return <article className="capital-period-result capital-period-result-global" key="consolidated" data-trend={trend}><div className="capital-period-ring"><svg viewBox="0 0 64 64" role="img" aria-label={item.percent===null?'—':formatPercent(item.result,item.returnBasis,locale)}><circle className="capital-period-ring-track" cx="32" cy="32" r="27"/><circle className="capital-period-ring-value" cx="32" cy="32" r="27" strokeDasharray={`${dash} 169.65`}/></svg><b>{item.percent===null?'—':formatPercent(item.result,item.returnBasis,locale)}</b></div><div className="capital-period-data"><span>{t.globalValue} · {item.currency}</span><strong>{item.result>0n?'+':''}{formatMoney(item.result,item.currency,locale)}</strong><small>{t.periodBase}: {formatMoney(item.returnBasis,item.currency,locale)}</small></div></article>})()}
            {periodResults.byCurrency.some(item=>item.result!==null)&&<details className="capital-period-breakdown"><summary>{t.periodBreakdown}</summary><div className="capital-period-results">{periodResults.byCurrency.map(item=>{if(item.result===null)return null;const amount=item.baseResult??item.result,pct=item.basePercent??item.percent,code=item.baseResult!==null?currency:item.currency,basis=item.baseReturnBasis??item.returnBasis,magnitude=pct===null?0:Number(pct<0n?-pct:pct)/100;const dash=Math.min(100,magnitude)/100*169.65;const trend=amount>0n?'up':amount<0n?'down':'flat';return <article className="capital-period-result" key={item.currency} data-trend={trend}>
            <div className="capital-period-ring"><svg viewBox="0 0 64 64" role="img" aria-label={pct===null?'—':formatPercent(amount,basis,locale)}><circle className="capital-period-ring-track" cx="32" cy="32" r="27"/><circle className="capital-period-ring-value" cx="32" cy="32" r="27" strokeDasharray={`${dash} 169.65`}/></svg><b>{pct===null?'—':formatPercent(amount,basis,locale)}</b></div>
            <div className="capital-period-data"><span>{item.currency} · {item.start.sampled_on} — {item.end.sampled_on}</span><strong>{amount>0n?'+':''}{formatMoney(amount,code,locale)}</strong><small>{pct===null?`${t.periodBase}: —`:`${t.periodBase}: ${formatMoney(basis,code,locale)}`}</small></div>
          </article>})}</div></details>}
          </div></>:<div className="capital-period-empty">{t.periodNoHistory}</div>}
        </section>
        <section className="capital-main-chart" aria-label={t.chart}><div className="capital-main-chart-heading"><strong>{t.historyValue}</strong><span>{currency}</span></div><p>{t.historyNote}</p>{consolidatedSnapshots.length?<CapitalPerformanceChart snapshots={consolidatedSnapshots} operations={chartOperations} fxSeries={activeFxSeries} currency={currency} range={historyRange} onRangeChange={setHistoryRange} t={t} locale={locale} showRanges={false}/>:<div className="capital-period-empty">{t.chartEmpty}</div>}{(chartCurrencies.length<Object.keys(metrics).filter(code=>code!=='USDT').length||metrics.USDT)&&<small className="capital-chart-coverage-note">{t.chartCoverage}</small>}</section>
        <div className="capital-overview-footer"><div className="capital-quote-summary"><span className={online?'capital-online-dot':'capital-offline-dot'}/><small>{quoteSummary}</small><small className="capital-quote-coverage">{marketQuotedAssets.length?t.quoteCoverage(freshQuoteCount,marketQuotedAssets.length,manualAssetCount):t.quoteNone}</small></div><div className="capital-today-change">{Object.entries(metrics).length?Object.entries(metrics).map(([code])=>{const change=todayChanges[code];return <small key={code} className={change?(change.value>=0n?'positive':'negative'):''}>{code} · {t.today}: {change?`${formatMoney(change.value,code,locale)} (${formatPercent(change.value,change.baseline,locale)})`:'—'}</small>}):<small>{t.today}: —</small>}{Object.keys(todayChanges).length>0&&<small className="capital-change-caption">{t.todayMethod}</small>}</div></div>
      </section>
      {!user && <div className="capital-notice"><LockIcon/> {t.signIn}</div>}
      {portfolio.error&&!composer&&<div role="alert" className="capital-notice">{friendlyCapitalError(portfolio.error,locale,t)}</div>}
      <section className="capital-holdings-panel">
        <div className="capital-section-title"><h2>{t.myAssets} <span>{filteredAssets.length}{categoryFilter!=='all'||filter?` / ${portfolio.assets.length}`:''}</span></h2><div className="capital-holdings-actions">{portfolio.assets.length>4&&!filter&&categoryFilter==='all'&&<button type="button" className="capital-show-all" onClick={()=>setAssetsExpanded(value=>!value)}>{assetsExpanded?t.showLess:t.allAssets}<ArrowRight size={14}/></button>}<button type="button" className="capital-search-toggle" aria-label={t.search} aria-expanded={searchVisible} onClick={()=>{setSearchVisible(value=>!value);if(searchVisible)setFilter('');}}><Search size={16}/></button></div></div>
        {categoryOptions.length>2&&<div className="capital-category-filters" role="group" aria-label={t.category}>{categoryOptions.map(category=><button type="button" key={category} className={categoryFilter===category?'is-active':''} aria-pressed={categoryFilter===category} onClick={()=>{setCategoryFilter(category);setAssetsExpanded(false);}}>{category==='all'?t.allAssets:t.categories[t.cats.indexOf(category)]}</button>)}</div>}
        {searchVisible&&<label className="capital-search"><Search size={15}/><input autoFocus value={filter} onChange={e=>setFilter(e.target.value)} placeholder={t.search}/></label>}
        {portfolio.loading?<div className="capital-empty"><RefreshCw className="capital-spin"/>{t.updated}…</div>:!visible.length?(portfolio.assets.length>0&&(filter||categoryFilter!=='all')?<div className="capital-filter-empty"><Search size={17}/><span>{t.noAssetsFound}</span></div>:<div className="capital-empty"><div className="capital-empty-icon"><ChartNoAxesCombined/></div><strong>{t.empty}</strong><span>{t.emptyHint}</span><button className="capital-add" onClick={()=>setComposer(true)}><Plus size={16}/>{t.add}</button></div>):<div className="capital-assets">{visible.map(asset=>{const Icon=icons[t.cats.indexOf(asset.category)]||BriefcaseBusiness, quote=quotes[asset.symbol], fresh=(quote?.transport==='websocket'&&isQuoteFresh(quote,now))||(isGoldApiAsset(asset)&&isGoldApiQuoteFresh(quote,now))||(asset.quote_source==='moex'&&isMoexQuoteFresh(quote,now)), price=priceFor(asset), total=price===null?null:multiplyScaled(asset.quantity,QUANTITY_SCALE,price,MONEY_SCALE), pnl=total===null?null:total+asset.realized-asset.invested, score=scorePosition(asset,price,quote,metrics[asset.currency]?.value??null,now,t);return <button className="capital-asset" key={asset.id} onClick={()=>setSelected(asset)}><span className="capital-asset-icon"><Icon/></span><span className="capital-asset-main"><strong>{asset.name}</strong><small className="capital-asset-context">{t.categories[t.cats.indexOf(asset.category)]} · {formatQuantity(asset.quantity,locale)} {asset.symbol||t.manual}</small><small className="capital-asset-context">{t.currentUnitPrice}: {price===null?'—':formatMoney(price,asset.currency,locale)}</small><em className="capital-quote-mobile" data-live={fresh}>{quoteLabel(asset,quote)}</em></span><span className="capital-asset-value"><strong>{total===null?'—':formatMoney(total,asset.currency,locale)}</strong><small className={pnl===null?'':pnl>=0?'positive':'negative'}>{pnl===null?t.waitingQuote:`${pnl>=0?'+':''}${formatMoney(pnl,asset.currency,locale)} · ${formatPercent(pnl,asset.invested,locale)}`}</small><small className="capital-asset-invested">{t.invested}: {formatMoney(asset.invested,asset.currency,locale)}</small>{score!==null&&<small className="capital-asset-score-chip">{t.assetScoreChip(new Intl.NumberFormat(locale).format(Number(score.value)))}</small>}</span><span className="capital-quote-state" data-live={fresh}>{quoteLabel(asset,quote)}</span></button>})}</div>}
        {portfolio.assets.length>0&&<button className="capital-add capital-add-operation" onClick={()=>setComposer(true)}><Plus size={18}/>{t.addOperation}</button>}
      </section>
      {Object.entries(allocations).length>0&&<details className="capital-allocation-details" open><summary>{t.distribution}<span>{t.analytics}</span></summary><div className="capital-allocation-list">{Object.entries(allocations).filter(([key])=>metrics[key.split(':')[0]]?.value!==null).map(([key,value])=>{const [code,category]=key.split(':');const percent=allocationTotals[code]?Number(value*10000n/allocationTotals[code])/100:0;return <div className="capital-allocation" key={key}><div><span>{t.categories[t.cats.indexOf(category)]} · {code}</span><b>{formatMoney(value,code,locale)}</b></div><i><span style={{width:`${percent}%`}}/></i></div>})}</div></details>}
      <p className="capital-disclaimer">{t.quoteDisclaimer}{lastQuote?` ${t.updated}: ${displayTime(lastQuote)}.`:''}</p>
    </div>
    {(composer||selected)&&<div className="capital-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)closeSheet();}}><SwipeDismissSheet as="form" onDismiss={closeSheet} handleClassName="-mt-3 mb-2" className="capital-sheet" onSubmit={composer?submit:saveOperation}>
      <div className="capital-sheet-head"><div><span className="capital-kicker">DAYRIS CAPITAL</span><h2>{composer?t.add:selected?.name||''}</h2></div><button type="button" onClick={closeSheet}><X/></button></div>
      {composer?<>
        <p className="capital-step-label">{t.chooseCategory}</p>
        <div className="capital-category-grid">{t.cats.map((category,index)=>{const Icon=icons[index]||BriefcaseBusiness;return <button type="button" key={category} className={form.category===category?'is-selected':''} onClick={()=>changeCategory(category)}><Icon/><span>{t.categories[index]}</span></button>;})}</div>
        {!assetSelection?<>
          {['stock','etf'].includes(form.category)&&<div className="capital-market-tabs" role="group" aria-label={t.market}><button type="button" className={marketScope==='world'?'is-active':''} aria-pressed={marketScope==='world'} onClick={()=>{setMarketScope('world');setAssetSearch('');setExchangeFilter('all');setBondFilter('all');}}>{t.worldMarket}</button><button type="button" className={marketScope==='russia'?'is-active':''} aria-pressed={marketScope==='russia'} onClick={()=>{setMarketScope('russia');setAssetSearch('');setExchangeFilter('all');setBondFilter('all');}}>{t.russiaMarket}</button></div>}
          {form.category==='bond'&&<p className="capital-market-note">{t.russiaMarket} · {t.moexSource}</p>}
          {form.category==='commodity'&&<p className="capital-market-note">{t.commodityManual}</p>}
          <p className="capital-step-label">{assetSearch?t.findAsset:t.popular}</p>
          <label className="capital-picker-search"><Search size={16}/><input autoComplete="off" value={assetSearch} onChange={event=>setAssetSearch(event.target.value)} placeholder={t.findAsset}/></label>
          {form.category==='commodity'&&<div className="capital-catalog-filters" role="group" aria-label={t.category}>{t.commodityGroups.map(([value,label])=><button type="button" key={value} className={commodityGroup===value?'is-active':''} aria-pressed={commodityGroup===value} onClick={()=>setCommodityGroup(value)}>{label}</button>)}</div>}
          {marketScope==='world'&&['stock','etf'].includes(form.category)&&!companyCatalog&&!companyCatalogLoading&&<button type="button" className="capital-catalog-action" onClick={()=>setShowFullUsCatalog(true)}><span>{t.showUsCatalog}</span><b>{t.catalogCount}</b></button>}
          {marketScope==='world'&&['stock','etf'].includes(form.category)&&companyCatalogLoading&&<p className="capital-form-hint">{t.stockCatalogLoading}</p>}
          {marketScope==='world'&&['stock','etf'].includes(form.category)&&companyCatalogError&&<p className="capital-form-hint">{t.stockCatalogUnavailable}</p>}
          {marketScope==='russia'&&['stock','etf','bond'].includes(form.category)&&moexCatalogLoading&&<p className="capital-form-hint">{t.catalogLoadingAll}</p>}
          {marketScope==='russia'&&moexCatalogError&&<p className="capital-form-hint">{t.moexCatalogUnavailable}</p>}
          {form.category==='crypto'&&binanceCatalogLoading&&<p className="capital-form-hint">{t.catalogLoading}</p>}
          {form.category==='crypto'&&binanceCatalogError&&<p className="capital-form-hint">{t.catalogUnavailable}</p>}
          {marketScope==='world'&&companyCatalog&&['stock','etf'].includes(form.category)&&(
            <div className="capital-catalog-filters" role="group" aria-label={t.market}>
              <button type="button" className={exchangeFilter==='all'?'is-active':''} aria-pressed={exchangeFilter==='all'} onClick={()=>setExchangeFilter('all')}>{t.exchangeAll}</button>
              {['Nasdaq','NYSE','TXSE'].map(exchange=>(<button type="button" key={exchange} className={exchangeFilter===exchange?'is-active':''} aria-pressed={exchangeFilter===exchange} onClick={()=>setExchangeFilter(exchange)}>{exchange}</button>))}
            </div>
          )}
          {marketScope==='russia'&&form.category==='bond'&&moexCatalogCategory==='bond'&&moexCatalogIsFull&&moexCatalog.length>0&&(
            <div className="capital-catalog-filters" role="group" aria-label={t.category}>
              {[['all',t.bondAll],['ofz',t.bondOfz],['corporate',t.bondCorporate],['municipal',t.bondMunicipal]].map(([value,label])=>(<button type="button" key={value} className={bondFilter===value?'is-active':''} aria-pressed={bondFilter===value} onClick={()=>setBondFilter(value)}>{label}</button>))}
            </div>
          )}
          {marketScope==='russia'&&moexCatalogCategory===form.category&&moexCatalog.length>0&&<p className="capital-catalog-count">{catalogMatches.length.toLocaleString(locale)} {moexCatalogIsFull&&!assetSearch.trim()&&bondFilter==='all'?t.catalogCount:t.catalogSearchCount} · MOEX</p>}
          {marketScope==='world'&&companyCatalog&&['stock','etf'].includes(form.category)&&<p className="capital-catalog-count">{catalogMatches.length.toLocaleString(locale)} {!assetSearch.trim()&&exchangeFilter==='all'?t.catalogCount:t.catalogSearchCount} · SEC</p>}
          <div className="capital-picker-results">{matchedCatalog.map(item=><button type="button" key={`${item.marketSource||item.quoteSource}:${item.symbol}`} onClick={()=>chooseCatalogAsset(item)}><span className="capital-picker-symbol">{item.symbol}</span><span>{item.name}</span>{item.quoteSource==='binance'&&<i>LIVE</i>}{item.marketSource==='gold-api'&&<i>SPOT</i>}{item.quoteSource==='moex'&&<i>MOEX</i>}</button>)}
            {!matchedCatalog.length&&(moexCatalogLoading||companyCatalogLoading?<p>{t.stockCatalogLoading}</p>:<p>{t.noAssetsFound}</p>)}</div>
          {matchedCatalog.length<catalogMatches.length&&<button type="button" className="capital-catalog-more" onClick={()=>setCatalogVisibleLimit(limit=>limit+40)}>{t.showMoreCatalog} · {matchedCatalog.length.toLocaleString(locale)} / {catalogMatches.length.toLocaleString(locale)}</button>}
          <button type="button" className="capital-custom-link" onClick={chooseCustomAsset}><Plus size={15}/>{t.customAsset}</button>
        </>:<>
          <div className="capital-selected-asset"><span className="capital-picker-symbol">{form.symbol||form.category.toUpperCase()}</span><span><strong>{form.name||t.customAsset}</strong><small>{form.symbol?`${form.symbol} · ${assetSelection.custom?t.manualSource:isGoldApiAsset(form)?(form.symbol==='HG'?t.goldApiCopper:t.goldApiSource):form.quoteSource==='binance'?t.binanceSource:form.quoteSource==='moex'?t.moexSource:t.manualSource}`:t.manualSource}</small></span><button type="button" onClick={()=>{setAssetSelection(null);setAssetSearch('');}}>{t.changeAsset}</button></div>
          {moexCurrencyLoading&&<p className="capital-form-hint">{t.moexCurrencyLoading}</p>}
          {assetSelection.custom&&<><label>{t.name}<input required maxLength="120" value={form.name} onChange={event=>setForm({...form,name:event.target.value})} placeholder={t.manualName}/></label><label>{t.symbol}<input maxLength="24" value={form.symbol} onChange={event=>setForm({...form,symbol:event.target.value.toUpperCase()})} placeholder={t.optional}/></label></>}
          <div className="capital-form-grid"><label>{t.quantity}<input required min="0.000000000001" step="any" type="number" value={form.quantity} onChange={event=>setForm({...form,quantity:event.target.value})}/></label><label>{t.purchase}<input required min="0" step="any" type="number" value={form.purchasePrice} onChange={event=>setForm({...form,purchasePrice:event.target.value})} placeholder="0.00"/></label></div>
          <details className="capital-purchase-details" open={showPurchaseDetails} onToggle={event=>setShowPurchaseDetails(event.currentTarget.open)}><summary>{t.purchaseDetails} <span>{t.optional}</span></summary>
            <div className="capital-form-grid"><label>{t.currency}<select disabled={form.category==='crypto'&&form.quoteSource==='binance'} value={form.currency} onChange={event=>setForm({...form,currency:event.target.value})}>{['USD','EUR','RON','RUB','CNY','GBP','USDT'].map(code=><option key={code}>{code}</option>)}</select></label><label>{t.fee}<input min="0" step="any" type="number" value={form.fee} onChange={event=>setForm({...form,fee:event.target.value})}/></label><label>{t.date}<input type="date" value={form.date} onChange={event=>setForm({...form,date:event.target.value})}/></label>{form.quoteSource==='manual'&&!isGoldApiAsset(form)&&<label>{t.currentEstimate}<input min="0" step="any" type="number" value={form.price} onChange={event=>setForm({...form,price:event.target.value})} placeholder={form.purchasePrice||'0.00'}/></label>}</div>
          </details>
          {form.category==='crypto'&&<><label>{t.quoteSource}<select value={form.quoteSource} onChange={event=>setForm(current=>({...current,quoteSource:event.target.value,currency:event.target.value==='binance'?'USDT':current.currency==='USDT'?currency:current.currency}))}><option value="binance">{t.binanceSource}</option><option value="manual">{t.manualSource}</option></select></label><p className="capital-form-hint">{form.quoteSource==='binance'?t.usdtNote:t.manualSource}</p></>}
          <button className="capital-add capital-submit" type="submit" disabled={saving||moexCurrencyLoading}>{t.save}</button>
        </>}
      </>:selected?<>
        <div className="capital-asset-identity"><div><strong>{selected.symbol||selected.name}</strong><span>{selected.name} · {t.categories[t.cats.indexOf(selected.category)]}</span></div><span className="capital-detail-quote">{quoteLabel(selected,quotes[selected.symbol])}</span></div>
        <section className="capital-detail-performance">
          <span>{t.unrealizedLead}</span>
          <strong className={selectedUnrealized===null?'':selectedUnrealized>0n?'positive':selectedUnrealized<0n?'negative':''}>{selectedUnrealized===null?t.waitingQuote:`${selectedUnrealized>0n?'+':''}${formatMoney(selectedUnrealized,selected.currency,locale)}`}</strong>
          <b className={selectedUnrealized===null?'':selectedUnrealized>0n?'positive':selectedUnrealized<0n?'negative':''}>{selectedUnrealized===null?'—':formatPercent(selectedUnrealized,selected.invested,locale)}</b>
          <small>{t.relativeCost}</small>
        </section>
        <section className="capital-asset-score" aria-label={t.assetScore}>
          <div className="capital-asset-score-head"><strong>{t.assetScore}</strong><b>{selectedScore===null?'—':`${new Intl.NumberFormat(locale).format(Number(selectedScore.value))}/100`}</b></div>
          <div className="capital-asset-score-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow={selectedScore===null?undefined:Number(selectedScore.value)}><span style={{width:selectedScore===null?'0%':`${Number(selectedScore.value)}%`}}/></div>
          {selectedScore&&<div className="capital-score-breakdown"><span>{t.scoreReturn}<b>{Number(selectedScore.performance)}/50</b></span><span>{t.scoreShare}<b>{`${new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(selectedScore.shareBasisPoints)/100)}% · ${Number(selectedScore.diversification)}/25`}</b></span><span>{t.scorePrice}<b>{selectedScore.freshnessLabel} · {Number(selectedScore.freshness)}/25</b></span></div>}
          {!selectedScore&&<small>{t.scoreUnavailable}</small>}
          <small>{t.assetScoreNote}</small>
        </section>
        <div className="capital-detail-primary-stats">
          <div><span>{t.currentValue}</span><b>{selectedValue===null?'—':formatMoney(selectedValue,selected.currency,locale)}</b></div>
          <div><span>{t.currentUnitPrice}</span><b>{selectedPrice===null?t.waitingQuote:`${formatMoney(selectedPrice,selected.currency,locale)} / ${selected.symbol||t.quantityUnit}`}</b></div>
          <div><span>{stats.basis}</span><b>{formatMoney(selected.invested,selected.currency,locale)}</b></div>
          <div><span>{t.quantity}</span><b>{formatQuantity(selected.quantity,locale)} {selected.symbol}</b></div>
          <div><span>{stats.average}</span><b>{formatMoney(selected.averageCost,selected.currency,locale)} / {selected.symbol||t.quantityUnit}</b></div>
        </div>
        <div className="capital-detail-stats capital-detail-results">
          <div><span>{stats.realized}</span><b className={selected.realized>0n?'positive':selected.realized<0n?'negative':''}>{selected.realized>0n?'+':''}{formatMoney(selected.realized,selected.currency,locale)}</b></div>
          <div><span>{stats.unrealized}</span><b className={selectedUnrealized===null?'':selectedUnrealized>0n?'positive':selectedUnrealized<0n?'negative':''}>{selectedUnrealized===null?'—':`${selectedUnrealized>0n?'+':''}${formatMoney(selectedUnrealized,selected.currency,locale)}`}</b></div>
          <div><span>{stats.total}</span><b className={selectedTotalResult===null?'':selectedTotalResult>0n?'positive':selectedTotalResult<0n?'negative':''}>{selectedTotalResult===null?'—':`${selectedTotalResult>0n?'+':''}${formatMoney(selectedTotalResult,selected.currency,locale)}`}</b></div>
          <div><span>{stats.fees}</span><b>{formatMoney(selectedFees,selected.currency,locale)}</b></div>
        </div>
        <p className="capital-result-formula">{t.resultFormula}</p>
        <CapitalAssetHistoryChart rows={selected.rows} currency={selected.currency} locale={locale} t={t} formatQuantity={formatQuantity}/>
        <div className="capital-detail-actions"><button type="button" onClick={()=>openOperation('buy')}>{t.buyAction}</button><button type="button" onClick={()=>openOperation('sell')}>{t.sellAction}</button></div>
        <label>{t.operation}<select value={opForm.operation} onChange={e=>setOpForm({...opForm,operation:e.target.value})}><option value="buy">{t.buy}</option><option value="sell">{t.sell}</option><option value="dividend">{t.dividend||t.sell}</option>{selected.quote_source==='manual'&&!isGoldApiAsset(selected)&&<option value="revalue">{t.revalue}</option>}</select></label>
        <div className="capital-form-grid"><label>{t.quantity}<input required={opForm.operation!=='revalue'} min="0.000000000001" max={opForm.operation==='sell'?scaledToString(selected.quantity,QUANTITY_SCALE):undefined} step="any" type="number" value={opForm.quantity} onChange={e=>setOpForm({...opForm,quantity:e.target.value})}/></label><label>{t.purchase}<input required min="0" step="any" type="number" value={opForm.price} onChange={e=>setOpForm({...opForm,price:e.target.value})}/></label><label>{t.fee}<input min="0" step="any" type="number" value={opForm.fee} onChange={e=>setOpForm({...opForm,fee:e.target.value})}/></label><label>{t.date}<input required type="date" value={opForm.date} onChange={e=>setOpForm({...opForm,date:e.target.value})}/></label></div>
        <div className="capital-operations">{selected.rows.map(row=><div key={row.id}><span>{row.operation==='sell'?<ArrowUpRight/>:<ArrowDownLeft/>}{row.operation==='sell'?t.sell:row.operation==='revalue'?t.revalue:row.operation==='dividend'?(t.dividend||t.buy):t.buy}</span><b>{formatQuantity(row.quantity?parseScaled(row.quantity,QUANTITY_SCALE):0n,locale)} × {formatMoney(row.unit_price,row.currency,locale)}</b><time>{row.occurred_on}</time></div>)}</div>{selected.rows[0]&&<button type="button" className="capital-cancel" onClick={async()=>{if(!window.confirm(`${t.cancelOperation}?`))return;setSaveError('');try{await portfolio.deleteLatestOperation(selected.rows[0].id);setSelected(null);}catch(error){setSaveError(friendlyCapitalError(error,locale,t));}}}>{t.cancelOperation}</button>}<button className="capital-add capital-submit" type="submit" disabled={saving}>{opForm.operation==='buy'?t.save:opForm.operation==='revalue'?t.revalue:opForm.operation==='dividend'?(t.dividend||t.buy):t.sellAction}</button></>:null}
          {(saveError||portfolio.error&&composer)&&<p role="alert" className="capital-form-hint">{saveError||friendlyCapitalError(portfolio.error,locale,t)}</p>}<button type="button" className="capital-cancel" onClick={closeSheet}>{t.cancel}</button>
    </SwipeDismissSheet></div>}
  </main>;
}
function LockIcon(){return <Wallet size={16}/>}
