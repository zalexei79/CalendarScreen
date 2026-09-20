import {
  Wallet,
  ShoppingCart,
  Home,
  Briefcase,
  ShoppingBag,
  CreditCard,
  MoreHorizontal,
  Coffee, Car, HeartPulse, GraduationCap, Plane, Gift, Gamepad2, Cigarette, Laptop, TrendingUp, RotateCcw,
} from 'lucide-react';

export const PERIOD_PRESETS = ['Сегодня', 'Текущая неделя', 'Текущий месяц', '3 месяца', 'Вся история'];

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const DEFAULT_ASSET_TAGS = ['BTCUSD', 'ETHUSD', 'XAUUSD', 'EURUSD', 'NDX100'];

export const INSTRUMENT_INFO = {
  BTCUSD: { icon: '₿', label: 'Bitcoin / US Dollar' },
  ETHUSD: { icon: 'Ξ', label: 'Ethereum / US Dollar' },
  XAUUSD: { icon: '🥇', label: 'Gold / US Dollar' },
  EURUSD: { icon: '€', label: 'Euro / US Dollar' },
  NDX100: { icon: '📈', label: 'Nasdaq 100' },
};

export const MONEY_CATEGORIES = [
  { key: 'Зарплата', icon: Wallet, type: 'plus', en: 'Salary', ro: 'Salariu' },
  { key: 'Фриланс', icon: Laptop, type: 'plus', en: 'Freelance', ro: 'Freelance' },
  { key: 'Инвестиции', icon: TrendingUp, type: 'plus', en: 'Investments', ro: 'Investiții' },
  { key: 'Возврат', icon: RotateCcw, type: 'plus', en: 'Refund', ro: 'Rambursare' },
  { key: 'Продукты', icon: ShoppingCart, type: 'minus', en: 'Groceries', ro: 'Alimente' },
  { key: 'Кафе', icon: Coffee, type: 'minus', en: 'Cafés & dining', ro: 'Cafenele' },
  { key: 'Жильё', icon: Home, type: 'minus', en: 'Housing', ro: 'Locuință' },
  { key: 'Транспорт', icon: Car, type: 'minus', en: 'Transport', ro: 'Transport' },
  { key: 'Покупки', icon: ShoppingBag, type: 'minus', en: 'Shopping', ro: 'Cumpărături' },
  { key: 'Подписки', icon: CreditCard, type: 'minus', en: 'Subscriptions', ro: 'Abonamente' },
  { key: 'Здоровье', icon: HeartPulse, type: 'minus', en: 'Health', ro: 'Sănătate' },
  { key: 'Образование', icon: GraduationCap, type: 'minus', en: 'Education', ro: 'Educație' },
  { key: 'Путешествия', icon: Plane, type: 'minus', en: 'Travel', ro: 'Călătorii' },
  { key: 'Развлечения', icon: Gamepad2, type: 'minus', en: 'Entertainment', ro: 'Divertisment' },
  { key: 'Сигареты', icon: Cigarette, type: 'minus', en: 'Tobacco', ro: 'Tutun' },
  { key: 'Работа', icon: Briefcase, en: 'Work', ro: 'Muncă' },
  { key: 'Подарки', icon: Gift, en: 'Gifts', ro: 'Cadouri' },
  { key: 'Другое', icon: MoreHorizontal, en: 'Other', ro: 'Altele' },
];

export const EXCHANGES = ['Bybit', 'Binance', 'OKX', 'MT4/MT5', 'cTrader'];
export const PLATFORMS = ['Manual', ...EXCHANGES];

export const MAX_CUSTOM_TAGS = 6;

// LocalStorage Keys
export const STORAGE_KEYS = {
  RECENT_INSTRUMENTS: 'atj_recent_instruments',
  CUSTOM_TAGS: 'atj_custom_instrument_tags',
  DEPOSIT_SIZE: 'atj_deposit_size',
  TRADER_MODE: 'atj_trader_mode',
  LANGUAGE: 'atj_language',
  CURRENCY: 'atj_currency',
  THEME: 'atj_theme',
  GUEST_TRADES_CACHE: 'money_calendar_guest_trades_cache',
  OFFLINE_QUEUE: 'atj_offline_queue',
  ONBOARDING_V2_COMPLETED: 'dayris_onboarding_v2_completed',
};

// Aliases for compatibility
export const RECENT_INSTRUMENTS_STORAGE_KEY = STORAGE_KEYS.RECENT_INSTRUMENTS;
export const CUSTOM_TAGS_STORAGE_KEY = STORAGE_KEYS.CUSTOM_TAGS;
export const DEPOSIT_SIZE_STORAGE_KEY = STORAGE_KEYS.DEPOSIT_SIZE;
export const TRADER_MODE_STORAGE_KEY = STORAGE_KEYS.TRADER_MODE;
export const LANGUAGE_STORAGE_KEY = STORAGE_KEYS.LANGUAGE;
export const CURRENCY_STORAGE_KEY = STORAGE_KEYS.CURRENCY;
export const THEME_STORAGE_KEY = STORAGE_KEYS.THEME;
export const ONBOARDING_V2_COMPLETED_STORAGE_KEY = STORAGE_KEYS.ONBOARDING_V2_COMPLETED;
export const GUEST_TRADES_CACHE_KEY = STORAGE_KEYS.GUEST_TRADES_CACHE;
export const OFFLINE_QUEUE_KEY = STORAGE_KEYS.OFFLINE_QUEUE;

export function getTradesCacheKey(userId) {
  return userId ? `money_calendar_trades_${userId}` : STORAGE_KEYS.GUEST_TRADES_CACHE;
}

export function getMoneyCategoryMeta(category) {
  return MONEY_CATEGORIES.find((item) => item.key.toUpperCase() === String(category || '').trim().toUpperCase()) || null;
}

export function getMoneyCategoryLabel(category, language = 'ru') {
  const meta = getMoneyCategoryMeta(category);
  if (!meta) return category;
  return meta[language === 'md' ? 'ro' : language] || meta.key;
}

export const LANGUAGES = [
  { code: 'ru', label: 'RU' },
  { code: 'en', label: 'EN' },
  { code: 'md', label: 'MD' },
];

export const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD' },
  { code: 'EUR', symbol: '€', label: 'EUR' },
  { code: 'MDL', symbol: 'L', label: 'MDL' },
  { code: 'RUB', symbol: '₽', label: 'RUB' },
];

export function getCurrencyMeta(code) {
  return CURRENCIES.find((c) => c.code === code) || CURRENCIES[0];
}
