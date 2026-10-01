export function normalizeVoiceCategory(value){return String(value||'').toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/[șş]/g,'s').replace(/[țţ]/g,'t').replace(/[ăâ]/g,'a').replace(/î/g,'i').replace(/[«»"']/g,'').replace(/\s+/g,' ').trim();}
export function categoryMatches(a,b){
 const left=normalizeVoiceCategory(a),right=normalizeVoiceCategory(b);if(left===right)return true;
 const stem=value=>value.split(' ').map(word=>word.length>5?word.replace(/(?:ами|ями|ах|ях|ов|ев|ей|ы|и|а|у|е)$/,''):word).join(' ');
 return stem(left)===stem(right);
}
export function resolveVoiceCategory(name,categories){
 const exact=categories.find(value=>normalizeVoiceCategory(value)===normalizeVoiceCategory(name));if(exact)return exact;
 const matches=[...new Set(categories.filter(value=>categoryMatches(value,name)))];
 return matches.length===1?matches[0]:String(name).trim();
}
export function resolveLocalizedCategory(name,categories,existing){
 const normalized=normalizeVoiceCategory(name);
 const exact=existing.find(value=>normalizeVoiceCategory(value)===normalized);
 if(exact)return exact;
 const aliases={cigarettes:'Сигареты',smoking:'Сигареты',tigari:'Сигареты',coffee:'Кафе',cafe:'Кафе',cafenea:'Кафе',cafea:'Кафе'};
 const translated=categories.find(item=>[item.key,item.en,item.ro].some(label=>label&&categoryMatches(label,name)));
 return translated?.key||aliases[normalized]||resolveVoiceCategory(name,existing);
}
