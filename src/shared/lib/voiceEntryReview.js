import {voiceEntryDialog} from './voiceEntryDialog.js';
import {parseCalendarVoiceCommand} from './calendarVoiceCommand.js';
import {normalizeVoiceCategory} from './voiceCategory.js';
import {chineseDate} from './chineseVoiceCommand.js';
import {parseNaturalVoiceEntry,resolveVoiceCorrections} from './naturalVoiceEntry.js';
import {parseSpokenAmount} from './spokenAmount.js';

export function localDateKey(date=new Date()) {
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
function validDate(key) {
 const [year,month,day]=key.split('-').map(Number),date=new Date(year,month-1,day);
 return year>=1900&&year<=9999&&localDateKey(date)===key;
}
const monthNames='январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья]|january|february|march|april|may|june|july|august|september|october|november|december|ianuarie|februarie|martie|aprilie|mai|iunie|iulie|septembrie|octombrie|noiembrie|decembrie';
const ordinals={первого:'один',второго:'два',третьего:'три',четвертого:'четыре',пятого:'пять',шестого:'шесть',седьмого:'семь',восьмого:'восемь',девятого:'девять',десятого:'десять',одиннадцатого:'одиннадцать',двенадцатого:'двенадцать',тринадцатого:'тринадцать',четырнадцатого:'четырнадцать',пятнадцатого:'пятнадцать',шестнадцатого:'шестнадцать',семнадцатого:'семнадцать',восемнадцатого:'восемнадцать',девятнадцатого:'девятнадцать',двадцатого:'двадцать',тридцатого:'тридцать'};
export function extractEntryDate(phrase,today=localDateKey()) {
 let text=String(phrase).toLowerCase().replace(/ё/g,'е').trim(),dateKey=null;
 const matches=[];
 text=text.replace(/(^|\s)(\d{1,3}|один|одна|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:день|дня|дней|days?)\s+(?:назад|ago)(?=$|[\s,.!?])/g,(_,prefix,value)=>{
  const offset=Number(parseSpokenAmount(value)),[year,month,day]=today.split('-').map(Number);
  matches.push(offset>=1&&offset<=366?localDateKey(new Date(year,month-1,day-offset)):'invalid');return prefix;
 });
 text=text.replace(/今天|昨天|前天|明天/g,word=>{
  const offset={今天:0,昨天:-1,前天:-2,明天:1}[word];
  const [year,month,day]=today.split('-').map(Number);
  matches.push(localDateKey(new Date(year,month-1,day+offset)));return '';
 });
 text=text.replace(/[零〇一二两三四五六七八九十百千\d]+年[零〇一二两三四五六七八九十\d]+月[零〇一二两三四五六七八九十\d]+[日号]/g,value=>{matches.push(chineseDate(value)||'invalid');return '';});
 text=text.replace(/(^|\s)(сегодня|вчера|позавчера|завтра|today|yesterday|tomorrow|astăzi|astazi|ieri|alaltăieri|alaltaieri|mâine|maine)(?=$|[\s,.!?])/g,(_,prefix,word)=>{
  const offset=/позавчера|alalt/.test(word)?-2:/вчера|yesterday|^ieri$/.test(word)?-1:/завтра|tomorrow|mâine|maine/.test(word)?1:0;
  const [year,month,day]=today.split('-').map(Number);
  matches.push(localDateKey(new Date(year,month-1,day+offset)));return prefix;
 });
 text=text.replace(/(^|\s)(\d{4}-\d{2}-\d{2}|\d{1,2}\.\d{1,2}\.\d{4})(?=$|[\s,!?])/g,(_,prefix,value)=>{
  const key=value.includes('.')?value.split('.').reverse().map((part,index)=>index?part.padStart(2,'0'):part).join('-'):value;
  matches.push(validDate(key)?key:'invalid');return prefix;
 });
 const dayPattern=`(?:\\d{1,2}|(?:(?:двадцать|тридцать) )?(?:${Object.keys(ordinals).join('|')}))`;
 text=text.replace(new RegExp(`(^|\\s)(${dayPattern}\\s+(?:${monthNames})(?:\\s+\\d{4})?)(?=$|[\\s,.!?])`,'g'),(_,prefix,value)=>{
  const cardinal=value.split(' ').map(word=>ordinals[word]||word).join(' ');
  const command=parseCalendarVoiceCommand(`открой ${cardinal}${/\d{4}$/.test(value)?'':` ${today.slice(0,4)}`}`);
  matches.push(command?.dateKey||'invalid');return prefix;
 });
 if(matches.length)dateKey=matches[0];
 return {text:text.replace(/\s+/g,' ').replace(/[, ]+$/,'').trim(),dateKey,invalid:matches.includes('invalid')||new Set(matches).size>1};
}
const copy={
  zh: {date:"请选择今天或过去的日期。",future:"无法保存未来日期的记录，请选择过去日期。",correction:"请说出修改内容，例如“不，350”“收入”或“用于食品”。",wallet:"钱包需要 PRO，请选择日历。"},
 ru:{date:'Укажите дату записи — сегодня или прошедший день.',future:'Будущую запись сохранить нельзя. Назовите прошедшую дату.',correction:'Скажите, что изменить: «нет, 350», «это доход» или «на продукты».',wallet:'Кошелёк доступен с PRO. Выберите календарь.'},
 en:{date:'Choose today or a past date.',future:'Future entries cannot be saved. Choose a past date.',correction:'Say what to change: “no, 350”, “income” or “on groceries”.',wallet:'Wallet requires PRO. Choose Calendar.'},
 ro:{date:'Alege astăzi sau o dată din trecut.',future:'Nu poți salva în viitor. Alege o dată din trecut.',correction:'Spune ce modificăm: „nu, 350”, „venit” sau „pe produse”.',wallet:'Portofelul necesită PRO. Alege calendarul.'},
};
const ambiguityPrompts={ru:{sign:'Неясно: это расход или доход?',amount:'В фразе несколько сумм. Какую одну сумму записать?',currency:'В фразе несколько валют. Какую валюту выбрать?',category:'Назовите одну категорию для этой записи.',destination:'Куда сохранить: в календарь, кошелёк или в оба?'},en:{sign:'Is this an expense or income?',amount:'Several amounts heard. Which single amount should I record?',currency:'Several currencies heard. Which currency should I use?',category:'Choose one category for this entry.',destination:'Save to calendar, wallet or both?'},ro:{sign:'Este cheltuială sau venit?',amount:'Am auzit mai multe sume. Ce sumă să înregistrez?',currency:'Am auzit mai multe monede. Ce monedă să folosesc?',category:'Alege o categorie pentru această înregistrare.',destination:'În calendar, portofel sau ambele?'}};

// The legacy dialog still handles missing fields. This layer keeps a complete
// draft for review and corrections, without submitting any financial action.
export function voiceEntryReview(phrase,draft=null,locale='ru',categories=[],options={}) {
 const today=options.todayKey||localDateKey(),labels=copy[locale]||copy.ru;
 const corrected=resolveVoiceCorrections(phrase);
 if(/^(取消|停止|不用了|отмена|отмени|не надо|cancel|stop|anuleaza|anulează)$/i.test(corrected.text))return draft?{cancelled:true}:null;
 if(corrected.negated)return {invalid:true};
 if(!draft){const existing=parseCalendarVoiceCommand(corrected.text);if(existing&&existing.type!=='entry')return null;}
 const date=extractEntryDate(corrected.text,today);
 let raw=date.text.replace(/[.!?]$/,'').trim(),destination=null;
 if(locale==='zh') {
  const chineseRoute=raw.match(/(?:保存到|添加到|记到|到)(日历和钱包|钱包和日历|日历|钱包)$/);
  if(chineseRoute){destination=/和/.test(chineseRoute[1])?'both':chineseRoute[1]==='钱包'?'wallet':'main';raw=raw.slice(0,chineseRoute.index).trim();}
 }
 const route=locale==='zh'&&raw.match(/(?:^|[, ]+)(?:(?:запиши|записать|добавь|сохрани|save|record|înregistrează|inregistreaza|salvează|salveaza)\s+(?:это\s+|it\s+)?)?(?:в |to |in |în )?(календарь и (?:в )?кошелек|кошелек и (?:в )?календарь|calendar and wallet|calendar și portofel|calendar si portofel|оба|both|ambele|кошелек|wallet|portofel|календарь|calendar)$/i);
 if(route&&!/(?:^|\s)(?:не|not|nu)\s*$/.test(raw.slice(0,route.index))){destination=/оба|both|ambele| и | and | și | si /.test(route[1])?'both':/кошелек|wallet|portofel/.test(route[1])?'wallet':'main';raw=raw.slice(0,route.index).trim();}
 const next=draft?{...draft}:null;
 const dateError=date.invalid||date.dateKey>today||(!date.dateKey&&next?.dateKey>today);
 if(next&&date.dateKey&&!dateError){next.dateKey=date.dateKey;delete next.datePending;}
 const category=next&&raw.match(/^(?:категория|в категорию|на|category|on|categoria|pe)\s+(.+)$/i);
 let result;
 const categoryCommand=next?.item&&parseCalendarVoiceCommand(raw)?.type==='category';
 let natural=locale==='zh'||categoryCommand?null:parseNaturalVoiceEntry(raw,{draft:next,categories,newEntry:options.newEntry});
 // A bare category name answers the pending question, without repeating the amount.
 if(next?.pendingFields?.includes('category')&&(!natural||natural.invalid)&&!parseCalendarVoiceCommand(raw)&&/^[\p{L}][\p{L}\s'-]{0,59}$/u.test(raw)&&!/(?:^|\s)(?:что|почему|сколько|когда|как|открой|покажи|вернись|сохрани|what|why|how|when|show|open|save|ce|cât|cat|cum|deschide|salvează|salveaza)(?:\s|$)/iu.test(raw))natural=parseNaturalVoiceEntry(`${locale==='en'?'on':locale==='ro'?'pe':'на'} ${raw}`,{draft:next,categories});
 if(natural?.invalid)return {invalid:true};
 if(natural){
  const prepared={...next,...natural.patch};
  if(natural.shorthand&&!prepared.currency&&['RUB','EUR','MDL','USD','CNY'].includes(options.defaultCurrency))prepared.currency=options.defaultCurrency;
  if(natural.patch.category)prepared.categoryConfirmed=true;
  for(const field of natural.ambiguous)prepared[field]=undefined;
  if(natural.ambiguous.length){
   const field=['sign','amount','currency','category','destination'].find(value=>natural.ambiguous.includes(value));
   prepared.pendingFields=[...new Set([...(next?.pendingFields||[]),...natural.ambiguous])];
   result={draft:prepared,field,prompt:ambiguityPrompts[locale]?.[field]||ambiguityPrompts.ru[field]};
  }else{
   prepared.pendingFields=(prepared.pendingFields||[]).filter(field=>!natural.provided.includes(field));
   const dialog=voiceEntryDialog('',prepared,locale,categories,{...options,askDestination:false});
   result=dialog?{...dialog,context:prepared}:null;
  }
 }
 else if(category&&category[1].length<=60){next.category=category[1];next.categoryConfirmed=true;result=voiceEntryDialog('',next,locale,categories,{...options,askDestination:false});}
 else if(next&&!raw&&next.sign&&next.amount&&next.currency&&(!next.item||next.categoryConfirmed))result={command:{...next,type:'entry'}};
 else result=voiceEntryDialog(raw,next,locale,categories,{...options,askDestination:false});
 if(!result)return null;
 if(result.cancelled)return result;
 const entry={...next,...result.context,...(result.draft||result.command),dateKey:(!dateError&&date.dateKey)||next?.dateKey||today};
 if(destination)entry.destination=destination;
 if(result.command?.type!=='entry'&&!result.draft)return null;
 if(dateError)return {draft:{...entry,datePending:true},field:'date',prompt:date.invalid?labels.date:labels.future};
 if(entry.datePending)return {draft:entry,field:'date',prompt:labels.date};
 if(!entry.sign||!entry.amount||!entry.currency)return result.draft?{...result,draft:entry}:null;
 if(entry.destination&&entry.destination!=='main'&&!options.walletAvailable)return {draft:entry,field:'destination',prompt:labels.wallet};
 const pending=(entry.pendingFields||[]).filter(field=>!entry[field]);
 if(pending.length&&!result.field){const field=pending[0];return {draft:entry,field,prompt:ambiguityPrompts[locale]?.[field]||ambiguityPrompts.ru[field]};}
 const chosen=categories.find(item=>[item.value,item.label].some(name=>normalizeVoiceCategory(name)===normalizeVoiceCategory(entry.category)));
 if(chosen)entry.category=chosen.value;
 if(!entry.pendingFields?.includes('destination'))entry.destination=entry.destination||'main';
 if(result.field)return {...result,draft:entry};
 if(next&&!natural&&!date.dateKey&&!category&&!destination&&['amount','currency','sign','category','destination'].every(key=>(next[key]||'main')===(entry[key]||'main'))&&!/^(?:это )?(?:支出|收入|расход|доход|expense|income|cheltuiala|cheltuială|venit)$|^(?:是|对|好的|да|yes|da)$/i.test(raw))return {invalid:true};
 if(options.requireCategory&&!entry.category&&!entry.mutation){return {draft:{...entry,pendingFields:[...new Set([...(entry.pendingFields||[]),'category'])]},field:'category',prompt:{ru:entry.sign==='minus'?'На что потратили? Назовите категорию.':'Откуда доход? Назовите категорию.',en:entry.sign==='minus'?'What did you spend it on? Name a category.':'Where did the income come from? Name a category.',ro:entry.sign==='minus'?'Pe ce ai cheltuit? Spune categoria.':'De unde este venitul? Spune categoria.',zh:entry.sign==='minus'?'花在什么上？请说出类别。':'收入来自哪里？请说出类别。'}[locale]};}
 return {entry:{type:'entry',kind:'record',amount:entry.amount,currency:entry.currency,sign:entry.sign,dateKey:entry.dateKey,destination:entry.destination,...(entry.category?{category:entry.category}:{})}};
}

export function shortEntryAnswer(entry,locale='ru') {
 const kind=entry.sign==='minus';
 return locale === 'zh' ? `已记录${kind?'支出':'收入'} ${entry.amount} ${entry.currency}。` : (locale==='en'?`Recorded ${kind?'expense':'income'} ${entry.amount} ${entry.currency}.`:locale==='ro'?`Am înregistrat ${kind?'cheltuiala':'venitul'} ${entry.amount} ${entry.currency}.`:`Записал ${kind?'расход':'доход'} ${entry.amount} ${entry.currency}.`);
}
