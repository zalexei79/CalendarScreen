import {parseChineseAmount} from './chineseNumber.js';
import {chineseCurrency,parseChineseVoiceCommand} from './chineseVoiceCommand.js';

export function chineseEntryDialog(phrase,draft,categories,options) {
  const text=String(phrase).replace(/\s+/g,'').replace(/[，。！？!?]$/,'');
  if(/^(?:取消|停止|不用了)$/.test(text))return draft?{cancelled:true}:null;
  const full=parseChineseVoiceCommand(text);
  if(!draft && full && full.type!=='entry')return null;
  if(!draft && !full && !/^(?:记录|添加|我|今天)?(?:支出|收入|花了|花费|收到|赚了|买了)/.test(text))return null;
  const next={...draft,...(full?.type==='entry'?full:{})};
  if(/支出|花了|花费|买了/.test(text)&&/收入|收到|赚了/.test(text))return null;
  if(/^(?:记录|添加|我|今天)?(?:支出|花了|花费|买了)/.test(text))next.sign='minus';
  if(/^(?:记录|添加|我|今天)?(?:收入|收到|赚了)/.test(text))next.sign='plus';
  const purchase=text.match(/^买了(.+?)(?:花了|花费|共|要)(.+)$/);
  if(purchase){next.item=purchase[1];next.sign='minus';}
  const currency=chineseCurrency(text);if(currency)next.currency=currency;
  if(draft?.suggestedCurrency&&/^(?:是|对|好的|可以)$/.test(text))next.currency=draft.suggestedCurrency;
  const amountText=(purchase?purchase[2]:text).replace(/^(?:不对[,，]?|不是[,，]?|不[,，]?)?/,'').replace(/^(?:记录|添加|我|今天)?(?:金额|支出|收入|花了|花费|收到|赚了)?/,'').replace(/(?:用于|在|买).+$/,'').replace(/(?:人民币|美元|美金|欧元|卢布|列伊|CNY|USD|EUR|RUB|MDL)$/i,'');
  const amount=parseChineseAmount(amountText);if(amount!==null&&Number(amount)>0)next.amount=amount;
  const category=text.match(/^(?:类别|用于)(.+)$/);
  const chosen=categories.find(c=>[c.value,c.label].includes(category?.[1]||text));
  if(chosen){next.category=chosen.value;next.categoryConfirmed=true;}
  else if(category && category[1].length<=60){next.category=category[1];next.categoryConfirmed=true;}
  if(next.item && full?.type==='category'){next.category=full.name;next.categoryConfirmed=true;}
  if(/^(?:日历和钱包|两者|都要)$/.test(text)&&options.walletAvailable)next.destination='both';
  if(/^(?:保存到|添加到)?钱包$/.test(text)&&options.walletAvailable)next.destination='wallet';
  if(/^(?:保存到|添加到)?日历$/.test(text))next.destination='main';
  const field=!next.sign?'sign':!next.amount?'amount':!next.currency?'currency':next.item&&!next.categoryConfirmed?'category':options.askDestination&&!next.destination?'destination':null;
  if(!field)return {command:{type:'entry',kind:'record',amount:next.amount,currency:next.currency,sign:next.sign,...(next.category?{category:next.category}:{}),...(next.destination?{destination:next.destination}:{})}};
  const prompts={sign:'这是支出还是收入？',amount:'记录多少金额？',currency:'使用哪种货币：人民币、美元、欧元、卢布还是列伊？',category:`将“${next.item}”归入哪个类别？请选择已有类别或创建新类别。`,destination:options.walletAvailable?'保存到日历、钱包，还是两者？':'添加到日历？请说“日历”。'};
  if(field==='currency'&&options.defaultCurrency){next.suggestedCurrency=options.defaultCurrency;prompts.currency=`使用 ${options.defaultCurrency} 记录？请说“是”或指定其他货币。`;}
  return {draft:next,field,prompt:prompts[field]};
}
