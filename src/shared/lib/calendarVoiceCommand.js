import {parseSpokenAmount} from './spokenAmount.js';
const months=[
 ['январь','января','january','ianuarie'],['февраль','февраля','february','februarie'],['март','марта','march','martie'],
 ['апрель','апреля','april','aprilie'],['май','мая','may','mai'],['июнь','июня','june','iunie'],
 ['июль','июля','july','iulie'],['август','августа','august'],['сентябрь','сентября','september','septembrie'],
 ['октябрь','октября','october','octombrie'],['ноябрь','ноября','november','noiembrie'],['декабрь','декабря','december','decembrie'],
];
export function parseCalendarVoiceCommand(transcript){
 const text=String(transcript).toLowerCase().trim().replace(/[.!?]$/,'').replace(/ё/g,'е');
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
