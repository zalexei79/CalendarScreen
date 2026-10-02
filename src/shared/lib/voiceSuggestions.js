import {voiceHelp} from './voiceHelp.js';
import {parseNaturalVoiceEntry,resolveVoiceCorrections} from './naturalVoiceEntry.js';
import {extractEntryDate} from './voiceEntryReview.js';
import {normalizeVoiceCategory} from './voiceCategory.js';

const copy={
 ru:{title:'Можно продолжить',empty:'Продолжайте фразу — подходящих подсказок пока нет.',amount:'[сумма]',currency:'[валюта]',category:'на [категория]',date:'вчера / сегодня',route:'в календарь',wallet:'в кошелёк / в оба',review:'После паузы проверьте запись',corrections:['потратил на [категория]','нет, [сумма]','сохрани / отмена']},
 en:{title:'You can continue with',empty:'Keep speaking — no matching hints yet.',amount:'[amount]',currency:'[currency]',category:'on [category]',date:'yesterday / today',route:'to calendar',wallet:'to wallet / both',review:'Pause, then review the entry',corrections:['spent on [category]','no, [amount]','save / cancel']},
 ro:{title:'Poți continua cu',empty:'Continuă fraza — încă nu sunt sugestii potrivite.',amount:'[sumă]',currency:'[monedă]',category:'pe [categorie]',date:'ieri / astăzi',route:'în calendar',wallet:'în portofel / ambele',review:'După pauză, verifică înregistrarea',corrections:['cheltuit pe [categorie]','nu, [sumă]','salvează / anulează']},
 zh:{title:'可以继续说',empty:'请继续说，暂时没有匹配的提示。',amount:'[金额]',currency:'[货币]',category:'用于[类别]',date:'昨天 / 今天',route:'到日历',wallet:'到钱包 / 两者',review:'暂停后核对记录',corrections:['用于[类别]','不，[金额]','保存 / 取消']},
};
const normalize=value=>normalizeVoiceCategory(value).replace(/[.,!?«»]/g,'').trim();
const nav=value=>normalize(value).replace(/^(?:зайди|войди|покажи|открой)/,'открой');
export function voiceSuggestions(locale,traderMode,{phrase='',draft=null,review=false,categories=[],walletAvailable=false}={}){
 const help=voiceHelp(locale,traderMode),c=copy[locale]||copy.ru;
 const text=resolveVoiceCorrections(phrase).text;
 if(!text)return review?{filtered:true,title:c.title,phrases:c.corrections}:{...help,filtered:false};
 const isQuestion=/(?:^|\s)(?:сколько|итог|подведи|how|summarize|cât|cat|rezumat)(?:\s|$)|花了多少|收入多少|总结/.test(text);
 const isNavigation=/(?:^|\s)(?:открой|зайди|войди|покажи|вернись|включи|выключи|следующий|предыдущий|open|next|previous|enable|switch|deschide|activează)(?:\s|$)|打开|开启|关闭|下个月|上个月/.test(text);
 const date=extractEntryDate(text),natural=parseNaturalVoiceEntry(date.text,{draft,categories});
 const parsed=natural&&!natural.invalid?natural.patch:{};
 // A partial phrase can contain unfinished words. A recognized money verb
 // still selects entry hints, without treating the unfinished text as a command.
 const verb=text.split(/\s+/).map(word=>parseNaturalVoiceEntry(word)).find(result=>result?.patch?.sign)?.patch;
 const money=!isQuestion&&!isNavigation&&(draft||parsed?.sign||parsed?.amount||parsed?.currency||verb||/支出|收入|花了|花费/.test(text));
 if(money){
  const slots={...draft,...parsed},phrases=[];
  if(!slots.amount)phrases.push(c.amount+(slots.currency?'':` ${c.currency}`));
  else if(!slots.currency)phrases.push(c.currency);
  if(!slots.category||review&&!parsed.category)phrases.push(c.category);
  if(!date.dateKey&&!draft?.dateKey)phrases.push(c.date);
  if(!parsed.destination&&!draft?.destination)phrases.push(c.route+(walletAvailable?` / ${c.wallet}`:''));
  if(review)phrases.push(c.corrections[1],c.corrections[2]);
  if(!phrases.length)phrases.push(c.review);
  return {filtered:true,title:c.title,phrases};
 }
 const words=nav(text).split(/\s+/).filter(word=>!['я','i','am','пожалуйста','please'].includes(word));
 const phrases=help.groups.flatMap(group=>group.phrases).filter(phrase=>words.every(word=>nav(phrase).includes(word)));
 return {filtered:true,title:c.title,phrases,empty:c.empty};
}
