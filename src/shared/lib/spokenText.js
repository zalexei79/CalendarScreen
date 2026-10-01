export function spokenText(value,locale='ru'){
 const currency={ru:{USD:'долларов',EUR:'евро',MDL:'леев',RUB:'рублей'},en:{USD:'dollars',EUR:'euros',MDL:'lei',RUB:'rubles'},ro:{USD:'dolari',EUR:'euro',MDL:'lei',RUB:'ruble'}}[locale];
 return String(value).replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\[nrt]/g,' ').replace(/\\/g,' ').replace(/\//g,{ru:' из ',en:' out of ',ro:' din '}[locale]).replace(/\b(?:USD|EUR|MDL|RUB)\b/g,code=>currency[code]).replace(/[*_`#]/g,'').replace(/\s+/g,' ').trim();
}
