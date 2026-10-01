import {parseSpokenAmount} from './spokenAmount.js';
const months=[
 ['январь','января','january','ianuarie'],['февраль','февраля','february','februarie'],['март','марта','march','martie'],
 ['апрель','апреля','april','aprilie'],['май','мая','may','mai'],['июнь','июня','june','iunie'],
 ['июль','июля','july','iulie'],['август','августа','august'],['сентябрь','сентября','september','septembrie'],
 ['октябрь','октября','october','octombrie'],['ноябрь','ноября','november','noiembrie'],['декабрь','декабря','december','decembrie'],
];
export function parseCalendarVoiceCommand(transcript){
 const text=String(transcript).toLowerCase().replace(/ё/g,'е').replace(/([\d])[,.](?=\d)/g,'$1DECIMAL').replace(/[,.!?]/g,' ').replace(/DECIMAL/g,',').replace(/\s+/g,' ').trim().replace(/^пожалуйста | пожалуйста$/g,'');
 const categoryCreate=text.match(/^(?:создай|создать|добавь|добавить) (?:новую |новый )?(?:категорию|раздел) (.+)$/);
 if(categoryCreate&&categoryCreate[1].length<=60)return {type:'category',name:categoryCreate[1].replace(/[«»"']/g,'').trim()};
 const categoryQuestion=text.replace(/^(?:скажи|расскажи) /,'').match(/^сколько (?:я )?(?:всего )?(?:потратил|потратила|потрачено)(?: (?:за|в) (?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?)? на (.+)$/);
 if(categoryQuestion){
  const category=categoryQuestion[1].replace(/ (?:за|в) (?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?$/,'').replace(/[«»"']/g,'').trim();
  if(category&&category.length<=60&&!/прошл|предыдущ|год|недел|вчера/.test(category))return {type:'question',metric:'expense',period:'current-month',category};
 }
 const categorized=text.match(/^(.+?) на (.+)$/);
 if(categorized&&!/^сколько/.test(text)){
  const base=parseCalendarVoiceCommand(categorized[1]);
  const category=categorized[2].replace(/[«»"']/g,'').trim();
  if(base?.type==='entry'&&category&&category.length<=60)return {...base,category};
  // Also accept “я потратил на сигареты двадцать евро”. Try each suffix
  // as an amount; the conservative amount parser rejects category words.
  const words=categorized[2].split(' ');
  for(let i=1;i<words.length;i++){
   const entry=parseCalendarVoiceCommand(`${categorized[1]} ${words.slice(i).join(' ')}`);
   const name=words.slice(0,i).join(' ');
   if(entry?.type==='entry'&&name.length<=60)return {...entry,category:name};
  }
 }
 if(/^(?:войди|зайди|перейди|открой)(?: в)? (?:мой )?кошелек$|^open (?:my )?wallet$|^deschide portofelul$/.test(text))return {type:'wallet'};
 const pro=text.match(/^(включи|включить|выключи|выключить|отключи|отключить) (?:режим )?(?:про|pro)$/);
 if(pro)return {type:'pro',enabled:/^включ/.test(pro[1])};
 if(/^(?:turn|switch) (on|off) pro(?: mode)?$/.test(text))return {type:'pro',enabled:/ on /.test(text)};
 if(/^(?:перемотай|перелистни|переключи|листай|перейди)(?: (?:на|в))? (?:следующий месяц|вперед)$|^следующий месяц$|^next month$/.test(text))return {type:'month',direction:1};
 if(/^(?:перемотай|перелистни|переключи|листай|перейди)(?: (?:на|в))? (?:предыдущий месяц|прошлый месяц|назад)$|^предыдущий месяц$|^previous month$/.test(text))return {type:'month',direction:-1};
 // Flexible Russian word order, but exactly one amount/currency and a clear intent.
 if(/(?:рубль|рубля|рублей|евро|лей|лея|леев|доллар|доллара|долларов)/.test(text) && /(?:потратил|потратила|расход|получил|получила|заработал|заработала|доход)/.test(text)){
  const stripped=text.replace(/в календарь|в календаре/g,' ').split(' ').filter(word=>!['добавь','добавить','запиши','записать','я','сегодня','потратил','потратила','получил','получила','заработал','заработала','расход','доход','запись'].includes(word)).join(' ').trim();
  const amountMatch=stripped.match(/^(.+?) (рубль|рубля|рублей|евро|лей|лея|леев|доллар|доллара|долларов)$/);
  if(amountMatch){const amount=parseSpokenAmount(amountMatch[1]);if(amount!==null&&Number(amount)>0){const expense=/потратил|потратила|расход/.test(text),income=/получил|получила|заработал|заработала|доход/.test(text);if(expense!==income)return {type:'entry',kind:'record',amount,currency:/^руб/.test(amountMatch[2])?'RUB':amountMatch[2]==='евро'?'EUR':/^ле/.test(amountMatch[2])?'MDL':'USD',sign:expense?'minus':'plus'};}}
 }
 const question=text.replace(/^(расскажи[,]? |скажи[,]? |tell me |spune-mi )/,'');
 // Optional pronouns/month qualifiers should not change a read-only question.
 const monthly=question.match(/^(.*?) (?:за|в) (?:(?:этот|этом|текущий|текущем) )?месяц(?:е)?$/);
 if(monthly){
  const intent=monthly[1];
  if(/^(?:сколько (?:я )?(?:заработал|заработала|получил|получила)|(?:какие|сколько) (?:у меня )?(?:мои )?доходы)$/.test(intent))return {type:'question',metric:'income',period:'current-month'};
  if(/^(?:сколько (?:я )?(?:потратил|потратила|потрачено)|(?:какие|сколько) (?:у меня )?(?:мои )?расходы)$/.test(intent))return {type:'question',metric:'expense',period:'current-month'};
  if(/^(?:подведи (?:итог|итоги)|(?:какой|какие) (?:итог|итоги)|итог|итоги|покажи итог|расскажи итог)$/.test(intent))return {type:'question',metric:'summary',period:'current-month'};
 }
 const questions={expense:/^(?:сколько (?:я )?(?:потратил|потратила)|какие (?:мои )?расходы) (?:за |в )?(?:этом|этот|текущий) месяц(?:е)?$|^how much (?:did i spend|have i spent) this month$|^cât am cheltuit luna aceasta$/,income:/^сколько (?:я )?(?:заработал|заработала|получил|получила) (?:за |в )?(?:этом|этот|текущий) месяц(?:е)?$|^how much (?:did i earn|have i earned) this month$|^cât am câștigat luna aceasta$/,summary:/^(?:какой итог|подведи итог|итоги|итог) (?:за |в )?(?:этом|этот|текущий) месяц(?:е)?$|^(?:summarize|summary for) this month$|^rezumat pentru luna aceasta$/};
 for(const [metric,pattern] of Object.entries(questions))if(pattern.test(question))return {type:'question',metric,period:'current-month'};
 const money=text.match(/^(?:сегодня )?(?:я )?(потратил|потратила|получил|получила|заработал|заработала) (.+) (рубль|рубля|рублей|евро|лей|лея|леев|доллар|доллара|долларов)$/)
  ||text.match(/^(?:today )?i (spent|received|earned) (.+) (rubles?|euros?|lei|dollars?)$/)
  ||text.match(/^(?:astăzi )?am (cheltuit|primit|câștigat) (.+) (ruble|euro|lei|dolari)$/);
 if(money){
  const amount=parseSpokenAmount(money[2]);
  if(amount===null||Number(amount)<=0)return null;
  const currency=/^(руб|rubl)/.test(money[3])?'RUB':/^(евро|euro)/.test(money[3])?'EUR':/^(лей|лея|леев|lei)$/.test(money[3])?'MDL':'USD';
  return {type:'entry',kind:'record',amount,currency,sign:/^(потрат|spent|cheltuit)/.test(money[1])?'minus':'plus'};
 }
 if(/^(добавь|добавить|создай) (новую )?(запись|сделку)$/.test(text))return {type:'add',kind:text.endsWith('сделку')?'trade':'record'};
 if(/^(add|create) (a |new )?(record|entry|trade)$/.test(text))return {type:'add',kind:text.endsWith('trade')?'trade':'record'};
 if(/^adaugă (o )?(înregistrare|tranzacție)$/.test(text))return {type:'add',kind:text.endsWith('tranzacție')?'trade':'record'};
 const date=text.replace(/^(открой|открыть|покажи|включи|перейди на|open|show|go to|deschide|arată)\s+/,'');
 if(date===text)return null;
 const match=date.match(new RegExp(`^(.+?)\\s+(${months.flat().join('|')})\\s+(.+)$`));
 if(!match)return null;
 const day=Number(parseSpokenAmount(match[1])),year=Number(parseSpokenAmount(match[3]));
 if(!Number.isInteger(day)||day<1||day>31||!Number.isInteger(year)||year<1900||year>9999)return null;
 const month=months.findIndex(names=>names.includes(match[2]));
 const checked=new Date(year,month,day);
 if(checked.getFullYear()!==year||checked.getMonth()!==month||checked.getDate()!==day)return null;
 return {type:'date',year,month,day,dateKey:`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`};
}
