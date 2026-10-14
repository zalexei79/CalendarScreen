import React from 'react';
import CapitalPriceStatus from './CapitalPriceStatus.jsx';
import { displayQuantity, displayPrice } from './investorTools.js';
import { formatMoney, formatUnitMoney, multiplyScaled, MONEY_SCALE, QUANTITY_SCALE } from './decimal.js';
import './holdings.css';
const copy={
 ru:{buy:'Куплено в среднем',now:'Цена сейчас',result:'При продаже остатка',profit:'Прибыль',loss:'Убыток',zero:'Без прибыли и убытка',closed:'Позиция закрыта',realized:'Результат продаж',unknown:'Нет цены',note:'Расчёт по последней цене. Комиссии покупки учтены; будущая комиссия продажи и налоги не включены.'},
 en:{buy:'Average buy cost',now:'Price now',result:'If you sell the rest',profit:'Profit',loss:'Loss',zero:'Break-even',closed:'Position closed',realized:'Sale result',unknown:'No price',note:'Calculated at the latest price. Purchase fees included; future sale fees and taxes excluded.'},
 ro:{buy:'Cost mediu de cumpărare',now:'Preț acum',result:'Dacă vinzi restul',profit:'Profit',loss:'Pierdere',zero:'Fără profit sau pierdere',closed:'Poziție închisă',realized:'Rezultatul vânzărilor',unknown:'Fără preț',note:'Calcul la ultimul preț. Comisioanele de cumpărare sunt incluse; cele viitoare de vânzare și taxele nu sunt incluse.'},
 zh:{buy:'平均买入成本',now:'当前价格',result:'卖出剩余持仓',profit:'盈利',loss:'亏损',zero:'盈亏持平',closed:'持仓已关闭',realized:'卖出收益',unknown:'暂无价格',note:'按最新价格计算，含买入手续费，不含未来卖出手续费及税费。'},
};
export function holdingOutcome(asset,price){
  const closed=asset.quantity===0n;
  const value=closed?0n:price===null?null:multiplyScaled(asset.quantity,QUANTITY_SCALE,price,MONEY_SCALE);
  return {closed,value,result:closed?asset.realized:value===null?null:value-asset.invested};
}
export function CapitalHoldingExplanation({locale}){
  const title={ru:'Как считается результат',en:'How the result is calculated',ro:'Cum se calculează rezultatul',zh:'收益计算说明'}[locale];
  return <details className="holding-explanation"><summary>{title}</summary><p>{copy[locale].note}</p></details>;
}
export default function CapitalHoldingCard({asset,price,quote,now,online,locale,t,Icon,onSelect,unitLabel,formatQuantity,formatPercent}){
  const c=copy[locale],{closed,value,result}=holdingOutcome(asset,price);
  const label=result===null?c.unknown:result>0n?c.profit:result<0n?c.loss:c.zero;
  return <button type="button" className="capital-asset capital-holding" onClick={()=>onSelect(asset)}>
    <span className="holding-heading"><span className="capital-asset-icon"><Icon aria-hidden="true"/></span><span className="holding-name"><strong>{asset.name}</strong><small>{closed?c.closed:`${formatQuantity(displayQuantity(asset.quantity,asset.display_unit),locale)} ${unitLabel}`}</small></span><span className="holding-value"><strong>{value===null?'—':formatMoney(value,asset.currency,locale)}</strong><small>{asset.symbol}</small></span></span>
    <span className="holding-facts"><span><small>{c.buy}</small><b>{closed?'—':formatUnitMoney(displayPrice(asset.averageCost,asset.display_unit),asset.currency,locale)}</b></span><span><small>{c.now}</small><b>{price===null?'—':formatUnitMoney(displayPrice(price,asset.display_unit),asset.currency,locale)}</b></span></span>
    <span className="holding-outcome" data-sign={result>0n?'positive':result<0n?'negative':'neutral'} title={c.note}><span>{closed?c.realized:c.result}<small>{label}</small></span><span><b>{result===null?'—':`${result>0n?'+':''}${formatMoney(result,asset.currency,locale)}`}</b>{!closed&&result!==null&&<small>{formatPercent(result,asset.invested,locale)}</small>}</span></span>
    {!closed&&<span className="holding-freshness"><CapitalPriceStatus asset={asset} quote={quote} now={now} online={online} locale={locale} t={t}/></span>}
  </button>;
}
