import {normalizeProductText} from './productCatalog.js';

const months=[
  ['jan','january','ian','ianuarie','янв','января','січ','січня'],
  ['feb','february','februarie','фев','февраля','лют','лютого'],
  ['mar','march','martie','мар','марта','бер','березня'],
  ['apr','april','aprilie','апр','апреля','кві','квітня'],
  ['may','mai','мая','трав','травня'],
  ['jun','june','iun','iunie','июн','июня','чер','червня'],
  ['jul','july','iul','iulie','июл','июля','лип','липня'],
  ['aug','august','авг','августа','сер','серпня'],
  ['sep','sept','september','septembrie','сен','сент','сентября','вер','вересня'],
  ['oct','october','octombrie','окт','октября','жов','жовтня'],
  ['nov','november','noiembrie','ноя','ноября','лис','листопада'],
  ['dec','december','decembrie','дек','декабря','гру','грудня'],
];
const monthIndex=new Map(months.flatMap((names,index)=>names.map(name=>[name,index+1])));
const monthPattern=[...monthIndex.keys()].sort((a,b)=>b.length-a.length).join('|');
const state='AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC';
const usAddress=new RegExp(`\\b(?:${state})[.,]?\\s+\\d{5}(?:-\\d{4})?\\b`,'iu');
const notTransactionDate=/\b(?:expires?|expiry|expiration|valid\s+(?:until|through)|sweepstakes|promotion\s+ends?|starting|offer\s+ends?|copyright|birth(?:day)?|best\s+before|use\s+by)\b|срок\s+годности|действител\w*\s+до|термін\s+придатності|valabil\w*\s+pana/iu;

function isoDate(year,month,day){
  year=Number(year);month=Number(month);day=Number(day);
  if(year<100)year+=year>=70?1900:2000;
  if(year<1900||year>2099||month<1||month>12||day<1||day>31)return '';
  const parsed=new Date(Date.UTC(year,month-1,day));
  if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()+1!==month||parsed.getUTCDate()!==day)return '';
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

// A language is not a date format. Use an explicit country cue, or keep a
// numerically ambiguous date empty instead of quietly swapping month and day.
export function extractReceiptDate(value){
  const text=String(value||'').split(/\r?\n/).map(normalizeProductText).join('\n');
  const us=usAddress.test(text)||/\b(?:united\s+states|usa|u\.s\.a\.?)\b/iu.test(text);
  const dayFirst=/\b(?:mdl|idno|moldova|romania|ron|uah|ukraine|united\s+kingdom|gbp)\b|\bvat\s*[:#]?\s*gb\b|\b(?:инн|єдрпоу|пдв)\b/iu.test(text);
  const format=us&&!dayFirst?'mdy':dayFirst&&!us?'dmy':'';
  const dates=new Set();let ambiguous=false;
  for(const line of text.split(/\r?\n/)){
    if(notTransactionDate.test(line))continue;
    for(const match of line.matchAll(/\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?!\d)|\b(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?![\d:])/gu)){
      if(match[1]){const key=isoDate(match[1],match[2],match[3]);if(key)dates.add(key);continue;}
      const first=Number(match[4]),second=Number(match[5]),year=match[6];
      const dmy=isoDate(year,second,first),mdy=isoDate(year,first,second);
      if(dmy&&mdy&&dmy!==mdy){
        if(format)dates.add(format==='mdy'?mdy:dmy);else ambiguous=true;
      }else if(dmy||mdy)dates.add(dmy||mdy);
    }
    const dayMonth=new RegExp(`(?<![\\p{L}\\p{N}])(\\d{1,2})[\\s./'-]*(${monthPattern})[\\s,./'-]*(\\d{4}|\\d{2})(?!\\d|[:/.-]\\d)`,'giu');
    const monthDay=new RegExp(`(?<![\\p{L}\\p{N}])(${monthPattern})[\\s.']*(\\d{1,2})(?:st|nd|rd|th)?[\\s,./'-]+(\\d{4}|\\d{2})(?!\\d|[:/.-]\\d)`,'giu');
    for(const match of line.matchAll(dayMonth)){const key=isoDate(match[3],monthIndex.get(match[2]),match[1]);if(key)dates.add(key);}
    for(const match of line.matchAll(monthDay)){const key=isoDate(match[3],monthIndex.get(match[1]),match[2]);if(key)dates.add(key);}
    const clockBetween=new RegExp(`(?<![\\p{L}\\p{N}])(${monthPattern})\\s+(\\d{1,2})\\s+\\d{1,2}:\\d{2}(?::\\d{2})?\\s+(\\d{4})(?!\\d)`,'giu');
    for(const match of line.matchAll(clockBetween)){const key=isoDate(match[3],monthIndex.get(match[1]),match[2]);if(key)dates.add(key);}
  }
  return !ambiguous&&dates.size===1?[...dates][0]:'';
}
