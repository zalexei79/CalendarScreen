import {MONEY_SCALE,QUANTITY_SCALE,multiplyScaled,parseScaled} from './decimal.js';

// Keep the ledger intact: hiding an empty position must not erase realized P/L.
export function partitionHoldings(assets){
 return {
  current:assets.filter(asset=>asset.quantity>0n),
  closed:assets.filter(asset=>asset.quantity===0n&&asset.rows.some(row=>row.operation==='buy'||row.operation==='sell')),
 };
}
export function activityRows(assets,operations,{kind='all',query=''}={}){
 const byId=new Map(assets.map(asset=>[asset.id,asset]));
 const search=query.trim().toLocaleLowerCase();
 return operations.filter(row=>(kind==='all'||row.operation===kind)&&byId.has(row.asset_id))
  .map(row=>{
   const asset=byId.get(row.asset_id),quantity=parseScaled(row.quantity,QUANTITY_SCALE),price=parseScaled(row.unit_price,MONEY_SCALE),fee=parseScaled(row.fee||'0',MONEY_SCALE);
   const gross=multiplyScaled(quantity,QUANTITY_SCALE,price,MONEY_SCALE);
   return {row,asset,quantity,price,fee,total:row.operation==='revalue'?null:row.operation==='buy'?gross+fee:gross-fee};
  }).filter(({asset})=>!search||`${asset.name} ${asset.symbol}`.toLocaleLowerCase().includes(search))
  .sort((a,b)=>String(b.row.occurred_on).localeCompare(String(a.row.occurred_on))||String(b.row.created_at).localeCompare(String(a.row.created_at))||String(b.row.id).localeCompare(String(a.row.id)));
}

export const sectionCopy={
 ru:{nav:'Разделы портфеля',overview:'Обзор',assets:'Активы',history:'История',current:'В портфеле',closed:'Закрытые',closedHint:'Здесь завершённые позиции. Их результат учтён в обзоре, операции сохранены в истории.',currentEmpty:'Сейчас нет открытых позиций',currentHint:'Добавьте покупку. Завершённые вложения доступны в «Закрытых».',closedEmpty:'Закрытых позиций пока нет',historyHint:'Все покупки, продажи и выплаты — по датам.',historyEmpty:'Операций пока нет',notFound:'По этим условиям операций нет',all:'Все',buy:'Покупки',sell:'Продажи',dividend:'Выплаты',revalue:'Оценки',search:'Название или тикер',received:'Получено после комиссии',spent:'Потрачено с комиссией',fee:'Комиссия',price:'Цена за единицу',quantity:'Количество',more:'Показать ещё',closedAction:'Открыть закрытые позиции',openAsset:'Открыть актив',noSales:'Продаж пока нет'},
 en:{nav:'Portfolio sections',overview:'Overview',assets:'Assets',history:'Activity',current:'Holdings',closed:'Closed',closedHint:'Completed positions. Their results remain in the overview and their transactions in activity.',currentEmpty:'No open positions',currentHint:'Add a purchase. Completed investments are available under Closed.',closedEmpty:'No closed positions yet',historyHint:'Purchases, sales and payouts, ordered by date.',historyEmpty:'No transactions yet',notFound:'No matching transactions',all:'All',buy:'Purchases',sell:'Sales',dividend:'Payouts',revalue:'Valuations',search:'Name or ticker',received:'Received after fees',spent:'Spent including fees',fee:'Fee',price:'Unit price',quantity:'Quantity',more:'Show more',closedAction:'View closed positions',openAsset:'Open asset',noSales:'No sales yet'},
 ro:{nav:'Secțiuni portofoliu',overview:'Prezentare',assets:'Active',history:'Istoric',current:'În portofoliu',closed:'Închise',closedHint:'Poziții încheiate. Rezultatele rămân în prezentare, iar operațiunile în istoric.',currentEmpty:'Nu ai poziții deschise',currentHint:'Adaugă o cumpărare. Investițiile încheiate sunt în secțiunea Închise.',closedEmpty:'Nu ai poziții închise încă',historyHint:'Cumpărări, vânzări și plăți, în ordinea datelor.',historyEmpty:'Nu există operațiuni',notFound:'Nicio operațiune găsită',all:'Toate',buy:'Cumpărări',sell:'Vânzări',dividend:'Plăți',revalue:'Evaluări',search:'Nume sau simbol',received:'Primit după comision',spent:'Plătit cu comision',fee:'Comision',price:'Preț unitar',quantity:'Cantitate',more:'Arată mai multe',closedAction:'Vezi pozițiile închise',openAsset:'Deschide activul',noSales:'Nu există vânzări'},
 zh:{nav:'投资组合分区',overview:'概览',assets:'持仓',history:'历史',current:'当前持仓',closed:'已关闭',closedHint:'已完成的持仓。收益仍计入概览，交易保留在历史中。',currentEmpty:'暂无当前持仓',currentHint:'添加买入记录。已完成的投资可在已关闭中查看。',closedEmpty:'暂无已关闭持仓',historyHint:'按日期查看买入、卖出和收益记录。',historyEmpty:'暂无交易',notFound:'没有符合条件的交易',all:'全部',buy:'买入',sell:'卖出',dividend:'收益',revalue:'估值',search:'名称或代码',received:'扣费后收到',spent:'含手续费支出',fee:'手续费',price:'单价',quantity:'数量',more:'显示更多',closedAction:'查看已关闭持仓',openAsset:'打开资产',noSales:'暂无卖出记录'},
};
