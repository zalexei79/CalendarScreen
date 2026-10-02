export function spokenText(value,locale='ru'){
 const currency={
  zh: {USD:"美元",EUR:"欧元",MDL:"列伊",RUB:"卢布",CNY:'人民币'},ru:{USD:'долларов',EUR:'евро',MDL:'леев',RUB:'рублей',CNY:'юаней'},en:{USD:'dollars',EUR:'euros',MDL:'lei',RUB:'rubles',CNY:'yuan'},ro:{USD:'dolari',EUR:'euro',MDL:'lei',RUB:'ruble',CNY:'yuani'}}[locale];
 return String(value).replace(/\\u([0-9a-f]{4})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16))).replace(/\\[nrt]/g,' ')
  .replace(/[\\/⁄∕／]+/g,', ').replace(/\b(?:USD|EUR|MDL|RUB|CNY)\b/g,code=>(currency||{})[code]||code)
  .replace(/[*_`#]/g,'').replace(/(?:\s*,\s*){2,}/g,', ').replace(/\s+/g,' ').replace(/\s+,/g,',').replace(/^\s*,\s*|\s*,\s*$/g,'').trim();
}
