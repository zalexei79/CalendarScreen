import {localeKey} from './locale.js';

const weekdays = {
  ru: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ro: ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'],
  zh: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
};

export const weekdaysFor = language => weekdays[localeKey(language)];
