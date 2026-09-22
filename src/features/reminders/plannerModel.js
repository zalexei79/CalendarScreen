export const REPEAT_RULES = ['none', 'monthly', 'weekly', 'yearly'];
export const REMIND_OFFSETS = ['at_time', '1_day', '3_days', '1_week'];
const OFFSET_MINUTES = { at_time: 0, '1_day': 1440, '3_days': 4320, '1_week': 10080 };

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function initialDraft(dateKey, plan, defaultCurrency) {
  return {
    title: plan?.title || '', amount: plan?.amount == null ? '' : String(plan.amount),
    kind: plan?.kind || 'expense', currency: plan?.currency || defaultCurrency || 'USD',
    dateKey, time: String(plan?.local_at || '').match(/(?:T|\s)(\d{2}:\d{2})/)?.[1] || '09:00',
    repeatRule: plan?.repeat_rule || 'none', remindOffset: plan?.remind_offset || 'at_time',
    repeatUntil: plan?.repeat_until || '', repeatTotal: plan?.repeat_total == null ? '' : String(plan.repeat_total),
  };
}

export function validateDraft(draft, now = new Date()) {
  if (!draft.title.trim()) return { field: 'title', step: 0, message: 'requiredTitle' };
  const amount = draft.amount.trim().replace(',', '.');
  if (amount && (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(amount) || !Number.isFinite(Number(amount)))) {
    return { field: 'amount', step: 0, message: 'invalidAmount' };
  }
  const event = new Date(`${draft.dateKey}T${draft.time}:00`);
  if (!/^\d{2}:\d{2}$/.test(draft.time) || !Number.isFinite(event.getTime()) || draft.dateKey <= localDateKey(now) || localDateKey(event) !== draft.dateKey) {
    return { field: 'dateKey', step: 1, message: 'future' };
  }
  if (draft.repeatRule !== 'none') {
    const count = Number(draft.repeatTotal);
    if (draft.repeatTotal !== '' && (!Number.isInteger(count) || count < 1 || count > 600)) {
      return { field: 'repeatTotal', step: 1, message: 'invalidCount' };
    }
    const until = new Date(`${draft.repeatUntil}T12:00:00`);
    if (draft.repeatUntil && (draft.repeatUntil < draft.dateKey || !Number.isFinite(until.getTime()) || localDateKey(until) !== draft.repeatUntil)) {
      return { field: 'repeatUntil', step: 1, message: 'invalidUntil' };
    }
  }
  return null;
}

export function planPayload(draft, id) {
  return {
    ...draft, id, title: draft.title.trim(), amount: draft.amount.trim().replace(',', '.'),
    repeatTotal: draft.repeatRule === 'none' ? null : draft.repeatTotal || null,
    repeatUntil: draft.repeatRule === 'none' ? null : draft.repeatUntil || null,
  };
}

// Use the same local-calendar subtraction as useFinancePlans, including DST.
export function reminderPreview(draft, now = new Date()) {
  const event = new Date(`${draft.dateKey}T${draft.time}:00`);
  const reminder = new Date(event);
  reminder.setMinutes(reminder.getMinutes() - (OFFSET_MINUTES[draft.remindOffset] || 0));
  const late = draft.remindOffset !== 'at_time' && reminder <= now;
  return { date: late ? event : reminder, late };
}
