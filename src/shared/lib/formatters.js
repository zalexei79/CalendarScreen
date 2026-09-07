/**
 * Pure formatting and string normalization utilities for Money Calendar.
 */

// Safely normalize form/input values before string operations.
// Old or incomplete trade records must never be able to crash the whole screen.
export function textValue(value) {
  return value == null ? '' : String(value);
}

export function formatMoney(n) {
  const abs = Math.abs(n);
  const rounded = Math.round(abs * 100) / 100;
  const raw = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  const [intPart, decPart] = raw.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return decPart ? `${grouped}.${decPart}` : grouped;
}

export function formatSignedShort(n) {
  return `${n >= 0 ? '+' : '-'}$${formatMoney(n)}`;
}

export function formatMoneyShort(n) {
  const abs = Math.abs(n);
  const [divisor, suffix] = abs >= 1e9 ? [1e9, 'б'] : abs >= 1e6 ? [1e6, 'м'] : abs >= 1e3 ? [1e3, 'к'] : [1, ''];
  return String(Math.round(abs / divisor)) + suffix;
}

export function formatPnlDisplay(amount, currencySymbol = '$', displayMode = 'usd', depositSize = 0, short = false) {
  if (displayMode === 'percent' && depositSize > 0) {
    const pct = (amount / depositSize) * 100;
    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
  }
  return `${amount >= 0 ? '+' : '-'}${currencySymbol}${short ? formatMoneyShort(amount) : formatMoney(amount)}`;
}

export function getValidUserId(user) {
  const id = typeof user?.id === 'string' ? user.id.trim() : '';
  // Supabase public.user_id is UUID. Treat anything else (including the
  // literal string "undefined") as a guest session.
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id) ? id : null;
}
