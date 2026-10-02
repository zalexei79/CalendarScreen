import {parseSpokenAmount} from './spokenAmount.js';
import {parseChineseVoiceCommand} from './chineseVoiceCommand.js';
export function parseLocalizedVoiceCommand(text){
 const chinese=parseChineseVoiceCommand(text);if(chinese)return chinese;
 const normalized=text.replace(/[șş]/g,'s').replace(/[țţ]/g,'t').replace(/[ăâ]/g,'a').replace(/î/g,'i');
 const restore=value=>value?text.slice(normalized.lastIndexOf(value),normalized.lastIndexOf(value)+value.length):value;
 const created=normalized.match(/^(?:create|add) (?:a )?(?:new )?(?:category|section)(?: (.*))?$/)||normalized.match(/^(?:creeaza|adauga|inregistreaza) (?:o |un )?(?:noua |nou )?(?:categorie|categoria|sectiune|sectiunea)(?: (.*))?$/);
 if(created){const name=(created[1]||'').trim();return !name||/^(?:create|add|record|creeaza|adauga|inregistreaza)$/.test(name)?{type:'category-prompt'}:name.length<=60?{type:'category',name:restore(name)}:null;}
 if(/^(?:deschide|intra in) (?:portofel|portofelul)$/.test(normalized))return {type:'wallet'};
 const pro=normalized.match(/^(activeaza|dezactiveaza|porneste|opreste) (?:modul |modul de )?pro$/);if(pro)return {type:'pro',enabled:['activeaza','porneste'].includes(pro[1])};
 if(/^(?:(?:treci|mergi|schimba) (?:la |in )?)?luna (?:urmatoare|viitoare)$/.test(normalized))return {type:'month',direction:1};
 if(/^(?:(?:treci|mergi|schimba) (?:la |in )?)?luna (?:precedenta|trecuta|anterioara)$/.test(normalized))return {type:'month',direction:-1};
 if(/^adauga (?:o )?(?:inregistrare|tranzactie)$/.test(normalized))return {type:'add',kind:normalized.endsWith('tranzactie')?'trade':'record'};
 const query=normalized.replace(/^(?:tell me|spune-mi|spune mi) /,'');
 const english=query.match(/^how much (?:did i|have i|i)? ?(spend|spent|earn|earned)(?: this month)?(?: (?:on|for|from) (.+?))?(?: this month)?$/);
 const romanian=query.match(/^cat (?:am )?(cheltuit|castigat)(?: (?:luna aceasta|in aceasta luna))?(?: (?:pe|pentru|din) (.+?))?(?: (?:luna aceasta|in aceasta luna))?$/);
 const question=english||romanian;
 if(question){const category=question[2];if(category&&(/last month|yesterday|anul|luna trecuta|saptamana/.test(category)||category.length>60))return null;return {type:'question',metric:/earn|castig/.test(question[1])?'income':'expense',period:'current-month',...(category?{category:restore(category)}:{})};}
 if(/^(?:summarize|summary for) (?:this month|the month)$|^(?:rezumat|fa rezumatul|arata totalul)(?: pentru)? (?:luna aceasta|aceasta luna)$/.test(query))return {type:'question',metric:'summary',period:'current-month'};
 const moneyText=normalized.replace(/^(?:record|add) (?:an? )?expense /,'spent ').replace(/^(?:record|add) (?:an? )?income /,'received ').replace(/^(?:inregistreaza|adauga|noteaza) (?:o )?cheltuiala /,'cheltuit ').replace(/^(?:inregistreaza|adauga|noteaza) (?:un )?venit /,'primit ');
 const money=moneyText.match(/^(?:(?:record|add) (?:an? )?(?:expense )?)?(?:today )?(?:i )?(spent|received|earned) (.+?) (rubles?|euros?|lei|leu|dollars?)(?: (?:on|for) (.+))?$/)
  ||moneyText.match(/^(?:(?:inregistreaza|adauga|noteaza) )?(?:astazi )?(?:am )?(cheltuit|primit|castigat) (.+?) (ruble|euro|lei|leu|dolari)(?: (?:pe|pentru) (.+))?$/);
 if(money){const amount=parseSpokenAmount(money[2].replace(/ de$/,''));if(amount===null||Number(amount)<=0||money[4]?.length>60)return null;return {type:'entry',kind:'record',amount,currency:/^rubl/.test(money[3])?'RUB':/^euro/.test(money[3])?'EUR':/^le/.test(money[3])?'MDL':'USD',sign:/spent|cheltuit/.test(money[1])?'minus':'plus',...(money[4]?{category:restore(money[4])}:{})};}
 return null;
}
