import {parseScaled,multiplyScaled,QUANTITY_SCALE,MONEY_SCALE} from './decimal.js';
export function hasCatalogQuote(item){return item?.marketSource==='gold-api'||['binance','moex','alphavantage'].includes(item?.quoteSource);}
export function filterQuoteCatalog(items,mode){return items.filter(item=>mode==='all'||(mode==='quoted'?hasCatalogQuote(item):!hasCatalogQuote(item)));}
export function purchaseTotal(form){try{const quantity=parseScaled(form.quantity,QUANTITY_SCALE),price=parseScaled(form.purchasePrice,MONEY_SCALE),fee=parseScaled(form.fee||'0',MONEY_SCALE);if(quantity<=0n)return null;return multiplyScaled(quantity,QUANTITY_SCALE,price,MONEY_SCALE)+fee;}catch{return null;}}
