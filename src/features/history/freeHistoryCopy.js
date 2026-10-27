const COPY = {
  ru: { result: 'Общий результат', records: 'Записи', income: 'Доходы', expense: 'Расходы', all: 'Все', dynamics: 'Динамика', analysis: 'Разбор', sections: 'Раздел истории', scope: 'Какие записи показывать', period: 'Период', currency: 'Валюта', filters: 'Фильтры', allTime: 'За всё время', allCurrencies: 'Все валюты', mixed: 'Выберите валюту, чтобы увидеть общий результат.', empty: 'За этот период записей пока нет.', more: 'Показать ещё', less: 'Свернуть список' },
  uk: { result: 'Загальний результат', records: 'Записи', income: 'Доходи', expense: 'Витрати', all: 'Усі', dynamics: 'Динаміка', analysis: 'Розбір', sections: 'Розділ історії', scope: 'Які записи показувати', period: 'Період', currency: 'Валюта', filters: 'Фільтри', allTime: 'За весь час', allCurrencies: 'Усі валюти', mixed: 'Виберіть валюту, щоб побачити загальний результат.', empty: 'За цей період записів поки немає.', more: 'Показати ще', less: 'Згорнути список' },
  en: { result: 'Overall result', records: 'Entries', income: 'Income', expense: 'Expenses', all: 'All', dynamics: 'Trends', analysis: 'Breakdown', sections: 'History section', scope: 'Entries to display', period: 'Period', currency: 'Currency', filters: 'Filters', allTime: 'All time', allCurrencies: 'All currencies', mixed: 'Choose a currency to see the overall result.', empty: 'No entries for this period yet.', more: 'Show more', less: 'Show less' },
  ro: { result: 'Rezultat total', records: 'Înregistrări', income: 'Venituri', expense: 'Cheltuieli', all: 'Toate', dynamics: 'Evoluție', analysis: 'Analiză', sections: 'Secțiunea istoricului', scope: 'Înregistrări afișate', period: 'Perioadă', currency: 'Monedă', filters: 'Filtre', allTime: 'Tot timpul', allCurrencies: 'Toate monedele', mixed: 'Alege moneda pentru a vedea rezultatul total.', empty: 'Nu există încă înregistrări în această perioadă.', more: 'Arată încă', less: 'Restrânge lista' },
  'zh-CN': { result: '总体结余', records: '记录', income: '收入', expense: '支出', all: '全部', dynamics: '趋势', analysis: '分析', sections: '历史记录分区', scope: '显示的记录', period: '时间范围', currency: '货币', filters: '筛选', allTime: '全部时间', allCurrencies: '全部货币', mixed: '请选择一种货币查看总体结余。', empty: '此时间段暂无记录。', more: '显示更多', less: '收起列表' },
};
export function freeHistoryCopy(language) { return COPY[language === 'md' ? 'ro' : language] || COPY.en; }
export function freeHistoryCount(count, language) {
  if (language === 'zh-CN') return `${count} 条记录`;
  if (language === 'ru' || language === 'uk') {
    const category = new Intl.PluralRules(language).select(count);
    const words = language === 'ru' ? { one: 'запись', few: 'записи', many: 'записей', other: 'записи' } : { one: 'запис', few: 'записи', many: 'записів', other: 'запису' };
    return `${count} ${words[category]}`;
  }
  if (language === 'ro' || language === 'md') return `${count} ${count === 1 ? 'înregistrare' : 'înregistrări'}`;
  return `${count} ${count === 1 ? 'entry' : 'entries'}`;
}
