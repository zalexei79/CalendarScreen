import {parseCalendarVoiceCommand} from './calendarVoiceCommand.js';
import {parseSpokenAmount} from './spokenAmount.js';
export function voiceEntryDialog(phrase,draft=null,locale='ru'){
 const text=String(phrase).toLowerCase().replace(/[.!?]$/,'').trim();
 if(/^(отмена|отмени|не надо|cancel|stop|anuleaza|anulează)$/.test(text))return draft?{cancelled:true}:null;
 const full=parseCalendarVoiceCommand(text);
 if(full?.type==='entry')return {command:full};
 if(!draft&&!/^(?:запиши|добавь|я потратил|потратил|потратила|расход|доход|получил|получила|заработал|заработала|record|add|i spent|spent|received|earned|am cheltuit|cheltuit|am primit|am câștigat|am castigat|primit|câștigat|castigat|adauga|adaugă)\b/u.test(text)&&! /^(?:запиши|добавь|потратил|потратила|расход|доход|получил|получила|заработал|заработала|am cheltuit|am primit|am câștigat|am castigat|adaugă)(?: |$)/.test(text))return null;
 // Navigation and complete questions keep their existing behavior.
 if(!draft&&full)return null;
 const next={...draft};
 if(/потрат|расход|spent|expense|cheltuit|cheltuial/.test(text))next.sign='minus';
 if(/получ|заработ|доход|received|earned|income|primit|venit|castig|câștig/.test(text))next.sign='plus';
 const currency=text.match(/руб\w*|руб[а-я]*|ruble?s?|rub|евро|euros?|eur|ле[йя]|леев|lei|leu|mdl|доллар[а-я]*|dollars?|usd/iu);
 if(currency)next.currency=/руб|rub/i.test(currency[0])?'RUB':/евро|eur/i.test(currency[0])?'EUR':/ле|lei|leu|mdl/i.test(currency[0])?'MDL':'USD';
 const category=text.match(/(?: на | on | pe )(.+)$/);if(category&&category[1].length<=60)next.category=category[1];
 let amountText=text.replace(/(?: на | on | pe ).+$/,'').replace(/^(?:нет[, ]+|no[, ]+|nu[, ]+)?(?:сумма |amount |suma )?/,'');
 amountText=amountText.replace(/^(?:(?:запиши|добавь|запись|я|сегодня|потратил|потратила|расход|доход|получил|получила|заработал|заработала|record|add|i|today|spent|received|earned|am|cheltuit|primit|câștigat|castigat|adauga|adaugă)\s*)+/,'');
 amountText=amountText.replace(/\s+(?:руб[а-я]*|rubles?|rub|евро|euros?|eur|ле[йя]|леев|lei|leu|mdl|доллар[а-я]*|dollars?|usd)$/i,'');
 const amount=parseSpokenAmount(amountText);if(amount!==null&&Number(amount)>0)next.amount=amount;
 const field=!next.sign?'sign':!next.amount?'amount':!next.currency?'currency':null;
 if(!field)return {command:{type:'entry',kind:'record',...next}};
 const questions={ru:{sign:'Это расход или доход?',amount:'Какую сумму записать?',currency:'В какой валюте: рубли, евро, леи или доллары?'},en:{sign:'Is this an expense or income?',amount:'What amount should I record?',currency:'Which currency: rubles, euros, lei or dollars?'},ro:{sign:'Este o cheltuială sau un venit?',amount:'Ce sumă să înregistrez?',currency:'În ce monedă: ruble, euro, lei sau dolari?'}};
 return {draft:next,field,prompt:questions[locale][field]};
}
