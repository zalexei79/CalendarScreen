export function selectCalendarExport({ records, filteredRecords = [], scope, from, to }) {
  const entries = scope === 'all'
    ? Object.entries(records || {}).flatMap(([dateKey, items]) => (Array.isArray(items) ? items : []).map(item => ({ ...item, dateKey })))
    : filteredRecords;
  return entries.filter(item => item.dateKey >= from && item.dateKey <= to)
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey) || String(b.time || '').localeCompare(String(a.time || '')));
}

// Machine-readable dates, numeric amounts and ISO currency codes survive
// spreadsheet import without losing the year or mixing monetary units.
export function calendarExportRows(entries, { type, fallbackCategory }) {
  return entries.map(item => [item.dateKey, item.time || '', item.instrument || fallbackCategory,
    type(item), String(Number(item.pnl)), String(item.currency || 'USD').toUpperCase(), item.comment || '']);
}
