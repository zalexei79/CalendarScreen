const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

// A week stays one parent throughout the zoom. Its seven children become the
// Monday-to-Sunday row of the live calendar, rather than seven other weeks.
export function lifeWeekHierarchy({ currentWeek, totalWeeks, rows, todayIndex, dayCount }) {
  const monthRows = Math.ceil(dayCount / 7);
  const startWeek = currentWeek - Math.floor(todayIndex / 7);
  const preferredRow = Math.max(0, Math.min(rows - monthRows, Math.floor(rows * .6)));
  const laneOffset = modulo(preferredRow - startWeek, rows);
  const position = week => ({ col: Math.floor((week + laneOffset) / rows), row: modulo(week + laneOffset, rows) });
  const weekAt = (col, row) => col * rows + row - laneOffset;
  const sourceWeeks = Array.from({ length: dayCount }, (_, index) => startWeek + Math.floor(index / 7));
  return {
    startWeek,
    sourceWeeks,
    selectedWeeks: new Set(sourceWeeks),
    laneOffset,
    columns: Math.max(1, Math.ceil((totalWeeks + laneOffset) / rows)),
    position,
    weekAt,
  };
}

const DAY = 86400000;
const WEEK = DAY * 7;

function calendarStamp(value) {
  let year, month, day;
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    year = value.getFullYear();
    month = value.getMonth() + 1;
    day = value.getDate();
  } else if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    [year, month, day] = value.split('-').map(Number);
  } else return null;
  const checked = new Date(0);
  checked.setUTCFullYear(year, month - 1, day);
  checked.setUTCHours(0, 0, 0, 0);
  if (checked.getUTCFullYear() !== year || checked.getUTCMonth() !== month - 1 || checked.getUTCDate() !== day) return null;
  return checked.getTime();
}

// Use date components with UTC arithmetic: local DST cannot shift a record
// into another week. Invalid input is not a usable temporal offset.
export function calendarWeekOffset(date, today = new Date()) {
  const stamp = calendarStamp(date);
  const reference = calendarStamp(today);
  if (stamp == null || reference == null) return null;
  const monday = value => value - modulo(new Date(value).getUTCDay() - 1, 7) * DAY;
  return (monday(stamp) - monday(reference)) / WEEK;
}
