export function voiceHelp(locale,traderMode){
 const groups={
  ru:[
   {title:'Записи',hint:'Доходы и расходы',phrases:['Потратил [сумма] [валюта] на [категория]','Получил [сумма] [валюта]','Добавь запись',...(traderMode?['Добавь сделку']:[])]},
   {title:'Категории',hint:'Свои разделы',phrases:['Создай категорию [название]','Сколько потратил на [категория] за месяц?']},
   {title:'Итоги',hint:'Вопросы за месяц',phrases:['Сколько потратил за месяц?','Сколько заработал за месяц?','Подведи итог за месяц']},
   {title:'Навигация',hint:'Месяцы, кошелёк, PRO',phrases:['Следующий / предыдущий месяц','Открой [день] [месяц] [год]','Войди в кошелёк','Включи / выключи режим про']},
  ],
  en:[
   {title:'Entries',hint:'Income and expenses',phrases:['Today I spent [amount] [currency]','Today I received [amount] [currency]','Add entry',...(traderMode?['Add trade']:[])]},
   {title:'Summary',hint:'This month',phrases:['How much did I spend this month?','How much did I earn this month?','Summarize this month']},
   {title:'Navigation',hint:'Calendar, wallet, PRO',phrases:['Next / previous month','Open [day] [month] [year]','Open wallet','Turn on / off pro']},
  ],
  ro:[
   {title:'Înregistrări',hint:'Venituri și cheltuieli',phrases:['Astăzi am cheltuit [sumă] [monedă]','Astăzi am primit [sumă] [monedă]','Adaugă o înregistrare',...(traderMode?['Adaugă o tranzacție']:[])]},
   {title:'Rezumat',hint:'Luna aceasta',phrases:['Cât am cheltuit luna aceasta?','Cât am câștigat luna aceasta?','Rezumat pentru luna aceasta']},
   {title:'Navigare',hint:'Calendar și portofel',phrases:['Deschide [zi] [lună] [an]','Deschide portofelul']},
  ],
 }[locale];
 return {groups,title:{ru:'Что можно голосом',en:'Voice actions',ro:'Acțiuni vocale'}[locale],note:{ru:'Откройте раздел. В [скобках] — ваши данные. Формулировку можно менять.',en:'Open a section. Replace [brackets] with your details.',ro:'Deschide o secțiune. Înlocuiește [parantezele] cu datele tale.'}[locale]};
}
