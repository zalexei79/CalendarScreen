import {parseSpokenAmount} from './spokenAmount.js';
import {categoryMatches,normalizeVoiceCategory} from './voiceCategory.js';

// Resolve explicit replacements before extracting dates or other fields.
// A negation without a replacement must never become a positive money action.
export function resolveVoiceCorrections(value){
 let text=String(value).toLowerCase().replace(/ё/g,'е').replace(/[«»]/g,'"');
 text=text.replace(/(^|\s)не забудь(?:те)?\s+(?:записать|добавить)/g,'$1запиши');
 text=text.replace(/(^|\s)не\s+(.+?)\s*[,;]?\s+(?:а|но)\s+/g,'$1')
  .replace(/(^|\s)not\s+(.+?)\s*[,;]?\s+but\s+/g,'$1')
  .replace(/(^|\s)nu\s+(.+?)\s*[,;]?\s+ci\s+/g,'$1');
 const negated=/(^|\s)(?:не|not|n-am)(?=\s|$)/.test(text)||/(^|\s)nu\s+(?![,\s]*\d)/.test(text);
 return {text:text.replace(/\s+/g,' ').trim(),negated};
}

const expense=/^(?:потратил[аи]?|потрачено|потратить|расход[ы]?|заплатил[аи]?|оплатил[аи]?|платил[аи]?|плата|ушло|списали|списано|списалось|обошлось|обошелся|обошлась|израсходовал[аи]?|spent|spend|paid|expense|cheltuit|cheltuiala|cheltuială|platit|plătit)$/u;
const income=/^(?:получил[аи]?|получено|получить|заработал[аи]?|заработано|доход[ы]?|пришло|поступило|поступили|зачислили|зачислено|вернули|вернулось|received|earned|income|primit|venit|castigat|câștigat)$/u;
const purchase=/^(?:купил[аи]?|покупка|bought|cumparat|cumpărat)$/u;
const transfer=/^(?:перевел[аи]?|перевод|отдал[аи]?|одолжил[аи]?|transferred|transfer)$/u;
const request=/^(?:запиши|записать|добавь|добавить|внеси|занеси|учти|сохрани|исправь|измени|поменяй|замени|record|add|save|note|change|correct|adauga|adaugă|inregistreaza|înregistrează|noteaza|notează|schimba|schimbă)$/u;
const filler=new Set('я мне это было был была ну вот пожалуйста давай сегодня за в на к по сумма сумму суммой всего итого около примерно только запись запишем деньги денег вышло составил составила the i it a an am was is amount total for to in of please on pe pentru în din de o un'.split(' '));
const currencies=[
 ['RUB',/^(?:рубль|рубля|рублей|рубли|рублях|руб|ruble|rubles|rublă|ruble|rub|₽)$/u],
 ['EUR',/^(?:евро|еврах|euro|euros|eur|€)$/u],
 ['MDL',/^(?:лей|лея|леев|леи|леях|lei|leu|mdl)$/u],
 ['USD',/^(?:доллар|доллара|долларов|доллары|долларах|dollar|dollars|dolari|usd|\$)$/u],
 ['CNY',/^(?:юань|юаня|юаней|юани|yuan|cny|¥)$/u],
];
const categoryMarkers=new Set(['на','категория','категорию','раздел','category','on','for','pe','pentru','categoria']);
const aliases={еда:'Продукты',еду:'Продукты',едой:'Продукты',food:'Продукты',groceries:'Продукты',кофе:'Кафе',coffee:'Кафе',cafea:'Кафе',бензин:'Транспорт',fuel:'Транспорт'};
const tokensOf=text=>Array.from(text.matchAll(/\d+(?:[.,]\d+)?|[\p{L}]+|[₽€$¥]|[-−]/gu),match=>({value:match[0],start:match.index,end:match.index+match[0].length,used:false}));
function naturalAmount(value){
 const direct=parseSpokenAmount(value);if(direct!==null)return direct;
 let text=value.trim();const tail=text.split(/\s+/).at(-1);
 if(currencies.some(([,pattern])=>pattern.test(tail)))text=text.slice(0,text.length-tail.length).trim();
 const halves={полсотни:50,полтысячи:500,полмиллиона:500000,полтора:1.5,полторы:1.5};
 if(halves[text])return String(halves[text]);
 const fraction=text.match(/^(полтора|полторы|.+? с половиной)(?:\s+(сотни|сотня|сотен|тысяча|тысячи|тысяч|миллион|миллиона|миллионов))?$/);
 if(!fraction)return null;
 const base=halves[fraction[1]]??(()=>{const amount=parseSpokenAmount(fraction[1].replace(/ с половиной$/,''));return amount!==null&&Number.isInteger(Number(amount))?Number(amount)+.5:null;})();
 const scale=fraction[2]?/сот/.test(fraction[2])?100:/тысяч/.test(fraction[2])?1000:1000000:1;
 return base!==null&&base*scale<1e12?String(base*scale):null;
}

