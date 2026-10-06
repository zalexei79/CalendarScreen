const COPY = {
  ru: {
    eyebrow: 'Денежный календарь', title: 'Каждый день\nимеет значение.', subtitle: 'Доходы, расходы и твой финансовый ритм — в одном календаре.',
    heading: 'Начни свою историю', hint: 'Войди, чтобы сохранять записи и открывать их на разных устройствах.',
    google: 'Продолжить с Google', telegram: 'Продолжить с Telegram', explore: 'Посмотреть без входа', preview: 'Пример твоего календаря',
    demo: 'Деморежим', demoHint: 'Это примеры доходов и расходов. Открой день или историю, чтобы посмотреть детали.',
    start: 'Создать свой календарь', addTitle: 'Сохраним твою первую запись', addHint: 'Выбери способ входа. После знакомства откроем форму записи — примеры останутся только в деморежиме.',
    close: 'Продолжить просмотр', loading: 'Открываем DAYRIS…', sample: 'Пример',
    salary: 'Зарплата за месяц', freelance: 'Оплата небольшого проекта', groceries: 'Продукты на неделю', coffee: 'Кофе и перекус', subscription: 'Подписка на музыку', housing: 'Аренда и коммунальные услуги', transport: 'Поездки по городу',
  },
  en: {
    eyebrow: 'Money calendar', title: 'Every day\nmatters.', subtitle: 'Income, expenses and your financial rhythm — in one calendar.',
    heading: 'Start your story', hint: 'Sign in to save your entries and access them across devices.',
    google: 'Continue with Google', telegram: 'Continue with Telegram', explore: 'Explore without signing in', preview: 'A glimpse of your calendar',
    demo: 'Demo mode', demoHint: 'These are sample income and expenses. Open a day or History to explore the details.',
    start: 'Create my calendar', addTitle: 'Save your first entry', addHint: 'Choose how to sign in. After the introduction, we’ll open your entry form. Sample entries stay in the demo.',
    close: 'Keep exploring', loading: 'Opening DAYRIS…', sample: 'Example',
    salary: 'Monthly salary', freelance: 'Payment for a small project', groceries: 'Weekly groceries', coffee: 'Coffee and a snack', subscription: 'Music subscription', housing: 'Rent and utilities', transport: 'Trips around town',
  },
  ro: {
    eyebrow: 'Calendar financiar', title: 'Fiecare zi\ncontează.', subtitle: 'Veniturile, cheltuielile și ritmul tău financiar — într-un calendar.',
    heading: 'Începe povestea ta', hint: 'Autentifică-te pentru a salva înregistrările și a le accesa de pe alte dispozitive.',
    google: 'Continuă cu Google', telegram: 'Continuă cu Telegram', explore: 'Explorează fără autentificare', preview: 'Un exemplu de calendar',
    demo: 'Mod demonstrativ', demoHint: 'Acestea sunt exemple de venituri și cheltuieli. Deschide o zi sau istoricul pentru detalii.',
    start: 'Creează calendarul meu', addTitle: 'Salvează prima înregistrare', addHint: 'Alege metoda de autentificare. După introducere, deschidem formularul. Exemplele rămân în demonstrație.',
    close: 'Continuă explorarea', loading: 'Se deschide DAYRIS…', sample: 'Exemplu',
    salary: 'Salariul lunar', freelance: 'Plata unui proiect mic', groceries: 'Alimente pentru săptămână', coffee: 'Cafea și gustare', subscription: 'Abonament muzical', housing: 'Chirie și utilități', transport: 'Deplasări prin oraș',
  },
  zh: {
    eyebrow: '财务日历', title: '每一天\n都很重要。', subtitle: '在一个日历中查看收入、支出和财务节奏。',
    heading: '开始你的故事', hint: '登录以保存记录，并在不同设备上查看。',
    google: '使用 Google 继续', telegram: '使用 Telegram 继续', explore: '无需登录，先体验', preview: '你的日历示例',
    demo: '演示模式', demoHint: '这些是收入和支出示例。打开日期或历史记录查看详情。',
    start: '创建我的日历', addTitle: '保存你的第一条记录', addHint: '选择登录方式。介绍结束后将打开记录表单。示例仅保留在演示模式中。',
    close: '继续体验', loading: '正在打开 DAYRIS…', sample: '示例',
    salary: '月薪', freelance: '小项目收入', groceries: '每周食品', coffee: '咖啡和点心', subscription: '音乐订阅', housing: '房租和水电费', transport: '市内交通',
  },
};

export function getEntryCopy(language) {
  const code = String(language || 'ru').toLowerCase();
  return COPY[code.startsWith('zh') ? 'zh' : code === 'md' || code.startsWith('ro') ? 'ro' : code.startsWith('en') ? 'en' : 'ru'];
}
