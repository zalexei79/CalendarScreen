export const savingsText=language=>(ru,en,ro,zh)=>language==='ru'?ru:language==='ro'||language==='md'?ro:language==='zh-CN'?zh:en;
export function savingsReason(reason,t){return ({
 essential:t('Обязательные расходы · оставим как есть','Essential spending · keep unchanged','Cheltuieli esențiale · păstrăm','必要支出 · 保持不变'),
 impulse:t('В заметке есть упоминание спонтанной покупки','Your note mentions a spontaneous purchase','Nota menționează o cumpărătură spontană','备注提到了冲动购物'),
 recurring:t('Повторяются похожие суммы · проверь подписки и привычки','Similar amounts repeat · check subscriptions and habits','Sume similare se repetă · verifică abonamentele și obiceiurile','金额相近的重复支出 · 检查订阅和习惯'),
 frequent:t('Частые траты · можно попробовать покупать реже','Frequent spending · consider buying less often','Cheltuieli frecvente · poți cumpăra mai rar','频繁支出 · 可尝试减少购买次数'),
 optional:t('Здесь можно поискать покупки, без которых обойдёшься','Look for purchases you could comfortably skip','Caută cumpărături la care poți renunța ușor','找找可以轻松放弃的购买'),
 review:t('Проверь вручную · по категории нельзя понять необходимость','Review yourself · the category cannot tell us what you need','Verifică personal · categoria nu arată necesitatea','请自行检查 · 类别无法说明是否必要')})[reason];}
