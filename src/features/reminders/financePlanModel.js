export function planDateKey(plan) {
  return String(plan?.local_at || '').slice(0, 10);
}

export function planTime(plan) {
  return String(plan?.local_at || '').match(/(?:T|\s)(\d{2}:\d{2})/)?.[1] || '09:00';
}

// Project only the remaining occurrences of an active server-side series.
export function projectPlansForDay(plans, dateKey) {
  const visible = plans.filter(plan => planDateKey(plan) === dateKey);
  const [year, month, day] = dateKey.split('-').map(Number);
  for (const plan of plans) {
    if (plan.status !== 'active' || plan.outcome !== 'planned' || !['weekly', 'monthly', 'yearly'].includes(plan.repeat_rule)) continue;
    const baseKey = planDateKey(plan);
    if (!baseKey || dateKey <= baseKey || (plan.repeat_until && dateKey > plan.repeat_until)) continue;
    const [baseYear, baseMonth, baseDay] = baseKey.split('-').map(Number);
    let distance;
    if (plan.repeat_rule === 'weekly') {
      const days = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(baseYear, baseMonth - 1, baseDay)) / 86400000);
      if (days % 7 !== 0) continue;
      distance = days / 7;
    } else if (plan.repeat_rule === 'monthly') {
      if (day !== Math.min(baseDay, new Date(Date.UTC(year, month, 0)).getUTCDate())) continue;
      distance = (year - baseYear) * 12 + month - baseMonth;
    } else {
      if (month !== baseMonth || day !== Math.min(baseDay, new Date(Date.UTC(year, month, 0)).getUTCDate())) continue;
      distance = year - baseYear;
    }
    const index = (Number(plan.repeat_index) || 1) + distance;
    if (plan.repeat_total != null && index > Number(plan.repeat_total)) continue;
    visible.push({ ...plan, id: `${plan.id}:${dateKey}`, local_at: `${dateKey} ${planTime(plan)}:00`, repeat_index: index, sourcePlan: plan, virtualOccurrence: true });
  }
  return visible.sort((a, b) => planTime(a).localeCompare(planTime(b)));
}

export async function loadFinancePlans(client, userId, pageSize = 500) {
  const plans = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('reminders')
      .select('id,title,amount,currency,kind,local_at,scheduled_at,status,outcome,resolved_at,repeat_rule,remind_offset,repeat_until,repeat_total,repeat_index,created_at')
      .eq('user_id', userId).order('local_at', { ascending: true }).order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    plans.push(...(data || []));
    if (!data || data.length < pageSize) return plans;
  }
}
