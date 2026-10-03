import {categoryMatches, normalizeVoiceCategory, resolveLocalizedCategory} from './voiceCategory.js';
import {resolveVoiceAsset, assetMatchesInstrument} from './voiceAsset.js';

const months = [
 ['январь','января','январе','january'],['февраль','февраля','феврале','february'],['март','марта','марте','march'],
 ['апрель','апреля','апреле','april'],['май','мая','мае','may'],['июнь','июня','июне','june'],
 ['июль','июля','июле','july'],['август','августа','августе','august'],['сентябрь','сентября','сентябре','september'],
 ['октябрь','октября','октябре','october'],['ноябрь','ноября','ноябре','november'],['декабрь','декабря','декабре','december'],
];
const periodPatterns = [
 ['all-time', /(?:за )?(?:все время|всю историю)|\ball time\b/],
 ['current-week', /(?:(?:за|на|в) )?(?:этой|эту|текущую|текущей) недел[юеи]|\bthis week\b/],
 ['last-week', /(?:(?:за|на|в) )?(?:прошлой|прошлую|предыдущую|предыдущей) недел[юеи]|\blast week\b/],
 ['last-month', /(?:(?:за|в) )?(?:прошлый|прошлом|предыдущий|предыдущем) месяц(?:е)?|\blast month\b/],
 ['current-month', /(?:(?:за|в) )?(?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?|\bthis month\b/],
 ['yesterday', /(?:за )?вчера|\byesterday\b/], ['today', /(?:за )?сегодня|\btoday\b/],
];

// Read-only intents are recognized before purchase parsing. Periods can appear
// before or after the category, so no date words become new category names.
export function parseFinancialVoiceQuery(value) {
 let text=normalizeVoiceCategory(value).replace(/[.,!?]/g,' ').replace(/\s+/g,' ').trim().replace(/^(?:пожалуйста |можешь |скажи |расскажи |tell me |please )/,'').replace(/ пожалуйста$/,'');
 const last=/^when did i last (?:pay|spend)(?: |$)/.test(text);
 const lastRu=/^когда (?:я )?(?:последний раз |в последний раз )?(?:платил|платила|оплатил|оплатила|потратил|потратила)(?: |$)/.test(text);
 const search=/^(?:покажи|найди|показать|найти|show|find)(?: |$)/.test(text)&&/(?:расход|трат|доход|запис|платеж|покуп|expense|spending|income|entries|payments)/.test(text);
 const question=/^(?:сколько|какие|какой|подведи|итог|итоги|how much|summarize|summary for)(?: |$)/.test(text);
 if(!last&&!lastRu&&!search&&!question)return null;
 const income=/(?:заработал|заработала|получил|получила|доход|earn|income|receive)/.test(text);
 const expense=/(?:потратил|потратила|потрачено|расход|трат|платил|платила|оплатил|оплатила|платеж|покуп|spend|spent|expense|pay)/.test(text);
 const summary=/(?:итог|summar|записи|entries)/.test(text);
 if(!income&&!expense&&!summary)return null;
 if(income&&expense)return null;
 const command={type:search||last||lastRu?'financial-search':'question',metric:income?'income':expense?'expense':'summary',period:last||lastRu?'all-time':'current-month'};
 if(search||last||lastRu)command.mode=last||lastRu?'last':'search';
 let explicitPeriod=false;
 for(const [period,pattern] of periodPatterns){
  if(pattern.test(text)){if(explicitPeriod)return null;explicitPeriod=true;command.period=period;text=text.replace(pattern,' ').replace(/\s+/g,' ').trim();}
 }
 const named=new RegExp(`(?:^| )(?:за |в |in |for )?(${months.flat().join('|')})(?: (20\\d{2}|19\\d{2})(?: года)?)?(?= |$)`);
 const match=text.match(named);
 if(match){if(explicitPeriod)return null;command.period='named-month';command.month=months.findIndex(names=>names.includes(match[1]))+1;if(match[2])command.year=Number(match[2]);text=text.replace(match[0],' ').replace(/\s+/g,' ').trim();}
 // Unsupported or conflicting dates must not silently fall back to this month.
 if(/недел|месяц|год|сегодня|вчера|завтра|week|month|year|20\d{2}|19\d{2}/.test(text))return null;
 const category=text.match(/(?:^| )(?:на|за|по|категория|категории|раздел|разделу|on|for)(?: категорию| категории| разделу)? (.+)$/);
 if(category){const name=category[1].replace(/\s+(?:потратил|потратила|потрачено|заработал|заработала|получил|получила)$/,'').replace(/\s+/g,' ').trim();if(!name||name.length>60)return null;command.category=name;}
 else {
  const remainder=text.replace(/^(?:покажи|найди|показать|найти|show|find) /,'').replace(/^(?:все |мои |my |all )+/,'').replace(/^(?:расходы|траты|доходы|записи|платежи|покупки|expenses|spending|income|entries|payments)(?: |$)/,'').trim();
  if(search&&remainder){if(remainder.length>60)return null;command.category=remainder;}
 }
 return command;
}

const dateKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function financialQueryRange(command, todayKey) {
 const [year,month,day]=todayKey.split('-').map(Number),today=new Date(year,month-1,day);
 const period=command.period||'current-month';
 if(period==='exact-day')return {from:command.dateKey,to:command.dateKey};
 if(period==='all-time')return {from:'0000-01-01',to:'9999-12-31'};
 if(period==='today'||period==='yesterday'){const date=new Date(today);if(period==='yesterday')date.setDate(date.getDate()-1);return {from:dateKey(date),to:dateKey(date)};}
 if(period==='current-week'||period==='last-week'){const start=new Date(today);start.setDate(start.getDate()-(start.getDay()+6)%7-(period==='last-week'?7:0));const end=new Date(start);end.setDate(end.getDate()+6);return {from:dateKey(start),to:dateKey(end)};}
 const targetMonth=period==='named-month'?command.month-1:month-1-(period==='last-month'?1:0),targetYear=command.year||year;
 return {from:dateKey(new Date(targetYear,targetMonth,1)),to:dateKey(new Date(targetYear,targetMonth+1,0))};
}

export function resolveFinancialQueryCategory(name, definitions, existing) {
 if(!name)return null;
 const resolved=resolveLocalizedCategory(name,definitions,existing);
 if(existing.some(value=>categoryMatches(value,resolved)))return resolved;
 const aliases={еду:['Еда','Продукты'],еда:['Еда','Продукты'],food:['Еда','Продукты'],машину:['Машина','Авто','Транспорт'],машина:['Машина','Авто','Транспорт'],авто:['Авто','Машина','Транспорт'],car:['Авто','Машина','Транспорт']};
 const choices=aliases[normalizeVoiceCategory(name)];
 return choices?.find(choice=>existing.some(value=>categoryMatches(value,choice)))||resolved;
}

export const financialRecordKey = item => `${item.dateKey}:${item.id}`;
export function financialQueryResult({records, command, todayKey, category=command.category, categoryLabel=category, language='ru', isTrading=()=>false}) {
 const locale=String(language).startsWith('zh')?'zh-CN':['ro','md'].includes(language)?'ro':language==='en'?'en':'ru';
 const copy=(ru,en,ro,zh)=>locale==='ru'?ru:locale==='en'?en:locale==='ro'?ro:zh;
 const range=financialQueryRange(command,todayKey),asset=category?resolveVoiceAsset(category):null;
 const items=Object.entries(records||{}).flatMap(([dateKey,rows])=>Array.isArray(rows)?rows.map(item=>({...item,dateKey})):[]).filter(item=>{
  const amount=Number(item.pnl);
  if(item.pnl===null||item.pnl===undefined||item.pnl===''||!Number.isFinite(amount)||!/^[A-Z]{3}$/.test(String(item.currency||'USD').toUpperCase()))return false;
  if(item.dateKey<range.from||item.dateKey>range.to)return false;
  if(asset?!assetMatchesInstrument(asset,item.instrument):isTrading(item))return false;
  if(category&&!asset&&!categoryMatches(item.instrument,category))return false;
  if(command.categories?.length&&!command.categories.some(name=>categoryMatches(item.instrument,name)))return false;
  if(command.amountFilter){const {kind,value}=command.amountFilter,magnitude=Math.abs(amount);if(kind==='above'&&magnitude<=value||kind==='below'&&magnitude>=value||kind==='approx'&&Math.abs(magnitude-value)>Math.max(1,value*.1))return false;}
  return command.metric==='income'?amount>0:command.metric==='expense'?amount<0:true;
 }).sort((a,b)=>b.dateKey.localeCompare(a.dateKey)||String(b.time||'').localeCompare(String(a.time||''))||String(b.id||'').localeCompare(String(a.id||'')));
 const selected=command.mode==='last'?items.slice(0,1):items;
 const format=value=>new Intl.NumberFormat(locale,{style:'currency',currency:value.currency||'USD',currencyDisplay:'name',maximumFractionDigits:2}).format(Math.abs(Number(value.pnl)));
 const label=categoryLabel?` · ${categoryLabel}`:'';
 const periodLabel=command.period==='exact-day'?new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${range.from}T12:00:00`)):command.period==='all-time'?copy('за всё время','all time','din toate înregistrările','全部时段'):command.period==='current-week'?copy('на этой неделе','this week','săptămâna aceasta','本周'):command.period==='last-week'?copy('на прошлой неделе','last week','săptămâna trecută','上周'):command.period==='yesterday'?copy('вчера','yesterday','ieri','昨天'):command.period==='today'?copy('сегодня','today','astăzi','今天'):command.period==='named-month'?new Intl.DateTimeFormat(locale,{month:'long',year:'numeric'}).format(new Date(`${range.from}T12:00:00`)):command.period==='last-month'?copy('за прошлый месяц','last month','luna trecută','上个月'):copy('за этот месяц','this month','luna aceasta','本月');
 let text;
 if(!selected.length)text=copy(`Записей ${periodLabel}${label} не найдено.`,`No entries ${periodLabel}${label}.`,`Nu există înregistrări ${periodLabel}${label}.`,`${periodLabel}${label} 没有记录。`);
 else if(command.mode==='last'){
  const item=selected[0],date=new Intl.DateTimeFormat(locale,{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${item.dateKey}T12:00:00`));
  text=copy(`Последний платёж${label}: ${date} · ${format(item)}.`,`Last payment${label}: ${date} · ${format(item)}.`,`Ultima plată${label}: ${date} · ${format(item)}.`,`最后付款${label}：${date} · ${format(item)}。`);
 } else if(command.mode==='day-review')text=selected.length?selected.slice(0,6).map(item=>`${item.instrument || copy('Другое','Other','Altele','其他')} · ${Number(item.pnl)<0?'−':'+'}${format(item)}`).join('; ')+(selected.length>6?copy(`. Ещё ${selected.length-6} записей в истории.`,`. ${selected.length-6} more entries in history.`,`. Încă ${selected.length-6} înregistrări.`,`。还有 ${selected.length-6} 条记录。`):''):copy('За этот день записей нет.','No entries for this day.','Nu există înregistrări pentru această zi.','这一天没有记录。');
 else if(command.mode==='search')text=copy(`Найдено записей: ${selected.length}${label} · ${periodLabel}.`,`Found ${selected.length} entries${label} · ${periodLabel}.`,`Am găsit ${selected.length} înregistrări${label} · ${periodLabel}.`,`找到 ${selected.length} 条记录${label} · ${periodLabel}。`);
 else {
  const totals=new Map();for(const item of selected){const currency=String(item.currency||'USD').toUpperCase();totals.set(currency,(totals.get(currency)||0)+Number(item.pnl));}
  const sums=[...totals].sort(([a],[b])=>a.localeCompare(b)).map(([currency,value])=>new Intl.NumberFormat(locale,{style:'currency',currency,currencyDisplay:'name',maximumFractionDigits:2}).format(command.metric==='summary'?value:Math.abs(value))).join('; ');
  const metric=command.metric==='income'?copy(asset?'Торговая прибыль':'Доходы',asset?'Trading profits':'Income',asset?'Profit din tranzacții':'Venituri',asset?'交易盈利':'收入'):command.metric==='expense'?copy(asset?'Торговые убытки':'Расходы',asset?'Trading losses':'Expenses',asset?'Pierderi din tranzacții':'Cheltuieli',asset?'交易亏损':'支出'):copy('Итог','Net result','Rezultat net','净结果');
  text=`${metric}${label}: ${sums} · ${periodLabel}.`;
 }
 return {text,items:selected,range:command.mode==='last'&&selected.length?{from:selected[0].dateKey,to:selected[0].dateKey}:range,asset:Boolean(asset),category,actionLabel:copy('Показать записи','Show entries','Arată înregistrările','查看记录')};
}
