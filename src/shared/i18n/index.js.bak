export const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTHS_MD = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
];

export function monthsFor(language) {
  if (language === 'en') return MONTHS_EN;
  if (language === 'md') return MONTHS_MD;
  return MONTHS;
}

export const TRANSLATIONS = {
  ru: {
    titleMoney: 'Денежный календарь', titlePro: 'Трейдерский календарь',
    signIn: 'Войти через Google', signOut: 'Выйти из аккаунта',
    settings: 'Настройки', language: 'Язык', currency: 'Валюта', theme: 'Тема',
    themeDark: 'Ночь', themeLight: 'День',
    balanceOfDay: 'Баланс дня', overallResult: 'Общий результат дня',
    analysis: 'Анализ', addRecord: 'Новая запись', addTrade: 'Добавить сделку',
    operations: 'История', income: 'Доходы', expense: 'Расходы',
    trades: 'Сделок', winrate: 'Winrate', noRecords: 'Пока нет записей за этот период.',
    close: 'Закрыть',
    record: 'Запись', editRecord: 'Редактировать запись', deleteRecord: 'Удалить запись',
    saveRecord: 'Сохранить запись', recordNotePlaceholder: 'Заметка по записи (необязательно)',
    recordFutureBlocked: 'Нельзя добавить запись на будущую дату',
    myMoney: 'Мои деньги',
    freePlan: 'FREE', history: 'История', filters: 'Фильтры', all: 'Все', entries: 'записей',
    financialHistory: 'Финансовая история', resultForPeriod: 'Результат за выбранный период', app: 'Приложение', account: 'Аккаунт', mobile: 'Телефон', desktop: 'Компьютер', sync: 'Синхронизация', platform: 'Площадка', platforms: 'Площадки',
  },
  en: {
    titleMoney: 'Money Calendar', titlePro: 'Trading Calendar',
    signIn: 'Sign in with Google', signOut: 'Sign out',
    settings: 'Settings', language: 'Language', currency: 'Currency', theme: 'Theme',
    themeDark: 'Dark', themeLight: 'Light',
    balanceOfDay: "Day's balance", overallResult: "Day's overall result",
    analysis: 'Analysis', addRecord: 'New entry', addTrade: 'Add trade',
    operations: 'History', income: 'Income', expense: 'Expenses',
    trades: 'Trades', winrate: 'Winrate', noRecords: 'No entries for this period yet.',
    close: 'Close',
    record: 'Entry', editRecord: 'Edit entry', deleteRecord: 'Delete entry',
    saveRecord: 'Save entry', recordNotePlaceholder: 'Note (optional)',
    recordFutureBlocked: "Can't add an entry for a future date",
    myMoney: 'My money',
    freePlan: 'FREE', history: 'History', filters: 'Filters', all: 'All', entries: 'entries',
    financialHistory: 'Financial history', resultForPeriod: 'Result for selected period', app: 'App', account: 'Account', mobile: 'Mobile', desktop: 'Desktop', sync: 'Sync', platform: 'Platform', platforms: 'Platforms',
  },
  md: {
    titleMoney: 'Calendar de bani', titlePro: 'Calendar de tranzacții',
    signIn: 'Autentificare cu Google', signOut: 'Ieșire din cont',
    settings: 'Setări', language: 'Limbă', currency: 'Valută', theme: 'Temă',
    themeDark: 'Noapte', themeLight: 'Zi',
    balanceOfDay: 'Soldul zilei', overallResult: 'Rezultatul zilei',
    analysis: 'Analiză', addRecord: 'Înregistrare nouă', addTrade: 'Adaugă tranzacție',
    operations: 'Istoric', income: 'Venituri', expense: 'Cheltuieli',
    trades: 'Tranzacții', winrate: 'Winrate', noRecords: 'Încă nu sunt înregistrări pentru această perioadă.',
    close: 'Închide',
    record: 'Înregistrare', editRecord: 'Editează înregistrarea', deleteRecord: 'Șterge înregistrarea',
    saveRecord: 'Salvează înregistrarea', recordNotePlaceholder: 'Notă (opțional)',
    recordFutureBlocked: 'Nu se poate adăuga o înregistrare pentru o dată viitoare',
    myMoney: 'Banii mei',
    freePlan: 'FREE', history: 'Istoric', filters: 'Filtre', all: 'Toate', entries: 'înregistrări',
    financialHistory: 'Istoric financiar', resultForPeriod: 'Rezultat pentru perioada selectată', app: 'Aplicație', account: 'Cont', mobile: 'Telefon', desktop: 'Computer', sync: 'Sincronizare', platform: 'Platformă', platforms: 'Platforme',
  },
};

export function translate(language, key) {
  return (TRANSLATIONS[language] && TRANSLATIONS[language][key]) || TRANSLATIONS.ru[key] || key;
}
