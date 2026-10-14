import {parseScaled,MONEY_SCALE,scaledToString,calculateReturnPercent} from './decimal.js';

// Chart comparisons use the same decimal arithmetic as the portfolio.
export function compareCandles(start,end){
  if(!start||!end)return null;
  try{
    const from=parseScaled(start.close,MONEY_SCALE),to=parseScaled(end.close,MONEY_SCALE);
    if(from<=0n)return null;
    const change=to-from;
    return {change,percent:calculateReturnPercent(change,from),fromTime:start.time,toTime:end.time};
  }catch{return null;}
}
export function formatChartPercent(value,locale){
  if(value===null)return '—';
  const raw=scaledToString(value,2),[whole,fraction='']=raw.split('.');
  const separator=new Intl.NumberFormat(locale).formatToParts(1.1).find(p=>p.type==='decimal')?.value||'.';
  return `${value>0n?'+':''}${whole}${separator}${fraction.padEnd(2,'0')}%`;
}
export const chartExperienceCopy={
 ru:{measure:'Сравнить свечи',measuring:'Сравнение включено',clear:'Сбросить сравнение',start:'От выбранной свечи',end:'До выбранной свечи',help:'Начало зафиксировано. Наведите на другую свечу или коснитесь её.',move:'Изменение цены свечи',selected:'Выбранная свеча',latest:'Последняя свеча',open:'Открытие',high:'Максимум',low:'Минимум',close:'Закрытие',volume:'Объём',range:'Диапазон свечи',compareNote:'Разница цен закрытия · это не доходность портфеля',liveEdge:'К последним свечам',focus:'Фокус',price:'Цена'},
 en:{measure:'Compare candles',measuring:'Comparison active',clear:'Clear comparison',start:'From selected candle',end:'To selected candle',help:'Start is pinned. Hover over or touch another candle.',move:'Candle price change',selected:'Selected candle',latest:'Latest candle',open:'Open',high:'High',low:'Low',close:'Close',volume:'Volume',range:'Candle range',compareNote:'Closing price difference · not portfolio return',liveEdge:'Latest candles',focus:'Focus',price:'Price'},
 ro:{measure:'Compară lumânări',measuring:'Comparație activă',clear:'Resetează comparația',start:'De la lumânarea aleasă',end:'Până la lumânarea aleasă',help:'Început fixat. Atinge sau indică altă lumânare.',move:'Schimbarea prețului lumânării',selected:'Lumânare selectată',latest:'Ultima lumânare',open:'Deschidere',high:'Maxim',low:'Minim',close:'Închidere',volume:'Volum',range:'Intervalul lumânării',compareNote:'Diferența prețurilor de închidere · nu randamentul portofoliului',liveEdge:'Ultimele lumânări',focus:'Focus',price:'Preț'},
 zh:{measure:'比较蜡烛',measuring:'比较已开启',clear:'清除比较',start:'起点蜡烛',end:'终点蜡烛',help:'起点已固定，悬停或触摸另一根蜡烛。',move:'蜡烛价格变化',selected:'选中蜡烛',latest:'最新蜡烛',open:'开盘',high:'最高',low:'最低',close:'收盘',volume:'成交量',range:'蜡烛区间',compareNote:'收盘价差，不是投资组合收益率',liveEdge:'最新蜡烛',focus:'聚焦',price:'价格'},
};
