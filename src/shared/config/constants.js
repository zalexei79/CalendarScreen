import {
  Wallet,
  ShoppingCart,
  Home,
  Briefcase,
  ShoppingBag,
  CreditCard,
  MoreHorizontal,
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
  { key: 'Зарплата', icon: Wallet },
  { key: 'Продукты', icon: ShoppingCart },
  { key: 'Жильё', icon: Home },
  { key: 'Работа', icon: Briefcase },
  { key: 'Покупки', icon: ShoppingBag },
  { key: 'Подписки', icon: CreditCard },
  { key: 'Сигареты', icon: MoreHorizontal },
  { key: 'Фриланс', icon: Wallet },
  { key: 'Другое', icon: MoreHorizontal },
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
};

// Aliases for compatibility
export const RECENT_INSTRUMENTS_STORAGE_KEY = STORAGE_KEYS.RECENT_INSTRUMENTS;
export const CUSTOM_TAGS_STORAGE_KEY = STORAGE_KEYS.CUSTOM_TAGS;
export const DEPOSIT_SIZE_STORAGE_KEY = STORAGE_KEYS.DEPOSIT_SIZE;
export const TRADER_MODE_STORAGE_KEY = STORAGE_KEYS.TRADER_MODE;
export const LANGUAGE_STORAGE_KEY = STORAGE_KEYS.LANGUAGE;
export const CURRENCY_STORAGE_KEY = STORAGE_KEYS.CURRENCY;
export const THEME_STORAGE_KEY = STORAGE_KEYS.THEME;
export const GUEST_TRADES_CACHE_KEY = STORAGE_KEYS.GUEST_TRADES_CACHE;
export const OFFLINE_QUEUE_KEY = STORAGE_KEYS.OFFLINE_QUEUE;

export function getTradesCacheKey(userId) {
  return userId ? `money_calendar_trades_${userId}` : STORAGE_KEYS.GUEST_TRADES_CACHE;
}

export function getMoneyCategoryMeta(category) {
  return MONEY_CATEGORIES.find((item) => item.key === category) || null;
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
