import {normalizeProductText} from './productCatalog.js';
import {receiptMetadataLine,receiptNonItemLine,receiptTotalAnchor} from './receiptStructure.js';

const address=/^str\.\s*\p{L}|^(?:strada|улица|вулиця|rue|rua)\s|^(?:ул\.|вул\.)\s*\p{L}|^\d+[\w/-]*\s+.*\p{L}|^[a-z]-\d+\b|\b(?:street|st\.?|avenue|ave\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|highway|hwy|turnpike|tpke|parkway|pkwy|rue|strada|str\.|улица|ул\.|вул\.|шоссе|площадь)\s*(?:\d|$)|\b[a-z]{2}[.,]?\s+\d{5}(?:-\d{4})?\b|(?:,|-)\s*\d{5,6}\b|^via\b.*[-,]|^[\p{L}\s'-]+,\s*(?:hawaii|california|texas|florida|new\s+york|new\s+jersey|oregon|georgia|usa|italy|france|moldova)\s*$/iu;
const contact=/https?:|www\.|\S+@\S+|^@|\b(?:tel(?:ephone|efon)?|phone|fax|email|web(?:site)?)\s*[:.(]|^[\s()+\d.-]{7,}$/iu;
const metadata=/^(?:receipt|invoice|tax\s+invoice|bill|bon\s+fiscal|кассовый\s+чек|чек|your\s+guest|guest\s+number|guest|check|order|ticket|table|bar\s+tab|seat|server|served\s+by|cashier|station|terminal|employee|manager|reg(?:ister)?|store\s*(?:no|number|#)|date|time|host|trans(?:action|\s+type|\s+key)?|auth|approval|acct|account|card|vat|gst|tin|idno|inr|dine\s+in|take\s+out|to\s+go|counter|name\s*:|no\s+signature|customer\s+copy|(?:\S+\s+)?demo\s+system)(?=$|[\s:#№.\d])/iu;
const promotion=/^(?:for\s+a\s+chance|see\s+back|survey|follow\s+us|please\b|thank\b|thanks\b|come\s+back|how\s+was|help\b|resources\b|record\b|if\s+you|no\s+purchase|sweepstakes|we\s+(?:have|take)|it's\s+been|it\s+has\s+been|excellence\s+served|no\s+returns|gratuity\b|suggested\b|tip\b|minimum\s+credit|don't\s+throw|dont\s+throw|log\s+online|download\b|mobile\s+ordering|diganos\b)/iu;
const legal=/\b(?:s\.?r\.?l\.?|s\.?a\.?|ltd\.?|llc|inc\.?|sdn\s+bhd|ооо|ип)\b/iu;
const business=/\b(?:restaurant|restau|cafe|coffee|market|grill|tavern|diner|bakery|pizzeria|pizza|food|burger|sushi|steak|bar|taco|ristorante|buffet|seafood|kitchen)\b/iu;
const generic=new Set('the and e of restaurant restaurants restau ristorante bar cafe coffee food french seafood kitchen indian mexican japanese chinese family famlily style wine bakery grill pub steakhouse & stabilimento marino termale inc ltd llc srl'.split(' '));
const fold=value=>normalizeProductText(value).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const descriptors=value=>{
  let words=fold(value).split(/\s+/).filter(Boolean);
  if(words.length>3&&words.every(word=>word.length===1))words=[words.join('')];
  return words.length>0&&(words.every(word=>generic.has(word))||words.includes('style')&&words.includes('restaurant')&&words.filter(word=>!generic.has(word)).length<=1);
};
const clean=value=>{let text=String(value||'').replace(/^[\s*#|—–-]+|[\s|]+$/gu,'').trim();if(text.startsWith('(')&&text.endsWith(')'))text=text.slice(1,-1);return text.replace(/^welcome\s+to\s+/iu,'').replace(/\s+/g,' ').trim();};
const hasPrice=value=>/(?:[€$£₽¥₴]\s*)?\d+(?:[.,]\d{3})*[.,]\d{2}\s*(?:[A-ZА-Я])?\s*$/u.test(value);

// Rank only plausible header text. A legal suffix in a footer, a street address,
// or a promotion is not enough evidence to claim the name of a business.
export function extractReceiptMerchant(value,{blocks=[],items=[],totalLayout=false}={}){
  const lines=String(value||'').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!/^\d{1,2}:\d{2}\s+(?:LTE|[45]G|Wi-?Fi)\b/iu.test(line));
  const body=lines.findIndex(line=>receiptTotalAnchor(line)||receiptNonItemLine(line)||hasPrice(line)||/\b(?:qty|quantity|cantitate|количество)\b.*\b(?:price|total|amount|pret|цена)\b/iu.test(line));
  const end=Math.min(body<0?lines.length:body,24);
  const layout=blocks.flatMap(block=>(block.paragraphs||[]).flatMap(paragraph=>paragraph.lines||[]));
  const maxY=Math.max(0,...layout.map(line=>line.bbox?.y1||0)),minY=Math.min(Infinity,...layout.filter(line=>line.bbox).map(line=>line.bbox.y0));
  const ranked=[];
  for(let index=0;index<end;index++){
    const original=lines[index],name=clean(original),normalized=fold(name),letters=name.match(/\p{L}/gu)||[];
    if(letters.length<3||letters.length/Math.max(1,name.length)<.45||address.test(name)||contact.test(name)||metadata.test(name)||promotion.test(name)||receiptMetadataLine(name)||receiptNonItemLine(name)||descriptors(name))continue;
    if(/^[\d\W]+$/u.test(name)||/^(?:\d{1,2}:\d{2}|\d{4}[./-]\d|\d{1,2}[./-]\d{1,2}[./-]\d)/u.test(name))continue;
    if(items.some(item=>fold(item.name)===normalized))continue;
    const box=layout.find(line=>fold(line.text)===fold(original))?.bbox;
    if(box&&Number.isFinite(minY)&&maxY>minY&&box.y0-minY>(maxY-minY)*.45)continue;
    const upper=letters.filter(letter=>letter===letter.toUpperCase()&&letter!==letter.toLowerCase()).length/letters.length;
    let score=index===0?2:index===1?1:.5;
    if(upper>.7)score+=2;
    else if(/(?:^|\s)\p{Lu}\p{Ll}/u.test(name))score+=1;
    if(name.split(/\s+/).length>=2)score+=.5;
    if(business.test(name))score+=3;
    if(legal.test(name))score+=2;
    if(/#\s*\d/.test(name)&&!metadata.test(name))score+=1;
    if(lines.slice(index+1,Math.min(index+4,end)).some(line=>address.test(line)&&!hasPrice(line)))score+=5;
    if(index>0&&address.test(lines[index-1]))score+=2;
    if(lines.slice(index+1,index+3).some(descriptors))score+=2;
    // A repeated complete name is stronger than a preceding fragmented logo.
    if(lines.slice(0,index).some(line=>{const first=fold(line);return first.length>=4&&normalized.replace(/ /g,'').includes(first.replace(/ /g,''))&&normalized!==first;}))score+=1;
    if(normalized.split(/\s+/).length<=2&&lines.slice(index+1,end).some(line=>{const later=clean(line),key=fold(later);return !address.test(later)&&!metadata.test(later)&&!contact.test(later)&&key.length>normalized.length+3&&key.replace(/ /g,'').includes(normalized.replace(/ /g,''));}))score-=3;
    ranked.push({name,score,index});
  }
  ranked.sort((a,b)=>b.score-a.score||a.index-b.index);
  const best=ranked[0];
  return best&&best.score>=(totalLayout?9:6)?best.name.slice(0,120):'';
}
