export function voiceHelp(locale,traderMode){
 const groups={
  zh:[
   {title:'记录',hint:'收入和支出',phrases:['支出[金额][货币]用于[类别]','收入[金额][货币]','添加记录',...(traderMode?['添加交易']:[])]},
   {title:'类别',hint:'自定义分类',phrases:['创建类别[名称]','这个月[类别]花了多少']},
   {title:'总结',hint:'本月',phrases:['这个月花了多少','这个月收入多少','总结这个月']},
   {title:'导航',hint:'日历、钱包、PRO',phrases:['下个月 / 上个月','打开[年]年[月]月[日]日','打开钱包','打开历史','打开设置','返回今天','切换深色主题','开启交易模式','开启 / 关闭 PRO 模式']},
  ],
  ru:[
   {title:'Записи',hint:'Доходы и расходы',phrases:['Потратил [сумма] [валюта] на [категория]','Получил [сумма] [валюта]','Добавь запись','[сумма] на [категория], [сумма] на [категория]',...(traderMode?['Добавь сделку']:[])]},
   {title:'Категории',hint:'Свои разделы',phrases:['Создай категорию [название]','Сколько потратил на [категория] за месяц?']},
   {title:'Поиск и итоги',hint:'Записи, периоды, суммы',phrases:['Сколько потратил на еду на этой неделе?','Покажи расходы на машину за сентябрь','Когда я последний раз платил за интернет?','Сколько заработал за прошлый месяц?','Подведи итог за месяц']},
   {title:'Навигация',hint:'Месяцы, кошелёк, PRO',phrases:['Следующий / предыдущий месяц','Открой [день] [месяц] [год]','Войди в кошелёк','Зайди в историю','Открой настройки','Вернись на сегодня','Включи тёмную тему','Включи режим трейдера','Включи / выключи режим про']},
  ],
  en:[
   {title:'Entries',hint:'Income and expenses',phrases:['I spent [amount] [currency] on [category]','I received [amount] [currency]','Add entry','[amount] on [category], [amount] on [category]',...(traderMode?['Add trade']:[])]},
   {title:'Categories',hint:'Your own sections',phrases:['Create category [name]','How much did I spend on [category] this month?']},
   {title:'Search and summary',hint:'Entries, periods, totals',phrases:['How much did I spend on food this week?','Show expenses on car in September','When did I last pay for internet?','How much did I earn last month?','Summarize this month']},
   {title:'Navigation',hint:'Calendar, wallet, PRO',phrases:['Next / previous month','Open [day] [month] [year]','Open wallet','Open history','Open settings','Go to today','Switch to dark theme','Enable trader mode','Turn on / off pro']},
  ],
  ro:[
   {title:'Înregistrări',hint:'Venituri și cheltuieli',phrases:['Am cheltuit [sumă] [monedă] pe [categorie]','Am primit [sumă] [monedă]','Adaugă o înregistrare','[sumă] pe [categorie], [sumă] pe [categorie]',...(traderMode?['Adaugă o tranzacție']:[])]},
   {title:'Categorii',hint:'Secțiuni proprii',phrases:['Creează categoria [nume]','Cât am cheltuit pe [categorie] luna aceasta?']},
   {title:'Rezumat',hint:'Luna aceasta',phrases:['Cât am cheltuit luna aceasta?','Cât am câștigat luna aceasta?','Rezumat pentru luna aceasta']},
   {title:'Navigare',hint:'Calendar, portofel, PRO',phrases:['Luna următoare / precedentă','Deschide [zi] [lună] [an]','Deschide portofelul','Deschide istoricul','Deschide setări','Deschide astăzi','Activează tema întunecată','Activează modul trader','Activează / dezactivează modul PRO']},
  ],
 }[locale];
 return {groups,title:{
  zh: "语音操作",ru:'Что можно голосом',en:'Voice actions',ro:'Acțiuni vocale'}[locale],note:{
  zh: "打开分组，将[括号]替换为你的内容。",ru:'Порядок слов можно менять. В [скобках] — ваши данные. Запись сохраняется после проверки. «к» после суммы означает тысячи.',en:'Word order can vary. Replace [brackets] with your details. Review entries before saving.',ro:'Poți schimba ordinea cuvintelor. Înlocuiește [parantezele] cu datele tale. Verifică înainte de salvare.'}[locale]};
}
