export const DATASETS = [
  ['trades', 'Календарь: записи', true, true],
  ['wallet_transactions', 'Кошелёк: операции', true, true],
  ['wallet_transfers', 'Переводы между счетами', true],
  ['reminders', 'Планы и напоминания', true],
  ['trading_day_notes', 'Заметки к дням', true, true],
  ['capital_assets', 'Капитал: активы'],
  ['capital_operations', 'Капитал: операции', true],
  ['capital_valuation_snapshots', 'Капитал: история оценки', true],
  ['capital_sale_settlements', 'Капитал: расчёты продаж'],
  ['capital_chart_preferences', 'Настройки графиков'],
  ['capital_alert_preferences', 'Настройки уведомлений капитала'],
  ['capital_price_alerts', 'Ценовые уведомления'],
  ['capital_alert_events', 'События капитала'],
  ['pro_entitlements', 'Доступ PRO'],
  ['pro_notifications', 'Уведомления PRO'],
  ['pro_notification_deliveries', 'Доставка уведомлений PRO'],
  ['referral_profiles', 'Реферальный профиль'],
  ['referrals', 'Приглашения'],
  ['ctrader_accounts', 'Подключения cTrader'],
  ['mt5_cloud_connections', 'Подключения MetaTrader'],
  ['voice_widget_devices', 'Голосовые устройства'],
  ['voice_widget_turns', 'История голосового виджета'],
  ['push_subscriptions', 'Устройства уведомлений'],
  ['reminder_deliveries', 'Доставка напоминаний'],
].map(([id, label, dated = false, editable = false]) => ({ id, label, dated, editable }));

export function monthBounds(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
  const [year, number] = month.split('-').map(Number);
  if (year < 1900 || year > 2200) throw new Error('Invalid year');
  return { from: `${month}-01`, to: `${month}-${new Date(year, number, 0).getDate()}` };
}
export function monthCells(month) {
  const { from, to } = monthBounds(month);
  const weekday = (new Date(`${from}T12:00:00`).getDay() + 6) % 7;
  const count = Number(to.slice(-2));
  return Array.from({ length: Math.ceil((weekday + count) / 7) * 7 }, (_, index) => {
    const day = index - weekday + 1;
    return day < 1 || day > count ? null : `${month}-${String(day).padStart(2, '0')}`;
  });
}
export function moveMonth(month, delta) {
  monthBounds(month);
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1 + delta, 1, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function calendarTotals(rows, dataset) {
  const totals = new Map();
  for (const row of rows || []) {
    if (row.dataset !== dataset) continue;
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;
    totals.set(row.currency, (totals.get(row.currency) || 0) + amount);
  }
  return [...totals].map(([currency, amount]) => ({ currency, amount }));
}
export function recordKey(dataset, row) { return String(dataset === 'trading_day_notes' ? row.date_key : row.id); }
export function editableFields(dataset, row) {
  if (dataset === 'trading_day_notes') return ['note'];
  if (dataset === 'wallet_transactions') return ['date_key', 'time', 'title', 'amount', 'kind', 'currency', 'comment'];
  if (dataset === 'trades') return String(row.platform).toLowerCase() === 'manual'
    ? ['date_key', 'time', 'instrument', 'direction', 'pnl', 'currency', 'comment'] : ['comment'];
  return [];
}
export function changesFor(dataset, original, input) {
  const changes = {};
  for (const key of editableFields(dataset, original)) {
    const value = ['pnl', 'amount'].includes(key) ? Number(input[key]) : input[key];
    if (['pnl', 'amount'].includes(key) && (input[key] === '' || !Number.isFinite(value) || (key === 'amount' && value < 0))) throw new Error('Укажите корректную сумму.');
    if (['pnl', 'amount'].includes(key) ? value !== Number(original[key]) : String(value ?? '') !== String(original[key] ?? '')) changes[key] = value;
  }
  return changes;
}
export function adminError(error) {
  if (error?.message?.includes('Imported financial data')) return 'Финансовые поля импортированной сделки доступны только для просмотра. Можно изменить комментарий.';
  if (error?.message?.includes('Capital settlement data')) return 'Запись связана с расчётом продажи капитала. Для сохранения связи можно изменить только комментарий.';
  if (error?.code === '42501') return 'Недостаточно прав. Доступ к данным и редактирование назначаются отдельно.';
  if (error?.code === '40001') return 'Запись уже изменилась. Закройте форму, обновите данные и откройте запись заново.';
  if (error?.code === 'P0002') return 'Пользователь или запись больше не доступны.';
  if (error?.code === '22023' || error?.code === '23514' || error?.code === '22007' || error?.code === '22P02') return 'Проверьте дату, сумму и остальные поля.';
  return 'Не удалось загрузить или сохранить данные. Проверьте подключение, права и миграции админки.';
}
