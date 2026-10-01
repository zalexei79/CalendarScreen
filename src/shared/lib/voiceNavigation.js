// Match whole requests, rather than executing an action for any mentioned noun.
export function parseVoiceNavigation(value){
 const text=value.replace(/^(?:можешь |можно |давай |can you |please )/,'').replace(/ пожалуйста$| please$/,'').replace(/^(activează|activeaza) (tema|temă) (.+)$/,'$1 $3 $2');
 const request=text.replace(/^(?:открой|открыть|зайди|войди|перейди|покажи|включи|вернись|верни меня|переключись|open|show|go|take me|deschide|arata|arată|mergi|intra|intră)(?: (?:в|на|к|to|the|my|la|in|în))? /,'');
 const targets={history:/^(?:история|историю|история записей|историю записей|история сделок|историю сделок|записи|мои записи|сделки|history|transaction history|istoric|istoricul)$/,settings:/^(?:настройки|settings|setari|setări)$/,wallet:/^(?:кошелек|мой кошелек|wallet|portofel|portofelul)$/,today:/^(?:сегодня|текущий месяц|этот месяц|today|current month|astazi|astăzi|luna curenta|luna curentă)$/};
 if(request!==text||text==='сегодня'||text==='today')for(const[type,pattern]of Object.entries(targets))if(pattern.test(request))return {type};
 const theme=text.match(/^(?:включи|переключи на|выбери|enable|switch to|activeaza|activează) (темную|темный|темная|светлую|светлый|светлая|dark|light|intunecata|întunecată|luminoasa|luminoasă) (?:тему|режим|theme|mode|tema|temă)$/);
 if(theme)return {type:'theme',theme:/свет|light|lumino/.test(theme[1])?'light':'dark'};
 const trader=text.match(/^(включи|выключи|отключи|enable|disable|activeaza|activează|dezactiveaza|dezactivează) (?:режим трейдера|трейдерский режим|трейдера|trader mode|trading mode|modul trader)$/);
 if(trader)return {type:'trader',enabled:/^(включи|enable|activeaz)/.test(trader[1])};
 if(/^(?:листай|листни|перелистай|перейди|давай|go|move|treci) (?:вперед|дальше|forward|inainte|înainte)$/.test(text))return {type:'month',direction:1};
 if(/^(?:листай|листни|перелистай|перейди|давай|go|move|treci) (?:назад|back|inapoi|înapoi)$/.test(text))return {type:'month',direction:-1};
 return null;
}
