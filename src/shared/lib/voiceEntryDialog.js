import {normalizeVoiceCategory} from './voiceCategory.js';
import {parseCalendarVoiceCommand} from './calendarVoiceCommand.js';
import {parseSpokenAmount} from './spokenAmount.js';
import {chineseEntryDialog} from './chineseEntryDialog.js';
export function voiceEntryDialog(phrase,draft=null,locale='ru',categories=[],options={}){
 if(String(locale).startsWith('zh'))return chineseEntryDialog(phrase,draft,categories,options);
 const raw=String(phrase).toLowerCase().replace(/ё/g,'е').replace(/[.!?]$/,'').replace(/\s+/g,' ').trim();
 const destination=/(?:календарь и (?:в )?кошелек|кошелек и (?:в )?календарь|оба|both|ambele)/.test(raw)?'both':/(?:в кошелек|^кошелек$|wallet)/.test(raw)?'wallet':/(?:в календарь|^календарь$|calendar)/.test(raw)?'main':null;
 const text=raw.replace(/^(?:(?:я|сегодня|например|ну) )+/,'').replace(/[, ]+(?:записать|запиши|добавить|добавь)(?: это)? (?:в календарь и кошелек|в кошелек|в календарь)$/,'').trim();
 if(/^(отмена|отмени|не надо|cancel|stop|anuleaza|anulează)$/.test(text))return draft?{cancelled:true}:null;
 const purchase=!/вчера|завтра|yesterday|tomorrow/.test(text)&&text.match(/^(?:(?:сегодня|я|запиши) )*купил[а]? (.+?)(?: за (.+))?$/);
 const full=parseCalendarVoiceCommand(text);
 const categoryReply=draft?.item&&draft.amount&&draft.currency&&full?.type==='category';
 if(full?.type==='entry'&&!draft?.item&&!options.askDestination)return {command:full};
 if(!draft&&!purchase&&full?.type!=='entry'&&!/^(?:запиши|добавь|я потратил|потратил|потратила|расход|доход|получил|получила|заработал|заработала|record|add|i spent|spent|received|earned|am cheltuit|cheltuit|am primit|am câștigat|am castigat|primit|câștigat|castigat|adauga|adaugă)\b/u.test(text)&&! /^(?:запиши|добавь|потратил|потратила|расход|доход|получил|получила|заработал|заработала|am cheltuit|am primit|am câștigat|am castigat|adaugă)(?: |$)/.test(text))return null;
 // Navigation and complete questions keep their existing behavior.
 if(!draft&&full&&full.type!=='entry')return null;
 const next={...draft,...(full?.type==='entry'?full:{})};
 if(categoryReply){next.category=full.name;next.categoryConfirmed=true;}
 if(!/^(?:не |not |nu )/.test(raw)&&destination&&(destination==='main'||options.walletAvailable))next.destination=destination;
 if(options.askDestination&&draft?.amount&&draft?.currency&&/^(да|yes|da)$/.test(text)&&!options.walletAvailable)next.destination='main';
 if(!next.currency&&draft?.suggestedCurrency&&/^(да|ага|верно|правильно|yes|correct|da)$/.test(text))next.currency=draft.suggestedCurrency;
 if(purchase){next.item=purchase[1].trim();next.sign='minus';}
 if(draft?.item){const chosen=categories.find(item=>[item.value,item.label].some(name=>normalizeVoiceCategory(name)===normalizeVoiceCategory(text.replace(/^(?:в категорию |в |категория |in |category |categoria )/,''))));if(chosen){next.category=chosen.value;next.categoryConfirmed=true;}else if(/^(новую|новая категория|создай новую|отдельную|new category|categorie noua|categorie nouă)$/.test(text)){next.category=next.item;next.categoryConfirmed=true;}}
 if(/потрат|расход|spent|expense|cheltuit|cheltuial/.test(text))next.sign='minus';
 if(/получ|заработ|доход|received|earned|income|primit|venit|castig|câștig/.test(text))next.sign='plus';
 const currency=text.match(/руб\w*|руб[а-я]*|ruble?s?|rub|евро|euros?|eur|ле[йя]|леев|lei|leu|mdl|доллар[а-я]*|dollars?|usd/iu);
 if(currency)next.currency=/руб|rub/i.test(currency[0])?'RUB':/евро|eur/i.test(currency[0])?'EUR':/ле|lei|leu|mdl/i.test(currency[0])?'MDL':'USD';
 const category=text.match(/(?: на | on | pe )(.+)$/);if(category&&category[1].length<=60)next.category=category[1];
 let amountText=(purchase?(purchase[2]||''):text).replace(/(?: на | on | pe ).+$/,'').replace(/^(?:нет[, ]+|no[, ]+|nu[, ]+)?(?:сумма |amount |suma )?/,'');
 amountText=amountText.replace(/^(?:(?:запиши|добавь|запись|я|сегодня|потратил|потратила|расход|доход|получил|получила|заработал|заработала|record|add|i|today|spent|received|earned|am|cheltuit|primit|câștigat|castigat|adauga|adaugă)\s*)+/,'');
 amountText=amountText.replace(/\s+(?:руб[а-я]*|rubles?|rub|евро|euros?|eur|ле[йя]|леев|lei|leu|mdl|доллар[а-я]*|dollars?|usd)$/i,'');
 const amount=parseSpokenAmount(amountText);if(amount!==null&&Number(amount)>0)next.amount=amount;
 const field=!next.sign?'sign':!next.amount?'amount':!next.currency?'currency':next.item&&!next.categoryConfirmed?'category':options.askDestination&&!next.destination?'destination':null;
 if(!field)return {command:{type:'entry',kind:'record',amount:next.amount,currency:next.currency,sign:next.sign,...(next.category?{category:next.category}:{}),...(next.destination?{destination:next.destination}:{})}};
 const questions={
  zh: {sign:"这是支出还是收入？",amount:"记录多少金额？",currency:"使用哪种货币：人民币、卢布、欧元、列伊还是美元？"},ru:{sign:'Это расход или доход?',amount:'Какую сумму записать?',currency:'В какой валюте: рубли, евро, леи или доллары?'},en:{sign:'Is this an expense or income?',amount:'What amount should I record?',currency:'Which currency: rubles, euros, lei or dollars?'},ro:{sign:'Este o cheltuială sau un venit?',amount:'Ce sumă să înregistrez?',currency:'În ce monedă: ruble, euro, lei sau dolari?'}};
 if(field==='currency'){next.suggestedCurrency=['RUB','EUR','MDL','USD'].includes(options.defaultCurrency)?options.defaultCurrency:'USD';if(options.defaultCurrency){const name={RUB:'рублях',EUR:'евро',MDL:'леях',USD:'долларах'}[next.suggestedCurrency];return {draft:next,field,prompt:locale === 'zh' ? `使用 ${next.suggestedCurrency} 记录？请说“是”或指定其他货币。` : (locale==='ru'?`Записать сумму в ${name}? Ответьте «да» или назовите другую валюту.`:locale==='en'?`Record in ${next.suggestedCurrency}? Say yes or another currency.`:`Înregistrăm în ${next.suggestedCurrency}? Spune da sau altă monedă.`)};}}
 if(field==='destination')return {draft:next,field,prompt:locale === 'zh' ? options.walletAvailable?"添加到日历、钱包，还是两者？":"添加到日历？请说“是”。" : (locale==='ru'?(options.walletAvailable?'Куда добавить: в календарь, кошелёк или в оба?':'Добавить в календарь? Ответьте «да».'):locale==='en'?(options.walletAvailable?'Calendar, wallet or both?':'Add to the calendar? Say yes.'):(options.walletAvailable?'În calendar, portofel sau ambele?':'Adăugăm în calendar? Spune da.'))};
 return {draft:next,field,prompt:field==='category'?({
  zh: `将“${next.item}”归入哪个类别？选择已有类别或创建新类别。`,ru:`В какую категорию отнести покупку «${next.item}»? Выберите существующую или создайте отдельную.`,en:`Which category should contain ${next.item}? Choose an existing one or create a separate category.`,ro:`În ce categorie includem ${next.item}? Alege una existentă sau creează una separată.`}[locale]):questions[locale][field]};
}
