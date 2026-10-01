// Amounts stay in their recorded currency; personal cash flow excludes trades.
import {categoryMatches} from './voiceCategory.js';
import {resolveVoiceAsset,assetMatchesInstrument} from './voiceAsset.js';
export function financialVoiceAnswer({records,monthKey,metric,category,categoryLabel=category,language='ru',isTrading=()=>false}){
 const locale=language==='en'?'en':['ro','md'].includes(language)?'ro':'ru';
 const labels={ru:{intro:'По вашим записям за этот месяц.',empty:'За этот месяц записей пока нет.',income:'Личные доходы',expense:'Личные расходы',net:'Разница доходов и расходов',trade:'Торговый результат отдельно',zero:'нет записей'},en:{intro:'Based on your entries this month.',empty:'There are no entries for this month yet.',income:'Personal income',expense:'Personal expenses',net:'Income minus expenses',trade:'Trading result separately',zero:'no entries'},ro:{intro:'Conform înregistrărilor tale din această lună.',empty:'Nu există înregistrări pentru această lună.',income:'Venituri personale',expense:'Cheltuieli personale',net:'Venituri minus cheltuieli',trade:'Rezultatul tranzacțiilor separat',zero:'fără înregistrări'}}[locale];
 const totals=new Map();let count=0;
 const asset=category?resolveVoiceAsset(category):null;
 for(const [date,items] of Object.entries(records||{})){
  if(!date.startsWith(`${monthKey}-`)||!Array.isArray(items))continue;
  for(const item of items){
   if(!item||item.pnl==null||item.pnl==='')continue;
   if(asset&&!assetMatchesInstrument(asset,item.instrument))continue;
   if(category&&!asset&&(!categoryMatches(item.instrument,category)||isTrading(item)))continue;
   const amount=Number(item.pnl);if(!Number.isFinite(amount))continue;
   const currency=String(item.currency||'USD').toUpperCase();
   if(!/^[A-Z]{3}$/.test(currency))continue;
   if(!totals.has(currency))totals.set(currency,{income:0,expense:0,net:0,trade:0,loss:0,profit:0,personalCount:0,tradeCount:0});
   const total=totals.get(currency);count++;
   if(asset||isTrading(item)){total.trade+=amount;total.tradeCount++;if(amount<0)total.loss-=amount;else total.profit+=amount;}
   else{total.personalCount++;total.net+=amount;if(amount>=0)total.income+=amount;else total.expense-=amount;}
  }
 }
 if(!count&&asset)return locale==='ru'?`За этот месяц сделок по инструменту «${asset.label}» в ваших записях нет.`:locale==='en'?`No trades recorded this month for ${categoryLabel}.`:`Nu există tranzacții înregistrate în această lună pentru ${categoryLabel}.`;
 if(!count)return category?(locale==='ru'?`За этот месяц расходов в категории «${categoryLabel}» пока нет в ваших записях.`:locale==='en'?`No expenses recorded this month in “${categoryLabel}”.`:`Nu există cheltuieli înregistrate în această lună pentru „${categoryLabel}”.`):labels.empty;
 if(asset){
  const values=key=>[...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,total])=>new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'name',maximumFractionDigits:2}).format(total[key])).join('; ');
  const words=locale==='ru'?['Убытки по сделкам','Прибыль по сделкам','Итог торговли']:locale==='en'?['Trading losses','Trading profits','Trading result']:['Pierderi din tranzacții închise','Profit din tranzacții închise','Rezultatul tranzacțiilor'];
  return `${labels.intro} ${locale==='ru'?asset.label:category}. ${words[metric==='income'?1:0]}: ${values(metric==='income'?'profit':'loss')}. ${words[2]}: ${values('trade')}.`;
 }
 function line(key){
  const parts=[...totals].sort(([a],[b])=>a.localeCompare(b)).filter(([,v])=>key==='trade'?v.tradeCount:v.personalCount).map(([currency,v])=>new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'name',maximumFractionDigits:2}).format(v[key]));
  return `${labels[key]}: ${parts.join('; ')||labels.zero}.`;
 }
 const result=[labels.intro,...(category?[locale==='ru'?`Категория «${categoryLabel}».`:locale==='en'?`Category “${categoryLabel}”.`:`Categoria „${categoryLabel}”.`]:[])];
 if(metric==='summary')result.push(line('income'),line('expense'),line('net'));
 else result.push(line(metric==='income'?'income':'expense'));
 if([...totals.values()].some(v=>v.tradeCount))result.push(line('trade'));
 return result.join(' ');
}