// Extract independent slots. Contiguous amounts are parsed by the same strict
// amount parser as the keypad; multiple amounts remain ambiguous, not summed.
export function parseNaturalVoiceEntry(value,{draft=null,categories=[]}={}){
 const text=String(value).toLowerCase().replace(/ё/g,'е').trim();
 if(!text||/[\u3400-\u9fff]/u.test(text))return null;
 if(/(^|\s)(?:сколько|покажи|открой|удали|удалить|баланс|остаток|how|delete|open|cât|cat|deschide)(?=\s|$)/u.test(text))return null;
 const tokens=tokensOf(text);if(tokens.length>80||text.length>600)return {invalid:true};
 if(!tokens.length)return null;
 const patch={},ambiguous=new Set(),provided=new Set(),categoryHits=[];
 const mark=(start,end)=>{for(let i=start;i<end;i++)tokens[i].used=true;};
 const signs=new Set();let hasRequest=false,hasPurchase=false,hasTransfer=false;
 // Known categories (including numeric names) are removed before looking for
 // money so a shop named “Кафе 24/7” cannot supply an extra amount.
 const known=categories.flatMap(item=>[item.value,item.label].filter(Boolean).map(label=>({value:item.value,label,size:tokensOf(label).length})));
 for(let start=0;start<tokens.length;start++){
  if(tokens[start].used)continue;
  for(let end=Math.min(tokens.length,start+12);end>start;end--){
   const name=text.slice(tokens[start].start,tokens[end-1].end);
   const matches=[...new Set(known.filter(item=>item.size===end-start&&categoryMatches(item.label,name)).map(item=>item.value))];
   const alias=aliases[normalizeVoiceCategory(name)];
   if(!matches.length&&alias&&categories.some(item=>item.value===alias))matches.push(alias);
   if(matches.length){if(matches.length>1)ambiguous.add('category');categoryHits.push(...matches);mark(start,end);start=end-1;break;}
  }
 }
 const destinations=[];
 for(let i=0;i<tokens.length;i++){
  if(tokens[i].used)continue;
  const word=tokens[i].value;
  if(/^(?:кошелек|wallet|portofel|календарь|calendar|оба|both|ambele)$/.test(word)){
   const explicit=draft||i>0&&/^(?:в|to|in|în)$/.test(tokens[i-1].value)||tokens.length===1||tokens.some(token=>request.test(token.value));
   if(explicit){destinations.push(/оба|both|ambele/.test(word)?'both':/кошелек|wallet|portofel/.test(word)?'wallet':'main');tokens[i].used=true;}
  }
 }
 if(destinations.length){const unique=[...new Set(destinations)];patch.destination=unique.includes('both')?'both':unique.length===1?unique[0]:/\s(?:и|and|și|si)\s/.test(text)?'both':null;if(!patch.destination)ambiguous.add('destination');provided.add('destination');}
 if(patch.destination==='both')for(const token of tokens)if(/^(?:и|and|și|si)$/.test(token.value))token.used=true;
 for(const token of tokens){
  if(token.used)continue;
  if(expense.test(token.value)){signs.add('minus');token.used=true;}
  else if(income.test(token.value)){signs.add('plus');token.used=true;}
  else if(purchase.test(token.value)){hasPurchase=true;signs.add('minus');token.used=true;}
  else if(transfer.test(token.value)){hasTransfer=true;token.used=true;}
  else if(request.test(token.value)){hasRequest=true;token.used=true;}
 }
 if(signs.size){provided.add('sign');if(signs.size===1)patch.sign=[...signs][0];else ambiguous.add('sign');}
 if(hasTransfer&&!signs.size)ambiguous.add('sign');
 const currencyHits=[];
 for(const token of tokens){if(token.used)continue;const found=currencies.find(([,pattern])=>pattern.test(token.value));if(found)currencyHits.push(found[0]);}
 if(currencyHits.length){provided.add('currency');const unique=[...new Set(currencyHits)];if(unique.length===1)patch.currency=unique[0];else ambiguous.add('currency');}
 const amounts=[];
 for(let start=0;start<tokens.length;start++){
  if(tokens[start].used||naturalAmount(tokens[start].value)===null||currencies.some(([,pattern])=>pattern.test(tokens[start].value)))continue;
  if(['o','un'].includes(tokens[start].value)&&tokens[start+1]?.used){tokens[start].used=true;continue;}
  let found=null;
  for(let end=start+1;end<=Math.min(tokens.length,start+18);end++){
   if(tokens[end-1].used)break;
   const amount=naturalAmount(text.slice(tokens[start].start,tokens[end-1].end));
   if(amount!==null)found={start,end,amount};
  }
  if(found){amounts.push(found);mark(found.start,found.end);start=found.end-1;}
 }
 if(amounts.length){provided.add('amount');if(amounts.length===1&&Number(amounts[0].amount)>0)patch.amount=amounts[0].amount;else ambiguous.add('amount');}
 for(const token of tokens)if(currencies.some(([,pattern])=>pattern.test(token.value)))token.used=true;
 let spendingCategory=false;
 for(let i=0;i<tokens.length;i++){
  if(tokens[i].used||!categoryMarkers.has(tokens[i].value))continue;
  const marker=tokens[i].value;tokens[i].used=true;
  if(['на','on','pe','pentru'].includes(marker))spendingCategory=true;
  if(i+1>=tokens.length||tokens[i+1].used)continue;
  let end=i+1;while(end<tokens.length&&!tokens[end].used&&!['на','on','pe','for','pentru'].includes(tokens[end].value)&&!request.test(tokens[end].value)&&!['и','and','și','si'].includes(tokens[end].value))end++;
  const words=tokens.slice(i+1,end);while(words.length&&filler.has(words.at(-1).value))words.pop();
  if(words.length){const name=text.slice(words[0].start,words.at(-1).end).trim();if(name.length>60)return {invalid:true};categoryHits.push(name);mark(i+1,i+1+words.length);}
 }
 if(categoryHits.length){provided.add('category');const unique=[...new Set(categoryHits.map(name=>known.find(item=>categoryMatches(item.label,name))?.value||name))];if(unique.length===1)patch.category=unique[0];else ambiguous.add('category');}
 if(!draft?.sign&&!signs.size&&!hasTransfer&&spendingCategory&&patch.category){patch.sign='minus';provided.add('sign');}
 // Remaining narrative is not a category unless the speaker labels it. Keep
 // the established purchase dialogue, which asks where an item belongs.
 for(const token of tokens)if(filler.has(token.value)||request.test(token.value)||/^(?:нет|no|nu|да|yes|da|это|is|este|составило)$/.test(token.value))token.used=true;
 const leftover=tokens.filter(token=>!token.used);
 if(ambiguous.size)for(const token of leftover)if(/^(?:и|and|și|si)$/.test(token.value))token.used=true;
 const recognized=provided.size>0||signs.size>0||hasRequest||hasTransfer;
 if(!recognized)return null;
 if(hasPurchase&&leftover.length){const item=leftover.map(token=>token.value).join(' ');if(item.length>60)return {invalid:true};patch.item=item;for(const token of leftover)token.used=true;}
 if(leftover.some(token=>!token.used&&/^(?:и|and|și|si|-|−)$/.test(token.value))&&amounts.length<=1)return {invalid:true};
 if(leftover.some(token=>!token.used)&&!hasTransfer)return {invalid:true};
 if(!draft&&!hasRequest&&!signs.size&&!hasTransfer&&!patch.category&&!patch.currency)return null;
 for(const field of ambiguous)delete patch[field];
 return {patch,provided:[...provided],ambiguous:[...ambiguous]};
}
