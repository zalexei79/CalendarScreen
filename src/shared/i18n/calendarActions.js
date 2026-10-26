import { localeKey } from './locale.js';

const COPY = {
  ru: { loading: 'Загружаем планы…', retry: 'Повторить', selection: 'С текущими фильтрами', all: 'Все записи', scope: 'Какие записи включить', notice: 'Период и выбранные фильтры определяют содержимое отчёта.', columns: 'Дата с годом · категория · тип · сумма · валюта · заметка' },
  en: { loading: 'Loading plans…', retry: 'Retry', selection: 'With current filters', all: 'All records', scope: 'Records to include', notice: 'The period and selected filters determine the report contents.', columns: 'Date with year · category · type · amount · currency · note' },
  ro: { loading: 'Se încarcă planurile…', retry: 'Reîncearcă', selection: 'Cu filtrele curente', all: 'Toate înregistrările', scope: 'Înregistrări incluse', notice: 'Perioada și filtrele selectate determină conținutul raportului.', columns: 'Data cu an · categorie · tip · sumă · monedă · notă' },
  uk: { loading: 'Завантажуємо плани…', retry: 'Повторити', selection: 'З поточними фільтрами', all: 'Усі записи', scope: 'Які записи включити', notice: 'Період і вибрані фільтри визначають вміст звіту.', columns: 'Дата з роком · категорія · тип · сума · валюта · нотатка' },
  zh: { loading: '正在加载计划…', retry: '重试', selection: '应用当前筛选', all: '所有记录', scope: '包含哪些记录', notice: '时段和所选筛选条件决定报告内容。', columns: '含年份的日期 · 类别 · 类型 · 金额 · 货币 · 备注' },
};
export const calendarActions = language => COPY[localeKey(language)];
